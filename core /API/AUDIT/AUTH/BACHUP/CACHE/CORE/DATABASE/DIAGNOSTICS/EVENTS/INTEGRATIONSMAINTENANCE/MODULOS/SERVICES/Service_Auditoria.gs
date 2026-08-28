/**
 * ============================================================
 * ALMOXA PRO — Service_Auditoria.gs
 * Tabela principal: AUDITORIA
 * Fase de implementação real: Fase 6
 *
 * ESTADO: ESQUELETO. Funções existem e são chamáveis pela API
 * correspondente, mas retornam MODULE_NOT_IMPLEMENTED até a
 * fase entrar — nunca fingem dado real (regra: seção 70/59).
 * ============================================================
 */

const Service_Auditoria = (function () {

  function _pending(fn) {
    return Core_Response.error(
      CORE_CONSTANTS.RESPONSE_CODES.MODULE_NOT_IMPLEMENTED,
      'Service_Auditoria.' + fn + '() será implementado na Fase 6.'
    );
  }

  function search(ctx) {
    return _pending('search');
  }

  function get(ctx) {
    return _pending('get');
  }

  return {
    search,
    get
  };
})();
