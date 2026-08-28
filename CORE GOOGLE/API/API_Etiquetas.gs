/**
 * ============================================================
 * ALMOXA PRO — API_Etiquetas.gs
 * Rotas expostas via Core_Router. Cada função é um handler fino:
 * delega a lógica para o Service correspondente e devolve o
 * Core_Response já formatado pelo Service (que hoje retorna
 * MODULE_NOT_IMPLEMENTED até a fase real entrar).
 * ============================================================
 */
function generate_etiqueta(ctx) {
  return Service_Etiqueta.generate(ctx);
}

function print_etiqueta(ctx) {
  return Service_Etiqueta.print(ctx);
}

function API_Etiquetas_getRoutes() {
  return {
    'etiqueta.generate': generate_etiqueta,
    'etiqueta.print': print_etiqueta
  };
}

function API_Etiquetas_registerPermissions() {
  Auth_RBAC.registerActionPermission('etiqueta.generate', 'ETIQUETA.CREATE');
  Auth_RBAC.registerActionPermission('etiqueta.print', 'ETIQUETA.EXPORT');
}

