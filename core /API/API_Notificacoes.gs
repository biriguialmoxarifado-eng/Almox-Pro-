/**
 * ============================================================
 * ALMOXA PRO — API_Notificacoes.gs
 * Rotas expostas via Core_Router. Cada função é um handler fino:
 * delega a lógica para o Service correspondente e devolve o
 * Core_Response já formatado pelo Service (que hoje retorna
 * MODULE_NOT_IMPLEMENTED até a fase real entrar).
 * ============================================================
 */
function list_notificacao(ctx) {
  return Service_Notificacao.list(ctx);
}

function read_notificacao(ctx) {
  return Service_Notificacao.read(ctx);
}

function send_notificacao(ctx) {
  return Service_Notificacao.send(ctx);
}

function criarNotificacao_notificacao(ctx) { return Service_Notificacao.criarNotificacao(ctx); }
function processarFila_notificacao(ctx) { return Service_Notificacao.processarFila(ctx); }
function registrarFalha_notificacao(ctx) { return Service_Notificacao.registrarFalha(ctx); }
function definirPreferenciaCanal_notificacao(ctx) { return Service_Notificacao.definirPreferenciaCanal(ctx); }
function obterPreferenciasCanal_notificacao(ctx) { return Service_Notificacao.obterPreferenciasCanal(ctx); }

function API_Notificacoes_getRoutes() {
  return {
    'notificacao.list': list_notificacao,
    'notificacao.read': read_notificacao,
    'notificacao.send': send_notificacao,
    // MÓDULO 12 — aliases com o nome exato que o contrato de API
    // pede (seção 13); por baixo, chamam as mesmas funções acima.
    'notificacao.criarNotificacao': criarNotificacao_notificacao,
    'notificacao.processarFila': processarFila_notificacao,
    'notificacao.registrarFalha': registrarFalha_notificacao,
    'notificacao.definirPreferenciaCanal': definirPreferenciaCanal_notificacao,
    'notificacao.obterPreferenciasCanal': obterPreferenciasCanal_notificacao
  };
}

function API_Notificacoes_registerPermissions() {
  Auth_RBAC.registerActionPermission('notificacao.list', 'NOTIFICACAO.VIEW');
  // FASE 4: notificacao.read é self-service (marcar A PRÓPRIA
  // notificação como lida) — antes exigia EDIT, que o perfil
  // OPERADOR (padrão de quem se cadastra pela loja) não tem,
  // travando a Central de Notificações pra todo mundo menos
  // ALMOXARIFE+. A segurança real já está no ownership check
  // dentro de Service_Notificacao.read(), não na permissão de papel.
  Auth_RBAC.registerActionPermission('notificacao.read', 'NOTIFICACAO.VIEW');
  Auth_RBAC.registerActionPermission('notificacao.send', 'NOTIFICACAO.CREATE');
  Auth_RBAC.registerActionPermission('notificacao.criarNotificacao', 'NOTIFICACAO.CREATE');
  // Fila e registro de falha são operação administrativa/de
  // sistema — nunca chamada por usuário comum.
  Auth_RBAC.registerActionPermission('notificacao.processarFila', 'NOTIFICACAO.ADMIN');
  Auth_RBAC.registerActionPermission('notificacao.registrarFalha', 'NOTIFICACAO.ADMIN');
  // Preferências são self-scope — a checagem real de dono está
  // dentro das funções, mesmo padrão de ia.definirPreferencia.
  Auth_RBAC.registerActionPermission('notificacao.definirPreferenciaCanal', 'NOTIFICACAO.VIEW');
  Auth_RBAC.registerActionPermission('notificacao.obterPreferenciasCanal', 'NOTIFICACAO.VIEW');
}

