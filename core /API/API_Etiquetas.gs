/**
 * ============================================================
 * ALMOXA PRO — API_Etiquetas.gs
 * Rotas expostas via Core_Router. Cada função é um handler fino:
 * delega a lógica para o Service correspondente e devolve o
 * Core_Response já formatado pelo Service.
 *
 * BLOCO 08 — rotas novas registradas (modelos, lote, ZPL, leitura
 * de QR) além das duas que já existiam desde a Fase 12.
 * ============================================================
 */
function generate_etiqueta(ctx) { return Service_Etiqueta.generate(ctx); }
function print_etiqueta(ctx) { return Service_Etiqueta.print(ctx); }
function gerarLote_etiqueta(ctx) { return Service_Etiqueta.gerarLote(ctx); }
function gerarZPL_etiqueta(ctx) { return Service_Etiqueta.gerarZPL(ctx); }
function lerQR_etiqueta(ctx) { return Service_Etiqueta.lerQR(ctx); }
function criarModelo_etiqueta(ctx) { return Service_Etiqueta.criarModelo(ctx); }
function listarModelos_etiqueta(ctx) { return Service_Etiqueta.listarModelos(ctx); }
function getModelo_etiqueta(ctx) { return Service_Etiqueta.getModelo(ctx); }
function atualizarModelo_etiqueta(ctx) { return Service_Etiqueta.atualizarModelo(ctx); }
function duplicarModelo_etiqueta(ctx) { return Service_Etiqueta.duplicarModelo(ctx); }
function excluirModelo_etiqueta(ctx) { return Service_Etiqueta.excluirModelo(ctx); }
function definirModeloPadrao_etiqueta(ctx) { return Service_Etiqueta.definirModeloPadrao(ctx); }

function API_Etiquetas_getRoutes() {
  return {
    'etiqueta.generate': generate_etiqueta,
    'etiqueta.print': print_etiqueta,
    'etiqueta.gerarLote': gerarLote_etiqueta,
    'etiqueta.gerarZPL': gerarZPL_etiqueta,
    'etiqueta.lerQR': lerQR_etiqueta,
    'etiqueta.criarModelo': criarModelo_etiqueta,
    'etiqueta.listarModelos': listarModelos_etiqueta,
    'etiqueta.getModelo': getModelo_etiqueta,
    'etiqueta.atualizarModelo': atualizarModelo_etiqueta,
    'etiqueta.duplicarModelo': duplicarModelo_etiqueta,
    'etiqueta.excluirModelo': excluirModelo_etiqueta,
    'etiqueta.definirModeloPadrao': definirModeloPadrao_etiqueta
  };
}

function API_Etiquetas_registerPermissions() {
  // BLOCO 08, seção 16 — ALMOXARIFE gera; GESTOR/OPERADOR consultam/leem; só ADMIN configura modelo.
  Auth_RBAC.registerActionPermission('etiqueta.generate', 'ETIQUETA.CREATE');
  Auth_RBAC.registerActionPermission('etiqueta.print', 'ETIQUETA.EXPORT');
  Auth_RBAC.registerActionPermission('etiqueta.gerarLote', 'ETIQUETA.CREATE');
  Auth_RBAC.registerActionPermission('etiqueta.gerarZPL', 'ETIQUETA.EXPORT');
  Auth_RBAC.registerActionPermission('etiqueta.lerQR', 'ETIQUETA.VIEW');
  Auth_RBAC.registerActionPermission('etiqueta.criarModelo', 'ETIQUETA.ADMIN');
  Auth_RBAC.registerActionPermission('etiqueta.listarModelos', 'ETIQUETA.VIEW');
  Auth_RBAC.registerActionPermission('etiqueta.getModelo', 'ETIQUETA.VIEW');
  Auth_RBAC.registerActionPermission('etiqueta.atualizarModelo', 'ETIQUETA.ADMIN');
  Auth_RBAC.registerActionPermission('etiqueta.duplicarModelo', 'ETIQUETA.ADMIN');
  Auth_RBAC.registerActionPermission('etiqueta.excluirModelo', 'ETIQUETA.ADMIN');
  Auth_RBAC.registerActionPermission('etiqueta.definirModeloPadrao', 'ETIQUETA.ADMIN');
}
