/**
 * ============================================================
 * ALMOXA PRO — Service_Obra.gs
 * FASE 7 — IMPLEMENTADO DE VERDADE.
 * ============================================================
 */

const Service_Obra = (function () {

  function get(ctx) {
    const p = ctx.payload || {};
    const row = p.id ? DB_Query.get('OBRAS', p.id) : null;
    if (p.id && !row) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Obra não encontrada.', {}, ctx.requestId);
    if (row) return Core_Response.ok(row, '', 'SUCCESS', {}, ctx.requestId);
    return Core_Response.ok(DB_Query.find('OBRAS', o => !p.status || o.status === p.status), '', 'SUCCESS', {}, ctx.requestId);
  }

  function create(ctx) {
    const dados = ctx.payload || {};
    try { DB_Validation.requireFields(dados, ['nome']); }
    catch (e) { return Core_Response.error(e.code || CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, e.message, {}, ctx.requestId); }

    const registro = DB_Insert.insert('OBRAS', {
      nome: dados.nome, endereco: dados.endereco || '',
      responsavel: dados.responsavel || ctx.userId, status: 'ATIVA'
    });
    Audit_Service.record(ctx, 'OBRA_CRIADA', { entidade: 'OBRAS', entidadeId: registro.ID });
    return Core_Response.ok(registro, 'Obra cadastrada.', 'SUCCESS', {}, ctx.requestId);
  }

  function update(ctx) {
    const { id, ...patch } = ctx.payload || {};
    if (!id) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'id é obrigatório.', {}, ctx.requestId);
    if (!DB_Query.get('OBRAS', id)) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Obra não encontrada.', {}, ctx.requestId);
    DB_Update.byId('OBRAS', id, patch);
    Audit_Service.record(ctx, 'OBRA_ATUALIZADA', { entidade: 'OBRAS', entidadeId: id }, null, patch);
    return Core_Response.ok(DB_Query.get('OBRAS', id), 'Obra atualizada.', 'SUCCESS', {}, ctx.requestId);
  }

  return { get, create, update };
})();
