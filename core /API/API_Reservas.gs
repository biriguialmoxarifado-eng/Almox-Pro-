/**
 * ============================================================
 * ALMOXA PRO — API_Reservas.gs
 * Rotas expostas via Core_Router. Cada função é um handler fino:
 * delega a lógica para o Service correspondente e devolve o
 * Core_Response já formatado pelo Service (que hoje retorna
 * MODULE_NOT_IMPLEMENTED até a fase real entrar).
 * ============================================================
 */
function create_reserva(ctx) {
  return Service_Reserva.create(ctx);
}

function get_reserva(ctx) {
  return Service_Reserva.get(ctx);
}

function approve_reserva(ctx) {
  return Service_Reserva.approve(ctx);
}

function reject_reserva(ctx) {
  return Service_Reserva.reject(ctx);
}

function cancel_reserva(ctx) {
  return Service_Reserva.cancel(ctx);
}

function calendar_reserva(ctx) {
  return Service_Reserva.calendar(ctx);
}

function schedule_reserva(ctx) {
  return Service_Reserva.schedule(ctx);
}

function disponibilidade_reserva(ctx) {
  return Service_Reserva.disponibilidade(ctx);
}

function historico_reserva(ctx) {
  return Service_Reserva.historico(ctx);
}

function separar_reserva(ctx) {
  return Service_Reserva.separar(ctx);
}

function marcarPronta_reserva(ctx) {
  return Service_Reserva.marcarPronta(ctx);
}

function entregar_reserva(ctx) {
  return Service_Reserva.entregar(ctx);
}

function concluir_reserva(ctx) {
  return Service_Reserva.concluir(ctx);
}

function API_Reservas_getRoutes() {
  return {
    'reserva.create': create_reserva,
    'reserva.get': get_reserva,
    'reserva.approve': approve_reserva,
    'reserva.reject': reject_reserva,
    'reserva.cancel': cancel_reserva,
    'reserva.calendar': calendar_reserva,
    'reserva.schedule': schedule_reserva,
    'reserva.disponibilidade': disponibilidade_reserva,
    'reserva.historico': historico_reserva,
    'reserva.separar': separar_reserva,
    'reserva.marcarPronta': marcarPronta_reserva,
    'reserva.entregar': entregar_reserva,
    // BLOCO 05, seção 6 — alias de rota pro MESMO handler de
    // `entregar`. A spec pediu o nome `atenderParcial`; a lógica
    // já suporta parcial via `payload.quantidade` — não duplicar
    // função só pra ter um segundo nome de rota.
    'reserva.atenderParcial': entregar_reserva,
    'reserva.concluir': concluir_reserva
  };
}

function API_Reservas_registerPermissions() {
  Auth_RBAC.registerActionPermission('reserva.create', 'RESERVA.CREATE');
  Auth_RBAC.registerActionPermission('reserva.get', 'RESERVA.VIEW');
  Auth_RBAC.registerActionPermission('reserva.approve', 'RESERVA.APPROVE');
  Auth_RBAC.registerActionPermission('reserva.reject', 'RESERVA.REJECT');
  // FASE 6: cancel() virou self-service (dono da reserva também
  // pode cancelar, não só quem tem EDIT) — a permissão de papel
  // agora é só um gate de VIEW; a autorização real é o ownership
  // check dentro de Service_Reserva.cancel().
  Auth_RBAC.registerActionPermission('reserva.cancel', 'RESERVA.VIEW');
  Auth_RBAC.registerActionPermission('reserva.calendar', 'RESERVA.VIEW');
  Auth_RBAC.registerActionPermission('reserva.schedule', 'RESERVA.EDIT');
  Auth_RBAC.registerActionPermission('reserva.disponibilidade', 'RESERVA.VIEW');
  Auth_RBAC.registerActionPermission('reserva.historico', 'RESERVA.VIEW');
  // MÓDULO 05 — separar/marcarPronta/entregar são operação física
  // de almoxarifado (exigem EDIT, que ALMOXARIFE+ tem); concluir
  // é self-service (dono confirma recebimento) ou gestão, então
  // fica em VIEW com o ownership check por dentro (mesmo padrão
  // de reserva.cancel).
  Auth_RBAC.registerActionPermission('reserva.separar', 'RESERVA.EDIT');
  Auth_RBAC.registerActionPermission('reserva.marcarPronta', 'RESERVA.EDIT');
  Auth_RBAC.registerActionPermission('reserva.entregar', 'RESERVA.EDIT');
  Auth_RBAC.registerActionPermission('reserva.atenderParcial', 'RESERVA.EDIT');
  Auth_RBAC.registerActionPermission('reserva.concluir', 'RESERVA.VIEW');
}

