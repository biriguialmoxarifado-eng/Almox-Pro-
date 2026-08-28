/**
 * ============================================================
 * ALMOXA PRO — API_Conferencia.gs
 * Rotas expostas via Core_Router. Cada função é um handler fino:
 * delega a lógica para o Service correspondente e devolve o
 * Core_Response já formatado pelo Service (que hoje retorna
 * MODULE_NOT_IMPLEMENTED até a fase real entrar).
 * ============================================================
 */
function start_conferencia(ctx) {
  return Service_Conferencia.start(ctx);
}

function scan_conferencia(ctx) {
  return Service_Conferencia.scan(ctx);
}

function manual_conferencia(ctx) {
  return Service_Conferencia.manual(ctx);
}

function finish_conferencia(ctx) {
  return Service_Conferencia.finish(ctx);
}

function divergence_conferencia(ctx) {
  return Service_Conferencia.divergence(ctx);
}

function API_Conferencia_getRoutes() {
  return {
    'conferencia.start': start_conferencia,
    'conferencia.scan': scan_conferencia,
    'conferencia.manual': manual_conferencia,
    'conferencia.finish': finish_conferencia,
    'conferencia.divergence': divergence_conferencia
  };
}

function API_Conferencia_registerPermissions() {
  Auth_RBAC.registerActionPermission('conferencia.start', 'CONFERENCIA.EDIT');
  Auth_RBAC.registerActionPermission('conferencia.scan', 'CONFERENCIA.EDIT');
  Auth_RBAC.registerActionPermission('conferencia.manual', 'CONFERENCIA.EDIT');
  Auth_RBAC.registerActionPermission('conferencia.finish', 'CONFERENCIA.EDIT');
  Auth_RBAC.registerActionPermission('conferencia.divergence', 'CONFERENCIA.VIEW');
}

