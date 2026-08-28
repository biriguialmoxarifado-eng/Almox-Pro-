/**
 * ============================================================
 * ALMOXA PRO — Gatilhos.gs
 * FASE 8 — verificações que dependem de TEMPO (não de evento),
 * então não cabem no Event_Bus (que só reage dentro da mesma
 * execução). Rode manualmente pelo editor OU instale como
 * trigger de tempo (Editor → Triggers → Adicionar trigger).
 *
 * Sugestão de frequência:
 *   Gatilho_VerificarEstoqueCritico   → a cada 6 horas
 *   Gatilho_VerificarReservasVencendo → a cada 1 hora
 * ============================================================
 */

function Gatilho_VerificarEstoqueCritico() {
  Core_API.bootstrap();
  const ctx = Core_Context.build({ action: 'sistema.gatilho', userId: 'sistema' });
  const total = Service_Notificacao.verificarEstoqueCritico(ctx);
  Logger.log('Gatilho estoque crítico: ' + total + ' item(ns) notificado(s).');
  return total;
}

function Gatilho_VerificarReservasVencendo() {
  Core_API.bootstrap();
  const total = Service_Notificacao.verificarReservasVencendo(6); // 6h de antecedência
  Logger.log('Gatilho reservas vencendo: ' + total + ' reserva(s) notificada(s).');
  return total;
}

/** Instala os dois triggers de tempo de uma vez (rodar manualmente uma vez). */
function setup_instalarGatilhosDeTempo() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (['Gatilho_VerificarEstoqueCritico', 'Gatilho_VerificarReservasVencendo'].includes(t.getHandlerFunction())) {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger('Gatilho_VerificarEstoqueCritico').timeBased().everyHours(6).create();
  ScriptApp.newTrigger('Gatilho_VerificarReservasVencendo').timeBased().everyHours(1).create();
  SpreadsheetApp.getUi().alert('Gatilhos instalados: estoque crítico a cada 6h, reservas vencendo a cada 1h.');
}
