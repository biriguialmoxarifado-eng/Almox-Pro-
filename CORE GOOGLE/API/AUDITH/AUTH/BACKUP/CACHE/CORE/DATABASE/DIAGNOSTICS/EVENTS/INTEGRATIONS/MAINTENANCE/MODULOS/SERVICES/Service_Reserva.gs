/**
 * ============================================================
 * ALMOXA PRO — Service_Reserva.gs
 * FASE 5 — IMPLEMENTADO DE VERDADE.
 *
 * Regra central (seção 21/26): o estoque reservado é separado
 * do disponível NO MOMENTO DA CRIAÇÃO da reserva — assim dois
 * operadores não conseguem reservar o mesmo saldo (prevenção de
 * reserva duplicada, seção 26). Aprovar/reprovar só muda status;
 * reprovar ou cancelar libera o saldo travado de volta.
 *
 * Validade padrão configurável (seção 21 — inclui 48h como
 * exemplo citado na spec original).
 * ============================================================
 */

const Service_Reserva = (function () {

  function _expirarSeVencida(reserva, ctx) {
    if (reserva.status !== 'PENDENTE' && reserva.status !== 'APROVADA') return reserva;
    if (!reserva.validade || new Date(reserva.validade) > new Date()) return reserva;

    Service_Estoque._liberarReservaInterno(reserva.produtoId, reserva.localizacao, reserva.quantidade);
    DB_Update.byId('RESERVAS', reserva.ID, { status: 'EXPIRADA' });
    Event_Bus.emit(EVENT_TYPES.RESERVA_EXPIRADA, { reservaId: reserva.ID }, ctx || {});
    return DB_Query.get('RESERVAS', reserva.ID);
  }

  function create(ctx) {
    const { produtoId, localizacao, quantidade, obraId, validadeHoras } = ctx.payload || {};
    try {
      DB_Validation.requireFields(ctx.payload || {}, ['produtoId', 'localizacao', 'quantidade']);
    } catch (e) {
      return Core_Response.error(e.code || CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, e.message, {}, ctx.requestId);
    }
    if (!Utils_Validation.isPositiveNumber(Number(quantidade))) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'quantidade deve ser positiva.', {}, ctx.requestId);
    }

    // Já existe reserva idêntica pendente do mesmo solicitante?
    // (seção 26 — "prevenção de reserva duplicada")
    const duplicada = DB_Query.findOne('RESERVAS', r =>
      String(r.produtoId) === String(produtoId) && r.localizacao === localizacao &&
      r.solicitante === ctx.userId && (r.status === 'PENDENTE' || r.status === 'APROVADA')
    );
    if (duplicada) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'Já existe uma reserva sua em aberto para este produto/local (reserva #' + duplicada.ID + ').', {}, ctx.requestId);
    }

    let saldoAtualizado;
    try {
      saldoAtualizado = Service_Estoque._reservarSaldoInterno(produtoId, localizacao, quantidade);
    } catch (e) {
      return Core_Response.error(e.code || CORE_CONSTANTS.RESPONSE_CODES.INTERNAL_ERROR, e.message, {}, ctx.requestId);
    }

    const horas = validadeHoras || Core_Config.get('RESERVATION_DEFAULT_HOURS') || 48;
    const reserva = DB_Insert.insert('RESERVAS', {
      produtoId, localizacao, quantidade,
      solicitante: ctx.userId, obraId: obraId || '',
      status: 'PENDENTE', validade: Utils_Date.addDays(new Date(), horas / 24),
      aprovador: '', data: new Date()
    });

    Event_Bus.emit(EVENT_TYPES.RESERVA_CRIADA, { reservaId: reserva.ID, produtoId, quantidade }, ctx);
    Audit_Service.record(ctx, 'RESERVA_CRIADA', { entidade: 'RESERVAS', entidadeId: reserva.ID });

    return Core_Response.ok({ reserva, saldo: saldoAtualizado }, 'Reserva criada — saldo travado até aprovação/expiração.', 'SUCCESS', {}, ctx.requestId);
  }

  function get(ctx) {
    const row = DB_Query.get('RESERVAS', ctx.payload.id);
    if (!row) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Reserva não encontrada.', {}, ctx.requestId);
    return Core_Response.ok(_expirarSeVencida(row, ctx), '', 'SUCCESS', {}, ctx.requestId);
  }

  function approve(ctx) {
    const reserva = DB_Query.get('RESERVAS', ctx.payload.id);
    if (!reserva) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Reserva não encontrada.', {}, ctx.requestId);
    const atual = _expirarSeVencida(reserva, ctx);
    if (atual.status !== 'PENDENTE') {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'Reserva não está pendente (status atual: ' + atual.status + ').', {}, ctx.requestId);
    }
    DB_Update.byId('RESERVAS', reserva.ID, { status: 'APROVADA', aprovador: ctx.userId });
    Event_Bus.emit(EVENT_TYPES.RESERVA_APROVADA, { reservaId: reserva.ID }, ctx);
    Audit_Service.record(ctx, 'RESERVA_APROVADA', { entidade: 'RESERVAS', entidadeId: reserva.ID }, { status: 'PENDENTE' }, { status: 'APROVADA' });
    return Core_Response.ok(DB_Query.get('RESERVAS', reserva.ID), 'Reserva aprovada.', 'SUCCESS', {}, ctx.requestId);
  }

  function reject(ctx) {
    const reserva = DB_Query.get('RESERVAS', ctx.payload.id);
    if (!reserva) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Reserva não encontrada.', {}, ctx.requestId);
    if (reserva.status !== 'PENDENTE') {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'Só é possível reprovar reserva pendente.', {}, ctx.requestId);
    }
    Service_Estoque._liberarReservaInterno(reserva.produtoId, reserva.localizacao, reserva.quantidade);
    DB_Update.byId('RESERVAS', reserva.ID, { status: 'REPROVADA', aprovador: ctx.userId });
    Audit_Service.record(ctx, 'RESERVA_REPROVADA', { entidade: 'RESERVAS', entidadeId: reserva.ID }, { status: 'PENDENTE' }, { status: 'REPROVADA', motivo: ctx.payload.motivo || '' });
    return Core_Response.ok(DB_Query.get('RESERVAS', reserva.ID), 'Reserva reprovada — saldo liberado.', 'SUCCESS', {}, ctx.requestId);
  }

  function cancel(ctx) {
    const reserva = DB_Query.get('RESERVAS', ctx.payload.id);
    if (!reserva) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Reserva não encontrada.', {}, ctx.requestId);
    if (!['PENDENTE', 'APROVADA'].includes(reserva.status)) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'Reserva não pode ser cancelada (status: ' + reserva.status + ').', {}, ctx.requestId);
    }
    Service_Estoque._liberarReservaInterno(reserva.produtoId, reserva.localizacao, reserva.quantidade);
    DB_Update.byId('RESERVAS', reserva.ID, { status: 'CANCELADA' });
    Audit_Service.record(ctx, 'RESERVA_CANCELADA', { entidade: 'RESERVAS', entidadeId: reserva.ID }, { status: reserva.status }, { status: 'CANCELADA' });
    return Core_Response.ok(DB_Query.get('RESERVAS', reserva.ID), 'Reserva cancelada — saldo liberado.', 'SUCCESS', {}, ctx.requestId);
  }

  function calendar(ctx) {
    const f = ctx.payload || {};
    const rows = DB_Query.find('RESERVAS', r => {
      if (f.obraId && r.obraId !== f.obraId) return false;
      if (f.dataInicio && new Date(r.validade) < new Date(f.dataInicio)) return false;
      if (f.dataFim && new Date(r.validade) > new Date(f.dataFim)) return false;
      return true;
    }).map(r => _expirarSeVencida(r, ctx))
      .sort((a, b) => new Date(a.validade) - new Date(b.validade));
    return Core_Response.ok(rows, '', 'SUCCESS', {}, ctx.requestId);
  }

  function schedule(ctx) {
    const { id, novaValidade } = ctx.payload || {};
    const reserva = DB_Query.get('RESERVAS', id);
    if (!reserva) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Reserva não encontrada.', {}, ctx.requestId);
    if (!['PENDENTE', 'APROVADA'].includes(reserva.status)) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'Só é possível reagendar reserva pendente/aprovada.', {}, ctx.requestId);
    }
    DB_Update.byId('RESERVAS', id, { validade: novaValidade });
    Audit_Service.record(ctx, 'RESERVA_REAGENDADA', { entidade: 'RESERVAS', entidadeId: id }, { validade: reserva.validade }, { validade: novaValidade });
    return Core_Response.ok(DB_Query.get('RESERVAS', id), 'Reserva reagendada.', 'SUCCESS', {}, ctx.requestId);
  }

  return { create, get, approve, reject, cancel, calendar, schedule, _expirarSeVencida };
})();
