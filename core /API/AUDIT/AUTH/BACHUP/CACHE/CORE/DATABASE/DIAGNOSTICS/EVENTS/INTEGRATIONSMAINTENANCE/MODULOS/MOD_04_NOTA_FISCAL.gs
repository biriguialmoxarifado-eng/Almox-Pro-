/**
 * ============================================================
 * ALMOXA PRO — MOD_04_NOTA_FISCAL.gs
 * Descritor de módulo (contrato: init/healthCheck/getRoutes/
 * getServices/getEvents/getVersion — seção 63).
 * Nome: Nota Fiscal
 * ============================================================
 */

const MOD_04_NOTA_FISCAL = (function () {

  function getRoutes() {
    return API_NF_getRoutes();
  }

  function init() {
    if (typeof API_NF_registerPermissions === 'function') API_NF_registerPermissions();
  }

  function healthCheck() {
    return {
      status: CORE_CONSTANTS.DOCTOR_STATUS.OK,
      detalhe: 'Entrada manual de NF ativa. importXML/processOCR/consultKey ainda pendentes de integração.'
    };
  }

  return {
    id: 'MOD_04_NOTA_FISCAL',
    name: 'Nota Fiscal',
    version: '1.1.0',
    status: CORE_CONSTANTS.MODULE_STATUS.ACTIVE,
    dependencies: ['MOD_03_CADASTROS'],
    getRoutes: getRoutes,
    getServices: function () { return { Service_NF }; },
    getEvents: function () { return [EVENT_TYPES.NF_RECEBIDA, EVENT_TYPES.NF_APROVADA]; },
    getVersion: function () { return '1.1.0'; },
    init: init,
    healthCheck: healthCheck
  };
})();
