/**
 * ============================================================
 * ALMOXA PRO — MOD_15_IA.gs
 * Descritor de módulo (contrato: init/healthCheck/getRoutes/
 * getServices/getEvents/getVersion — seção 63).
 * Nome: IA
 * ============================================================
 */

const MOD_15_IA = (function () {

  function getRoutes() {
    return API_IA_getRoutes();
  }

  function init() {
    if (typeof API_IA_registerPermissions === 'function') API_IA_registerPermissions();
  }

  function healthCheck() {
    return { status: CORE_CONSTANTS.DOCTOR_STATUS.OK };
  }

  return {
    id: 'MOD_15_IA',
    name: 'IA',
    version: '1.1.0',
    status: CORE_CONSTANTS.MODULE_STATUS.ACTIVE,
    dependencies: ['MOD_06_ESTOQUE'],
    getRoutes: getRoutes,
    getServices: function () { return { Service_IA }; },
    getEvents: function () { return []; },
    getVersion: function () { return '1.1.0'; },
    init: init,
    healthCheck: healthCheck
  };
})();
