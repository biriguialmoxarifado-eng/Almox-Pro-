/**
 * ============================================================
 * ALMOXA PRO — API_Estoque.gs
 * Rotas expostas via Core_Router. Cada função é um handler fino:
 * delega a lógica para o Service correspondente e devolve o
 * Core_Response já formatado pelo Service (que hoje retorna
 * MODULE_NOT_IMPLEMENTED até a fase real entrar).
 * ============================================================
 */
function get_estoque(ctx) {
  return Service_Estoque.get(ctx);
}

function search_estoque(ctx) {
  return Service_Estoque.search(ctx);
}

function entry_estoque(ctx) {
  return Service_Estoque.entry(ctx);
}

function exit_estoque(ctx) {
  return Service_Estoque.exit(ctx);
}

function transfer_estoque(ctx) {
  return Service_Estoque.transfer(ctx);
}

function adjust_estoque(ctx) {
  return Service_Estoque.adjust(ctx);
}

function history_estoque(ctx) {
  return Service_Estoque.history(ctx);
}

function setMinimo_estoque(ctx) {
  return Service_Estoque.setMinimo(ctx);
}

function API_Estoque_getRoutes() {
  return {
    'estoque.get': get_estoque,
    'estoque.search': search_estoque,
    'estoque.entry': entry_estoque,
    'estoque.exit': exit_estoque,
    'estoque.transfer': transfer_estoque,
    'estoque.adjust': adjust_estoque,
    'estoque.history': history_estoque,
    'estoque.setMinimo': setMinimo_estoque
  };
}

function API_Estoque_registerPermissions() {
  Auth_RBAC.registerActionPermission('estoque.get', 'ESTOQUE.VIEW');
  Auth_RBAC.registerActionPermission('estoque.search', 'ESTOQUE.VIEW');
  Auth_RBAC.registerActionPermission('estoque.entry', 'ESTOQUE.EDIT');
  Auth_RBAC.registerActionPermission('estoque.exit', 'ESTOQUE.EDIT');
  Auth_RBAC.registerActionPermission('estoque.transfer', 'ESTOQUE.EDIT');
  Auth_RBAC.registerActionPermission('estoque.adjust', 'ESTOQUE.EDIT');
  Auth_RBAC.registerActionPermission('estoque.history', 'ESTOQUE.VIEW');
  Auth_RBAC.registerActionPermission('estoque.setMinimo', 'ESTOQUE.EDIT');
}

