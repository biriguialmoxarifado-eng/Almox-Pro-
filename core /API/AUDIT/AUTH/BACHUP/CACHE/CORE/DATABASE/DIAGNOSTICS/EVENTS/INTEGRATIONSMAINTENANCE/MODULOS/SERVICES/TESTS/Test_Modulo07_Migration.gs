/**
 * ============================================================
 * ALMOXA PRO — Test_Modulo07_Migration.gs
 * Cria um CSV real no Drive (2 válidos, 1 duplicado, 1 com campo
 * obrigatório vazio) e roda o ciclo completo: diagnóstico →
 * validação (classificação) → simulação (nada grava) → execução
 * real (grava, cria backup) → rollback (desfaz). Usa FORNECEDORES
 * como tabela destino — tabela simples, sem efeito colateral em
 * outros módulos, ideal pra testar migração isoladamente.
 * ============================================================
 */

function Test_Modulo07_Migration_fluxoCompleto() {
  Core_API.bootstrap();
  const resultados = {};

  const admin = Core_API.call({ action: 'auth.login', payload: { identificacao: 'admin', senha: 'almoxa123' } });
  const sessionAdmin = admin.data.sessionId;

  const csv = [
    'cnpj,razaoSocial',
    '11222333000144,Fornecedor Migração A',
    '55666777000188,Fornecedor Migração B',
    '11222333000144,Fornecedor Migração A',
    ',Fornecedor Sem CNPJ'
  ].join('\n');
  const pasta = DriveApp.getRootFolder();
  const arquivo = pasta.createFile('teste_migracao_m7.csv', csv, MimeType.CSV);
  const driveFileId = arquivo.getId();

  const operador = Core_API.call({ action: 'loja.cadastro', payload: { nome: 'Operador M7', matricula: 'M7-OP-' + Date.now(), senha: '1234' } });

  const diagnosticoNegado = Core_API.call({ action: 'migration.diagnosticarOrigem', sessionId: operador.data.sessionId, payload: { driveFileId } });
  resultados.bloqueiaNaoAdmin = !diagnosticoNegado.success && diagnosticoNegado.code === CORE_CONSTANTS.RESPONSE_CODES.PERMISSION_DENIED;

  const diagnostico = Core_API.call({ action: 'migration.diagnosticarOrigem', sessionId: sessionAdmin, payload: { driveFileId, tabelaDestino: 'FORNECEDORES' } });
  resultados.diagnosticaOrigem = diagnostico.success && diagnostico.data.totalRegistros === 4 && diagnostico.data.duplicidadesDetectadas === 1 && diagnostico.data.registrosIncompletos === 1;

  const mapeamento = { cnpj: 0, razaoSocial: 1 };

  const validacao = Core_API.call({
    action: 'migration.validar', sessionId: sessionAdmin,
    payload: { driveFileId, tabelaDestino: 'FORNECEDORES', mapeamento, camposObrigatorios: ['cnpj'] }
  });
  resultados.classificaVermelhoComInvalido = validacao.success && validacao.data.classificacao === 'VERMELHO' && !validacao.data.podeImportar;

  const simulacaoBloqueada = Core_API.call({
    action: 'migration.executar', sessionId: sessionAdmin,
    payload: { driveFileId, tabelaDestino: 'FORNECEDORES', mapeamento, camposObrigatorios: ['cnpj'], modo: 'SIMULAR' }
  });
  resultados.bloqueiaExecucaoComCritico = !simulacaoBloqueada.success;

  const csvSemInvalido = [
    'cnpj,razaoSocial',
    '11222333000144,Fornecedor Migração A',
    '55666777000188,Fornecedor Migração B',
    '11222333000144,Fornecedor Migração A'
  ].join('\n');
  const arquivo2 = pasta.createFile('teste_migracao_m7_v2.csv', csvSemInvalido, MimeType.CSV);
  const driveFileId2 = arquivo2.getId();

  const validacao2 = Core_API.call({
    action: 'migration.validar', sessionId: sessionAdmin,
    payload: { driveFileId: driveFileId2, tabelaDestino: 'FORNECEDORES', mapeamento, camposObrigatorios: ['cnpj'] }
  });
  resultados.classificaAmareloComDuplicadoSoZinho = validacao2.success && validacao2.data.classificacao === 'AMARELO' && validacao2.data.podeImportar;

  const totalFornecedoresAntes = Core_API.call({ action: 'fornecedor.search', sessionId: sessionAdmin, payload: {} }).data.length;
  const simulacao = Core_API.call({
    action: 'migration.executar', sessionId: sessionAdmin,
    payload: { driveFileId: driveFileId2, tabelaDestino: 'FORNECEDORES', mapeamento, camposObrigatorios: ['cnpj'], modo: 'SIMULAR' }
  });
  const totalFornecedoresDepoisSimulacao = Core_API.call({ action: 'fornecedor.search', sessionId: sessionAdmin, payload: {} }).data.length;
  resultados.simulacaoNaoGravaNada = simulacao.success && simulacao.data.importados === 2 && totalFornecedoresDepoisSimulacao === totalFornecedoresAntes;

  const execucaoReal = Core_API.call({
    action: 'migration.executar', sessionId: sessionAdmin,
    payload: { driveFileId: driveFileId2, tabelaDestino: 'FORNECEDORES', mapeamento, camposObrigatorios: ['cnpj'], modo: 'REAL' }
  });
  const totalFornecedoresDepoisReal = Core_API.call({ action: 'fornecedor.search', sessionId: sessionAdmin, payload: {} }).data.length;
  resultados.execucaoRealGravaEBackup = execucaoReal.success && execucaoReal.data.importados === 2 &&
    totalFornecedoresDepoisReal === totalFornecedoresAntes + 2 && !!execucaoReal.data.backupId;

  const rollback = Core_API.call({ action: 'migration.rollback', sessionId: sessionAdmin, payload: { execucaoId: execucaoReal.data.execucaoId } });
  const totalFornecedoresDepoisRollback = Core_API.call({ action: 'fornecedor.search', sessionId: sessionAdmin, payload: {} }).data.length;
  resultados.rollbackDesfazDeVerdade = rollback.success && rollback.data.revertidos === 2 && totalFornecedoresDepoisRollback === totalFornecedoresAntes;

  const rollbackDuplo = Core_API.call({ action: 'migration.rollback', sessionId: sessionAdmin, payload: { execucaoId: execucaoReal.data.execucaoId } });
  resultados.bloqueiaRollbackDuplo = !rollbackDuplo.success;

  const relatorio = Core_API.call({ action: 'migration.relatorio', sessionId: sessionAdmin, payload: { execucaoId: execucaoReal.data.execucaoId } });
  resultados.relatorioReflete = relatorio.success && relatorio.data.migracao.status === 'REVERTIDA' && relatorio.data.itens.length === 3;

  arquivo.setTrashed(true);
  arquivo2.setTrashed(true);

  const passou = Object.values(resultados).every(Boolean);

  Logger.log('=== RESULTADOS MÓDULO 07 (Migration Engine) ===');
  Logger.log(JSON.stringify(resultados, null, 2));
  Logger.log('=== ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌') + ' ===');
  SpreadsheetApp.getUi().alert('Teste Módulo 07 (Migration Engine): ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌ — veja o Logger.'));

  return resultados;
}
