/**
 * ============================================================
 * ALMOXA PRO — Backup_Core.gs
 * Contrato de módulo do Backup (rotas backup.*).
 * ============================================================
 */
const Backup_Core = (function () {
  const MODULE_ID = 'BACKUP';

  function create(ctx) {
    const folderId = Core_Config.get('DRIVE_FOLDER_BACKUP');
    if (!folderId) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.EXTERNAL_INTEGRATION_NOT_CONFIGURED, 'DRIVE_FOLDER_BACKUP não configurado.', {}, ctx.requestId);
    }
    const result = Backup_Sheets.backupNow(folderId);
    DB_Insert.insert('BACKUPS', { data: new Date(), versao: Core_Version.get('APP_VERSION'), responsavel: ctx.userId, arquivosJson: JSON.stringify(result), status: 'CONCLUIDO' });
    Audit_Service.record(ctx, 'BACKUP_REALIZADO', result);
    return Core_Response.ok(result, 'Backup realizado.', 'SUCCESS', {}, ctx.requestId);
  }

  function verify(ctx) {
    return Core_Response.ok(Backup_Verification.verify(ctx.payload.fileId), '', 'SUCCESS', {}, ctx.requestId);
  }

  function restore(ctx) {
    const result = Backup_Restore.restore(ctx.payload.fileId, ctx.payload.confirm);
    return Core_Response.ok(result, '', 'SUCCESS', {}, ctx.requestId);
  }

  function getRoutes() {
    return { 'backup.create': create, 'backup.verify': verify, 'backup.restore': restore };
  }
  function getServices() { return { Backup_Core, Backup_Sheets, Backup_Files, Backup_Config, Backup_Restore, Backup_Verification }; }
  function getEvents() { return ['BACKUP_REALIZADO']; }
  function getVersion() { return '1.0.0'; }
  function init() {}
  function healthCheck() {
    const configured = !!Core_Config.get('DRIVE_FOLDER_BACKUP');
    return { status: configured ? CORE_CONSTANTS.DOCTOR_STATUS.OK : CORE_CONSTANTS.DOCTOR_STATUS.NOT_CONFIGURED };
  }

  return { create, verify, restore, getRoutes, getServices, getEvents, getVersion, init, healthCheck, id: MODULE_ID };
})();
