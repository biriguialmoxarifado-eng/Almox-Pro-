/**
 * ============================================================
 * ALMOXA PRO — API_Obras.gs
 * Rotas expostas via Core_Router. Cada função é um handler fino:
 * delega a lógica para o Service correspondente e devolve o
 * Core_Response já formatado pelo Service (que hoje retorna
 * MODULE_NOT_IMPLEMENTED até a fase real entrar).
 * ============================================================
 */
function get_obra(ctx) {
  return Service_Obra.get(ctx);
}

function create_obra(ctx) {
  return Service_Obra.create(ctx);
}

function update_obra(ctx) {
  return Service_Obra.update(ctx);
}

function API_Obras_getRoutes() {
  return {
    'obra.get': get_obra,
    'obra.create': create_obra,
    'obra.update': update_obra
  };
}

function API_Obras_registerPermissions() {
  Auth_RBAC.registerActionPermission('obra.get', 'OBRA.VIEW');
  Auth_RBAC.registerActionPermission('obra.create', 'OBRA.CREATE');
  Auth_RBAC.registerActionPermission('obra.update', 'OBRA.EDIT');
}

