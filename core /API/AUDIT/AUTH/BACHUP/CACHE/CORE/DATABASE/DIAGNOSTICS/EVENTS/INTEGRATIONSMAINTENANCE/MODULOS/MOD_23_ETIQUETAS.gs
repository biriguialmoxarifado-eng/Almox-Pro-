/**
 * ============================================================
 * ALMOXA PRO — MOD_23_ETIQUETAS.gs
 * Descritor de módulo (contrato: init/healthCheck/getRoutes/
 * getServices/getEvents/getVersion — seção 63).
 * Nome: Etiquetas
 * ============================================================
 */

const MOD_23_ETIQUETAS = (function () {

  function getRoutes() {
    return API_Etiquetas_getRoutes();
  }

  function init() {
    if (typeof API_Etiquetas_registerPermissions === 'function') API_Etiquetas_registerPermissions();
  }

  function healthCheck() {
    return { status: CORE_CONSTANTS.DOCTOR_STATUS.OK };
  }

  return {
    id: 'MOD_23_ETIQUETAS',
    name: 'Etiquetas',
    version: '1.2.0',
    status: CORE_CONSTANTS.MODULE_STATUS.ACTIVE,
    dependencies: ['MOD_06_ESTOQUE'],
    getRoutes: getRoutes,
    getServices: function () { return { Service_Etiqueta }; },
    getEvents: function () { return []; },
    getVersion: function () { return '1.2.0'; },
    init: init,
    healthCheck: healthCheck
  };
})();
