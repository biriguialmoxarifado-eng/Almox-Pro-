/**
 * ============================================================
 * ALMOXA PRO — MOD_09_SAIDAS.gs
 * Descritor de módulo (contrato: init/healthCheck/getRoutes/
 * getServices/getEvents/getVersion — seção 63).
 * Nome: Saídas
 * ============================================================
 */

const MOD_09_SAIDAS = (function () {

  function getRoutes() {
    return API_Saidas_getRoutes();
  }

  function init() {
    if (typeof API_Saidas_registerPermissions === 'function') API_Saidas_registerPermissions();
  }

  function healthCheck() {
    return { status: CORE_CONSTANTS.DOCTOR_STATUS.OK };
  }

  return {
    id: 'MOD_09_SAIDAS',
    name: 'Saídas',
    version: '1.1.0',
    status: CORE_CONSTANTS.MODULE_STATUS.ACTIVE,
    dependencies: ['MOD_06_ESTOQUE', 'MOD_07_RESERVAS'],
    getRoutes: getRoutes,
    getServices: function () { return { Service_Saida }; },
    getEvents: function () { return []; },
    getVersion: function () { return '1.1.0'; },
    init: init,
    healthCheck: healthCheck
  };
})();
