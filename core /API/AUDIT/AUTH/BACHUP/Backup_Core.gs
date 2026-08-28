/**
 * ============================================================
 * ALMOXA PRO — Backup_Core.gs
 * Contrato de módulo do Backup (rotas backup.*).
 * ============================================================
 */
/**
 * ============================================================
 * ALMOXA PRO — Backup_Core.gs
 * Contrato de módulo do Backup (rotas backup.*).
 *
 * MÓDULO 13 (contrato "Backup, Versionamento e Restauração") —
 * BUG DE SEGURANÇA REAL CORRIGIDO: `init()` estava vazio desde
 * sempre — nenhuma das 3 rotas (`create`/`verify`/`restore`)
 * tinha permissão registrada, caindo no padrão VIEW (qualquer
 * usuário autenticado, inclusive OPERADOR, conseguia chamar
 * `backup.restore`). Mesma classe de bug já encontrada e
 * corrigida em `usuario.*` (Fase 3), `notificacao.read` (Fase 4),
 * `reserva.get/calendar` (Fase 6) e `doctor.*` (Fase 8) — o
 * `Doctor_Permissions` do Módulo 08 teria pegado isso
 * automaticamente se já existisse quando este arquivo foi
 * escrito. Corrigido agora, antes de qualquer teste.
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
    const tipo = (ctx.payload && ctx.payload.tipo === 'AUTOMATICO') ? 'AUTOMATICO' : 'MANUAL'; // MÓDULO 13 — distingue automático de manual (seção 1/2 do contrato)
    const registro = DB_Insert.insert('BACKUPS', { data: new Date(), versao: Core_Version.get('APP_VERSION'), responsavel: ctx.userId, arquivosJson: JSON.stringify(result), status: 'CONCLUIDO', tipo });
    Audit_Service.record(ctx, 'BACKUP_REALIZADO', { entidade: 'BACKUPS', entidadeId: registro.ID, resultado: tipo });
    return Core_Response.ok(Object.assign({}, result, { ID: registro.ID, tipo }), 'Backup realizado.', 'SUCCESS', {}, ctx.requestId);
  }

  function verify(ctx) {
    return Core_Response.ok(Backup_Verification.verify(ctx.payload.fileId), '', 'SUCCESS', {}, ctx.requestId);
  }

  /**
   * MÓDULO 13, seção 4: "registrar quem executou, registrar
   * quando executou, preservar histórico da operação" — antes,
   * uma tentativa de restauração (mesmo bloqueada por falta de
   * `confirm:true`, mesmo com backup corrompido) não deixava
   * NENHUM rastro. Agora toda tentativa é auditada, sucesso ou não.
   */
  function restore(ctx) {
    try {
      const result = Backup_Restore.restore(ctx.payload.fileId, ctx.payload.confirm);
      Audit_Service.record(ctx, 'BACKUP_RESTAURACAO_SOLICITADA', { entidade: 'BACKUPS', entidadeId: ctx.payload.fileId, resultado: result.status });
      return Core_Response.ok(result, '', 'SUCCESS', {}, ctx.requestId);
    } catch (e) {
      Audit_Service.record(ctx, 'BACKUP_RESTAURACAO_FALHOU', { entidade: 'BACKUPS', entidadeId: ctx.payload.fileId, resultado: 'ERRO: ' + e.message });
      return Core_Response.error(e.code || CORE_CONSTANTS.RESPONSE_CODES.INTERNAL_ERROR, e.message, {}, ctx.requestId);
    }
  }

  function getRoutes() {
    return { 'backup.create': create, 'backup.verify': verify, 'backup.restore': restore };
  }
  function getServices() { return { Backup_Core, Backup_Sheets, Backup_Files, Backup_Config, Backup_Restore, Backup_Verification }; }
  function getEvents() { return ['BACKUP_REALIZADO']; }
  function getVersion() { return '1.1.0'; }
  function init() {
    // Backup e restauração são operações de risco real sobre
    // TODO o banco — sem exceção self-scope, sempre ADMIN.
    Auth_RBAC.registerActionPermission('backup.create', 'BACKUP.ADMIN');
    Auth_RBAC.registerActionPermission('backup.verify', 'BACKUP.ADMIN');
    Auth_RBAC.registerActionPermission('backup.restore', 'BACKUP.ADMIN');
  }
  function healthCheck() {
    const configured = !!Core_Config.get('DRIVE_FOLDER_BACKUP');
    return { status: configured ? CORE_CONSTANTS.DOCTOR_STATUS.OK : CORE_CONSTANTS.DOCTOR_STATUS.NOT_CONFIGURED };
  }

  return { create, verify, restore, getRoutes, getServices, getEvents, getVersion, init, healthCheck, id: MODULE_ID };
})();
