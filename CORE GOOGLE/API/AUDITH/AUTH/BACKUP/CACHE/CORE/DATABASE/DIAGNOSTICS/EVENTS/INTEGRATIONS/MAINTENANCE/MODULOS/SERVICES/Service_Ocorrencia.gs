/**
 * ============================================================
 * ALMOXA PRO — Service_Ocorrencia.gs
 * FASE 8 — IMPLEMENTADO DE VERDADE.
 * Ocorrência de prioridade ALTA/URGENTE dispara notificação
 * automática pra GESTOR/ADMIN (ver Notificacao_Events.gs).
 * ============================================================
 */

const Service_Ocorrencia = (function () {

  function create(ctx) {
    const dados = ctx.payload || {};
    try { DB_Validation.requireFields(dados, ['tipo', 'descricao']); }
    catch (e) { return Core_Response.error(e.code || CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, e.message, {}, ctx.requestId); }

    const registro = DB_Insert.insert('OCORRENCIAS', {
      tipo: dados.tipo, prioridade: dados.prioridade || 'MEDIA', descricao: dados.descricao,
      obraId: dados.obraId || '', projetoId: dados.projetoId || '', atividadeId: dados.atividadeId || '',
      responsavel: ctx.userId, data: new Date(), status: 'ABERTA', resolucao: ''
    });

    Event_Bus.emit(EVENT_TYPES.OCORRENCIA_CRIADA, { ocorrenciaId: registro.ID, prioridade: registro.prioridade, tipo: registro.tipo }, ctx);
    Audit_Service.record(ctx, 'OCORRENCIA_CRIADA', { entidade: 'OCORRENCIAS', entidadeId: registro.ID });

    return Core_Response.ok(registro, 'Ocorrência registrada.', 'SUCCESS', {}, ctx.requestId);
  }

  function update(ctx) {
    const { id, ...patch } = ctx.payload || {};
    if (!id) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'id é obrigatório.', {}, ctx.requestId);
    if (!DB_Query.get('OCORRENCIAS', id)) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Ocorrência não encontrada.', {}, ctx.requestId);
    DB_Update.byId('OCORRENCIAS', id, patch);
    Audit_Service.record(ctx, 'OCORRENCIA_ATUALIZADA', { entidade: 'OCORRENCIAS', entidadeId: id }, null, patch);
    return Core_Response.ok(DB_Query.get('OCORRENCIAS', id), 'Ocorrência atualizada.', 'SUCCESS', {}, ctx.requestId);
  }

  function resolve(ctx) {
    const { id, resolucao } = ctx.payload || {};
    const ocorrencia = DB_Query.get('OCORRENCIAS', id);
    if (!ocorrencia) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Ocorrência não encontrada.', {}, ctx.requestId);
    if (!resolucao) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'resolucao é obrigatória para encerrar a ocorrência.', {}, ctx.requestId);

    DB_Update.byId('OCORRENCIAS', id, { status: 'RESOLVIDA', resolucao });
    Audit_Service.record(ctx, 'OCORRENCIA_RESOLVIDA', { entidade: 'OCORRENCIAS', entidadeId: id }, { status: ocorrencia.status }, { status: 'RESOLVIDA' });
    return Core_Response.ok(DB_Query.get('OCORRENCIAS', id), 'Ocorrência resolvida.', 'SUCCESS', {}, ctx.requestId);
  }

  return { create, update, resolve };
})();
