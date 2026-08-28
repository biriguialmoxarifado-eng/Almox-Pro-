/**
 * ============================================================
 * ALMOXA PRO — Test_Fase10_SAP_ImportExport.gs
 * Fluxo: cria um CSV de teste no Drive simulando exportação SAP
 * (colunas com nomes SAP reais: EBELN, MATNR, MENGE) → importa
 * via sap.import → valida → confere que reconheceu o produto.
 * Depois testa importação genérica pra FORNECEDORES e exportação
 * genérica de PRODUTOS.
 *
 * PRÉ-REQUISITO: configure SAP_IMPORT_FOLDER_ID e
 * DRIVE_FOLDER_DOCS em Configurações antes de rodar — sem isso
 * o teste avisa e pula as partes que dependem do Drive.
 * ============================================================
 */

function Test_Fase10_fluxoCompleto() {
  Core_API.bootstrap();

  const login = Core_API.call({ action: 'auth.login', payload: { identificacao: 'admin', senha: 'almoxa123' } });
  if (!login.success) { Logger.log('LOGIN FALHOU'); return login; }
  const sessionId = login.data.sessionId;

  const sapFolderId = Core_Config.get('SAP_IMPORT_FOLDER_ID');
  const docsFolderId = Core_Config.get('DRIVE_FOLDER_DOCS') || Core_Config.get('DRIVE_FOLDER_ID');

  if (!sapFolderId || !docsFolderId) {
    Logger.log('AVISO: configure SAP_IMPORT_FOLDER_ID e DRIVE_FOLDER_DOCS antes de rodar este teste completo.');
    SpreadsheetApp.getUi().alert('Configure SAP_IMPORT_FOLDER_ID e DRIVE_FOLDER_DOCS em Configurações antes de rodar o teste da Fase 10.');
    return { erro: 'Configuração ausente' };
  }

  const produto = Core_API.call({ action: 'produto.create', sessionId, payload: { descricaoOriginal: 'Chapa de aço 3mm', codigo: 'CHAPA-3MM' } });
  const produtoId = produto.data.ID;

  // ---- Simula um arquivo exportado do SAP (layout ME2N típico) ----
  const csvSAP = 'EBELN,EBELP,MATNR,MENGE,NETPR\n4500001234,10,CHAPA-3MM,25,89.90\n4500001234,20,PECA-DESCONHECIDA,5,12.00';
  const arquivoSAP = DriveApp.getFolderById(sapFolderId).createFile('teste_sap_me2n.csv', csvSAP, MimeType.CSV);

  const sapImport = Core_API.call({ action: 'sap.import', sessionId, payload: { driveFileId: arquivoSAP.getId(), tipoRelatorio: 'ME2N' } });
  Logger.log('SAP IMPORT: ' + JSON.stringify(sapImport));

  const sapValidate = Core_API.call({ action: 'sap.validate', sessionId, payload: { tipoRelatorio: 'ME2N' } });
  Logger.log('SAP VALIDATE: ' + JSON.stringify(sapValidate));

  // ---- Importação genérica: fornecedor via CSV ----
  const csvFornecedor = 'cnpj,razaoSocial,status\n55666777000199,Distribuidora Teste LTDA,ATIVO';
  const arquivoFornecedor = DriveApp.getFolderById(docsFolderId).createFile('teste_fornecedores.csv', csvFornecedor, MimeType.CSV);

  const preview = Core_API.call({ action: 'importacao.preview', sessionId, payload: { driveFileId: arquivoFornecedor.getId(), tabelaDestino: 'FORNECEDORES' } });
  Logger.log('IMPORT PREVIEW: ' + JSON.stringify(preview));

  const commit = Core_API.call({ action: 'importacao.commit', sessionId, payload: { driveFileId: arquivoFornecedor.getId(), tabelaDestino: 'FORNECEDORES', mapeamento: preview.data.mapeamentoSugerido } });
  Logger.log('IMPORT COMMIT: ' + JSON.stringify(commit));

  // ---- Exportação genérica ----
  const exportGeneric = Core_API.call({ action: 'exportacao.generic', sessionId, payload: { tabela: 'PRODUTOS', formato: 'CSV' } });
  Logger.log('EXPORT GENÉRICO: ' + JSON.stringify(exportGeneric));

  // limpeza dos arquivos de teste
  arquivoSAP.setTrashed(true);
  arquivoFornecedor.setTrashed(true);

  const passou =
    sapImport.success && sapImport.data.totalImportado === 2 &&
    sapImport.data.pendentesDeProduto === 1 && // PECA-DESCONHECIDA não existe
    sapValidate.success &&
    preview.success && Object.keys(preview.data.mapeamentoSugerido).length >= 2 &&
    commit.success && commit.data.inseridos === 1 &&
    exportGeneric.success;

  Logger.log('=== RESULTADO FASE 10: ' + (passou ? 'PASSOU' : 'FALHOU') + ' ===');
  SpreadsheetApp.getUi().alert('Teste Fase 10 (SAP/Importação/Exportação): ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌') + ' — log completo em Ver → Registros de execução.');
  return { login, sapImport, sapValidate, preview, commit, exportGeneric, passou };
}
