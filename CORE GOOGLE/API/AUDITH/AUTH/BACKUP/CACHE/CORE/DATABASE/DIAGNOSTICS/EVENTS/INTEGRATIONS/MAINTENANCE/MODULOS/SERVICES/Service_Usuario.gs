/**
 * ============================================================
 * ALMOXA PRO — Service_Usuario.gs
 * Tabela principal: USUARIOS
 * Fase de implementação real: Fase 4
 *
 * ESTADO: ESQUELETO. Funções existem e são chamáveis pela API
 * correspondente, mas retornam MODULE_NOT_IMPLEMENTED até a
 * fase entrar — nunca fingem dado real (regra: seção 70/59).
 * ============================================================
 */

const Service_Usuario = (function () {

  function _pending(fn) {
    return Core_Response.error(
      CORE_CONSTANTS.RESPONSE_CODES.MODULE_NOT_IMPLEMENTED,
      'Service_Usuario.' + fn + '() será implementado na Fase 4.'
    );
  }

  function get(ctx) {
    return _pending('get');
  }

  function search(ctx) {
    return _pending('search');
  }

  function create(ctx) {
    return _pending('create');
  }

  function update(ctx) {
    return _pending('update');
  }

  return {
    get,
    search,
    create,
    update
  };
})();
