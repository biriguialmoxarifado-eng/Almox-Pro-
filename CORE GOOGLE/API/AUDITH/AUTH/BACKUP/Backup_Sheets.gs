/**
 * ============================================================
 * ALMOXA PRO — Backup_Sheets.gs  (CAMADA 5 / Backup)
 * Backup do banco (Sheets) — cópia da planilha inteira no Drive.
 * ============================================================
 */
const Backup_Sheets = (function () {
  function backupNow(destFolderId) {
    const original = DriveApp.getFileById(Core_Config.get('SPREADSHEET_ID'));
    const nome = 'ALMOXA_PRO_BACKUP_' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');
    const folder = DriveApp.getFolderById(destFolderId);
    const copia = original.makeCopy(nome, folder);
    return { fileId: copia.getId(), nome: nome };
  }
  return { backupNow };
})();
