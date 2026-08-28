/**
 * ============================================================
 * ALMOXA PRO — API_Configuracoes.gs
 * Rotas expostas via Core_Router. Cada função é um handler fino:
 * delega a lógica para o Service correspondente e devolve o
 * Core_Response já formatado pelo Service (que hoje retorna
 * MODULE_NOT_IMPLEMENTED até a fase real entrar).
 * ============================================================
 */
function get_config(ctx) {
  return Service_Config.get(ctx);
}

function update_config(ctx) {
  return Service_Config.update(ctx);
}

function API_Configuracoes_getRoutes() {
  return {
    'config.get': get_config,
    'config.update': update_config
  };
}

function API_Configuracoes_registerPermissions() {
  Auth_RBAC.registerActionPermission('config.get', 'CONFIG.VIEW');
  Auth_RBAC.registerActionPermission('config.update', 'CONFIG.CONFIG');
}

