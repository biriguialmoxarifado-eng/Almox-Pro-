/**
 * ============================================================
 * ALMOXA PRO — Doctor_Core.gs
 * Contrato de módulo do Doutor (registra as rotas doctor.*).
 * ============================================================
 */
const Doctor_Core = (function () {
  const MODULE_ID = 'DOUTOR';

  function health(ctx) { return Core_Response.ok(Doctor_Health.check(), '', 'SUCCESS', {}, ctx.requestId); }
  function modules(ctx) { return Core_Response.ok(Doctor_Modules.check(), '', 'SUCCESS', {}, ctx.requestId); }
  function diagnostics(ctx) { return Core_Response.ok(Doctor_Report.generate(), '', 'SUCCESS', {}, ctx.requestId); }
  function recovery(ctx) {
    const problema = ctx.payload && ctx.payload.problema;
    return Core_Response.ok({
      sugestao: Doctor_Recovery.suggestFor(problema),
      ultimaVersaoFuncional: Doctor_Recovery.ultimaVersaoFuncional(),
      backupsDisponiveis: Doctor_Recovery.backupsDisponiveis()
    }, '', 'SUCCESS', {}, ctx.requestId);
  }
  // MÓDULO 08 — diagnósticos por seção, pra quem só quer uma parte
  // (composição em cima do que já existe, não duplica o generate()).
  function permissions(ctx) { return Core_Response.ok(Doctor_Permissions.check(), '', 'SUCCESS', {}, ctx.requestId); }
  function dependencies(ctx) { return Core_Response.ok(Doctor_Dependencies.check(), '', 'SUCCESS', {}, ctx.requestId); }
  function backupStatus(ctx) { return Core_Response.ok(Doctor_Backup.check(), '', 'SUCCESS', {}, ctx.requestId); }
  function errorAudit(ctx) { return Core_Response.ok(Doctor_ErrorAudit.check((ctx.payload || {}).janelaDias), '', 'SUCCESS', {}, ctx.requestId); }
  // MÓDULO 17 — contrato sintetizado por módulo / mapa do sistema inteiro.
  function moduleContract(ctx) {
    const { moduloId } = ctx.payload || {};
    if (!moduloId) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'moduloId é obrigatório.', {}, ctx.requestId);
    const contrato = Doctor_Contracts.describe(moduloId);
    if (!contrato) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Módulo não encontrado: ' + moduloId, {}, ctx.requestId);
    return Core_Response.ok(contrato, '', 'SUCCESS', {}, ctx.requestId);
  }
  function systemMap(ctx) { return Core_Response.ok(Doctor_Contracts.mapaDoSistema(), '', 'SUCCESS', {}, ctx.requestId); }
  // MÓDULO 14 — teste de comunicação em cadeia (não isolada).
  function communication(ctx) { return Core_Response.ok(Doctor_Communication.testarCadeia(), '', 'SUCCESS', {}, ctx.requestId); }

  function getRoutes() {
    return {
      'doctor.health': health,
      'doctor.modules': modules,
      'doctor.diagnostics': diagnostics,
      'doctor.recovery': recovery,
      'doctor.permissions': permissions,
      'doctor.dependencies': dependencies,
      'doctor.backup': backupStatus,
      'doctor.errorAudit': errorAudit,
      'doctor.moduleContract': moduleContract,
      'doctor.systemMap': systemMap,
      'doctor.communication': communication
    };
  }
  function getServices() { return { Doctor_Core, Doctor_Database, Doctor_Modules, Doctor_API, Doctor_Health, Doctor_Recovery, Doctor_Report, Doctor_Permissions, Doctor_Dependencies, Doctor_Backup, Doctor_ErrorAudit, Doctor_History, Doctor_Contracts, Doctor_Communication }; }
  function getEvents() { return []; }
  function getVersion() { return '2.0.0'; }
  function init() {
    // FASE 8 (Front Mobile) — bug corrigido: estas rotas nunca
    // tinham permissão registrada, caindo no padrão VIEW (que
    // todo perfil autenticado tem, inclusive OPERADOR). O
    // diagnóstico completo do sistema — status de banco,
    // integrações, módulos — deveria ser só de ADMIN.
    Auth_RBAC.registerActionPermission('doctor.health', 'DOCTOR.ADMIN');
    Auth_RBAC.registerActionPermission('doctor.modules', 'DOCTOR.ADMIN');
    Auth_RBAC.registerActionPermission('doctor.diagnostics', 'DOCTOR.ADMIN');
    Auth_RBAC.registerActionPermission('doctor.recovery', 'DOCTOR.ADMIN');
    Auth_RBAC.registerActionPermission('doctor.permissions', 'DOCTOR.ADMIN');
    Auth_RBAC.registerActionPermission('doctor.dependencies', 'DOCTOR.ADMIN');
    Auth_RBAC.registerActionPermission('doctor.backup', 'DOCTOR.ADMIN');
    Auth_RBAC.registerActionPermission('doctor.errorAudit', 'DOCTOR.ADMIN');
    Auth_RBAC.registerActionPermission('doctor.moduleContract', 'DOCTOR.ADMIN');
    Auth_RBAC.registerActionPermission('doctor.systemMap', 'DOCTOR.ADMIN');
    Auth_RBAC.registerActionPermission('doctor.communication', 'DOCTOR.ADMIN');
  }
  function healthCheck() { return { status: CORE_CONSTANTS.DOCTOR_STATUS.OK }; }

  return { health, modules, diagnostics, recovery, getRoutes, getServices, getEvents, getVersion, init, healthCheck, id: MODULE_ID };
})();
