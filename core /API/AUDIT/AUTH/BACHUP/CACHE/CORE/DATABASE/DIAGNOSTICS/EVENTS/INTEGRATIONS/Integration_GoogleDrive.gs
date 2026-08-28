/**
 * ============================================================
 * ALMOXA PRO — Integration_GoogleDrive.gs
 * Único ponto que fala com DriveApp para fins de integração
 * "externa" (upload/organização de documentos gerados pelo
 * sistema). Uso interno geral de Drive já é feito por Utils_File
 * e Backup_* — aqui é a camada de adapter para os módulos de
 * negócio (NF, Digitalização, Etiquetas).
 * ============================================================
 */
const Integration_GoogleDrive = (function () {
  function uploadFile(folderId, blob) {
    const folder = DriveApp.getFolderById(folderId);
    const file = folder.createFile(blob);
    return { fileId: file.getId(), url: file.getUrl() };
  }
  function healthCheck() {
    const folderId = Core_Config.get('DRIVE_FOLDER_ID');
    if (!folderId) return { status: CORE_CONSTANTS.DOCTOR_STATUS.NOT_CONFIGURED };
    try { DriveApp.getFolderById(folderId); return { status: CORE_CONSTANTS.DOCTOR_STATUS.OK }; }
    catch (e) { return { status: CORE_CONSTANTS.DOCTOR_STATUS.ERROR, error: e.message }; }
  }
  return { uploadFile, healthCheck };
})();
