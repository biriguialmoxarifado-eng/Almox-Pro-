/**
 * ============================================================
 * ALMOXA PRO — API_Notificacoes.gs
 * Rotas expostas via Core_Router. Cada função é um handler fino:
 * delega a lógica para o Service correspondente e devolve o
 * Core_Response já formatado pelo Service (que hoje retorna
 * MODULE_NOT_IMPLEMENTED até a fase real entrar).
 * ============================================================
 */
function list_notificacao(ctx) {
  return Service_Notificacao.list(ctx);
}

function read_notificacao(ctx) {
  return Service_Notificacao.read(ctx);
}

function send_notificacao(ctx) {
  return Service_Notificacao.send(ctx);
}

function API_Notificacoes_getRoutes() {
  return {
    'notificacao.list': list_notificacao,
    'notificacao.read': read_notificacao,
    'notificacao.send': send_notificacao
  };
}

function API_Notificacoes_registerPermissions() {
  Auth_RBAC.registerActionPermission('notificacao.list', 'NOTIFICACAO.VIEW');
  Auth_RBAC.registerActionPermission('notificacao.read', 'NOTIFICACAO.EDIT');
  Auth_RBAC.registerActionPermission('notificacao.send', 'NOTIFICACAO.CREATE');
}

