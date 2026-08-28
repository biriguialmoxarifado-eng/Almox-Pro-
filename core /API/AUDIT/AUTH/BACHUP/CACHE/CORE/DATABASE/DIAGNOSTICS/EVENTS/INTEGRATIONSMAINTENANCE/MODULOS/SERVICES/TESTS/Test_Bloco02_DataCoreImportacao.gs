/**
 * ============================================================
 * ALMOXA PRO — Test_Bloco02_DataCoreImportacao.gs
 * Foca no que é NOVO nesta entrega (SchemaCore, DB_Errors, chave
 * composta) + confirmação explícita das seções 30/31 do contrato
 * (cadeia Core→DataCore→Sheets, e proteção contra duplicidade
 * ao reimportar). O restante do checklist da seção 29 (conexão,
 * abas, cabeçalhos, leitura, inserção, atualização, busca,
 * validação, normalização, importação, preview, commit, erro,
 * lock, histórico) já tem cobertura própria em
 * Test_Integracao02_DataLayer.gs e Test_Modulo07_Migration.gs —
 * não duplicado aqui.
 * ============================================================
 */

function Test_Bloco02_DataCoreImportacao_fluxoCompleto() {
  Core_API.bootstrap();
  const resultados = {};

  const admin = Core_API.call({ action: 'auth.login', payload: { identificacao: 'admin', senha: 'almoxa123' } });
  const sessionAdmin = admin.data.sessionId;

  const schemaProdutos = SchemaCore.get('PRODUTOS');
  resultados.schemaExisteComVersaoECampos = !!schemaProdutos && schemaProdutos.versao === 1 && schemaProdutos.campos.length > 0;

  resultados.schemaReaproveitaColunasReaisDoDbMapping = JSON.stringify(schemaProdutos.colunasReais) === JSON.stringify(DB_Mapping.getExpectedHeaders('PRODUTOS'));

  const schemaInexistente = SchemaCore.get('RESERVAS');
  resultados.tabelaSemSchemaRetornaNull = schemaInexistente === null;
  const validacaoSemSchema = SchemaCore.validate('RESERVAS', { qualquerCoisa: 1 });
  resultados.validacaoSemSchemaEhHonesta = validacaoSemSchema.valido === true && validacaoSemSchema.cobertura === 'SEM_SCHEMA_TIPADO';

  const registroEstoqueTipoErrado = { produtoId: 'não-é-um-número', localizacao: 'A1', saldo: 10 };
  const validacaoTipoErrado = SchemaCore.validate('ESTOQUE', registroEstoqueTipoErrado, 5);
  resultados.schemaDetectaTipoErrado = !validacaoTipoErrado.valido && validacaoTipoErrado.erros[0].field === 'produtoId';

  const registroEstoqueValido = { produtoId: 42, localizacao: 'A1', saldo: 10 };
  const validacaoTipoOk = SchemaCore.validate('ESTOQUE', registroEstoqueValido, 6);
  resultados.schemaAceitaTipoCorreto = validacaoTipoOk.valido === true;

  const erro = DB_Errors.build({ code: CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, message: 'Campo obrigatório ausente.', module: 'SCHEMA', operation: 'validate', field: 'CODIGO_PRODUTO', row: 37 });
  resultados.erroEstruturadoTemTodosOsCampos = !!(erro.code && erro.message && erro.module && erro.operation && erro.field === 'CODIGO_PRODUTO' && erro.row === 37 && erro.timestamp);
  resultados.erroFormatadoNuncaEhGenerico = DB_Errors.format(erro).includes('CODIGO_PRODUTO') && DB_Errors.format(erro).includes('37');

  DB_Insert.insert('ESTOQUE', { produtoId: 999001, localizacao: 'TESTE-BLOCO02/A', saldo: 5, reservado: 0, bloqueado: 0, estoqueMinimo: 0 });
  let bloqueouChaveComposta = false;
  try {
    DB_Validation.ensureUnique('ESTOQUE', ['produtoId', 'localizacao'], [999001, 'TESTE-BLOCO02/A']);
  } catch (e) { bloqueouChaveComposta = e.code === CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR; }
  resultados.duplicidadePorChaveCompostaBloqueia = bloqueouChaveComposta;

  const chaveCompostaDiferente = (function () {
    try { DB_Validation.ensureUnique('ESTOQUE', ['produtoId', 'localizacao'], [999001, 'TESTE-BLOCO02/OUTRA']); return true; }
    catch (e) { return false; }
  })();
  resultados.chaveCompostaComLocalizacaoDiferenteNaoBloqueia = chaveCompostaDiferente;

  let ensureUniqueStringUnicaFunciona = false;
  try { DB_Validation.ensureUnique('PRODUTOS', 'codigo', 'CODIGO-QUE-NAO-EXISTE-BLOCO02'); ensureUniqueStringUnicaFunciona = true; }
  catch (e) { ensureUniqueStringUnicaFunciona = false; }
  resultados.retrocompatibilidadeStringUnicaMantida = ensureUniqueStringUnicaFunciona;

  const produtoIntegracao = Core_API.call({ action: 'produto.create', sessionId: sessionAdmin, payload: { descricaoOriginal: 'Item Integração Bloco02', codigo: 'BLOCO02-INT' } });
  const lidoDoSheetsDeVerdade = DB_Query.get('PRODUTOS', produtoIntegracao.data.ID);
  resultados.testeIntegracaoCoreDataCoreSheets = produtoIntegracao.success && !!lidoDoSheetsDeVerdade && lidoDoSheetsDeVerdade.codigo === 'BLOCO02-INT' && !!lidoDoSheetsDeVerdade._updated_at;

  const pasta = DriveApp.getRootFolder();
  const csv = ['cnpj,razaoSocial', '33444555000199,Fornecedor Bloco02 Teste'].join('\n');
  const arquivo = pasta.createFile('teste_bloco02_importacao.csv', csv, MimeType.CSV);
  const mapeamento = { cnpj: 0, razaoSocial: 1 };

  const primeiraImportacao = Service_Migration.executar({
    userId: sessionAdmin, requestId: 'x', payload: { driveFileId: arquivo.getId(), tabelaDestino: 'FORNECEDORES', mapeamento: mapeamento, camposObrigatorios: ['cnpj'], chaveDeduplicacao: ['cnpj'], modo: 'REAL' }
  });
  const totalAposPrimeira = DB_Query.find('FORNECEDORES', function (f) { return f.cnpj === '33444555000199'; }).length;

  const segundaImportacao = Service_Migration.executar({
    userId: sessionAdmin, requestId: 'y', payload: { driveFileId: arquivo.getId(), tabelaDestino: 'FORNECEDORES', mapeamento: mapeamento, camposObrigatorios: ['cnpj'], chaveDeduplicacao: ['cnpj'], modo: 'REAL' }
  });
  const totalAposSegunda = DB_Query.find('FORNECEDORES', function (f) { return f.cnpj === '33444555000199'; }).length;

  resultados.importacaoInicialCriaRegistro = primeiraImportacao.success && primeiraImportacao.data.importados === 1 && totalAposPrimeira === 1;
  resultados.reimportarNaoDuplicaRegistro = segundaImportacao.success && segundaImportacao.data.jaExistentesNoBanco === 1 && segundaImportacao.data.importados === 0 && totalAposSegunda === 1;

  // Confirma o comportamento ANTIGO preservado: SEM chaveDeduplicacao, o sistema não sabe comparar contra o banco (documentado, não escondido)
  const arquivo2 = pasta.createFile('teste_bloco02_sem_chave.csv', csv, MimeType.CSV);
  const semChaveSegundaVez = Service_Migration.executar({
    userId: sessionAdmin, requestId: 'z', payload: { driveFileId: arquivo2.getId(), tabelaDestino: 'FORNECEDORES', mapeamento: mapeamento, camposObrigatorios: ['cnpj'], modo: 'REAL' }
  });
  resultados.semChaveDeduplicacaoComportamentoAntigoPreservado = semChaveSegundaVez.success && semChaveSegundaVez.data.importados === 1; // sem chave, insere de novo — limitação documentada, não escondida
  arquivo2.setTrashed(true);

  arquivo.setTrashed(true);

  const passou = Object.values(resultados).every(Boolean);

  Logger.log('=== RESULTADOS BLOCO 02 (Data Core / Importação) ===');
  Logger.log(JSON.stringify(resultados, null, 2));
  Logger.log('=== ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌') + ' ===');
  SpreadsheetApp.getUi().alert('Teste Bloco 02: ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌ — veja o Logger.'));

  return resultados;
}
