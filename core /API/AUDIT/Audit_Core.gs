/**
 * ============================================================
 * ALMOXA PRO — Audit_Core.gs  (CAMADA 4)
 * Contrato de módulo da Auditoria (para o Registry/Doctor).
 * ============================================================
 */

const Audit_Core = (function () {
  const MODULE_ID = 'AUDITORIA';

  function getRoutes() {
    return {
      'auditoria.search': (ctx) => Core_Response.ok(Audit_Service.search(ctx.payload || {}), '', 'SUCCESS', {}, ctx.requestId),
      'auditoria.get': (ctx) => {
        const row = DB_Query.get('AUDITORIA', ctx.payload.id);
        return row ? Core_Response.ok(row, '', 'SUCCESS', {}, ctx.requestId)
                    : Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Registro não encontrado.', {}, ctx.requestId);
      }
    };
  }
  function getServices() { return { Audit_Service }; }
  function getEvents() { return []; }
  function getVersion() { return '1.0.0'; }
  function init() {}
  function healthCheck() { return { status: CORE_CONSTANTS.DOCTOR_STATUS.OK }; }

  return { getRoutes, getServices, getEvents, getVersion, init, healthCheck, id: MODULE_ID };
})();
