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
  // BLOCO 07, seção 14 — "quem pode acessar informações
  // financeiras" nunca era checado separadamente. Não é uma rota
  // HTTP própria — é uma checagem interna que `Service_Relatorio
  // .generate()` faz via `Auth_RBAC.can()` antes de rodar um
  // relatório da lista `TIPOS_FINANCEIROS`. 'AUDIT' é o nível de
  // confiança certo no vocabulário já existente (GESTOR/AUDITOR/
  // ADMIN têm, ALMOXARIFE/OPERADOR não têm).
  Auth_RBAC.registerActionPermission('relatorio.financeiro', 'RELATORIO.AUDIT');
}

