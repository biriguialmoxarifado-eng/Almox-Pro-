/**
 * ============================================================
 * ALMOXA PRO — MOD_20_OCORRENCIAS.gs
 * Descritor de módulo (contrato: init/healthCheck/getRoutes/
 * getServices/getEvents/getVersion — seção 63).
 * Nome: Ocorrências
 * ============================================================
 */

const MOD_20_OCORRENCIAS = (function () {

  function getRoutes() {
    return API_Ocorrencias_getRoutes();
  }

  function init() {
    if (typeof API_Ocorrencias_registerPermissions === 'function') API_Ocorrencias_registerPermissions();
  }

  function healthCheck() {
    return { status: CORE_CONSTANTS.DOCTOR_STATUS.OK };
  }

  return {
    id: 'MOD_20_OCORRENCIAS',
    name: 'Ocorrências',
    version: '1.1.0',
    status: CORE_CONSTANTS.MODULE_STATUS.ACTIVE,
    dependencies: ['MOD_17_OBRAS'],
    getRoutes: getRoutes,
    getServices: function () { return { Service_Ocorrencia }; },
    getEvents: function () { return [EVENT_TYPES.OCORRENCIA_CRIADA]; },
    getVersion: function () { return '1.1.0'; },
    init: init,
    healthCheck: healthCheck
  };
})();
