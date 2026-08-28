/**
 * ============================================================
 * ALMOXA PRO — API_Dashboard.gs
 * Rotas expostas via Core_Router. Cada função é um handler fino:
 * delega a lógica para o Service correspondente e devolve o
 * Core_Response já formatado pelo Service (que hoje retorna
 * MODULE_NOT_IMPLEMENTED até a fase real entrar).
 * ============================================================
 */
function get_dashboard(ctx) {
  return Service_Dashboard.get(ctx);
}

function API_Dashboard_getRoutes() {
  return {
    'dashboard.get': get_dashboard
  };
}

function API_Dashboard_registerPermissions() {
  Auth_RBAC.registerActionPermission('dashboard.get', 'DASHBOARD.VIEW');
}

