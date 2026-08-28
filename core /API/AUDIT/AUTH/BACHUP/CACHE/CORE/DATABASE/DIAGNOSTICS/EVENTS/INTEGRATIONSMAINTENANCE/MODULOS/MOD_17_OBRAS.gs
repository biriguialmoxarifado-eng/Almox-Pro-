/**
 * ============================================================
 * ALMOXA PRO — MOD_17_OBRAS.gs
 * Descritor de módulo (contrato: init/healthCheck/getRoutes/
 * getServices/getEvents/getVersion — seção 63).
 * Nome: Obras
 * ============================================================
 */

const MOD_17_OBRAS = (function () {

  function getRoutes() {
    return API_Obras_getRoutes();
  }

  function init() {
    if (typeof API_Obras_registerPermissions === 'function') API_Obras_registerPermissions();
  }

  function healthCheck() {
    return { status: CORE_CONSTANTS.DOCTOR_STATUS.OK };
  }

  return {
    id: 'MOD_17_OBRAS',
    name: 'Obras',
    version: '1.1.0',
    status: CORE_CONSTANTS.MODULE_STATUS.ACTIVE,
    dependencies: [],
    getRoutes: getRoutes,
    getServices: function () { return { Service_Obra }; },
    getEvents: function () { return []; },
    getVersion: function () { return '1.1.0'; },
    init: init,
    healthCheck: healthCheck
  };
})();
