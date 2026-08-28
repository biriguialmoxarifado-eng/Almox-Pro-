/**
 * ============================================================
 * ALMOXA PRO — MOD_25_CONFIGURACOES.gs
 * Descritor de módulo (contrato: init/healthCheck/getRoutes/
 * getServices/getEvents/getVersion — seção 63).
 * Nome: Configurações
 * ============================================================
 */

const MOD_25_CONFIGURACOES = (function () {

  function getRoutes() {
    return API_Configuracoes_getRoutes();
  }

  function init() {
    if (typeof API_Configuracoes_registerPermissions === 'function') API_Configuracoes_registerPermissions();
  }

  function healthCheck() {
    return { status: CORE_CONSTANTS.DOCTOR_STATUS.OK };
  }

  return {
    id: 'MOD_25_CONFIGURACOES',
    name: 'Configurações',
    version: '1.1.0',
    status: CORE_CONSTANTS.MODULE_STATUS.ACTIVE,
    dependencies: ['MOD_01_CORE'],
    getRoutes: getRoutes,
    getServices: function () { return { Service_Config }; },
    getEvents: function () { return []; },
    getVersion: function () { return '1.1.0'; },
    init: init,
    healthCheck: healthCheck
  };
})();
