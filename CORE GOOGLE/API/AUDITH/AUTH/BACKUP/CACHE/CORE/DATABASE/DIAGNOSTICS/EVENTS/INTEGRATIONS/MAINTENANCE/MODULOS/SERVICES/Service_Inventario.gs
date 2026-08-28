/**
 * ============================================================
 * ALMOXA PRO — Service_Inventario.gs
 * FASE 6 — IMPLEMENTADO DE VERDADE.
 *
 * Fluxo (seção 28):
 * CRIAR → GERAR TOKEN → ABRIR (congela saldo esperado) →
 * BIPAGEM/CONTAGEM → DIVERGÊNCIA → RECONTAGEM → APROVAÇÃO →
 * AJUSTE (aplica no ESTOQUE de verdade) → FECHAMENTO
 *
 * Estados usados (CORE_CONSTANTS.INVENTARIO_ESTADOS):
 * CRIADO → ABERTO → EM_CONTAGEM → (EM_RECONTAGEM) →
 * PENDENTE_APROVACAO → APROVADO/REPROVADO → FINALIZADO
 *
 * Token gerado no padrão da spec: INV-2026-000001.
 * ============================================================
 */

const Service_Inventario = (function () {

  const SCAN_DEBOUNCE_SEC = 2;

  function create(ctx) {
    const { obraId, localizacao } = ctx.payload || {};
    if (!localizacao) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'localizacao é obrigatória.', {}, ctx.requestId);

    const sequencial = DB_Query.count('INVENTARIOS', () => true) + 1;
    const inventario = DB_Insert.insert('INVENTARIOS', {
      token: Utils_ID.tokenComAno('INV', sequencial),
      obraId: obraId || '', localizacao: localizacao,
      estado: CORE_CONSTANTS.INVENTARIO_ESTADOS[0], // CRIADO
      responsavel: ctx.userId, dataAbertura: '', dataFechamento: ''
    });
    Audit_Service.record(ctx, 'INVENTARIO_CRIADO', { entidade: 'INVENTARIOS', entidadeId: inventario.ID });
    return Core_Response.ok(inventario, 'Inventário criado: ' + inventario.token, 'SUCCESS', {}, ctx.requestId);
  }

  // ---- ABRIR: congela o saldo atual de cada produto na localização como "esperado" ----
  function open(ctx) {
    const inventario = DB_Query.get('INVENTARIOS', ctx.payload.id);
    if (!inventario) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Inventário não encontrado.', {}, ctx.requestId);
    if (inventario.estado !== 'CRIADO') {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'Inventário já foi aberto (estado atual: ' + inventario.estado + ').', {}, ctx.requestId);
    }

    const saldosNaLocalizacao = DB_Query.find('ESTOQUE', r => r.localizacao === inventario.localizacao);
    const contagens = saldosNaLocalizacao.map(saldo => DB_Insert.insert('CONTAGENS', {
      inventarioId: inventario.ID,
      produtoId: saldo.produtoId,
      esperado: saldo.saldo,
      contado: 0,
      diferenca: -Number(saldo.saldo || 0)
    }));

    DB_Update.byId('INVENTARIOS', inventario.ID, { estado: 'ABERTO', dataAbertura: new Date() });
    Event_Bus.emit(EVENT_TYPES.INVENTARIO_ABERTO, { inventarioId: inventario.ID, totalItens: contagens.length }, ctx);
    Audit_Service.record(ctx, 'INVENTARIO_ABERTO', { entidade: 'INVENTARIOS', entidadeId: inventario.ID });

    return Core_Response.ok({ inventario: DB_Query.get('INVENTARIOS', inventario.ID), contagens },
      'Inventário aberto com ' + contagens.length + ' item(ns) esperado(s) da localização.', 'SUCCESS', {}, ctx.requestId);
  }

  function _findOrCreateContagem(inventarioId, produtoId) {
    let row = DB_Query.findOne('CONTAGENS', c => String(c.inventarioId) === String(inventarioId) && String(c.produtoId) === String(produtoId));
    if (!row) {
      // Item contado que não tinha saldo esperado na localização —
      // ou é sobra real, ou é produto que nunca foi lançado ali.
      row = DB_Insert.insert('CONTAGENS', { inventarioId, produtoId, esperado: 0, contado: 0, diferenca: 0 });
    }
    return row;
  }

  // ---- BIPAGEM (seção 20 — mesma proteção contra bip duplicado) ----
  function scan(ctx) {
    const { inventarioId, codigo, quantidade } = ctx.payload || {};
    if (!inventarioId || !codigo) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'inventarioId e codigo são obrigatórios.', {}, ctx.requestId);
    }
    const inventario = DB_Query.get('INVENTARIOS', inventarioId);
    if (!inventario || !['ABERTO', 'EM_CONTAGEM'].includes(inventario.estado)) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'Inventário precisa estar ABERTO ou EM_CONTAGEM para bipar.', {}, ctx.requestId);
    }
    const produto = DB_Query.findOne('PRODUTOS', p => p.codigo === codigo || p.codigoBarras === codigo);
    if (!produto) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Código não corresponde a nenhum produto cadastrado.', {}, ctx.requestId);
    }

    const debounceKey = 'INV_SCAN_DEBOUNCE_' + inventarioId + '_' + produto.ID;
    if (Cache_Core.get(debounceKey)) {
      return Core_Response.ok({ ignorado: true }, 'Leitura ignorada — mesmo item bipado há menos de ' + SCAN_DEBOUNCE_SEC + 's.', 'SUCCESS', {}, ctx.requestId);
    }
    Cache_Core.set(debounceKey, true, SCAN_DEBOUNCE_SEC);

    const contagem = _findOrCreateContagem(inventarioId, produto.ID);
    const novoContado = Number(contagem.contado || 0) + (Number(quantidade) || 1);
    DB_Update.byRowIndex('CONTAGENS', contagem._rowIndex, { contado: novoContado, diferenca: novoContado - Number(contagem.esperado || 0) });

    if (inventario.estado === 'ABERTO') DB_Update.byId('INVENTARIOS', inventarioId, { estado: 'EM_CONTAGEM' });

    return Core_Response.ok({ produto, contadoAtual: novoContado, esperado: contagem.esperado }, 'Bipagem registrada.', 'SUCCESS', {}, ctx.requestId);
  }

  // ---- CONTAGEM MANUAL (granel, sem código) ----
  function count(ctx) {
    const { inventarioId, produtoId, quantidadeContada } = ctx.payload || {};
    if (!inventarioId || !produtoId || quantidadeContada === undefined) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'inventarioId, produtoId e quantidadeContada são obrigatórios.', {}, ctx.requestId);
    }
    const inventario = DB_Query.get('INVENTARIOS', inventarioId);
    if (!inventario || !['ABERTO', 'EM_CONTAGEM'].includes(inventario.estado)) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'Inventário precisa estar ABERTO ou EM_CONTAGEM.', {}, ctx.requestId);
    }
    const contagem = _findOrCreateContagem(inventarioId, produtoId);
    DB_Update.byRowIndex('CONTAGENS', contagem._rowIndex, { contado: quantidadeContada, diferenca: Number(quantidadeContada) - Number(contagem.esperado || 0) });
    if (inventario.estado === 'ABERTO') DB_Update.byId('INVENTARIOS', inventarioId, { estado: 'EM_CONTAGEM' });

    Audit_Service.record(ctx, 'CONTAGEM_MANUAL', { entidade: 'CONTAGENS', entidadeId: contagem.ID }, { contado: contagem.contado }, { contado: quantidadeContada });
    return Core_Response.ok(DB_Query.get('CONTAGENS', contagem.ID), 'Contagem manual registrada.', 'SUCCESS', {}, ctx.requestId);
  }

  // ---- RECONTAGEM (quando finish() encontrou divergência e o time quer conferir de novo) ----
  function recount(ctx) {
    const { inventarioId, produtoId, quantidadeRecontada } = ctx.payload || {};
    const inventario = DB_Query.get('INVENTARIOS', inventarioId);
    if (!inventario) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Inventário não encontrado.', {}, ctx.requestId);
    if (!['EM_CONTAGEM', 'PENDENTE_APROVACAO'].includes(inventario.estado)) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'Recontagem só é permitida em EM_CONTAGEM ou PENDENTE_APROVACAO (estado atual: ' + inventario.estado + ').', {}, ctx.requestId);
    }
    const contagem = DB_Query.findOne('CONTAGENS', c => String(c.inventarioId) === String(inventarioId) && String(c.produtoId) === String(produtoId));
    if (!contagem) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Contagem do item não encontrada.', {}, ctx.requestId);

    DB_Update.byRowIndex('CONTAGENS', contagem._rowIndex, { contado: quantidadeRecontada, diferenca: Number(quantidadeRecontada) - Number(contagem.esperado || 0) });
    DB_Update.byId('INVENTARIOS', inventarioId, { estado: 'EM_RECONTAGEM' });
    Audit_Service.record(ctx, 'INVENTARIO_RECONTAGEM', { entidade: 'CONTAGENS', entidadeId: contagem.ID }, { contado: contagem.contado }, { contado: quantidadeRecontada });

    return Core_Response.ok(DB_Query.get('CONTAGENS', contagem.ID), 'Recontagem registrada.', 'SUCCESS', {}, ctx.requestId);
  }

  // ---- FINISH: fecha a contagem e decide se precisa de aprovação ----
  function finish(ctx) {
    const inventario = DB_Query.get('INVENTARIOS', ctx.payload.id);
    if (!inventario) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Inventário não encontrado.', {}, ctx.requestId);
    if (!['EM_CONTAGEM', 'EM_RECONTAGEM'].includes(inventario.estado)) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'Inventário precisa ter itens contados antes de finalizar (estado atual: ' + inventario.estado + ').', {}, ctx.requestId);
    }

    const contagens = DB_Query.find('CONTAGENS', c => String(c.inventarioId) === String(inventario.ID));
    const divergentes = contagens.filter(c => Number(c.diferenca) !== 0);

    if (divergentes.length === 0) {
      DB_Update.byId('INVENTARIOS', inventario.ID, { estado: 'FINALIZADO', dataFechamento: new Date() });
      Event_Bus.emit(EVENT_TYPES.INVENTARIO_FINALIZADO, { inventarioId: inventario.ID, divergencias: 0 }, ctx);
      Audit_Service.record(ctx, 'INVENTARIO_FINALIZADO', { entidade: 'INVENTARIOS', entidadeId: inventario.ID });
      return Core_Response.ok(DB_Query.get('INVENTARIOS', inventario.ID), 'Inventário finalizado sem divergências.', 'SUCCESS', {}, ctx.requestId);
    }

    DB_Update.byId('INVENTARIOS', inventario.ID, { estado: 'PENDENTE_APROVACAO' });
    Audit_Service.record(ctx, 'INVENTARIO_PENDENTE_APROVACAO', { entidade: 'INVENTARIOS', entidadeId: inventario.ID }, null, { divergencias: divergentes.length });

    return Core_Response.ok({
      inventario: DB_Query.get('INVENTARIOS', inventario.ID),
      divergentes
    }, divergentes.length + ' item(ns) com divergência — aguardando aprovação (recontagem ou approve).', 'SUCCESS', {}, ctx.requestId);
  }

  // ---- APPROVE: aplica o ajuste real no ESTOQUE, ou reprova (descarta) ----
  function approve(ctx) {
    const { id, decisao, motivo } = ctx.payload || {};
    const inventario = DB_Query.get('INVENTARIOS', id);
    if (!inventario) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Inventário não encontrado.', {}, ctx.requestId);
    if (inventario.estado !== 'PENDENTE_APROVACAO') {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'Inventário não está aguardando aprovação (estado atual: ' + inventario.estado + ').', {}, ctx.requestId);
    }

    if (decisao === 'reprovar') {
      DB_Update.byId('INVENTARIOS', inventario.ID, { estado: 'REPROVADO', dataFechamento: new Date() });
      Audit_Service.record(ctx, 'INVENTARIO_REPROVADO', { entidade: 'INVENTARIOS', entidadeId: inventario.ID }, null, { motivo: motivo || '' });
      return Core_Response.ok(DB_Query.get('INVENTARIOS', inventario.ID), 'Inventário reprovado — nenhum ajuste aplicado ao estoque.', 'SUCCESS', {}, ctx.requestId);
    }

    // Aprovar: aplica DB_Insert/ESTOQUE.adjust em cada item divergente
    const contagens = DB_Query.find('CONTAGENS', c => String(c.inventarioId) === String(inventario.ID));
    const ajustes = [];
    contagens.filter(c => Number(c.diferenca) !== 0).forEach(c => {
      const resultado = Service_Estoque.adjust({
        userId: ctx.userId, requestId: ctx.requestId,
        payload: { produtoId: c.produtoId, localizacao: inventario.localizacao, novoSaldo: c.contado, motivo: 'Ajuste por inventário ' + inventario.token }
      });
      if (resultado.success) ajustes.push(resultado.data);
    });

    DB_Update.byId('INVENTARIOS', inventario.ID, { estado: 'APROVADO', dataFechamento: new Date() });
    Event_Bus.emit(EVENT_TYPES.INVENTARIO_FINALIZADO, { inventarioId: inventario.ID, divergencias: ajustes.length }, ctx);
    Audit_Service.record(ctx, 'INVENTARIO_APROVADO', { entidade: 'INVENTARIOS', entidadeId: inventario.ID }, null, { itensAjustados: ajustes.length });

    return Core_Response.ok({ inventario: DB_Query.get('INVENTARIOS', inventario.ID), ajustes },
      'Inventário aprovado — ' + ajustes.length + ' item(ns) ajustado(s) no estoque.', 'SUCCESS', {}, ctx.requestId);
  }

  return { create, open, scan, count, recount, approve, finish };
})();
