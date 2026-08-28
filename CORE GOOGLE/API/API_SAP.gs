/**
 * ============================================================
 * ALMOXA PRO — API_SAP.gs
 * Rotas expostas via Core_Router. Cada função é um handler fino:
 * delega a lógica para o Service correspondente e devolve o
 * Core_Response já formatado pelo Service (que hoje retorna
 * MODULE_NOT_IMPLEMENTED até a fase real entrar).
 * ============================================================
 */
function import_sap(ctx) {
  return Service_SAP.import(ctx);
}

function validate_sap(ctx) {
  return Service_SAP.validate(ctx);
}

function export_sap(ctx) {
  return Service_SAP.export(ctx);
}

function API_SAP_getRoutes() {
  return {
    'sap.import': import_sap,
    'sap.validate': validate_sap,
    'sap.export': export_sap
  };
}

function API_SAP_registerPermissions() {
  Auth_RBAC.registerActionPermission('sap.import', 'SAP.IMPORT');
  Auth_RBAC.registerActionPermission('sap.validate', 'SAP.EDIT');
  Auth_RBAC.registerActionPermission('sap.export', 'SAP.EXPORT');
}

