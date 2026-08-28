/**
 * ============================================================
 * ALMOXA PRO — API_Atividades.gs
 * Rotas expostas via Core_Router. Cada função é um handler fino:
 * delega a lógica para o Service correspondente e devolve o
 * Core_Response já formatado pelo Service (que hoje retorna
 * MODULE_NOT_IMPLEMENTED até a fase real entrar).
 * ============================================================
 */
function get_atividade(ctx) {
  return Service_Atividade.get(ctx);
}

function create_atividade(ctx) {
  return Service_Atividade.create(ctx);
}

function update_atividade(ctx) {
  return Service_Atividade.update(ctx);
}

function progress_atividade(ctx) {
  return Service_Atividade.progress(ctx);
}

function API_Atividades_getRoutes() {
  return {
    'atividade.get': get_atividade,
    'atividade.create': create_atividade,
    'atividade.update': update_atividade,
    'atividade.progress': progress_atividade
  };
}

function API_Atividades_registerPermissions() {
  Auth_RBAC.registerActionPermission('atividade.get', 'ATIVIDADE.VIEW');
  Auth_RBAC.registerActionPermission('atividade.create', 'ATIVIDADE.CREATE');
  Auth_RBAC.registerActionPermission('atividade.update', 'ATIVIDADE.EDIT');
  Auth_RBAC.registerActionPermission('atividade.progress', 'ATIVIDADE.EDIT');
}

