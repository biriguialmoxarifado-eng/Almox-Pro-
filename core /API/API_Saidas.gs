/**
 * ============================================================
 * ALMOXA PRO — API_Saidas.gs
 * Rotas expostas via Core_Router. Cada função é um handler fino:
 * delega a lógica para o Service correspondente e devolve o
 * Core_Response já formatado pelo Service (que hoje retorna
 * MODULE_NOT_IMPLEMENTED até a fase real entrar).
 * ============================================================
 */
function create_saida(ctx) {
  return Service_Saida.create(ctx);
}

function confirm_saida(ctx) {
  return Service_Saida.confirm(ctx);
}

function cancel_saida(ctx) {
  return Service_Saida.cancel(ctx);
}

function API_Saidas_getRoutes() {
  return {
    'saida.create': create_saida,
    'saida.confirm': confirm_saida,
    'saida.cancel': cancel_saida
  };
}

function API_Saidas_registerPermissions() {
  Auth_RBAC.registerActionPermission('saida.create', 'SAIDA.CREATE');
  Auth_RBAC.registerActionPermission('saida.confirm', 'SAIDA.EDIT');
  Auth_RBAC.registerActionPermission('saida.cancel', 'SAIDA.EDIT');
}

