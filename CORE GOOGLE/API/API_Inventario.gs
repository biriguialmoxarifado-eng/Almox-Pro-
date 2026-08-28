/**
 * ============================================================
 * ALMOXA PRO — API_Inventario.gs
 * Rotas expostas via Core_Router. Cada função é um handler fino:
 * delega a lógica para o Service correspondente e devolve o
 * Core_Response já formatado pelo Service (que hoje retorna
 * MODULE_NOT_IMPLEMENTED até a fase real entrar).
 * ============================================================
 */
function create_inventario(ctx) {
  return Service_Inventario.create(ctx);
}

function open_inventario(ctx) {
  return Service_Inventario.open(ctx);
}

function scan_inventario(ctx) {
  return Service_Inventario.scan(ctx);
}

function count_inventario(ctx) {
  return Service_Inventario.count(ctx);
}

function recount_inventario(ctx) {
  return Service_Inventario.recount(ctx);
}

function approve_inventario(ctx) {
  return Service_Inventario.approve(ctx);
}

function finish_inventario(ctx) {
  return Service_Inventario.finish(ctx);
}

function API_Inventario_getRoutes() {
  return {
    'inventario.create': create_inventario,
    'inventario.open': open_inventario,
    'inventario.scan': scan_inventario,
    'inventario.count': count_inventario,
    'inventario.recount': recount_inventario,
    'inventario.approve': approve_inventario,
    'inventario.finish': finish_inventario
  };
}

function API_Inventario_registerPermissions() {
  Auth_RBAC.registerActionPermission('inventario.create', 'INVENTARIO.CREATE');
  Auth_RBAC.registerActionPermission('inventario.open', 'INVENTARIO.EDIT');
  Auth_RBAC.registerActionPermission('inventario.scan', 'INVENTARIO.EDIT');
  Auth_RBAC.registerActionPermission('inventario.count', 'INVENTARIO.EDIT');
  Auth_RBAC.registerActionPermission('inventario.recount', 'INVENTARIO.EDIT');
  Auth_RBAC.registerActionPermission('inventario.approve', 'INVENTARIO.APPROVE');
  Auth_RBAC.registerActionPermission('inventario.finish', 'INVENTARIO.EDIT');
}

