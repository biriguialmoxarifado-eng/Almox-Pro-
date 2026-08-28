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
 *   Gatilho_VerificarVistoriasPendentes → 1x por dia (Módulo 06)
 *   Gatilho_DiagnosticoAutomatico     → 1x por dia (Módulo 08)
 *   Gatilho_BackupAutomatico          → 1x por dia, madrugada (Módulo 13)
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

/** MÓDULO 06 — avisa vistoria vencida sem esconder isso (seção 6 do contrato). */
function Gatilho_VerificarVistoriasPendentes() {
  Core_API.bootstrap();
  const ctx = Core_Context.build({ action: 'sistema.gatilho', userId: 'sistema' });
  const resultado = Service_Ferramenta.verificarVistoriasPendentes(ctx);
  Logger.log('Gatilho vistorias pendentes: ' + resultado.total + ' ferramenta(s) com vistoria vencida.');
  return resultado;
}

/**
 * MÓDULO 08 — diagnóstico automático (seção 11 do contrato):
 * "criar rotina que possa executar verificações sem depender da
 * interface." Roda o mesmo `Doctor_Report.generate()` que a rota
 * `doctor.diagnostics` usa — não duplica lógica nenhuma, só
 * chama de um gatilho de tempo em vez de esperar alguém abrir a
 * tela do Doutor. Cada execução já salva no histórico sozinha
 * (dentro do próprio `generate()`).
 */
function Gatilho_DiagnosticoAutomatico() {
  Core_API.bootstrap();
  const relatorio = Doctor_Report.generate();
  const totalProblemas = (relatorio.recomendacoes || []).length;
  Logger.log('Diagnóstico automático: ' + totalProblemas + ' recomendação(ões). Status banco: ' + relatorio.database.status + ', permissões: ' + relatorio.permissions.status);
  return relatorio;
}

/**
 * MÓDULO 13 — backup automático (seção 1 do contrato: "permitir
 * execução automática... backup programado"). Era o único gap
 * real do módulo — `Backup_Core.create()` já existia, só nunca
 * era chamado por um gatilho de tempo, só manualmente.
 * `userId: 'sistema'` marca origem no `responsavel`, e
 * `tipo: 'AUTOMATICO'` distingue de backup manual no histórico.
 */
function Gatilho_BackupAutomatico() {
  Core_API.bootstrap();
  const ctx = Core_Context.build({ action: 'sistema.gatilho', userId: 'sistema' });
  const resultado = Backup_Core.create(Object.assign({}, ctx, { payload: { tipo: 'AUTOMATICO' } }));
  Logger.log('Gatilho backup automático: ' + (resultado.success ? 'sucesso (backup #' + resultado.data.ID + ')' : 'FALHOU — ' + resultado.message));
  return resultado;
}

/** Instala os sete triggers de tempo de uma vez (rodar manualmente uma vez). */
function setup_instalarGatilhosDeTempo() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (['Gatilho_VerificarEstoqueCritico', 'Gatilho_VerificarReservasVencendo', 'Gatilho_VerificarNiveisEstoque', 'Gatilho_GerarInventarioD1', 'Gatilho_VerificarVistoriasPendentes', 'Gatilho_DiagnosticoAutomatico', 'Gatilho_BackupAutomatico'].includes(t.getHandlerFunction())) {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger('Gatilho_VerificarEstoqueCritico').timeBased().everyHours(6).create();
  ScriptApp.newTrigger('Gatilho_VerificarReservasVencendo').timeBased().everyHours(1).create();
  ScriptApp.newTrigger('Gatilho_VerificarNiveisEstoque').timeBased().everyDays(1).create();
  ScriptApp.newTrigger('Gatilho_GerarInventarioD1').timeBased().everyDays(1).atHour(20).create();
  ScriptApp.newTrigger('Gatilho_VerificarVistoriasPendentes').timeBased().everyDays(1).atHour(7).create();
  ScriptApp.newTrigger('Gatilho_DiagnosticoAutomatico').timeBased().everyDays(1).atHour(5).create();
  ScriptApp.newTrigger('Gatilho_BackupAutomatico').timeBased().everyDays(1).atHour(3).create();
  SpreadsheetApp.getUi().alert('Gatilhos instalados: estoque crítico (6h), reservas vencendo (1h), níveis de estoque (1x/dia), inventário D-1 (1x/dia às 20h), vistorias pendentes (1x/dia às 7h), diagnóstico automático (1x/dia às 5h), backup automático (1x/dia às 3h).');
}
