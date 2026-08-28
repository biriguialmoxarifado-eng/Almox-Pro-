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
 * 5. executar handler
 * 6. registrar auditoria (Audit_Service)
 * 7. registrar observabilidade (Utils_Log)
 * 8. devolver Core_Response padronizado
 * ============================================================
 */

const Core_Router = (function () {

  function dispatch(request) {
    const ctx = Core_Context.build(request);

    try {
      if (Core_Config.isMaintenance() && request.module !== 'manutencao' && request.module !== 'doctor') {
        return _finish(ctx, Core_Response.error(
          'MAINTENANCE_MODE', 'Sistema em modo manutenção.', {}, ctx.requestId
        ));
      }

      // ---- 2. Sessão (rotas de auth.login/auth.session ficam isentas) ----
      const isPublicRoute = request.action === 'auth.login';
      let session = null;
      if (!isPublicRoute) {
        const sessionResult = Auth_Session.validate(request.sessionId);
        if (!sessionResult.success) {
          return _finish(ctx, Core_Response.error(
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
        return _finish(ctx, Core_Response.error(
          CORE_CONSTANTS.RESPONSE_CODES.ROUTE_NOT_FOUND,
          'Ação não encontrada: ' + request.action, {}, ctx.requestId
        ));
      }

      // ---- 3b. Permissão (RBAC) ----
      if (!isPublicRoute) {
        const permCheck = Auth_RBAC.can(session.perfil, request.action);
        if (!permCheck) {
          Audit_Service.record(ctx, 'ACCESS_DENIED', { action: request.action });
          return _finish(ctx, Core_Response.error(
            CORE_CONSTANTS.RESPONSE_CODES.PERMISSION_DENIED,
            'Sem permissão para executar: ' + request.action, {}, ctx.requestId
          ));
        }
      }

      // ---- 5. Executa ----
      const result = route.handler(ctx);

      // ---- 6. Auditoria (best-effort, não derruba a resposta) ----
      try { Audit_Service.record(ctx, 'ACTION_EXECUTED', { action: request.action }); } catch (e) {}

      Core_Context.finalize(ctx, 'SUCCESS');
      Utils_Log.record(ctx);

      return result;

    } catch (e) {
      Core_Context.finalize(ctx, 'ERROR', { message: e.message, stack: e.stack });
      Utils_Log.record(ctx);
      try { Audit_Service.record(ctx, 'ROUTE_ERROR', { error: e.message }); } catch (e2) {}
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.INTERNAL_ERROR, e.message, {}, ctx.requestId);
    }
  }

  function _finish(ctx, response) {
    Core_Context.finalize(ctx, response.success ? 'SUCCESS' : 'ERROR');
    Utils_Log.record(ctx);
    return response;
  }

  return { dispatch };
})();
