/**
 * ============================================================
 * ALMOXA PRO — MOD_07_RESERVAS.gs
 * Descritor de módulo (contrato: init/healthCheck/getRoutes/
 * getServices/getEvents/getVersion — seção 63).
 * Nome: Reservas
 * ============================================================
 */

const MOD_07_RESERVAS = (function () {

  function getRoutes() {
    return API_Reservas_getRoutes();
  }

  function init() {
    if (typeof API_Reservas_registerPermissions === 'function') API_Reservas_registerPermissions();
  }

  function healthCheck() {
    return { status: CORE_CONSTANTS.DOCTOR_STATUS.OK };
  }

  return {
    id: 'MOD_07_RESERVAS',
    name: 'Reservas',
    version: '1.1.0',
    status: CORE_CONSTANTS.MODULE_STATUS.ACTIVE,
    dependencies: ['MOD_06_ESTOQUE'],
    getRoutes: getRoutes,
    getServices: function () { return { Service_Reserva }; },
    getEvents: function () { return [EVENT_TYPES.RESERVA_CRIADA, EVENT_TYPES.RESERVA_APROVADA, EVENT_TYPES.RESERVA_EXPIRADA]; },
    getVersion: function () { return '1.1.0'; },
    init: init,
    healthCheck: healthCheck
  };
})();
