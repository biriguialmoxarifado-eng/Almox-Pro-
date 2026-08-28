/**
 * ============================================================
 * ALMOXA PRO — MOD_03_CADASTROS.gs
 * Descritor de módulo (contrato: init/healthCheck/getRoutes/
 * getServices/getEvents/getVersion — seção 63).
 * Nome: Cadastros
 * ============================================================
 */

const MOD_03_CADASTROS = (function () {

  function getRoutes() {
    return API_Cadastros_getRoutes();
  }

  function init() {
    if (typeof API_Cadastros_registerPermissions === 'function') API_Cadastros_registerPermissions();
  }

  function healthCheck() {
    return { status: CORE_CONSTANTS.DOCTOR_STATUS.OK };
  }

  return {
    id: 'MOD_03_CADASTROS',
    name: 'Cadastros',
    version: '1.1.0',
    status: CORE_CONSTANTS.MODULE_STATUS.ACTIVE,
    dependencies: ['MOD_01_CORE'],
    getRoutes: getRoutes,
    getServices: function () { return { Service_Produto, Service_Fornecedor }; },
    getEvents: function () { return []; },
    getVersion: function () { return '1.1.0'; },
    init: init,
    healthCheck: healthCheck
  };
})();
