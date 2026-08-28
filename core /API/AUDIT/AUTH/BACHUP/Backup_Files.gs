/**
 * ============================================================
 * ALMOXA PRO — Backup_Files.gs
 * Backup de arquivos avulsos (NFs, fotos, documentos) já
 * referenciados no banco — copia a pasta de documentos.
 * ============================================================
 */
const Backup_Files = (function () {
  function backupFolder(sourceFolderId, destFolderId) {
    const source = DriveApp.getFolderById(sourceFolderId);
    const dest = DriveApp.getFolderById(destFolderId);
    const files = source.getFiles();
    let count = 0;
    while (files.hasNext()) {
      const f = files.next();
      f.makeCopy(f.getName(), dest);
      count++;
    }
    return { arquivosCopiados: count };
  }
  return { backupFolder };
})();
