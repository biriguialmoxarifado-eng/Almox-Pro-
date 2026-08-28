/**
 * ============================================================
 * ALMOXA PRO — MOD_11_EXPORTACAO.gs
 * Descritor de módulo (contrato: init/healthCheck/getRoutes/
 * getServices/getEvents/getVersion — seção 63).
 * Nome: Exportação
 * ============================================================
 */

const MOD_11_EXPORTACAO = (function () {

  function getRoutes() {
    return API_Exportacao_getRoutes();
  }

  function init() {
    if (typeof API_Exportacao_registerPermissions === 'function') API_Exportacao_registerPermissions();
  }

  function healthCheck() {
    return { status: CORE_CONSTANTS.DOCTOR_STATUS.OK };
  }

  return {
    id: 'MOD_11_EXPORTACAO',
    name: 'Exportação',
    version: '1.1.0',
    status: CORE_CONSTANTS.MODULE_STATUS.ACTIVE,
    dependencies: ['MOD_01_CORE'],
    getRoutes: getRoutes,
    getServices: function () { return { Service_Exportacao }; },
    getEvents: function () { return []; },
    getVersion: function () { return '1.1.0'; },
    init: init,
    healthCheck: healthCheck
  };
})();
