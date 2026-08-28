/**
 * ============================================================
 * ALMOXA PRO — MOD_24_SAP.gs
 * Descritor de módulo (contrato: init/healthCheck/getRoutes/
 * getServices/getEvents/getVersion — seção 63).
 * Nome: SAP
 * ============================================================
 */

const MOD_24_SAP = (function () {

  function getRoutes() {
    return API_SAP_getRoutes();
  }

  function init() {
    if (typeof API_SAP_registerPermissions === 'function') API_SAP_registerPermissions();
  }

  function healthCheck() {
    return Integration_SAP.healthCheck();
  }

  return {
    id: 'MOD_24_SAP',
    name: 'SAP',
    version: '1.1.0',
    status: CORE_CONSTANTS.MODULE_STATUS.ACTIVE,
    dependencies: ['MOD_03_CADASTROS'],
    getRoutes: getRoutes,
    getServices: function () { return { Service_SAP }; },
    getEvents: function () { return []; },
    getVersion: function () { return '1.1.0'; },
    init: init,
    healthCheck: healthCheck
  };
})();
