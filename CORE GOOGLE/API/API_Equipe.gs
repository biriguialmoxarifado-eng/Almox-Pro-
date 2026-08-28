/**
 * ============================================================
 * ALMOXA PRO — API_Equipe.gs
 * Rotas expostas via Core_Router. Cada função é um handler fino:
 * delega a lógica para o Service correspondente e devolve o
 * Core_Response já formatado pelo Service (que hoje retorna
 * MODULE_NOT_IMPLEMENTED até a fase real entrar).
 * ============================================================
 */
function get_equipe(ctx) {
  return Service_Equipe.get(ctx);
}

function assign_equipe(ctx) {
  return Service_Equipe.assign(ctx);
}

function API_Equipe_getRoutes() {
  return {
    'equipe.get': get_equipe,
    'equipe.assign': assign_equipe
  };
}

function API_Equipe_registerPermissions() {
  Auth_RBAC.registerActionPermission('equipe.get', 'EQUIPE.VIEW');
  Auth_RBAC.registerActionPermission('equipe.assign', 'EQUIPE.EDIT');
}

