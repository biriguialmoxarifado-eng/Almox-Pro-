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

function salvarFoto_usuario(ctx) {
  return Service_Usuario.salvarFoto(ctx);
}

function API_Usuarios_getRoutes() {
  return {
    'usuario.get': get_usuario,
    'usuario.search': search_usuario,
    'usuario.create': create_usuario,
    'usuario.update': update_usuario,
    'usuario.salvarFoto': salvarFoto_usuario
  };
}

function API_Usuarios_registerPermissions() {
  Auth_RBAC.registerActionPermission('usuario.get', 'USUARIO.VIEW');
  Auth_RBAC.registerActionPermission('usuario.search', 'USUARIO.VIEW');
  Auth_RBAC.registerActionPermission('usuario.create', 'USUARIO.ADMIN');
  Auth_RBAC.registerActionPermission('usuario.update', 'USUARIO.ADMIN');
  // usuario.salvarFoto fica DE PROPÓSITO sem permissão registrada
  // aqui — ela cai no padrão VIEW (que todo perfil autenticado
  // tem, inclusive o OPERADOR do autocadastro da loja). A
  // autorização de verdade é a própria sessão: o Service usa
  // ctx.userId (vindo do token), nunca um id do payload — então
  // não tem como alguém salvar foto de outra pessoa por aqui.
}

