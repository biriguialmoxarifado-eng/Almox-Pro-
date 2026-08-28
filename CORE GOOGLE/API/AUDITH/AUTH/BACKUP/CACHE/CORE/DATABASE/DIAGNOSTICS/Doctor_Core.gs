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
    return Core_Response.ok({ sugestao: Doctor_Recovery.suggestFor(problema) }, '', 'SUCCESS', {}, ctx.requestId);
  }

  function getRoutes() {
    return {
      'doctor.health': health,
      'doctor.modules': modules,
      'doctor.diagnostics': diagnostics,
      'doctor.recovery': recovery
    };
  }
  function getServices() { return { Doctor_Core, Doctor_Database, Doctor_Modules, Doctor_API, Doctor_Health, Doctor_Recovery, Doctor_Report }; }
  function getEvents() { return []; }
  function getVersion() { return '1.0.0'; }
  function init() {}
  function healthCheck() { return { status: CORE_CONSTANTS.DOCTOR_STATUS.OK }; }

  return { health, modules, diagnostics, recovery, getRoutes, getServices, getEvents, getVersion, init, healthCheck, id: MODULE_ID };
})();
