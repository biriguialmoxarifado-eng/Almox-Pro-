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

  /**
   * MÓDULO 02 — consumo médio diário real, calculado a partir de
   * MOVIMENTOS (tipo SAIDA) na janela configurada. Nunca inventa
   * um número quando não há dado suficiente — regra explícita do
   * contrato ("não inventar valores"): com menos que
   * ESTOQUE_CONSUMO_MIN_EVENTOS saídas na janela, devolve
   * historicoSuficiente:false e consumoMedioDiario:null.
   */
  function _consumoMedioDiario(produtoId, localizacao) {
    const janelaDias = Number(Core_Config.get('ESTOQUE_CONSUMO_DIAS_JANELA') || 30);
    const minEventos = Number(Core_Config.get('ESTOQUE_CONSUMO_MIN_EVENTOS') || 3);
    const desde = new Date(Date.now() - janelaDias * 24 * 3600 * 1000);

    const saidas = DB_Query.find('MOVIMENTOS', m =>
      m.tipo === 'SAIDA' && String(m.produtoId) === String(produtoId) &&
      m.origem === localizacao && new Date(m.data) >= desde
    );

    if (saidas.length < minEventos) {
      return { historicoSuficiente: false, consumoMedioDiario: null, totalEventosNaJanela: saidas.length };
    }
    const totalSaidas = Utils_Array.sum(saidas, s => Number(s.quantidade || 0));
    return { historicoSuficiente: true, consumoMedioDiario: totalSaidas / janelaDias, totalEventosNaJanela: saidas.length };
  }

  /**
   * MÓDULO 02 — classificação operacional verde/amarelo/vermelho
   * (seção 5 do contrato). Sem `estoqueMinimo` configurado, não
   * dá pra classificar de verdade — devolve NAO_CONFIGURADO em
   * vez de inventar um limiar arbitrário pra aquele item.
   *
   * Regra (limiares vêm de Core_Config, ajustáveis sem redeploy):
   *   disponível <= 0                          → VERMELHO (sem saldo)
   *   disponível <= estoqueMinimo               → VERMELHO (abaixo do mínimo)
   *   disponível <= estoqueMinimo × fatorAmarelo → AMARELO (gatilho de pré-compra)
   *   caso contrário                             → VERDE
   */
  function classificar(estoqueRow) {
    const disponivel = _saldoDisponivel(estoqueRow);
    const minimo = Number(estoqueRow.estoqueMinimo || 0);

    if (minimo <= 0) {
      return { classificacao: 'NAO_CONFIGURADO', disponivel, estoqueMinimo: 0, consumoMedioDiario: null, diasCobertura: null, historicoSuficiente: false };
    }

    const fatorAmarelo = Number(Core_Config.get('ESTOQUE_FATOR_ALERTA_AMARELO') || 1.5);
    let classificacao;
    if (disponivel <= 0 || disponivel <= minimo) classificacao = 'VERMELHO';
    else if (disponivel <= minimo * fatorAmarelo) classificacao = 'AMARELO';
    else classificacao = 'VERDE';

    const consumo = _consumoMedioDiario(estoqueRow.produtoId, estoqueRow.localizacao);
    const diasCobertura = (consumo.historicoSuficiente && consumo.consumoMedioDiario > 0)
      ? Math.round((disponivel / consumo.consumoMedioDiario) * 10) / 10
      : null;

    return {
      classificacao, disponivel, estoqueMinimo: minimo,
      consumoMedioDiario: consumo.historicoSuficiente ? consumo.consumoMedioDiario : null,
      diasCobertura, historicoSuficiente: consumo.historicoSuficiente
    };
  }

  /**
   * MÓDULO 02 — gatilho pra pré-compra (seção 5/8 do contrato):
   * varre todo o ESTOQUE com mínimo configurado, classifica cada
   * linha, e EMITE evento pra quem estiver em AMARELO. Não cria
   * nenhuma compra aqui dentro — só avisa (o Módulo 03 decide o
   * que fazer com o aviso). Pensado pra rodar num gatilho de
   * tempo (ver Gatilhos.gs), mas também pode ser chamado por rota
   * administrativa/teste.
   */
  function verificarNiveis(ctx) {
    const linhas = DB_Query.find('ESTOQUE', r => Number(r.estoqueMinimo) > 0);
    let amarelos = 0;
    linhas.forEach(row => {
      const classificacaoInfo = classificar(row);
      if (classificacaoInfo.classificacao === 'AMARELO') {
        amarelos++;
        Event_Bus.emit(EVENT_TYPES.ESTOQUE_AMARELO_IDENTIFICADO, {
          produtoId: row.produtoId, localizacao: row.localizacao,
          disponivel: classificacaoInfo.disponivel, estoqueMinimo: classificacaoInfo.estoqueMinimo,
          consumoMedioDiario: classificacaoInfo.consumoMedioDiario, diasCobertura: classificacaoInfo.diasCobertura
        }, ctx || {});
      }
    });
    return { totalVerificados: linhas.length, totalAmarelo: amarelos };
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
    // MÓDULO 02 — classificação/consumo compostos na mesma rota
    // existente, sem criar `estoque.classificar` separado (o
    // contrato pede pra compor com rotas existentes quando dá).
    return Core_Response.ok(Object.assign({}, row, { saldoDisponivel: _saldoDisponivel(row) }, classificar(row)), '', 'SUCCESS', {}, ctx.requestId);
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

  /**
   * FASE 6 (Front Mobile) — busca por código/descrição, pensada
   * pra tela de consulta do celular (a `search` acima só aceita
   * produtoId/localização exatos, útil pra código, não pra
   * digitar "capacete" e achar).
   *
   * Escopo por perfil (seção 27/40 do doc de telas — "permissão
   * de módulo é diferente de permissão de dados"): ALMOXARIFE/
   * GESTOR/ADMIN veem o detalhe interno por localização
   * (reservado, bloqueado, mínimo); os demais perfis só veem o
   * saldo disponível agregado, sem esses campos internos.
   */
  function buscar(ctx) {
    const { busca } = ctx.payload || {};
    const perfisGestao = [CORE_CONSTANTS.PERFIS.ALMOXARIFE, CORE_CONSTANTS.PERFIS.GESTOR, CORE_CONSTANTS.PERFIS.ADMIN];
    const detalheCompleto = perfisGestao.includes(ctx.perfil);
    const buscaNorm = busca ? Utils_String.normalize(busca) : null;

    const produtos = DB_Query.find('PRODUTOS', p => {
      if (p.status !== 'ATIVO') return false;
      if (!buscaNorm) return true;
      return Utils_String.normalize(p.descricaoOriginal + ' ' + (p.codigo || '')).includes(buscaNorm);
    });

    const resultado = produtos.map(produto => {
      const saldos = DB_Query.find('ESTOQUE', e => String(e.produtoId) === String(produto.ID));
      const totalDisponivel = Utils_Array.sum(saldos, e => _saldoDisponivel(e));
      const base = {
        produtoId: produto.ID, codigo: produto.codigo, descricao: produto.descricaoOriginal,
        unidade: produto.unidade, totalDisponivel: totalDisponivel
      };
      if (detalheCompleto) {
        base.localizacoes = saldos.map(e => Object.assign({
          localizacao: e.localizacao, saldo: e.saldo, reservado: e.reservado,
          bloqueado: e.bloqueado, disponivel: _saldoDisponivel(e), estoqueMinimo: e.estoqueMinimo
        }, classificar(e))); // MÓDULO 02 — mesma composição do get()
      }
      return base;
    }).filter(p => p.totalDisponivel > 0 || detalheCompleto); // gestão vê tudo, inclusive zerado; outros só o que tem saldo

    return Core_Response.ok(resultado, '', 'SUCCESS', {}, ctx.requestId);
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

  return { get, search, buscar, entry, exit, transfer, adjust, history, setMinimo, classificar, verificarNiveis, _registrarEntradaInterna, _registrarSaidaInterna, _reservarSaldoInterno, _liberarReservaInterno, _saldoDisponivel };
})();
