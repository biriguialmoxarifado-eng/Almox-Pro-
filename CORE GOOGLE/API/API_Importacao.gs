/**
 * ============================================================
 * ALMOXA PRO — API_Importacao.gs
 * FASE 10 — NOVO (previsto no mapa de arquivos da spec, seção 4,
 * mas sem rotas listadas na seção 50 — nomenclatura escolhida
 * de forma consistente com o resto do sistema).
 * ============================================================
 */
function preview_importacao(ctx) {
  return Service_Importacao.preview(ctx);
}

function commit_importacao(ctx) {
  return Service_Importacao.commit(ctx);
}

function API_Importacao_getRoutes() {
  return {
    'importacao.preview': preview_importacao,
    'importacao.commit': commit_importacao
  };
}

function API_Importacao_registerPermissions() {
  Auth_RBAC.registerActionPermission('importacao.preview', 'IMPORTACAO.IMPORT');
  Auth_RBAC.registerActionPermission('importacao.commit', 'IMPORTACAO.IMPORT');
}
