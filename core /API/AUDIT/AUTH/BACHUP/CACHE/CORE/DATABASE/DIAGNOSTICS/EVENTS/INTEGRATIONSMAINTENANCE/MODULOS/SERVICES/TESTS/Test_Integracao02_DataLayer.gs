/**
 * ============================================================
 * ALMOXA PRO — Test_Integracao02_DataLayer.gs
 * Cobre os 8 cenários pedidos: leitura, gravação, atualização,
 * busca, duplicidade, concorrência, erro de conexão, recuperação
 * de erro.
 *
 * HONESTIDADE sobre "concorrência": Apps Script roda essa função
 * numa única thread — não dá pra simular duas execuções paralelas
 * de verdade dentro de um teste síncrono. O que testamos aqui são
 * as PROPRIEDADES que protegem contra concorrência real (IDs
 * nunca colidem mesmo em inserções rápidas em sequência, o lock
 * sempre libera mesmo quando a operação falha) — não uma
 * simulação de paralelismo genuíno, que exigiria dois processos
 * de verdade.
 * ============================================================
 */

function Test_Integracao02_DataLayer_fluxoCompleto() {
  Core_API.bootstrap();
  const resultados = {};

  const admin = Core_API.call({ action: 'auth.login', payload: { identificacao: 'admin', senha: 'almoxa123' } });
  const sessionAdmin = admin.data.sessionId;

  const produto = Core_API.call({ action: 'produto.create', sessionId: sessionAdmin, payload: { descricaoOriginal: 'Item Data Layer INT02', codigo: 'INT02-DL' } });
  const lido = DB_Query.get('PRODUTOS', produto.data.ID);
  resultados.leituraFunciona = !!lido && lido.codigo === 'INT02-DL';

  resultados.gravacaoGeraIdUnico = !!produto.data.ID && typeof produto.data.ID === 'number';

  DB_Update.byId('PRODUTOS', produto.data.ID, { descricaoOriginal: 'Item Atualizado INT02' });
  const atualizado = DB_Query.get('PRODUTOS', produto.data.ID);
  resultados.atualizacaoFunciona = atualizado.descricaoOriginal === 'Item Atualizado INT02';

  for (let i = 0; i < 7; i++) {
    DB_Insert.insert('PRODUTOS', { codigo: 'INT02-BUSCA-' + i, descricaoOriginal: 'Item Busca INT02 ' + i, status: 'ATIVO' });
  }
  const busca = DB_Query.find('PRODUTOS', p => (p.codigo || '').indexOf('INT02-BUSCA-') === 0);
  resultados.buscaComFiltroFunciona = busca.length === 7;

  const pagina1 = DB_Query.paginate('PRODUTOS', p => (p.codigo || '').indexOf('INT02-BUSCA-') === 0, 3, 0);
  const pagina2 = DB_Query.paginate('PRODUTOS', p => (p.codigo || '').indexOf('INT02-BUSCA-') === 0, 3, 3);
  resultados.paginacaoGenericaFunciona = pagina1.registros.length === 3 && pagina1.temMais === true &&
    pagina2.registros.length === 3 && pagina1.registros[0].ID !== pagina2.registros[0].ID;

  let bloqueouDuplicidade = false;
  try {
    DB_Validation.ensureUnique('PRODUTOS', 'codigo', 'INT02-DL');
  } catch (e) {
    bloqueouDuplicidade = e.code === CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR;
  }
  resultados.duplicidadeBloqueada = bloqueouDuplicidade;

  const naoBloqueiaCodigoNovo = (function () {
    try { DB_Validation.ensureUnique('PRODUTOS', 'codigo', 'INT02-CODIGO-INEXISTENTE'); return true; }
    catch (e) { return false; }
  })();
  resultados.codigoNaoDuplicadoPassaLivre = naoBloqueiaCodigoNovo;

  const idsGerados = [];
  for (let i = 0; i < 10; i++) {
    idsGerados.push(DB_Insert.insert('PRODUTOS', { codigo: 'INT02-CONC-' + i, descricaoOriginal: 'Concorrência ' + i }).ID);
  }
  resultados.idsNuncaColidem = new Set(idsGerados).size === idsGerados.length;

  let lockSempreLibera = true;
  try {
    DB_Lock.withLock(function () { throw new Error('Falha proposital dentro do lock.'); });
  } catch (e) { /* esperado */ }
  try {
    DB_Lock.withLock(function () { return true; });
  } catch (e) {
    lockSempreLibera = false;
  }
  resultados.lockSempreLiberaMesmoComErro = lockSempreLibera;

  resultados.heuristicaDeErroTransitorioFunciona =
    DB_Core._pareceTransitorio('Service Spreadsheets timeout') === true &&
    DB_Core._pareceTransitorio('Tabela/aba não encontrada: X') === false;

  let tentativas = 0;
  const resultadoComRetry = DB_Core._withRetry(function () {
    tentativas++;
    if (tentativas < 3) throw new Error('rate limit exceeded, try again later');
    return 'sucesso na tentativa ' + tentativas;
  });
  resultados.retryTentaDeNovoEconsegue = tentativas === 3 && resultadoComRetry === 'sucesso na tentativa 3';

  let tentativasErroReal = 0;
  let erroRealPropagado = false;
  try {
    DB_Core._withRetry(function () {
      tentativasErroReal++;
      throw new Error('Tabela/aba não encontrada: TABELA_QUE_NAO_EXISTE');
    });
  } catch (e) {
    erroRealPropagado = true;
  }
  resultados.erroRealNaoFicaRetentandoAToa = erroRealPropagado && tentativasErroReal === 1;

  let compensou = false;
  try {
    DB_Transaction.run([
      { execute: function () { return 'passo1 ok'; }, compensate: function () { compensou = true; } },
      { execute: function () { throw new Error('passo2 falha de propósito'); } }
    ]);
  } catch (e) { /* esperado */ }
  resultados.transacaoCompensaAoFalhar = compensou === true;

  const passou = Object.values(resultados).every(Boolean);

  Logger.log('=== RESULTADOS INTEGRAÇÃO 02 (Data Layer) ===');
  Logger.log(JSON.stringify(resultados, null, 2));
  Logger.log('=== ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌') + ' ===');
  SpreadsheetApp.getUi().alert('Teste Integração 02: ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌ — veja o Logger.'));

  return resultados;
}
