/**
 * ============================================================
 * ALMOXA PRO — Service_Produto.gs
 * FASE 2 — IMPLEMENTADO DE VERDADE.
 * CRUD real + findOrSuggest(), que implementa a lógica exata
 * da seção 17 da spec:
 *   1. procurar por código
 *   2. procurar por código de barras
 *   3. procurar por descrição normalizada
 *   4. procurar por descrição aproximada
 *   5. se nada bater, é pendência de cadastro
 * NUNCA cria duplicado automaticamente quando já existe match
 * exato — e quando é só "parecido", devolve sugestão em vez de
 * decidir sozinho (a confirmação é controlada por permissão,
 * como a spec exige).
 * ============================================================
 */

const Service_Produto = (function () {

  const SIMILARITY_THRESHOLD = 0.6;

  function get(ctx) {
    const row = DB_Query.get('PRODUTOS', ctx.payload.id);
    return row
      ? Core_Response.ok(row, '', 'SUCCESS', {}, ctx.requestId)
      : Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Produto não encontrado.', {}, ctx.requestId);
  }

  function search(ctx) {
    const f = ctx.payload || {};
    const rows = DB_Query.find('PRODUTOS', r => {
      if (f.codigo && r.codigo !== f.codigo) return false;
      if (f.descricao && !Utils_String.normalize(r.descricaoNormalizada).includes(Utils_String.normalize(f.descricao))) return false;
      if (f.status && r.status !== f.status) return false;
      return true;
    });
    return Core_Response.ok(rows, '', 'SUCCESS', {}, ctx.requestId);
  }

  function create(ctx) {
    const dados = ctx.payload || {};
    try {
      DB_Validation.requireFields(dados, ['descricaoOriginal']);
    } catch (e) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, e.message, {}, ctx.requestId);
    }
    const registro = _insertProduto(dados);
    Audit_Service.record(ctx, 'PRODUTO_CRIADO', { entidade: 'PRODUTOS', entidadeId: registro.ID });
    return Core_Response.ok(registro, 'Produto cadastrado.', 'SUCCESS', {}, ctx.requestId);
  }

  function update(ctx) {
    const { id, ...patch } = ctx.payload || {};
    if (!id) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'id é obrigatório.', {}, ctx.requestId);
    if (patch.descricaoOriginal) patch.descricaoNormalizada = Utils_String.normalize(patch.descricaoOriginal);
    DB_Update.byId('PRODUTOS', id, patch);
    Audit_Service.record(ctx, 'PRODUTO_ATUALIZADO', { entidade: 'PRODUTOS', entidadeId: id }, null, patch);
    return Core_Response.ok(DB_Query.get('PRODUTOS', id), 'Produto atualizado.', 'SUCCESS', {}, ctx.requestId);
  }

  function _insertProduto(dados) {
    return DB_Insert.insert('PRODUTOS', {
      codigo: dados.codigo || '',
      codigoBarras: dados.codigoBarras || '',
      descricaoOriginal: dados.descricaoOriginal,
      descricaoNormalizada: Utils_String.normalize(dados.descricaoOriginal),
      NCM: dados.NCM || '',
      unidade: dados.unidade || 'UN',
      status: 'ATIVO'
    });
  }

  /**
   * Lógica da seção 17 — usada internamente pelo Service_NF ao
   * processar cada item de uma nota. Não cria nada sozinho;
   * apenas classifica a situação:
   *
   * { situacao: 'ENCONTRADO', produto }
   * { situacao: 'SEMELHANTE', produtoSugerido, similaridade }
   * { situacao: 'PENDENTE_CADASTRO' }
   */
  function findOrSuggest(item) {
    // 1) código exato
    if (item.codigo) {
      const porCodigo = DB_Query.findOne('PRODUTOS', p => p.codigo === item.codigo);
      if (porCodigo) return { situacao: 'ENCONTRADO', produto: porCodigo, criterio: 'codigo' };
    }
    // 2) código de barras exato
    if (item.codigoBarras) {
      const porBarras = DB_Query.findOne('PRODUTOS', p => p.codigoBarras === item.codigoBarras);
      if (porBarras) return { situacao: 'ENCONTRADO', produto: porBarras, criterio: 'codigoBarras' };
    }
    // 3) descrição normalizada exata
    const descNorm = Utils_String.normalize(item.descricao || '');
    if (descNorm) {
      const porDescExata = DB_Query.findOne('PRODUTOS', p => p.descricaoNormalizada === descNorm);
      if (porDescExata) return { situacao: 'ENCONTRADO', produto: porDescExata, criterio: 'descricaoExata' };

      // 4) descrição aproximada (seção 23 cobre granel sem código —
      // esta rota também serve para esses casos)
      const candidatos = DB_Query.find('PRODUTOS', () => true)
        .map(p => ({ produto: p, score: Utils_String.similarity(p.descricaoNormalizada, descNorm) }))
        .filter(c => c.score >= SIMILARITY_THRESHOLD)
        .sort((a, b) => b.score - a.score);

      if (candidatos.length) {
        return { situacao: 'SEMELHANTE', produtoSugerido: candidatos[0].produto, similaridade: candidatos[0].score };
      }
    }
    // 5) nada encontrado
    return { situacao: 'PENDENTE_CADASTRO' };
  }

  return { get, search, create, update, findOrSuggest, _insertProduto };
})();
