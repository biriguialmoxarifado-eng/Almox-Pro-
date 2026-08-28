/**
 * ============================================================
 * ALMOXA PRO — MOD_00_MIGRATION.gs
 * Descritor de módulo (contrato: init/healthCheck/getRoutes/
 * getServices/getEvents/getVersion — seção 63).
 * Nome: Migração
 * ============================================================
 */

const MOD_00_MIGRATION = (function () {

  function getRoutes() {
    return {}; // rotas entram quando a fase deste módulo for implementada
  }

  function init() {
    // nada a inicializar nesta fase
  }

  function healthCheck() {
    return { status: CORE_CONSTANTS.MODULE_STATUS.PENDING === 'ACTIVE' ? CORE_CONSTANTS.DOCTOR_STATUS.OK : CORE_CONSTANTS.DOCTOR_STATUS.NOT_CONFIGURED };
  }

  return {
    id: 'MOD_00_MIGRATION',
    name: 'Migração',
    version: '1.0.0',
    status: CORE_CONSTANTS.MODULE_STATUS.PENDING,
    dependencies: [],
    getRoutes: getRoutes,
    getServices: function () { return {}; },
    getEvents: function () { return []; },
    getVersion: function () { return '1.0.0'; },
    init: init,
    healthCheck: healthCheck
  };
})();
