/**
 * ============================================================
 * ALMOXA PRO — API_IA.gs
 * FASE 12 — NOVO (o módulo MOD_15_IA existia desde a Fase 1, mas
 * nunca tinha arquivo de API/rotas — Service_IA ficava sem
 * ninguém pra chamar).
 * ============================================================
 */
function sugerirCompra_ia(ctx) {
  return Service_IA.sugerirCompra(ctx);
}

function detectarAnomalias_ia(ctx) {
  return Service_IA.detectarAnomalias(ctx);
}

function analisarConsumo_ia(ctx) {
  return Service_IA.analisarConsumo(ctx);
}

function API_IA_getRoutes() {
  return {
    'ia.sugerirCompra': sugerirCompra_ia,
    'ia.detectarAnomalias': detectarAnomalias_ia,
    'ia.analisarConsumo': analisarConsumo_ia
  };
}

function API_IA_registerPermissions() {
  Auth_RBAC.registerActionPermission('ia.sugerirCompra', 'IA.VIEW');
  Auth_RBAC.registerActionPermission('ia.detectarAnomalias', 'IA.VIEW');
  Auth_RBAC.registerActionPermission('ia.analisarConsumo', 'IA.VIEW');
}
