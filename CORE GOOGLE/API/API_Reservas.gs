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

function API_Reservas_getRoutes() {
  return {
    'reserva.create': create_reserva,
    'reserva.get': get_reserva,
    'reserva.approve': approve_reserva,
    'reserva.reject': reject_reserva,
    'reserva.cancel': cancel_reserva,
    'reserva.calendar': calendar_reserva,
    'reserva.schedule': schedule_reserva
  };
}

function API_Reservas_registerPermissions() {
  Auth_RBAC.registerActionPermission('reserva.create', 'RESERVA.CREATE');
  Auth_RBAC.registerActionPermission('reserva.get', 'RESERVA.VIEW');
  Auth_RBAC.registerActionPermission('reserva.approve', 'RESERVA.APPROVE');
  Auth_RBAC.registerActionPermission('reserva.reject', 'RESERVA.REJECT');
  Auth_RBAC.registerActionPermission('reserva.cancel', 'RESERVA.EDIT');
  Auth_RBAC.registerActionPermission('reserva.calendar', 'RESERVA.VIEW');
  Auth_RBAC.registerActionPermission('reserva.schedule', 'RESERVA.EDIT');
}

