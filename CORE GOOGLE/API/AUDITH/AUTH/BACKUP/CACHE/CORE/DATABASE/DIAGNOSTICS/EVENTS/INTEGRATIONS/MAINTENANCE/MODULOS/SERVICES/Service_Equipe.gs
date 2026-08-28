/**
 * ============================================================
 * ALMOXA PRO — Service_Equipe.gs
 * FASE 7 — IMPLEMENTADO DE VERDADE.
 * assign() é upsert: já existe o colaborador nessa obra? edita
 * (troca de função/equipe); não existe? cria vínculo novo.
 * ============================================================
 */

const Service_Equipe = (function () {

  function get(ctx) {
    const p = ctx.payload || {};
    const rows = DB_Query.find('EQUIPE', r => {
      if (p.obraId && String(r.obraId) !== String(p.obraId)) return false;
      if (p.equipe && r.equipe !== p.equipe) return false;
      if (p.status && r.status !== p.status) return false;
      return true;
    });
    return Core_Response.ok(rows, '', 'SUCCESS', {}, ctx.requestId);
  }

  function assign(ctx) {
    const dados = ctx.payload || {};
    try { DB_Validation.requireFields(dados, ['colaborador', 'obraId']); }
    catch (e) { return Core_Response.error(e.code || CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, e.message, {}, ctx.requestId); }

    if (!DB_Query.get('OBRAS', dados.obraId)) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'obraId não corresponde a nenhuma obra cadastrada.', {}, ctx.requestId);
    }

    const existente = DB_Query.findOne('EQUIPE', r => r.colaborador === dados.colaborador && String(r.obraId) === String(dados.obraId));
    const patch = {
      colaborador: dados.colaborador, funcao: dados.funcao || '', cargo: dados.cargo || '',
      equipe: dados.equipe || '', obraId: dados.obraId, status: 'ATIVO'
    };

    let registro;
    if (existente) {
      DB_Update.byRowIndex('EQUIPE', existente._rowIndex, patch);
      registro = DB_Query.get('EQUIPE', existente.ID);
      Audit_Service.record(ctx, 'EQUIPE_REALOCADA', { entidade: 'EQUIPE', entidadeId: existente.ID }, existente, patch);
    } else {
      registro = DB_Insert.insert('EQUIPE', patch);
      Audit_Service.record(ctx, 'EQUIPE_ATRIBUIDA', { entidade: 'EQUIPE', entidadeId: registro.ID });
    }

    return Core_Response.ok(registro, 'Colaborador atribuído à obra.', 'SUCCESS', {}, ctx.requestId);
  }

  return { get, assign };
})();
