/**
 * ============================================================
 * ALMOXA PRO — API_Inventario.gs
 * Rotas expostas via Core_Router. Cada função é um handler fino:
 * delega a lógica para o Service correspondente e devolve o
 * Core_Response já formatado pelo Service (que hoje retorna
 * MODULE_NOT_IMPLEMENTED até a fase real entrar).
 * ============================================================
 */
function create_inventario(ctx) {
  return Service_Inventario.create(ctx);
}

function open_inventario(ctx) {
  return Service_Inventario.open(ctx);
}

function scan_inventario(ctx) {
  return Service_Inventario.scan(ctx);
}

function count_inventario(ctx) {
  return Service_Inventario.count(ctx);
}

function recount_inventario(ctx) {
  return Service_Inventario.recount(ctx);
}

function approve_inventario(ctx) {
  return Service_Inventario.approve(ctx);
}

function finish_inventario(ctx) {
  return Service_Inventario.finish(ctx);
}

function justificarDivergencia_inventario(ctx) {
  return Service_Inventario.justificarDivergencia(ctx);
}

function liberar_inventario(ctx) {
  return Service_Inventario.liberar(ctx);
}

function get_inventario(ctx) {
  return Service_Inventario.get(ctx);
}

function listar_inventario(ctx) {
  return Service_Inventario.listar(ctx);
}

function relatorio_inventario(ctx) {
  return Service_Inventario.relatorio(ctx);
}

function gerarInventarioD1_inventario(ctx) {
  return Service_Inventario.gerarInventarioD1(ctx);
}

// BLOCO 04 — inventario.cancelar nunca existia; CANCELADO estava
// reservado no enum desde sempre, sem nenhuma rota alcançando ele.
function cancelar_inventario(ctx) {
  return Service_Inventario.cancelar(ctx);
}

function API_Inventario_getRoutes() {
  return {
    'inventario.create': create_inventario,
    'inventario.liberar': liberar_inventario,
    'inventario.open': open_inventario,
    'inventario.scan': scan_inventario,
    'inventario.count': count_inventario,
    'inventario.recount': recount_inventario,
    'inventario.approve': approve_inventario,
    'inventario.finish': finish_inventario,
    'inventario.justificarDivergencia': justificarDivergencia_inventario,
    'inventario.get': get_inventario,
    'inventario.listar': listar_inventario,
    'inventario.relatorio': relatorio_inventario,
    'inventario.gerarInventarioD1': gerarInventarioD1_inventario,
    'inventario.cancelar': cancelar_inventario
  };
}

function API_Inventario_registerPermissions() {
  Auth_RBAC.registerActionPermission('inventario.create', 'INVENTARIO.CREATE');
  Auth_RBAC.registerActionPermission('inventario.liberar', 'INVENTARIO.EDIT');
  Auth_RBAC.registerActionPermission('inventario.open', 'INVENTARIO.EDIT');
  // MÓDULO 04: scan/count/recount viram self-scope real — a spec
  // quer "operador conta quando autorizado", e antes EDIT
  // bloqueava OPERADOR completamente, mesmo autorizado pela
  // equipe do inventário. A autorização de verdade agora é
  // `_podeContar()` dentro do Service (dono/equipe ou gestão),
  // não mais só o papel — mesmo padrão já usado em
  // usuario.salvarFoto e notificacao.read.
  Auth_RBAC.registerActionPermission('inventario.scan', 'INVENTARIO.VIEW');
  Auth_RBAC.registerActionPermission('inventario.count', 'INVENTARIO.VIEW');
  Auth_RBAC.registerActionPermission('inventario.recount', 'INVENTARIO.VIEW');
  Auth_RBAC.registerActionPermission('inventario.approve', 'INVENTARIO.APPROVE');
  Auth_RBAC.registerActionPermission('inventario.finish', 'INVENTARIO.EDIT');
  Auth_RBAC.registerActionPermission('inventario.justificarDivergencia', 'INVENTARIO.EDIT');
  Auth_RBAC.registerActionPermission('inventario.get', 'INVENTARIO.VIEW');
  Auth_RBAC.registerActionPermission('inventario.listar', 'INVENTARIO.VIEW');
  Auth_RBAC.registerActionPermission('inventario.relatorio', 'INVENTARIO.VIEW');
  Auth_RBAC.registerActionPermission('inventario.gerarInventarioD1', 'INVENTARIO.ADMIN');
  Auth_RBAC.registerActionPermission('inventario.cancelar', 'INVENTARIO.EDIT');
}

