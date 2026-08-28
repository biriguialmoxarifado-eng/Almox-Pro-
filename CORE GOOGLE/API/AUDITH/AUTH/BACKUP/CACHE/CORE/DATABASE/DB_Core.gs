/**
 * ============================================================
 * ALMOXA PRO — DB_Core.gs  (CAMADA 2)
 * Acesso base ao Google Sheets. NENHUM outro arquivo do sistema
 * deve chamar SpreadsheetApp diretamente — tudo passa por aqui
 * (seção 7 — regra absoluta).
 * ============================================================
 */

const DB_Core = (function () {

  function ss() {
    const id = Core_Config.get('SPREADSHEET_ID');
    if (!id) throw new Error('SPREADSHEET_ID não configurado (Core_Config).');
    return SpreadsheetApp.openById(id);
  }

  function sheet(tableName) {
    const sh = ss().getSheetByName(tableName);
    if (!sh) throw new Error('Tabela/aba não encontrada: ' + tableName);
    return sh;
  }

  function headers(sh) {
    const lastCol = sh.getLastColumn();
    return lastCol ? sh.getRange(1, 1, 1, lastCol).getValues()[0] : [];
  }

  function ensureSheet(tableName, headerList) {
    let sh = ss().getSheetByName(tableName);
    if (!sh) {
      sh = ss().insertSheet(tableName);
      sh.getRange(1, 1, 1, headerList.length).setValues([headerList]);
      sh.setFrozenRows(1);
    }
    return sh;
  }

  return { ss, sheet, headers, ensureSheet };
})();
