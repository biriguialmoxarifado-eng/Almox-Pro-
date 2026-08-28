/**
 * ============================================================
 * ALMOXA PRO — Service_Projeto.gs
 * FASE 7 — IMPLEMENTADO DE VERDADE.
 * Todo projeto pertence a uma obra existente (seção 29 — PEP/
 * Centro de Custo relacionados a obra/projeto).
 * ============================================================
 */

const Service_Projeto = (function () {

  function get(ctx) {
    const p = ctx.payload || {};
    if (p.id) {
      const row = DB_Query.get('PROJETOS', p.id);
      return row ? Core_Response.ok(row, '', 'SUCCESS', {}, ctx.requestId)
                  : Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Projeto não encontrado.', {}, ctx.requestId);
    }
    const rows = DB_Query.find('PROJETOS', r => !p.obraId || String(r.obraId) === String(p.obraId));
    return Core_Response.ok(rows, '', 'SUCCESS', {}, ctx.requestId);
  }

  function create(ctx) {
    const dados = ctx.payload || {};
    try { DB_Validation.requireFields(dados, ['nome', 'obraId']); }
    catch (e) { return Core_Response.error(e.code || CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, e.message, {}, ctx.requestId); }

    if (!DB_Query.get('OBRAS', dados.obraId)) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'obraId não corresponde a nenhuma obra cadastrada.', {}, ctx.requestId);
    }

    const registro = DB_Insert.insert('PROJETOS', {
      nome: dados.nome, obraId: dados.obraId,
      pep: dados.pep || '', centroCusto: dados.centroCusto || '',
      responsavel: dados.responsavel || ctx.userId
    });
    Audit_Service.record(ctx, 'PROJETO_CRIADO', { entidade: 'PROJETOS', entidadeId: registro.ID });
    return Core_Response.ok(registro, 'Projeto cadastrado.', 'SUCCESS', {}, ctx.requestId);
  }

  function update(ctx) {
    const { id, ...patch } = ctx.payload || {};
    if (!id) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'id é obrigatório.', {}, ctx.requestId);
    if (!DB_Query.get('PROJETOS', id)) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Projeto não encontrado.', {}, ctx.requestId);
    if (patch.obraId && !DB_Query.get('OBRAS', patch.obraId)) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'obraId não corresponde a nenhuma obra cadastrada.', {}, ctx.requestId);
    }
    DB_Update.byId('PROJETOS', id, patch);
    Audit_Service.record(ctx, 'PROJETO_ATUALIZADO', { entidade: 'PROJETOS', entidadeId: id }, null, patch);
    return Core_Response.ok(DB_Query.get('PROJETOS', id), 'Projeto atualizado.', 'SUCCESS', {}, ctx.requestId);
  }

  return { get, create, update };
})();
