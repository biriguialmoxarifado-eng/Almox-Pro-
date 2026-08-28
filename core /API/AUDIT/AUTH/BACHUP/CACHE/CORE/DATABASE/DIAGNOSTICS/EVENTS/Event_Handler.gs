/**
 * ============================================================
 * ALMOXA PRO — Event_Handler.gs  (CAMADA 4)
 * Utilitário para módulos registrarem handlers de forma
 * padronizada, sempre com try/catch e log (contrato mínimo).
 * ============================================================
 */

const Event_Handler = (function () {

  function safe(moduleId, fn) {
    return function (payload, ctx) {
      try {
        fn(payload, ctx);
      } catch (e) {
        console.error('[Event_Handler] ' + moduleId + ' falhou: ' + e.message);
      }
    };
  }

  return { safe };
})();
