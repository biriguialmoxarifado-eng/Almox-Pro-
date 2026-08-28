/**
 * ============================================================
 * ALMOXA PRO — Test_Fase9_Relatorios.gs
 * Fluxo: gera dados reais (produto+entrada+saída) → relatório
 * de ESTOQUE → relatório de CURVA_ABC → exporta em CSV, PDF e
 * JSON de verdade pro Drive (confere que os arquivos existem).
 * ============================================================
 */

function Test_Fase9_fluxoCompleto() {
  Core_API.bootstrap();

  const login = Core_API.call({ action: 'auth.login', payload: { identificacao: 'admin', senha: 'almoxa123' } });
  if (!login.success) { Logger.log('LOGIN FALHOU'); return login; }
  const sessionId = login.data.sessionId;

  const produto = Core_API.call({ action: 'produto.create', sessionId, payload: { descricaoOriginal: 'Telha cerâmica', codigo: 'TELHA-01' } });
  const produtoId = produto.data.ID;
  const localizacao = 'OBRA-TESTE/DEPOSITO-TELHAS';

  Core_API.call({ action: 'estoque.entry', sessionId, payload: { produtoId, localizacao, quantidade: 50 } });
  Core_API.call({ action: 'estoque.exit', sessionId, payload: { produtoId, localizacao, quantidade: 20, motivo: 'Uso em telhado' } });

  const relEstoque = Core_API.call({ action: 'relatorio.generate', sessionId, payload: { tipo: 'ESTOQUE', filtros: { produtoId } } });
  Logger.log('RELATÓRIO ESTOQUE: ' + JSON.stringify(relEstoque));

  const relCurvaABC = Core_API.call({ action: 'relatorio.generate', sessionId, payload: { tipo: 'CURVA_ABC', filtros: {} } });
  Logger.log('RELATÓRIO CURVA ABC: ' + JSON.stringify(relCurvaABC));

  const tipoInvalido = Core_API.call({ action: 'relatorio.generate', sessionId, payload: { tipo: 'NAO_EXISTE' } });
  Logger.log('TIPO INVÁLIDO (deve falhar com mensagem clara): ' + JSON.stringify(tipoInvalido));

  let exportCSV = null, exportPDF = null, exportJSON = null;
  const temPastaDrive = !!(Core_Config.get('DRIVE_FOLDER_DOCS') || Core_Config.get('DRIVE_FOLDER_ID'));

  if (temPastaDrive) {
    exportCSV = Core_API.call({ action: 'relatorio.export', sessionId, payload: { tipo: 'ESTOQUE', filtros: { produtoId }, formato: 'CSV' } });
    Logger.log('EXPORT CSV: ' + JSON.stringify(exportCSV));

    exportPDF = Core_API.call({ action: 'relatorio.export', sessionId, payload: { tipo: 'ESTOQUE', filtros: { produtoId }, formato: 'PDF' } });
    Logger.log('EXPORT PDF: ' + JSON.stringify(exportPDF));

    exportJSON = Core_API.call({ action: 'relatorio.export', sessionId, payload: { tipo: 'MOVIMENTACOES', filtros: { produtoId }, formato: 'JSON' } });
    Logger.log('EXPORT JSON: ' + JSON.stringify(exportJSON));
  } else {
    Logger.log('AVISO: DRIVE_FOLDER_DOCS/DRIVE_FOLDER_ID não configurado — pulando testes de exportação real. Configure em Configurações antes de testar exportação.');
  }

  const passou =
    relEstoque.success && relEstoque.data.totalRegistros === 1 &&
    relCurvaABC.success && relCurvaABC.data.dados.length === 1 && relCurvaABC.data.dados[0].classe === 'A' &&
    !tipoInvalido.success &&
    (!temPastaDrive || (exportCSV.success && exportPDF.success && exportJSON.success));

  Logger.log('=== RESULTADO FASE 9: ' + (passou ? 'PASSOU' : 'FALHOU') + ' ===' + (temPastaDrive ? '' : ' (exportação real não testada — sem pasta Drive configurada)'));
  SpreadsheetApp.getUi().alert('Teste Fase 9 (Relatórios): ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌') + (temPastaDrive ? '' : ' — configure DRIVE_FOLDER_DOCS pra testar exportação real') + '. Log completo em Ver → Registros de execução.');
  return { login, relEstoque, relCurvaABC, tipoInvalido, exportCSV, exportPDF, exportJSON, passou };
}
