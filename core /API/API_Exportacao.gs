/**
 * ============================================================
 * ALMOXA PRO — API_Exportacao.gs
 * FASE 10 — NOVO (mesmo caso do API_Importacao — arquivo previsto
 * na spec, rota nomeada de forma consistente com o resto).
 * ============================================================
 */
function generic_exportacao(ctx) {
  return Service_Exportacao.generic(ctx);
}

function API_Exportacao_getRoutes() {
  return {
    'exportacao.generic': generic_exportacao
  };
}

function API_Exportacao_registerPermissions() {
  Auth_RBAC.registerActionPermission('exportacao.generic', 'EXPORTACAO.EXPORT');
}
