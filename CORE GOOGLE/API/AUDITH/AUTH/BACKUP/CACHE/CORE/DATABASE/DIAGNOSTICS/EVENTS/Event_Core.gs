/**
 * ============================================================
 * ALMOXA PRO — Event_Core.gs  (CAMADA 4)
 * Ponto de bootstrap dos handlers padrão do sistema (ex: todo
 * ERRO_SISTEMA também dispara notificação — ligação feita aqui,
 * não dentro do módulo que gerou o erro).
 * ============================================================
 */

const Event_Core = (function () {

  function bootstrapDefaultHandlers() {
    Event_Bus.on(EVENT_TYPES.ERRO_SISTEMA, function (payload, ctx) {
      try { Audit_Service.record(ctx, 'ERRO_SISTEMA', payload); } catch (e) {}
    });
  }

  return { bootstrapDefaultHandlers };
})();
