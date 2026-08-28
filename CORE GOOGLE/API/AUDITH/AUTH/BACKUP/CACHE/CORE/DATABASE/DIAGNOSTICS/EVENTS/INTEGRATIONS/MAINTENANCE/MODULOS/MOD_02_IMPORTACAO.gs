/**
 * ============================================================
 * ALMOXA PRO — MOD_02_IMPORTACAO.gs
 * Descritor de módulo (contrato: init/healthCheck/getRoutes/
 * getServices/getEvents/getVersion — seção 63).
 * Nome: Importação
 * ============================================================
 */

const MOD_02_IMPORTACAO = (function () {

  function getRoutes() {
    return API_Importacao_getRoutes();
  }

  function init() {
    if (typeof API_Importacao_registerPermissions === 'function') API_Importacao_registerPermissions();
  }

  function healthCheck() {
    return { status: CORE_CONSTANTS.DOCTOR_STATUS.OK };
  }

  return {
    id: 'MOD_02_IMPORTACAO',
    name: 'Importação',
    version: '1.1.0',
    status: CORE_CONSTANTS.MODULE_STATUS.ACTIVE,
    dependencies: ['MOD_01_CORE'],
    getRoutes: getRoutes,
    getServices: function () { return { Service_Importacao }; },
    getEvents: function () { return []; },
    getVersion: function () { return '1.1.0'; },
    init: init,
    healthCheck: healthCheck
  };
})();
