/**
 * ============================================================
 * ALMOXA PRO — Service_Estoque.gs
 * FASE 4 — IMPLEMENTADO DE VERDADE.
 *
 * Núcleo do sistema (seção 24). Toda movimentação gera registro
 * em MOVIMENTOS — nunca altera saldo sem rastro (regra explícita
 * da spec: "nunca simplesmente alterar saldo sem registrar
 * movimento").
 *
 * Fecha o fluxo principal (seção 65): NF → Conferência →
 * Aprovação → ENTRADA → ESTOQUE. Ver Service_NF.approve(), que
 * agora chama _registrarEntradaInterna() automaticamente.
 * ============================================================
 */

const Service_Estoque = (function () {

  function _saldoDisponivel(row) {
    return Number(row.saldo || 0) - Number(row.reservado || 0) - Number(row.bloqueado || 0);
  }

  function _getOrCreateSaldo(produtoId, localizacao, estoqueMinimo) {
    let row = DB_Query.findOne('ESTOQUE', r => String(r.produtoId) === String(produtoId) && r.localizacao === localizacao);
    if (!row) {
      row = DB_Insert.insert('ESTOQUE', {
        produtoId: produtoId, localizacao: localizacao,
        saldo: 0, reservado: 0, bloqueado: 0, estoqueMinimo: estoqueMinimo || 0, ultimaMovimentacao: new Date()
      });
    }
    return row;
  }

  /** Define/atualiza o estoque mínimo de um produto/localização (usado pelo Doutor/Notificações para estoque crítico). */
  function setMinimo(ctx) {
    const { produtoId, localizacao, estoqueMinimo } = ctx.payload || {};
    try { DB_Validation.requireFields(ctx.payload || {}, ['produtoId', 'localizacao', 'estoqueMinimo']); }
    catch (e) { return Core_Response.error(e.code || CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, e.message, {}, ctx.requestId); }
    const saldoRow = _getOrCreateSaldo(produtoId, localizacao, estoqueMinimo);
    DB_Update.byRowIndex('ESTOQUE', saldoRow._rowIndex, { estoqueMinimo });
    Audit_Service.record(ctx, 'ESTOQUE_MINIMO_DEFINIDO', { entidade: 'ESTOQUE', entidadeId: saldoRow.ID }, { estoqueMinimo: saldoRow.estoqueMinimo }, { estoqueMinimo });
    return Core_Response.ok(DB_Query.get('ESTOQUE', saldoRow.ID), 'Estoque mínimo atualizado.', 'SUCCESS', {}, ctx.requestId);
  }

  // ---- ENTRADA (usada pela rota estoque.entry E internamente por Service_NF) ----
  function _registrarEntradaInterna(produtoId, localizacao, quantidade, meta, ctx) {
    const saldoRow = _getOrCreateSaldo(produtoId, localizacao);
    const novoSaldo = Number(saldoRow.saldo || 0) + Number(quantidade);
    DB_Update.byRowIndex('ESTOQUE', saldoRow._rowIndex, { saldo: novoSaldo, ultimaMovimentacao: new Date() });

    DB_Insert.insert('MOVIMENTOS', {
      tipo: 'ENTRADA', produtoId: produtoId, quantidade: quantidade,
      origem: meta.origem || '', destino: localizacao,
      responsavel: ctx.userId, documentoId: meta.documentoId || '',
      obraId: meta.obraId || '', projetoId: meta.projetoId || '', atividadeId: meta.atividadeId || '',
      data: new Date()
    });

    Event_Bus.emit(EVENT_TYPES.ESTOQUE_ENTRADA, { produtoId, localizacao, quantidade, documentoId: meta.documentoId }, ctx);
    Audit_Service.record(ctx, 'ESTOQUE_ENTRADA', { entidade: 'ESTOQUE', entidadeId: saldoRow.ID }, { saldo: saldoRow.saldo }, { saldo: novoSaldo });

    return DB_Query.get('ESTOQUE', saldoRow.ID);
  }

  function entry(ctx) {
    const { produtoId, localizacao, quantidade, documentoId, obraId } = ctx.payload || {};
    try {
      DB_Validation.requireFields(ctx.payload || {}, ['produtoId', 'localizacao', 'quantidade']);
    } catch (e) {
      return Core_Response.error(e.code || CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, e.message, {}, ctx.requestId);
    }
    if (!Utils_Validation.isPositiveNumber(Number(quantidade))) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'quantidade deve ser um número positivo.', {}, ctx.requestId);
    }
    const atualizado = _registrarEntradaInterna(produtoId, localizacao, quantidade, { documentoId, obraId }, ctx);
    return Core_Response.ok(atualizado, 'Entrada registrada.', 'SUCCESS', {}, ctx.requestId);
  }

  // ---- SAÍDA ----
  // liberarReservadoQtd: quando a saída vem de uma reserva já
  // aprovada, o valor reservado precisa ser liberado junto com o
  // débito do saldo (senão o "reservado" fica travado pra sempre).
  function _registrarSaidaInterna(produtoId, localizacao, quantidade, meta, ctx, liberarReservadoQtd) {
    const saldoRow = DB_Query.findOne('ESTOQUE', r => String(r.produtoId) === String(produtoId) && r.localizacao === localizacao);
    if (!saldoRow) {
      throw Object.assign(new Error('Não há saldo cadastrado para este produto/localização.'), { code: CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND });
    }
    if (_saldoDisponivel(saldoRow) < Number(quantidade) && !liberarReservadoQtd) {
      throw Object.assign(new Error('Saldo disponível insuficiente. Disponível: ' + _saldoDisponivel(saldoRow) + ', solicitado: ' + quantidade + '.'), { code: CORE_CONSTANTS.RESPONSE_CODES.ESTOQUE_INSUFICIENTE });
    }

    const patch = { saldo: Number(saldoRow.saldo) - Number(quantidade), ultimaMovimentacao: new Date() };
    if (liberarReservadoQtd) {
      patch.reservado = Math.max(0, Number(saldoRow.reservado || 0) - Number(liberarReservadoQtd));
    }
    DB_Update.byRowIndex('ESTOQUE', saldoRow._rowIndex, patch);

    DB_Insert.insert('MOVIMENTOS', {
      tipo: 'SAIDA', produtoId, quantidade, origem: localizacao, destino: meta.motivo || '',
      responsavel: ctx.userId, documentoId: meta.documentoId || '', obraId: meta.obraId || '', projetoId: meta.projetoId || '', atividadeId: meta.atividadeId || '', data: new Date()
    });
    Event_Bus.emit(EVENT_TYPES.ESTOQUE_SAIDA, { produtoId, localizacao, quantidade, motivo: meta.motivo }, ctx);
    Audit_Service.record(ctx, 'ESTOQUE_SAIDA', { entidade: 'ESTOQUE', entidadeId: saldoRow.ID }, { saldo: saldoRow.saldo }, { saldo: patch.saldo });

    return DB_Query.get('ESTOQUE', saldoRow.ID);
  }

  function exit(ctx) {
    const { produtoId, localizacao, quantidade, motivo, obraId } = ctx.payload || {};
    try {
      DB_Validation.requireFields(ctx.payload || {}, ['produtoId', 'localizacao', 'quantidade']);
    } catch (e) {
      return Core_Response.error(e.code || CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, e.message, {}, ctx.requestId);
    }
    try {
      const atualizado = _registrarSaidaInterna(produtoId, localizacao, quantidade, { motivo, obraId }, ctx, 0);
      return Core_Response.ok(atualizado, 'Saída registrada.', 'SUCCESS', {}, ctx.requestId);
    } catch (e) {
      return Core_Response.error(e.code || CORE_CONSTANTS.RESPONSE_CODES.INTERNAL_ERROR, e.message, {}, ctx.requestId);
    }
  }

  // ---- TRANSFERÊNCIA entre localizações ----
  function transfer(ctx) {
    const { produtoId, origemLocalizacao, destinoLocalizacao, quantidade } = ctx.payload || {};
    try {
      DB_Validation.requireFields(ctx.payload || {}, ['produtoId', 'origemLocalizacao', 'destinoLocalizacao', 'quantidade']);
    } catch (e) {
      return Core_Response.error(e.code || CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, e.message, {}, ctx.requestId);
    }
    if (origemLocalizacao === destinoLocalizacao) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'Origem e destino não podem ser iguais.', {}, ctx.requestId);
    }

    const saldoOrigem = DB_Query.findOne('ESTOQUE', r => String(r.produtoId) === String(produtoId) && r.localizacao === origemLocalizacao);
    if (!saldoOrigem || _saldoDisponivel(saldoOrigem) < Number(quantidade)) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.ESTOQUE_INSUFICIENTE, 'Saldo disponível insuficiente na origem.', {}, ctx.requestId);
    }

    DB_Update.byRowIndex('ESTOQUE', saldoOrigem._rowIndex, { saldo: Number(saldoOrigem.saldo) - Number(quantidade), ultimaMovimentacao: new Date() });
    const saldoDestino = _getOrCreateSaldo(produtoId, destinoLocalizacao);
    DB_Update.byRowIndex('ESTOQUE', saldoDestino._rowIndex, { saldo: Number(saldoDestino.saldo) + Number(quantidade), ultimaMovimentacao: new Date() });

    DB_Insert.insert('MOVIMENTOS', {
      tipo: 'TRANSFERENCIA', produtoId, quantidade, origem: origemLocalizacao, destino: destinoLocalizacao,
      responsavel: ctx.userId, documentoId: '', obraId: '', projetoId: '', atividadeId: '', data: new Date()
    });
    Audit_Service.record(ctx, 'ESTOQUE_TRANSFERENCIA', { entidade: 'ESTOQUE', entidadeId: produtoId }, {}, { origemLocalizacao, destinoLocalizacao, quantidade });

    return Core_Response.ok({
      origem: DB_Query.get('ESTOQUE', saldoOrigem.ID),
      destino: DB_Query.get('ESTOQUE', saldoDestino.ID)
    }, 'Transferência realizada.', 'SUCCESS', {}, ctx.requestId);
  }

  // ---- AJUSTE (uso tipicamente pós-inventário) ----
  function adjust(ctx) {
    const { produtoId, localizacao, novoSaldo, motivo } = ctx.payload || {};
    try {
      DB_Validation.requireFields(ctx.payload || {}, ['produtoId', 'localizacao', 'novoSaldo', 'motivo']);
    } catch (e) {
      return Core_Response.error(e.code || CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, e.message, {}, ctx.requestId);
    }
    const saldoRow = _getOrCreateSaldo(produtoId, localizacao);
    const saldoAnterior = Number(saldoRow.saldo || 0);
    const diferenca = Number(novoSaldo) - saldoAnterior;

    DB_Update.byRowIndex('ESTOQUE', saldoRow._rowIndex, { saldo: novoSaldo, ultimaMovimentacao: new Date() });
    DB_Insert.insert('MOVIMENTOS', {
      tipo: 'AJUSTE', produtoId, quantidade: diferenca, origem: '', destino: localizacao,
      responsavel: ctx.userId, documentoId: '', obraId: '', projetoId: '', atividadeId: '', data: new Date()
    });
    Audit_Service.record(ctx, 'ESTOQUE_AJUSTE', { entidade: 'ESTOQUE', entidadeId: saldoRow.ID }, { saldo: saldoAnterior }, { saldo: novoSaldo, motivo });

    return Core_Response.ok(DB_Query.get('ESTOQUE', saldoRow.ID), 'Ajuste de estoque registrado (diferença: ' + diferenca + ').', 'SUCCESS', {}, ctx.requestId);
  }

  // ---- Consultas ----
  function get(ctx) {
    const p = ctx.payload || {};
    const row = p.id ? DB_Query.get('ESTOQUE', p.id)
      : DB_Query.findOne('ESTOQUE', r => String(r.produtoId) === String(p.produtoId) && r.localizacao === p.localizacao);
    if (!row) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Saldo não encontrado.', {}, ctx.requestId);
    return Core_Response.ok(Object.assign({}, row, { saldoDisponivel: _saldoDisponivel(row) }), '', 'SUCCESS', {}, ctx.requestId);
  }

  function search(ctx) {
    const f = ctx.payload || {};
    const rows = DB_Query.find('ESTOQUE', r => {
      if (f.produtoId && String(r.produtoId) !== String(f.produtoId)) return false;
      if (f.localizacao && r.localizacao !== f.localizacao) return false;
      return true;
    }).map(r => Object.assign({}, r, { saldoDisponivel: _saldoDisponivel(r) }));
    return Core_Response.ok(rows, '', 'SUCCESS', {}, ctx.requestId);
  }

  function history(ctx) {
    const f = ctx.payload || {};
    const rows = DB_Query.find('MOVIMENTOS', m => {
      if (f.produtoId && String(m.produtoId) !== String(f.produtoId)) return false;
      if (f.localizacao && m.origem !== f.localizacao && m.destino !== f.localizacao) return false;
      if (f.tipo && m.tipo !== f.tipo) return false;
      return true;
    }).sort((a, b) => new Date(b.data) - new Date(a.data));
    return Core_Response.ok(rows, '', 'SUCCESS', {}, ctx.requestId);
  }

  // ---- Reserva de saldo (usado por Service_Reserva — não move físico, só "trava") ----
  function _reservarSaldoInterno(produtoId, localizacao, quantidade) {
    const saldoRow = DB_Query.findOne('ESTOQUE', r => String(r.produtoId) === String(produtoId) && r.localizacao === localizacao);
    if (!saldoRow) {
      throw Object.assign(new Error('Não há saldo cadastrado para este produto/localização.'), { code: CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND });
    }
    if (_saldoDisponivel(saldoRow) < Number(quantidade)) {
      throw Object.assign(new Error('Saldo disponível insuficiente para reservar. Disponível: ' + _saldoDisponivel(saldoRow) + '.'), { code: CORE_CONSTANTS.RESPONSE_CODES.ESTOQUE_INSUFICIENTE });
    }
    DB_Update.byRowIndex('ESTOQUE', saldoRow._rowIndex, { reservado: Number(saldoRow.reservado || 0) + Number(quantidade) });
    return DB_Query.get('ESTOQUE', saldoRow.ID);
  }

  function _liberarReservaInterno(produtoId, localizacao, quantidade) {
    const saldoRow = DB_Query.findOne('ESTOQUE', r => String(r.produtoId) === String(produtoId) && r.localizacao === localizacao);
    if (!saldoRow) return null;
    DB_Update.byRowIndex('ESTOQUE', saldoRow._rowIndex, { reservado: Math.max(0, Number(saldoRow.reservado || 0) - Number(quantidade)) });
    return DB_Query.get('ESTOQUE', saldoRow.ID);
  }

  return { get, search, entry, exit, transfer, adjust, history, setMinimo, _registrarEntradaInterna, _registrarSaidaInterna, _reservarSaldoInterno, _liberarReservaInterno };
})();
