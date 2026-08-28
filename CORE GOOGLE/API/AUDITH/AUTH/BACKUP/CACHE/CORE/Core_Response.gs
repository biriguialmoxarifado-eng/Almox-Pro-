/**
 * ============================================================
 * ALMOXA PRO — Core_Response.gs  (CAMADA 5)
 * ÚNICO padrão de resposta do sistema (seção 52). Nenhum
 * módulo cria formato de resposta próprio.
 * ============================================================
 */

const Core_Response = (function () {

  function ok(data, message, code, meta, requestId) {
    return {
      success: true,
      code: code || CORE_CONSTANTS.RESPONSE_CODES.SUCCESS,
      message: message || '',
      data: data === undefined ? null : data,
      meta: meta || {},
      requestId: requestId || Utilities.getUuid(),
      timestamp: new Date().toISOString()
    };
  }

  function error(code, message, details, requestId) {
    return {
      success: false,
      code: code || CORE_CONSTANTS.RESPONSE_CODES.INTERNAL_ERROR,
      message: message || '',
      details: details || {},
      requestId: requestId || Utilities.getUuid(),
      timestamp: new Date().toISOString()
    };
  }

  return { ok, error };
})();
