/**
 * ============================================================
 * ALMOXA PRO — MOD_19_EQUIPE.gs
 * Descritor de módulo (contrato: init/healthCheck/getRoutes/
 * getServices/getEvents/getVersion — seção 63).
 * Nome: Equipe
 * ============================================================
 */

const MOD_19_EQUIPE = (function () {

  function getRoutes() {
    return API_Equipe_getRoutes();
  }

  function init() {
    if (typeof API_Equipe_registerPermissions === 'function') API_Equipe_registerPermissions();
  }

  function healthCheck() {
    return { status: CORE_CONSTANTS.DOCTOR_STATUS.OK };
  }

  return {
    id: 'MOD_19_EQUIPE',
    name: 'Equipe',
    version: '1.1.0',
    status: CORE_CONSTANTS.MODULE_STATUS.ACTIVE,
    dependencies: ['MOD_17_OBRAS'],
    getRoutes: getRoutes,
    getServices: function () { return { Service_Equipe }; },
    getEvents: function () { return []; },
    getVersion: function () { return '1.1.0'; },
    init: init,
    healthCheck: healthCheck
  };
})();
