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
    version: '1.2.0',
    status: CORE_CONSTANTS.MODULE_STATUS.ACTIVE,
    dependencies: ['MOD_06_ESTOQUE'],
    getRoutes: getRoutes,
    getServices: function () { return { Service_Reserva }; },
    getEvents: function () {
      // BLOCO 05 — corrigido: faltavam 7 eventos que o módulo já
      // emitia de verdade desde as entregas anteriores (o Doutor
      // consulta isso pra diagnóstico — uma lista incompleta aqui
      // faria parecer que o módulo faz menos do que faz).
      return [
        EVENT_TYPES.RESERVA_CRIADA, EVENT_TYPES.RESERVA_APROVACAO_SOLICITADA, EVENT_TYPES.RESERVA_APROVADA,
        EVENT_TYPES.RESERVA_REPROVADA, EVENT_TYPES.RESERVA_EXPIRANDO, EVENT_TYPES.RESERVA_EXPIRADA,
        EVENT_TYPES.RESERVA_SEPARACAO, EVENT_TYPES.RESERVA_PRONTA, EVENT_TYPES.RESERVA_ATENDIMENTO_PARCIAL,
        EVENT_TYPES.RESERVA_ENTREGUE, EVENT_TYPES.RESERVA_CONCLUIDA, EVENT_TYPES.RESERVA_CANCELADA
      ];
    },
    getVersion: function () { return '1.2.0'; },
    init: init,
    healthCheck: healthCheck
  };
})();
