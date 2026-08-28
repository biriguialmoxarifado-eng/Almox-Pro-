/**
 * ============================================================
 * ALMOXA PRO — Audit_Events.gs  (CAMADA 4)
 * Liga eventos do Event_Bus a registros de auditoria, para que
 * módulos de negócio não precisem chamar Audit_Service toda vez
 * que emitem um evento de domínio.
 * ============================================================
 */

const Audit_Events = (function () {

  function bootstrap() {
    Object.values(EVENT_TYPES).forEach(eventType => {
      Event_Bus.on(eventType, Event_Handler.safe('Audit_Events', function (payload, ctx) {
        Audit_Service.record(ctx, eventType, payload);
      }));
    });
  }

  return { bootstrap };
})();
