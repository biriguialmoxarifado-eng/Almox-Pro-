/**
 * ============================================================
 * ALMOXA PRO — Core_Router.gs  (CAMADA 5)
 * Todo request passa por aqui. Ordem fixa (seção 10 — permissão
 * verificada no Router, não só confiar no módulo):
 *
 * 1. construir contexto (Core_Context)
 * 2. validar sessão (Auth_Session)
 * 3. validar permissão (Auth_RBAC)
 * 4. localizar rota (Core_Registry)
 * 4b. módulo dono da rota está disponível?
 * 5. executar handler
 * 5b. resposta do handler tem formato válido?
 * 6. registrar auditoria (Audit_Service)
 * 7. registrar observabilidade (Utils_Log)
 * 8. devolver Core_Response padronizado, enriquecido (module/action/error aninhado)
 *
 * INTEGRAÇÃO 01 — dois gaps reais encontrados e corrigidos:
 *
 * (a) "Módulo indisponível" nunca era checado de verdade. Um
 * módulo com `status: DISABLED` (ou que falhasse durante
 * `init()`, virando `ERROR`) continuava com suas rotas 100%
 * executáveis — `Core_Registry.registerModule()` absorve rotas
 * incondicionalmente, e nada consultava o status do módulo dono
 * antes de rodar o handler. `RESPONSE_CODES.MODULE_DISABLED` já
 * existia reservado no enum, nunca usado em lugar nenhum — a
 * peça estava pronta, só faltava a checagem.
 *
 * (b) "Resposta inválida" nunca era validada. Se um handler
 * (por bug futuro) retornasse `undefined` ou um objeto sem o
 * formato `Core_Response`, o Router devolvia isso direto pro
 * chamador — um contrato quebrado silenciosamente. Agora o
 * Router confere o formato antes de devolver.
 *
 * BLOCO 03 (contrato "API Interna + Comunicação Central") —
 * seção 3 pede um formato de resposta com `module`/`action`
 * ecoados e `error` como OBJETO ANINHADO ({code, message,
 * details}), não só campos soltos. `Core_Context.build()` já
 * capturava `module`/`action` desde a Fase 1 — só nunca eram
 * devolvidos na resposta final. Em vez de mudar a assinatura de
 * `Core_Response.ok/error` (chamada em ~200 lugares em todo o
 * sistema — mudar a assinatura ali seria o tipo exato de risco
 * que a seção 2 do contrato proíbe: "não duplicar/quebrar
 * serviços"), o enriquecimento acontece AQUI, no único ponto por
 * onde toda resposta já passava antes de sair. Aditivo puro:
 * quem já lê `.success`/`.code`/`.message`/`.data` continua
 * encontrando exatamente os mesmos campos, no mesmo lugar.
 * ============================================================
 */

const Core_Router = (function () {

  function _respostaValida(result) {
    return !!result && typeof result === 'object' && typeof result.success === 'boolean';
  }

  /** Deriva o "módulo" a partir do prefixo da action (ex: 'estoque.get' → 'estoque') — nenhum Front precisou mudar pra enviar um campo `module` que nunca enviava antes. */
  function _moduloDaAcao(action) {
    return action && action.indexOf('.') > -1 ? action.split('.')[0] : (action || null);
  }

  function _enriquecerResposta(response, request) {
    if (!response || typeof response !== 'object') return response;
    response.module = request.module || _moduloDaAcao(request.action);
    response.action = request.action || null;
    if (response.success === false && !response.error) {
      // Formato aninhado que o Bloco 03 pede — SEM remover os
      // campos soltos (code/message/details) que todo o sistema
      // já lê há dezenas de fases.
      response.error = { code: response.code, message: response.message, details: response.details || {} };
    }
    return response;
  }

  function dispatch(request) {
    const ctx = Core_Context.build(request);

    try {
      if (Core_Config.isMaintenance() && request.module !== 'manutencao' && request.module !== 'doctor') {
        return _finish(ctx, request, Core_Response.error(
          'MAINTENANCE_MODE', 'Sistema em modo manutenção.', {}, ctx.requestId
        ));
      }

      // ---- 2. Sessão (rotas públicas ficam isentas — ver Core_Registry.isPublicRoute) ----
      const isPublicRoute = Core_Registry.isPublicRoute(request.action);
      let session = null;
      if (!isPublicRoute) {
        const sessionResult = Auth_Session.validate(request.sessionId);
        if (!sessionResult.success) {
          return _finish(ctx, request, Core_Response.error(
            CORE_CONSTANTS.RESPONSE_CODES.SESSION_EXPIRED, sessionResult.message, {}, ctx.requestId
          ));
        }
        session = sessionResult.data;
        ctx.userId = session.userId;
        ctx.perfil = session.perfil;
      }

      // ---- 3. Rota existe? ----
      const route = Core_Registry.getRoute(request.action);
      if (!route) {
        return _finish(ctx, request, Core_Response.error(
          CORE_CONSTANTS.RESPONSE_CODES.ROUTE_NOT_FOUND,
          'Ação não encontrada: ' + request.action, {}, ctx.requestId
        ));
      }

      // ---- 3a. Módulo dono da rota está disponível? (Integração 01, item "a") ----
      const moduloDaRota = Core_Registry.getModule(route.moduleId);
      if (moduloDaRota && (moduloDaRota.status === CORE_CONSTANTS.MODULE_STATUS.DISABLED || moduloDaRota.status === CORE_CONSTANTS.MODULE_STATUS.ERROR)) {
        return _finish(ctx, request, Core_Response.error(
          CORE_CONSTANTS.RESPONSE_CODES.MODULE_DISABLED,
          'Módulo indisponível no momento: ' + moduloDaRota.id, {}, ctx.requestId
        ));
      }

      // ---- 3b. Permissão (RBAC) ----
      if (!isPublicRoute) {
        const permCheck = Auth_RBAC.can(session.perfil, request.action);
        if (!permCheck) {
          Audit_Service.record(ctx, 'ACCESS_DENIED', { action: request.action });
          return _finish(ctx, request, Core_Response.error(
            CORE_CONSTANTS.RESPONSE_CODES.PERMISSION_DENIED,
            'Sem permissão para executar: ' + request.action, {}, ctx.requestId
          ));
        }
      }

      // ---- 5. Executa ----
      const result = route.handler(ctx);

      // ---- 5b. Resposta tem o formato Core_Response? (Integração 01, item "b") ----
      if (!_respostaValida(result)) {
        try { Audit_Service.record(ctx, 'RESPOSTA_INVALIDA', { action: request.action }); } catch (e) {}
        return _finish(ctx, request, Core_Response.error(
          CORE_CONSTANTS.RESPONSE_CODES.INTERNAL_ERROR,
          'O módulo respondeu num formato inválido — contrato Core_Response não foi respeitado.', {}, ctx.requestId
        ));
      }

      // ---- 6. Auditoria (best-effort, não derruba a resposta) ----
      try { Audit_Service.record(ctx, 'ACTION_EXECUTED', { action: request.action }); } catch (e) {}

      return _finish(ctx, request, result);

    } catch (e) {
      Core_Context.finalize(ctx, 'ERROR', { message: e.message, stack: e.stack });
      Utils_Log.record(ctx);
      try { Audit_Service.record(ctx, 'ROUTE_ERROR', { error: e.message }); } catch (e2) {}
      return _enriquecerResposta(Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.INTERNAL_ERROR, e.message, {}, ctx.requestId), request);
    }
  }

  function _finish(ctx, request, response) {
    Core_Context.finalize(ctx, response.success ? 'SUCCESS' : 'ERROR');
    Utils_Log.record(ctx);
    return _enriquecerResposta(response, request);
  }

  return { dispatch };
})();
