/**
 * ============================================================
 * ALMOXA PRO — Service_OCR.gs
 * Tabela principal: *
 * Fase de implementação real: Fase 7
 *
 * ESTADO: ESQUELETO. Funções existem e são chamáveis pela API
 * correspondente, mas retornam MODULE_NOT_IMPLEMENTED até a
 * fase entrar — nunca fingem dado real (regra: seção 70/59).
 * ============================================================
 */

const Service_OCR = (function () {

  function _pending(fn) {
    return Core_Response.error(
      CORE_CONSTANTS.RESPONSE_CODES.MODULE_NOT_IMPLEMENTED,
      'Service_OCR.' + fn + '() será implementado na Fase 7.'
    );
  }

  function extract(ctx) {
    return _pending('extract');
  }

  function nf(ctx) {
    return _pending('nf');
  }

  return {
    extract,
    nf
  };
})();
