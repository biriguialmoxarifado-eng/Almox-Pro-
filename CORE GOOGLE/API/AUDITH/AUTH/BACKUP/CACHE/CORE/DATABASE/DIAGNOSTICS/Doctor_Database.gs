/**
 * ============================================================
 * ALMOXA PRO — Doctor_Database.gs  (CAMADA 5 / Diagnostics)
 * Verifica se as tabelas esperadas existem e se os cabeçalhos
 * batem com DB_Mapping (detecta corrupção estrutural cedo).
 * ============================================================
 */

const Doctor_Database = (function () {

  function check() {
    const spreadsheetId = Core_Config.get('SPREADSHEET_ID');
    if (!spreadsheetId) {
      return { status: CORE_CONSTANTS.DOCTOR_STATUS.NOT_CONFIGURED, detail: 'SPREADSHEET_ID não configurado.' };
    }

    let ss;
    try { ss = DB_Core.ss(); } catch (e) {
      return { status: CORE_CONSTANTS.DOCTOR_STATUS.ERROR, detail: 'Não foi possível abrir a planilha: ' + e.message };
    }

    const tables = DB_Mapping.getAllTableNames();
    const missing = [];
    const headerMismatch = [];

    tables.forEach(table => {
      const sh = ss.getSheetByName(table);
      if (!sh) { missing.push(table); return; }
      const actual = DB_Core.headers(sh);
      const expected = DB_Mapping.getExpectedHeaders(table) || [];
      const faltando = expected.filter(h => !actual.includes(h));
      if (faltando.length) headerMismatch.push({ table, faltando });
    });

    let status = CORE_CONSTANTS.DOCTOR_STATUS.OK;
    if (missing.length) status = CORE_CONSTANTS.DOCTOR_STATUS.ERROR;
    else if (headerMismatch.length) status = CORE_CONSTANTS.DOCTOR_STATUS.WARNING;

    return { status, tabelasFaltando: missing, colunasFaltando: headerMismatch, totalTabelasEsperadas: tables.length };
  }

  return { check };
})();
