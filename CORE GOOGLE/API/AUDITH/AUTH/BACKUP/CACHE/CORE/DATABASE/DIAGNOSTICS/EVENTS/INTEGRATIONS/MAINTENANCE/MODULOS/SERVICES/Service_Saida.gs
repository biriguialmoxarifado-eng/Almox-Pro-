/**
 * ============================================================
 * ALMOXA PRO — Service_Saida.gs
 * FASE 5 — IMPLEMENTADO DE VERDADE.
 *
 * Fluxo (seção 27): create → validação → autorização → movimento
 * → estoque → auditoria. A saída só mexe fisicamente no saldo em
 * confirm() — create() apenas registra a intenção (permite
 * separar material sem já ter dado baixa).
 * ============================================================
 */

const Service_Saida = (function () {

  function create(ctx) {
    const p = ctx.payload || {};

    // ---- Saída a partir de reserva já aprovada ----
    if (p.reservaId) {
      const reserva = DB_Query.get('RESERVAS', p.reservaId);
      if (!reserva) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Reserva não encontrada.', {}, ctx.requestId);
      const reservaAtual = Service_Reserva._expirarSeVencida(reserva, ctx);
      if (reservaAtual.status !== 'APROVADA') {
        return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'Reserva precisa estar APROVADA para gerar saída (status atual: ' + reservaAtual.status + ').', {}, ctx.requestId);
      }
      const saida = DB_Insert.insert('SAIDAS', {
        tipo: 'RESERVA', produtoId: reservaAtual.produtoId, localizacao: reservaAtual.localizacao,
        quantidade: reservaAtual.quantidade, reservaId: reservaAtual.ID,
        responsavel: ctx.userId, obraId: reservaAtual.obraId, status: 'PENDENTE_CONFIRMACAO', data: new Date()
      });
      Audit_Service.record(ctx, 'SAIDA_CRIADA', { entidade: 'SAIDAS', entidadeId: saida.ID });
      return Core_Response.ok(saida, 'Saída de reserva registrada — aguardando confirmação física.', 'SUCCESS', {}, ctx.requestId);
    }

    // ---- Saída direta (normal ou emergencial — seção 27) ----
    try {
      DB_Validation.requireFields(p, ['produtoId', 'localizacao', 'quantidade']);
    } catch (e) {
      return Core_Response.error(e.code || CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, e.message, {}, ctx.requestId);
    }
    const saida = DB_Insert.insert('SAIDAS', {
      tipo: p.emergencial ? 'EMERGENCIAL' : 'NORMAL',
      produtoId: p.produtoId, localizacao: p.localizacao, quantidade: p.quantidade,
      reservaId: '', responsavel: ctx.userId, obraId: p.obraId || '',
      status: 'PENDENTE_CONFIRMACAO', data: new Date()
    });
    Audit_Service.record(ctx, 'SAIDA_CRIADA', { entidade: 'SAIDAS', entidadeId: saida.ID });
    return Core_Response.ok(saida, 'Saída registrada — aguardando confirmação física.', 'SUCCESS', {}, ctx.requestId);
  }

  function confirm(ctx) {
    const saida = DB_Query.get('SAIDAS', ctx.payload.id);
    if (!saida) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Saída não encontrada.', {}, ctx.requestId);
    if (saida.status !== 'PENDENTE_CONFIRMACAO') {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'Saída já foi confirmada ou cancelada.', {}, ctx.requestId);
    }

    let saldoAtualizado;
    try {
      const liberarReservado = saida.tipo === 'RESERVA' ? Number(saida.quantidade) : 0;
      saldoAtualizado = Service_Estoque._registrarSaidaInterna(
        saida.produtoId, saida.localizacao, saida.quantidade,
        { motivo: 'Saída #' + saida.ID + ' (' + saida.tipo + ')', obraId: saida.obraId, documentoId: saida.ID },
        ctx, liberarReservado
      );
    } catch (e) {
      return Core_Response.error(e.code || CORE_CONSTANTS.RESPONSE_CODES.INTERNAL_ERROR, e.message, {}, ctx.requestId);
    }

    DB_Update.byId('SAIDAS', saida.ID, { status: 'CONFIRMADA' });
    if (saida.reservaId) {
      DB_Update.byId('RESERVAS', saida.reservaId, { status: 'CONCLUIDA' });
    }
    Audit_Service.record(ctx, 'SAIDA_CONFIRMADA', { entidade: 'SAIDAS', entidadeId: saida.ID });

    return Core_Response.ok({ saida: DB_Query.get('SAIDAS', saida.ID), saldo: saldoAtualizado }, 'Saída confirmada — estoque baixado.', 'SUCCESS', {}, ctx.requestId);
  }

  function cancel(ctx) {
    const saida = DB_Query.get('SAIDAS', ctx.payload.id);
    if (!saida) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Saída não encontrada.', {}, ctx.requestId);
    if (saida.status !== 'PENDENTE_CONFIRMACAO') {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'Só é possível cancelar saída ainda não confirmada (nenhum saldo foi baixado antes da confirmação).', {}, ctx.requestId);
    }
    DB_Update.byId('SAIDAS', saida.ID, { status: 'CANCELADA' });
    // Não precisa liberar reservado aqui — a saída pendente nunca
    // tocou o saldo; se veio de reserva, a reserva continua
    // APROVADA e pode gerar outra saída depois.
    Audit_Service.record(ctx, 'SAIDA_CANCELADA', { entidade: 'SAIDAS', entidadeId: saida.ID }, { status: saida.status }, { status: 'CANCELADA', motivo: ctx.payload.motivo || '' });
    return Core_Response.ok(DB_Query.get('SAIDAS', saida.ID), 'Saída cancelada.', 'SUCCESS', {}, ctx.requestId);
  }

  return { create, confirm, cancel };
})();
