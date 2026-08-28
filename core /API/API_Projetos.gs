/**
 * ============================================================
 * ALMOXA PRO — API_Projetos.gs
 * Rotas expostas via Core_Router. Cada função é um handler fino:
 * delega a lógica para o Service correspondente e devolve o
 * Core_Response já formatado pelo Service (que hoje retorna
 * MODULE_NOT_IMPLEMENTED até a fase real entrar).
 * ============================================================
 */
function get_projeto(ctx) {
  return Service_Projeto.get(ctx);
}

function create_projeto(ctx) {
  return Service_Projeto.create(ctx);
}

function update_projeto(ctx) {
  return Service_Projeto.update(ctx);
}

function API_Projetos_getRoutes() {
  return {
    'projeto.get': get_projeto,
    'projeto.create': create_projeto,
    'projeto.update': update_projeto
  };
}

function API_Projetos_registerPermissions() {
  Auth_RBAC.registerActionPermission('projeto.get', 'PROJETO.VIEW');
  Auth_RBAC.registerActionPermission('projeto.create', 'PROJETO.CREATE');
  Auth_RBAC.registerActionPermission('projeto.update', 'PROJETO.EDIT');
}

