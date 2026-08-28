/**
 * ============================================================
 * ALMOXA PRO — MOD_06_ESTOQUE.gs
 * Descritor de módulo (contrato: init/healthCheck/getRoutes/
 * getServices/getEvents/getVersion — seção 63).
 * Nome: Estoque
 * ============================================================
 */

const MOD_06_ESTOQUE = (function () {

  function getRoutes() {
    return API_Estoque_getRoutes();
  }

  function init() {
    if (typeof API_Estoque_registerPermissions === 'function') API_Estoque_registerPermissions();
  }

  function healthCheck() {
    return { status: CORE_CONSTANTS.DOCTOR_STATUS.OK };
  }

  return {
    id: 'MOD_06_ESTOQUE',
    name: 'Estoque',
    version: '1.1.0',
    status: CORE_CONSTANTS.MODULE_STATUS.ACTIVE,
    dependencies: ['MOD_05_CONFERENCIA'],
    getRoutes: getRoutes,
    getServices: function () { return { Service_Estoque }; },
    getEvents: function () { return [EVENT_TYPES.ESTOQUE_ENTRADA, EVENT_TYPES.ESTOQUE_SAIDA]; },
    getVersion: function () { return '1.1.0'; },
    init: init,
    healthCheck: healthCheck
  };
})();
