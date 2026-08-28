/**
 * ============================================================
 * ALMOXA PRO — API_Usuarios.gs
 * Rotas expostas via Core_Router. Cada função é um handler fino:
 * delega a lógica para o Service correspondente e devolve o
 * Core_Response já formatado pelo Service (que hoje retorna
 * MODULE_NOT_IMPLEMENTED até a fase real entrar).
 * ============================================================
 */
function get_usuario(ctx) {
  return Service_Usuario.get(ctx);
}

function search_usuario(ctx) {
  return Service_Usuario.search(ctx);
}

function create_usuario(ctx) {
  return Service_Usuario.create(ctx);
}

function update_usuario(ctx) {
  return Service_Usuario.update(ctx);
}

function API_Usuarios_getRoutes() {
  return {
    'usuario.get': get_usuario,
    'usuario.search': search_usuario,
    'usuario.create': create_usuario,
    'usuario.update': update_usuario
  };
}

function API_Usuarios_registerPermissions() {
  Auth_RBAC.registerActionPermission('usuario.get', 'USUARIO.VIEW');
  Auth_RBAC.registerActionPermission('usuario.search', 'USUARIO.VIEW');
  Auth_RBAC.registerActionPermission('usuario.create', 'USUARIO.ADMIN');
  Auth_RBAC.registerActionPermission('usuario.update', 'USUARIO.ADMIN');
}

