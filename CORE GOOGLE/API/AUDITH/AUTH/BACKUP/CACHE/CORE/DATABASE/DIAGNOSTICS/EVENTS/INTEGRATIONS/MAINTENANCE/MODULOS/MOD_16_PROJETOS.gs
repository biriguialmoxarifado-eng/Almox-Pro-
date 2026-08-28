/**
 * ============================================================
 * ALMOXA PRO — MOD_16_PROJETOS.gs
 * Descritor de módulo (contrato: init/healthCheck/getRoutes/
 * getServices/getEvents/getVersion — seção 63).
 * Nome: Projetos
 * ============================================================
 */

const MOD_16_PROJETOS = (function () {

  function getRoutes() {
    return API_Projetos_getRoutes();
  }

  function init() {
    if (typeof API_Projetos_registerPermissions === 'function') API_Projetos_registerPermissions();
  }

  function healthCheck() {
    return { status: CORE_CONSTANTS.DOCTOR_STATUS.OK };
  }

  return {
    id: 'MOD_16_PROJETOS',
    name: 'Projetos',
    version: '1.1.0',
    status: CORE_CONSTANTS.MODULE_STATUS.ACTIVE,
    dependencies: ['MOD_17_OBRAS'],
    getRoutes: getRoutes,
    getServices: function () { return { Service_Projeto }; },
    getEvents: function () { return []; },
    getVersion: function () { return '1.1.0'; },
    init: init,
    healthCheck: healthCheck
  };
})();
