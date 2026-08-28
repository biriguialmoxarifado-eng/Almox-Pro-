/**
 * ============================================================
 * ALMOXA PRO — Event_Bus.gs  (CAMADA 4)
 * Barramento de eventos. Reduz acoplamento entre módulos
 * (seção 42): quem dispara um evento não precisa saber quem
 * reage a ele.
 *
 * Limitação honesta: como cada execução do Apps Script é
 * isolada, handlers só reagem DENTRO da mesma execução onde o
 * evento foi emitido (não há fila persistente nesta fase). Todo
 * evento é gravado em EVENTOS_LOG para auditoria/replay manual.
 * ============================================================
 */

const Event_Bus = (function () {

  const _handlers = {};

  function on(eventType, handlerFn) {
    if (!_handlers[eventType]) _handlers[eventType] = [];
    _handlers[eventType].push(handlerFn);
  }

  function emit(eventType, payload, ctx) {
    if (!Object.values(EVENT_TYPES).includes(eventType)) {
      console.warn('[Event_Bus] Evento fora do catálogo EVENT_TYPES: ' + eventType);
    }

    try {
      DB_Insert.insert('EVENTOS_LOG', {
        tipo: eventType,
        payload: JSON.stringify(payload || {}),
        correlationId: ctx ? ctx.correlationId : null,
        data: new Date()
      });
    } catch (e) { /* best-effort — tabela pode não existir ainda nesta fase */ }

    (_handlers[eventType] || []).forEach(fn => {
      try { fn(payload, ctx); } catch (e) {
        console.error('[Event_Bus] Handler falhou para ' + eventType + ': ' + e.message);
      }
    });
  }

  return { on, emit };
})();
