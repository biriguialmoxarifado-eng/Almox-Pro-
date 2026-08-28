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
 *   Gatilho_VerificarNiveisEstoque    → 1x por dia (Módulo 02)
 *   Gatilho_GerarInventarioD1         → 1x por dia, fim do expediente (Módulo 04)
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

/**
 * MÓDULO 02 — gatilho de pré-compra. Diferente do
 * `Gatilho_VerificarEstoqueCritico` (que já existia e continua
 * intocado: ele notifica GESTOR/ADMIN quando saldo <= mínimo,
 * ou seja, quando já está VERMELHO), este verifica a
 * classificação completa (verde/amarelo/vermelho com o fator de
 * alerta configurável) e emite `ESTOQUE_AMARELO_IDENTIFICADO`
 * pro Módulo 03 (Compras) reagir — sem criar compra nenhuma
 * aqui, só o aviso.
 */
function Gatilho_VerificarNiveisEstoque() {
  Core_API.bootstrap();
  const ctx = Core_Context.build({ action: 'sistema.gatilho', userId: 'sistema' });
  const resultado = Service_Estoque.verificarNiveis(ctx);
  Logger.log('Gatilho níveis de estoque: ' + resultado.totalVerificados + ' verificado(s), ' + resultado.totalAmarelo + ' em alerta amarelo.');
  return resultado;
}

/**
 * MÓDULO 04 — gera (cria + abre) automaticamente o inventário do
 * dia seguinte pras localizações configuradas em
 * `INVENTARIO_D1_LOCALIZACOES` (vazio por padrão — não gera nada
 * até alguém configurar de propósito). Pula localização que já
 * tem inventário ativo, pra não duplicar.
 */
function Gatilho_GerarInventarioD1() {
  Core_API.bootstrap();
  const ctx = Core_Context.build({ action: 'sistema.gatilho', userId: 'sistema' });
  const resultado = Service_Inventario.gerarInventarioD1(ctx);
  Logger.log('Gatilho inventário D-1: ' + resultado.totalGerados + ' de ' + resultado.totalLocalizacoesConfiguradas + ' configurada(s). Tokens: ' + resultado.tokens.join(', '));
  return resultado;
}

/** Instala os quatro triggers de tempo de uma vez (rodar manualmente uma vez). */
function setup_instalarGatilhosDeTempo() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (['Gatilho_VerificarEstoqueCritico', 'Gatilho_VerificarReservasVencendo', 'Gatilho_VerificarNiveisEstoque', 'Gatilho_GerarInventarioD1'].includes(t.getHandlerFunction())) {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger('Gatilho_VerificarEstoqueCritico').timeBased().everyHours(6).create();
  ScriptApp.newTrigger('Gatilho_VerificarReservasVencendo').timeBased().everyHours(1).create();
  ScriptApp.newTrigger('Gatilho_VerificarNiveisEstoque').timeBased().everyDays(1).create();
  ScriptApp.newTrigger('Gatilho_GerarInventarioD1').timeBased().everyDays(1).atHour(20).create();
  SpreadsheetApp.getUi().alert('Gatilhos instalados: estoque crítico (6h), reservas vencendo (1h), níveis de estoque (1x/dia), inventário D-1 (1x/dia às 20h).');
}
