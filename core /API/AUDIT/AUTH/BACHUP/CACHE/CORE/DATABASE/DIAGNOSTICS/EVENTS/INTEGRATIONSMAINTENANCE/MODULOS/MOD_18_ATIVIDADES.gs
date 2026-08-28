/**
 * ============================================================
 * ALMOXA PRO — MOD_18_ATIVIDADES.gs
 * Descritor de módulo (contrato: init/healthCheck/getRoutes/
 * getServices/getEvents/getVersion — seção 63).
 * Nome: Atividades
 * ============================================================
 */

const MOD_18_ATIVIDADES = (function () {

  function getRoutes() {
    return API_Atividades_getRoutes();
  }

  function init() {
    if (typeof API_Atividades_registerPermissions === 'function') API_Atividades_registerPermissions();
  }

  function healthCheck() {
    return { status: CORE_CONSTANTS.DOCTOR_STATUS.OK };
  }

  return {
    id: 'MOD_18_ATIVIDADES',
    name: 'Atividades',
    version: '1.1.0',
    status: CORE_CONSTANTS.MODULE_STATUS.ACTIVE,
    dependencies: ['MOD_17_OBRAS'],
    getRoutes: getRoutes,
    getServices: function () { return { Service_Atividade }; },
    getEvents: function () { return []; },
    getVersion: function () { return '1.1.0'; },
    init: init,
    healthCheck: healthCheck
  };
})();
