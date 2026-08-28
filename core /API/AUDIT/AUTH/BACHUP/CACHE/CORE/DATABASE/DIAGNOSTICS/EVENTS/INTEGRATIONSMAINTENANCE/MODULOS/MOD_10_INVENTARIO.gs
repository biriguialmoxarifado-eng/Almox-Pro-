/**
 * ============================================================
 * ALMOXA PRO — MOD_10_INVENTARIO.gs
 * Descritor de módulo (contrato: init/healthCheck/getRoutes/
 * getServices/getEvents/getVersion — seção 63).
 * Nome: Inventário
 * ============================================================
 */

const MOD_10_INVENTARIO = (function () {

  function getRoutes() {
    return API_Inventario_getRoutes();
  }

  function init() {
    if (typeof API_Inventario_registerPermissions === 'function') API_Inventario_registerPermissions();
  }

  function healthCheck() {
    return { status: CORE_CONSTANTS.DOCTOR_STATUS.OK };
  }

  return {
    id: 'MOD_10_INVENTARIO',
    name: 'Inventário',
    version: '1.1.0',
    status: CORE_CONSTANTS.MODULE_STATUS.ACTIVE,
    dependencies: ['MOD_06_ESTOQUE'],
    getRoutes: getRoutes,
    getServices: function () { return { Service_Inventario }; },
    getEvents: function () { return [EVENT_TYPES.INVENTARIO_ABERTO, EVENT_TYPES.INVENTARIO_FINALIZADO]; },
    getVersion: function () { return '1.1.0'; },
    init: init,
    healthCheck: healthCheck
  };
})();
