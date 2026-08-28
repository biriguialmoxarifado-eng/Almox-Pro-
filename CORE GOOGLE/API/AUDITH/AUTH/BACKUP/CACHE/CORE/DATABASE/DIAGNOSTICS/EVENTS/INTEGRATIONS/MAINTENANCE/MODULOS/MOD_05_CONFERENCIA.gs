/**
 * ============================================================
 * ALMOXA PRO — MOD_05_CONFERENCIA.gs
 * Descritor de módulo (contrato: init/healthCheck/getRoutes/
 * getServices/getEvents/getVersion — seção 63).
 * Nome: Conferência
 * ============================================================
 */

const MOD_05_CONFERENCIA = (function () {

  function getRoutes() {
    return API_Conferencia_getRoutes();
  }

  function init() {
    if (typeof API_Conferencia_registerPermissions === 'function') API_Conferencia_registerPermissions();
    // Permissão fina extra: resolver (aprovar/reprovar) divergência
    // exige APPROVE, mesmo a rota conferencia.divergence sendo VIEW
    // por padrão (ela também serve pra simples listagem).
    Auth_RBAC.registerActionPermission('__divergencia_resolver__', 'CONFERENCIA.APPROVE');
  }

  function healthCheck() {
    return { status: CORE_CONSTANTS.DOCTOR_STATUS.OK };
  }

  return {
    id: 'MOD_05_CONFERENCIA',
    name: 'Conferência',
    version: '1.1.0',
    status: CORE_CONSTANTS.MODULE_STATUS.ACTIVE,
    dependencies: ['MOD_04_NOTA_FISCAL'],
    getRoutes: getRoutes,
    getServices: function () { return { Service_Conferencia }; },
    getEvents: function () { return [EVENT_TYPES.NF_CONFERIDA, EVENT_TYPES.NF_DIVERGENCIA]; },
    getVersion: function () { return '1.1.0'; },
    init: init,
    healthCheck: healthCheck
  };
})();
