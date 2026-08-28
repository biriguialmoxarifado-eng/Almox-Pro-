/**
 * ============================================================
 * ALMOXA PRO — Integration_GoogleSheets.gs
 * Adapter para operações de Sheets que não são CRUD comum
 * (ex: exportação para nova planilha, mesclagem de abas) —
 * CRUD comum continua em /DATABASE.
 * ============================================================
 */
const Integration_GoogleSheets = (function () {
  function exportRangeToNewSheet(sourceTable, filterFn, newSheetName) {
    const rows = DB_Query.find(sourceTable, filterFn);
    const newSs = SpreadsheetApp.create(newSheetName);
    const sh = newSs.getActiveSheet();
    if (rows.length) {
      const headers = Object.keys(rows[0]).filter(k => !k.startsWith('_'));
      sh.appendRow(headers);
      rows.forEach(r => sh.appendRow(headers.map(h => r[h])));
    }
    return { spreadsheetId: newSs.getId(), url: newSs.getUrl() };
  }
  return { exportRangeToNewSheet };
})();
