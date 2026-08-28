/**
 * ============================================================
 * ALMOXA PRO — Service_Atividade.gs
 * FASE 7 — IMPLEMENTADO DE VERDADE.
 * Toda atividade referencia obra (obrigatório) e projeto
 * (opcional) — usado depois pra rastrear consumo de material
 * por atividade (MOVIMENTOS.atividadeId, já plugado no
 * Service_Estoque desde esta fase).
 * ============================================================
 */

const Service_Atividade = (function () {

  function get(ctx) {
    const p = ctx.payload || {};
    if (p.id) {
      const row = DB_Query.get('ATIVIDADES', p.id);
      return row ? Core_Response.ok(row, '', 'SUCCESS', {}, ctx.requestId)
                  : Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Atividade não encontrada.', {}, ctx.requestId);
    }
    const rows = DB_Query.find('ATIVIDADES', r => {
      if (p.obraId && String(r.obraId) !== String(p.obraId)) return false;
      if (p.status && r.status !== p.status) return false;
      return true;
    });
    return Core_Response.ok(rows, '', 'SUCCESS', {}, ctx.requestId);
  }

  function create(ctx) {
    const dados = ctx.payload || {};
    try { DB_Validation.requireFields(dados, ['nome', 'obraId']); }
    catch (e) { return Core_Response.error(e.code || CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, e.message, {}, ctx.requestId); }

    if (!DB_Query.get('OBRAS', dados.obraId)) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'obraId não corresponde a nenhuma obra cadastrada.', {}, ctx.requestId);
    }
    if (dados.projetoId && !DB_Query.get('PROJETOS', dados.projetoId)) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'projetoId não corresponde a nenhum projeto cadastrado.', {}, ctx.requestId);
    }

    const registro = DB_Insert.insert('ATIVIDADES', {
      nome: dados.nome, obraId: dados.obraId, projetoId: dados.projetoId || '',
      etapa: dados.etapa || '', responsavel: dados.responsavel || ctx.userId,
      equipe: dados.equipe || '', inicio: dados.inicio || '', fim: dados.fim || '',
      progresso: 0, status: 'PENDENTE', prioridade: dados.prioridade || 'MEDIA'
    });
    Audit_Service.record(ctx, 'ATIVIDADE_CRIADA', { entidade: 'ATIVIDADES', entidadeId: registro.ID });
    return Core_Response.ok(registro, 'Atividade cadastrada.', 'SUCCESS', {}, ctx.requestId);
  }

  function update(ctx) {
    const { id, ...patch } = ctx.payload || {};
    if (!id) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'id é obrigatório.', {}, ctx.requestId);
    if (!DB_Query.get('ATIVIDADES', id)) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Atividade não encontrada.', {}, ctx.requestId);
    DB_Update.byId('ATIVIDADES', id, patch);
    Audit_Service.record(ctx, 'ATIVIDADE_ATUALIZADA', { entidade: 'ATIVIDADES', entidadeId: id }, null, patch);
    return Core_Response.ok(DB_Query.get('ATIVIDADES', id), 'Atividade atualizada.', 'SUCCESS', {}, ctx.requestId);
  }

  function progress(ctx) {
    const { id, progresso } = ctx.payload || {};
    const atividade = DB_Query.get('ATIVIDADES', id);
    if (!atividade) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Atividade não encontrada.', {}, ctx.requestId);
    if (progresso < 0 || progresso > 100) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'progresso deve estar entre 0 e 100.', {}, ctx.requestId);
    }
    const novoStatus = Number(progresso) >= 100 ? 'CONCLUIDA' : (Number(progresso) > 0 ? 'EM_ANDAMENTO' : atividade.status);
    DB_Update.byId('ATIVIDADES', id, { progresso, status: novoStatus });
    Audit_Service.record(ctx, 'ATIVIDADE_PROGRESSO', { entidade: 'ATIVIDADES', entidadeId: id }, { progresso: atividade.progresso }, { progresso });
    return Core_Response.ok(DB_Query.get('ATIVIDADES', id), 'Progresso atualizado.', 'SUCCESS', {}, ctx.requestId);
  }

  return { get, create, update, progress };
})();
