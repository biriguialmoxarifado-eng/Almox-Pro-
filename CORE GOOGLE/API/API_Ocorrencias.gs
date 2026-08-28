/**
 * ============================================================
 * ALMOXA PRO — API_Ocorrencias.gs
 * Rotas expostas via Core_Router. Cada função é um handler fino:
 * delega a lógica para o Service correspondente e devolve o
 * Core_Response já formatado pelo Service (que hoje retorna
 * MODULE_NOT_IMPLEMENTED até a fase real entrar).
 * ============================================================
 */
function create_ocorrencia(ctx) {
  return Service_Ocorrencia.create(ctx);
}

function update_ocorrencia(ctx) {
  return Service_Ocorrencia.update(ctx);
}

function resolve_ocorrencia(ctx) {
  return Service_Ocorrencia.resolve(ctx);
}

function API_Ocorrencias_getRoutes() {
  return {
    'ocorrencia.create': create_ocorrencia,
    'ocorrencia.update': update_ocorrencia,
    'ocorrencia.resolve': resolve_ocorrencia
  };
}

function API_Ocorrencias_registerPermissions() {
  Auth_RBAC.registerActionPermission('ocorrencia.create', 'OCORRENCIA.CREATE');
  Auth_RBAC.registerActionPermission('ocorrencia.update', 'OCORRENCIA.EDIT');
  Auth_RBAC.registerActionPermission('ocorrencia.resolve', 'OCORRENCIA.EDIT');
}

