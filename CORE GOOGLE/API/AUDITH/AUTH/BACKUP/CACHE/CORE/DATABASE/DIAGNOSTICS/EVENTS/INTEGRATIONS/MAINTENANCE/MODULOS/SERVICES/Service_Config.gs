/**
 * ============================================================
 * ALMOXA PRO — Service_Config.gs
 * FASE 12 — IMPLEMENTADO DE VERDADE.
 * Só ADMIN edita (permissão CONFIG já registrada desde a Fase 1
 * via API_Configuracoes_registerPermissions). Chaves sensíveis
 * (API keys) vêm mascaradas na leitura.
 * ============================================================
 */

const Service_Config = (function () {

  const CHAVES_SENSIVEIS = ['OCR_API_KEY'];

  function get(ctx) {
    const todas = Core_Config.getAll();
    const filtro = ctx.payload && ctx.payload.chave;

    if (filtro) {
      if (!(filtro in todas)) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Configuração não encontrada: ' + filtro, {}, ctx.requestId);
      const valor = CHAVES_SENSIVEIS.includes(filtro) ? Utils_Security.maskSensitive(todas[filtro]) : todas[filtro];
      return Core_Response.ok({ chave: filtro, valor }, '', 'SUCCESS', {}, ctx.requestId);
    }

    const saida = {};
    Object.keys(todas).forEach(chave => {
      saida[chave] = CHAVES_SENSIVEIS.includes(chave) ? Utils_Security.maskSensitive(String(todas[chave] || '')) : todas[chave];
    });
    return Core_Response.ok(saida, '', 'SUCCESS', {}, ctx.requestId);
  }

  function update(ctx) {
    const { chave, valor } = ctx.payload || {};
    if (!chave) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'chave é obrigatória.', {}, ctx.requestId);

    if (chave === 'SPREADSHEET_ID') {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'SPREADSHEET_ID não pode ser alterado por aqui — é definido automaticamente pelo setup_instalar().', {}, ctx.requestId);
    }

    const valorAnterior = Core_Config.get(chave);
    Core_Config.set(chave, valor);
    Audit_Service.record(ctx, 'CONFIG_ALTERADA', { entidade: 'CONFIGURACOES', entidadeId: chave },
      { valor: CHAVES_SENSIVEIS.includes(chave) ? Utils_Security.maskSensitive(String(valorAnterior || '')) : valorAnterior },
      { valor: CHAVES_SENSIVEIS.includes(chave) ? Utils_Security.maskSensitive(String(valor || '')) : valor }
    );

    return Core_Response.ok({ chave, valor: Core_Config.get(chave) }, 'Configuração atualizada.', 'SUCCESS', {}, ctx.requestId);
  }

  return { get, update };
})();
