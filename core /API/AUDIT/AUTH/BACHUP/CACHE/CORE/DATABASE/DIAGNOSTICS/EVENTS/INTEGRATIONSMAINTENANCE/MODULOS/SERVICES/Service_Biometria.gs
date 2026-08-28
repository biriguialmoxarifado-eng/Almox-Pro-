/**
 * ============================================================
 * ALMOXA PRO — Service_Biometria.gs
 * Tabela principal: BIOMETRIA
 * Fase de implementação real: Fase 17
 *
 * ESTADO: ESQUELETO. Funções existem e são chamáveis pela API
 * correspondente, mas retornam MODULE_NOT_IMPLEMENTED até a
 * fase entrar — nunca fingem dado real (regra: seção 70/59).
 * ============================================================
 */

const Service_Biometria = (function () {

  function _pending(fn) {
    return Core_Response.error(
      CORE_CONSTANTS.RESPONSE_CODES.MODULE_NOT_IMPLEMENTED,
      'Service_Biometria.' + fn + '() será implementado na Fase 17.'
    );
  }

  function register(ctx) {
    return _pending('register');
  }

  function verify(ctx) {
    return _pending('verify');
  }

  function identify(ctx) {
    return _pending('identify');
  }

  function status(ctx) {
    return _pending('status');
  }

  return {
    register,
    verify,
    identify,
    status
  };
})();
