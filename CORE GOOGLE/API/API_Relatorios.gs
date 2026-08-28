/**
 * ============================================================
 * ALMOXA PRO — API_Relatorios.gs
 * Rotas expostas via Core_Router. Cada função é um handler fino:
 * delega a lógica para o Service correspondente e devolve o
 * Core_Response já formatado pelo Service (que hoje retorna
 * MODULE_NOT_IMPLEMENTED até a fase real entrar).
 * ============================================================
 */
function generate_relatorio(ctx) {
  return Service_Relatorio.generate(ctx);
}

function export_relatorio(ctx) {
  return Service_Relatorio.export(ctx);
}

function API_Relatorios_getRoutes() {
  return {
    'relatorio.generate': generate_relatorio,
    'relatorio.export': export_relatorio
  };
}

function API_Relatorios_registerPermissions() {
  Auth_RBAC.registerActionPermission('relatorio.generate', 'RELATORIO.VIEW');
  Auth_RBAC.registerActionPermission('relatorio.export', 'RELATORIO.EXPORT');
}

