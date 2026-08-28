/**
 * ============================================================
 * ALMOXA PRO — MOD_21_NOTIFICACOES.gs
 * Descritor de módulo (contrato: init/healthCheck/getRoutes/
 * getServices/getEvents/getVersion — seção 63).
 * Nome: Notificações
 * ============================================================
 */

const MOD_21_NOTIFICACOES = (function () {

  function getRoutes() {
    return API_Notificacoes_getRoutes();
  }

  function init() {
    if (typeof API_Notificacoes_registerPermissions === 'function') API_Notificacoes_registerPermissions();
    Notificacao_Events.bootstrap();
  }

  function healthCheck() {
    return { status: CORE_CONSTANTS.DOCTOR_STATUS.OK };
  }

  return {
    id: 'MOD_21_NOTIFICACOES',
    name: 'Notificações',
    version: '1.1.0',
    status: CORE_CONSTANTS.MODULE_STATUS.ACTIVE,
    dependencies: ['MOD_01_CORE'],
    getRoutes: getRoutes,
    getServices: function () { return { Service_Notificacao, Notificacao_Events }; },
    getEvents: function () { return []; },
    getVersion: function () { return '1.1.0'; },
    init: init,
    healthCheck: healthCheck
  };
})();
