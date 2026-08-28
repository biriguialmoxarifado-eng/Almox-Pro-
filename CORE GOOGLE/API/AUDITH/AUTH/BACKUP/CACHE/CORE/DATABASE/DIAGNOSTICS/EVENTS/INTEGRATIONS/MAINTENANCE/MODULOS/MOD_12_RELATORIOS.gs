/**
 * ============================================================
 * ALMOXA PRO — MOD_12_RELATORIOS.gs
 * Descritor de módulo (contrato: init/healthCheck/getRoutes/
 * getServices/getEvents/getVersion — seção 63).
 * Nome: Relatórios
 * ============================================================
 */

const MOD_12_RELATORIOS = (function () {

  function getRoutes() {
    return API_Relatorios_getRoutes();
  }

  function init() {
    if (typeof API_Relatorios_registerPermissions === 'function') API_Relatorios_registerPermissions();
  }

  function healthCheck() {
    return { status: CORE_CONSTANTS.DOCTOR_STATUS.OK };
  }

  return {
    id: 'MOD_12_RELATORIOS',
    name: 'Relatórios',
    version: '1.1.0',
    status: CORE_CONSTANTS.MODULE_STATUS.ACTIVE,
    dependencies: ['MOD_06_ESTOQUE'],
    getRoutes: getRoutes,
    getServices: function () { return { Service_Relatorio }; },
    getEvents: function () { return []; },
    getVersion: function () { return '1.1.0'; },
    init: init,
    healthCheck: healthCheck
  };
})();
