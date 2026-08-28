/**
 * ============================================================
 * ALMOXA PRO — Integration_ExternalAPI.gs
 * Adapter genérico para QUALQUER API externa futura ainda não
 * prevista nominalmente na spec — centraliza UrlFetchApp com
 * timeout, log e tratamento de erro padronizado, para que
 * nenhum módulo chame UrlFetchApp diretamente (seção 1).
 * ============================================================
 */
const Integration_ExternalAPI = (function () {
  function call(url, options) {
    const opts = Object.assign({ muteHttpExceptions: true }, options || {});
    const started = new Date();
    try {
      const response = UrlFetchApp.fetch(url, opts);
      return {
        status: response.getResponseCode(),
        body: response.getContentText(),
        durationMs: new Date() - started
      };
    } catch (e) {
      throw Object.assign(new Error('Falha ao chamar API externa: ' + e.message), {
        code: CORE_CONSTANTS.RESPONSE_CODES.EXTERNAL_INTEGRATION_NOT_CONFIGURED
      });
    }
  }
  return { call };
})();
