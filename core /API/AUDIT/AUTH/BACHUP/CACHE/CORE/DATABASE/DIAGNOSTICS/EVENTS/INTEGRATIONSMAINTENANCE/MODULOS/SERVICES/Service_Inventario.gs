/**
 * ============================================================
 * ALMOXA PRO — Service_Inventario.gs
 * FASE 6 do backend — núcleo real preservado.
 *
 * MÓDULO 04 (contrato "PROMPTS_MODULOS_04_05_06") — AMPLIA sem
 * reescrever. Auditoria confirmou: create/open/scan/count/
 * recount/finish/approve já funcionavam de verdade. O que faltava:
 *
 *   - consulta (get/listar) — não existia NENHUMA rota de leitura
 *     fora do retorno direto de cada ação;
 *   - autorização real de quem pode contar (OPERADOR tinha EDIT
 *     bloqueado, mesmo a spec querendo "operador conta quando
 *     autorizado" — corrigido com lista explícita de equipe);
 *   - planejamento por categoria/conjunto de produtos (só existia
 *     por localização);
 *   - impedir dois inventários conflitantes no mesmo escopo;
 *   - liberação programada (Planejado → Liberado, só na data);
 *   - geração automática D-1;
 *   - reaproveitar a tabela DIVERGENCIAS já existente (a spec
 *     pede pra não inventar aba nova se já tem uma real);
 *   - relatório discriminado;
 *   - detectar movimentação de estoque durante o inventário.
 *
 * Fluxo agora (LIBERAÇÃO é opcional — quem não configurar
 * dataLiberacao mantém o fluxo antigo intacto, direto de
 * CRIADO pra ABERTO, sem quebrar nada que já funcionava):
 *
 * CRIAR → (LIBERAR, se configurado) → ABRIR (congela esperado) →
 * BIPAGEM/CONTAGEM → DIVERGÊNCIA (também registrada em
 * DIVERGENCIAS) → RECONTAGEM → APROVAÇÃO → AJUSTE real no
 * ESTOQUE → FECHAMENTO → RELATÓRIO
 * ============================================================
 */

const Service_Inventario = (function () {

  const SCAN_DEBOUNCE_SEC = 2;
  const ESTADOS_ATIVOS = ['CRIADO', 'LIBERADO', 'ABERTO', 'EM_CONTAGEM', 'EM_RECONTAGEM', 'PENDENTE_APROVACAO'];

  function _parseLista(csv) {
    return (csv || '').split(',').map(s => s.trim()).filter(Boolean);
  }

  /**
   * Autorização real de quem pode contar (seção 7 do contrato:
   * "Operador: contar quando autorizado"). Sem equipe definida no
   * inventário, ALMOXARIFE+ sempre pode contar (comportamento
   * antigo preservado); COM equipe definida, só quem está na
   * lista (ou ALMOXARIFE+) conta — é isso que torna "autorizado"
   * uma checagem de verdade, não só um rótulo de perfil.
   */
  function _podeContar(inventario, ctx) {
    const perfisGestao = [CORE_CONSTANTS.PERFIS.ALMOXARIFE, CORE_CONSTANTS.PERFIS.GESTOR, CORE_CONSTANTS.PERFIS.ADMIN];
    if (perfisGestao.includes(ctx.perfil)) return true;
    const equipe = _parseLista(inventario.equipeAutorizada);
    if (!equipe.length) return false; // sem equipe definida, só gestão conta (regra restritiva por padrão)
    return equipe.includes(String(ctx.userId));
  }

  function _podeVer(inventario, ctx) {
    const perfisGestao = [CORE_CONSTANTS.PERFIS.ALMOXARIFE, CORE_CONSTANTS.PERFIS.GESTOR, CORE_CONSTANTS.PERFIS.ADMIN];
    if (perfisGestao.includes(ctx.perfil)) return true;
    if (String(inventario.responsavel) === String(ctx.userId)) return true;
    return _parseLista(inventario.equipeAutorizada).includes(String(ctx.userId));
  }

  /** Impede dois inventários ativos conflitando no mesmo escopo (seção 2.1 do contrato). */
  function _existeInventarioAtivoNoEscopo(localizacao, categoria) {
    return DB_Query.exists('INVENTARIOS', inv =>
      ESTADOS_ATIVOS.includes(inv.estado) && inv.localizacao === localizacao && (inv.categoria || '') === (categoria || '')
    );
  }

  function create(ctx) {
    const p = ctx.payload || {};
    if (!p.localizacao) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'localizacao é obrigatória.', {}, ctx.requestId);

    if (_existeInventarioAtivoNoEscopo(p.localizacao, p.categoria)) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR,
        'Já existe um inventário ativo para este escopo (localização' + (p.categoria ? '/categoria' : '') + ').', {}, ctx.requestId);
    }

    const sequencial = DB_Query.count('INVENTARIOS', () => true) + 1;
    const inventario = DB_Insert.insert('INVENTARIOS', {
      token: Utils_ID.tokenComAno('INV', sequencial),
      obraId: p.obraId || '', localizacao: p.localizacao, categoria: p.categoria || '',
      produtosEscopo: Array.isArray(p.produtosEscopo) ? p.produtosEscopo.join(',') : '',
      estado: 'CRIADO', responsavel: ctx.userId,
      equipeAutorizada: Array.isArray(p.equipeAutorizada) ? p.equipeAutorizada.join(',') : '',
      dataLiberacao: p.dataLiberacao || '', origem: p.origem || 'MANUAL',
      tipo: p.tipo || 'GERAL', // BLOCO 04, seção 5 — GERAL/CICLICO/ROTATIVO (livre, não validado contra lista fechada — informativo)
      dataAbertura: '', dataFechamento: ''
    });
    Event_Bus.emit(EVENT_TYPES.INVENTARIO_CRIADO, { inventarioId: inventario.ID, token: inventario.token }, ctx);
    Audit_Service.record(ctx, 'INVENTARIO_CRIADO', { entidade: 'INVENTARIOS', entidadeId: inventario.ID });
    return Core_Response.ok(inventario, 'Inventário criado: ' + inventario.token, 'SUCCESS', {}, ctx.requestId);
  }

  /**
   * NOVA — libera a contagem só na data/horário configurado
   * (seção 2.2 do contrato). Passo OPCIONAL: um inventário criado
   * sem `dataLiberacao` pode ir direto pra open(), exatamente como
   * sempre funcionou — não quebra o fluxo antigo.
   */
  function liberar(ctx) {
    const inventario = DB_Query.get('INVENTARIOS', ctx.payload.id);
    if (!inventario) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Inventário não encontrado.', {}, ctx.requestId);
    if (inventario.estado !== 'CRIADO') {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'Só é possível liberar um inventário recém-criado (estado atual: ' + inventario.estado + ').', {}, ctx.requestId);
    }
    if (inventario.dataLiberacao && new Date() < new Date(inventario.dataLiberacao)) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR,
        'Ainda não chegou a data/horário de liberação (' + inventario.dataLiberacao + ').', {}, ctx.requestId);
    }
    DB_Update.byId('INVENTARIOS', inventario.ID, { estado: 'LIBERADO' });
    Event_Bus.emit(EVENT_TYPES.INVENTARIO_LIBERADO, { inventarioId: inventario.ID, token: inventario.token }, ctx);
    Audit_Service.record(ctx, 'INVENTARIO_LIBERADO', { entidade: 'INVENTARIOS', entidadeId: inventario.ID });
    return Core_Response.ok(DB_Query.get('INVENTARIOS', inventario.ID), 'Inventário liberado para contagem.', 'SUCCESS', {}, ctx.requestId);
  }

  // ---- ABRIR: congela o saldo atual de cada produto no escopo como "esperado" ----
  function open(ctx) {
    const inventario = DB_Query.get('INVENTARIOS', ctx.payload.id);
    if (!inventario) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Inventário não encontrado.', {}, ctx.requestId);
    if (!['CRIADO', 'LIBERADO'].includes(inventario.estado)) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'Inventário já foi aberto (estado atual: ' + inventario.estado + ').', {}, ctx.requestId);
    }
    // Se dataLiberacao foi configurada, exige ter passado por liberar() antes — não pula a regra.
    if (inventario.dataLiberacao && inventario.estado === 'CRIADO') {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'Este inventário exige liberação antes de abrir (use inventario.liberar).', {}, ctx.requestId);
    }

    let saldosNoEscopo = DB_Query.find('ESTOQUE', r => r.localizacao === inventario.localizacao);
    // Planejamento parcial por categoria (seção 2.1: "por localização, área, obra, categoria ou conjunto de produtos")
    if (inventario.categoria) {
      const produtosDaCategoria = new Set(DB_Query.find('PRODUTOS', p => p.categoria === inventario.categoria).map(p => String(p.ID)));
      saldosNoEscopo = saldosNoEscopo.filter(r => produtosDaCategoria.has(String(r.produtoId)));
    }
    const escopoProdutos = _parseLista(inventario.produtosEscopo);
    if (escopoProdutos.length) {
      saldosNoEscopo = saldosNoEscopo.filter(r => escopoProdutos.includes(String(r.produtoId)));
    }

    /**
     * BLOCO 04, seção 6/7 — "valor unitário"/"valor sistêmico"/
     * "diferença financeira". `PRODUTOS` não tem campo de custo
     * nenhum (confirmado antes de escrever isso) — a única fonte
     * REAL de preço é o histórico de nota fiscal aprovada, que o
     * Módulo 03 já expõe via `Service_PreCompra
     * .obterPrecoReferencia()`. Reaproveitado aqui, nunca
     * duplicado. Sem histórico de preço pro produto, o valor
     * financeiro fica `null` — nunca um número inventado.
     */
    const contagens = saldosNoEscopo.map(saldo => {
      const precoRef = Service_PreCompra.obterPrecoReferencia(saldo.produtoId);
      const valorUnitario = precoRef.historicoSuficiente ? precoRef.precoMedio : null;
      const esperadoNum = Number(saldo.saldo || 0);
      return DB_Insert.insert('CONTAGENS', {
        inventarioId: inventario.ID, produtoId: saldo.produtoId,
        esperado: esperadoNum, contado: 0, diferenca: -esperadoNum,
        operador: '', dispositivo: '', dataHora: '',
        valorUnitario: valorUnitario || 0, valorUnitarioDisponivel: !!valorUnitario,
        valorSistemico: valorUnitario ? Utils_Currency.round2(esperadoNum * valorUnitario) : 0,
        valorContado: 0,
        diferencaFinanceira: valorUnitario ? Utils_Currency.round2(-esperadoNum * valorUnitario) : 0
      });
    });

    DB_Update.byId('INVENTARIOS', inventario.ID, { estado: 'ABERTO', dataAbertura: new Date() });
    Event_Bus.emit(EVENT_TYPES.INVENTARIO_ABERTO, { inventarioId: inventario.ID, totalItens: contagens.length }, ctx);
    Audit_Service.record(ctx, 'INVENTARIO_ABERTO', { entidade: 'INVENTARIOS', entidadeId: inventario.ID });

    return Core_Response.ok({ inventario: DB_Query.get('INVENTARIOS', inventario.ID), contagens },
      'Inventário aberto com ' + contagens.length + ' item(ns) esperado(s) do escopo.', 'SUCCESS', {}, ctx.requestId);
  }

  function _findOrCreateContagem(inventarioId, produtoId) {
    let row = DB_Query.findOne('CONTAGENS', c => String(c.inventarioId) === String(inventarioId) && String(c.produtoId) === String(produtoId));
    if (!row) {
      const precoRef = Service_PreCompra.obterPrecoReferencia(produtoId);
      const valorUnitario = precoRef.historicoSuficiente ? precoRef.precoMedio : null;
      row = DB_Insert.insert('CONTAGENS', {
        inventarioId, produtoId, esperado: 0, contado: 0, diferenca: 0, operador: '', dispositivo: '', dataHora: '',
        valorUnitario: valorUnitario || 0, valorUnitarioDisponivel: !!valorUnitario, valorSistemico: 0, valorContado: 0, diferencaFinanceira: 0
      });
    }
    return row;
  }

  /** BLOCO 04, seção 7 — recalcula o lado financeiro sempre que `contado` muda. Fórmula numérica real, nunca texto formatado como fonte de cálculo. */
  function _recalcularValoresFinanceiros(contagem, novoContado) {
    if (!contagem.valorUnitarioDisponivel) return { valorSistemico: 0, valorContado: 0, diferencaFinanceira: 0 };
    const valorUnitario = Number(contagem.valorUnitario || 0);
    const valorSistemico = Utils_Currency.round2(Number(contagem.esperado || 0) * valorUnitario);
    const valorContado = Utils_Currency.round2(Number(novoContado || 0) * valorUnitario);
    return { valorSistemico, valorContado, diferencaFinanceira: Utils_Currency.round2(valorContado - valorSistemico) };
  }

  function _marcarInicioContagemSeNecessario(inventario, ctx) {
    if (inventario.estado === 'ABERTO') {
      DB_Update.byId('INVENTARIOS', inventario.ID, { estado: 'EM_CONTAGEM' });
      Event_Bus.emit(EVENT_TYPES.INVENTARIO_INICIADO, { inventarioId: inventario.ID, token: inventario.token }, ctx);
    }
  }

  // ---- BIPAGEM ----
  function scan(ctx) {
    const { inventarioId, codigo, quantidade, dispositivo } = ctx.payload || {};
    if (!inventarioId || !codigo) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'inventarioId e codigo são obrigatórios.', {}, ctx.requestId);
    }
    const inventario = DB_Query.get('INVENTARIOS', inventarioId);
    if (!inventario || !['ABERTO', 'EM_CONTAGEM'].includes(inventario.estado)) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'Inventário precisa estar ABERTO ou EM_CONTAGEM para bipar.', {}, ctx.requestId);
    }
    if (!_podeContar(inventario, ctx)) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.PERMISSION_DENIED, 'Você não está autorizado a contar este inventário.', {}, ctx.requestId);
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
    const financeiro = _recalcularValoresFinanceiros(contagem, novoContado);
    DB_Update.byRowIndex('CONTAGENS', contagem._rowIndex, {
      contado: novoContado, diferenca: novoContado - Number(contagem.esperado || 0),
      operador: ctx.userId, dispositivo: dispositivo || '', dataHora: new Date(),
      valorContado: financeiro.valorContado, diferencaFinanceira: financeiro.diferencaFinanceira
    });

    _marcarInicioContagemSeNecessario(inventario, ctx);

    return Core_Response.ok({ produto, contadoAtual: novoContado, esperado: contagem.esperado }, 'Bipagem registrada.', 'SUCCESS', {}, ctx.requestId);
  }

  // ---- CONTAGEM MANUAL (granel, sem código) ----
  function count(ctx) {
    const { inventarioId, produtoId, quantidadeContada, dispositivo } = ctx.payload || {};
    if (!inventarioId || !produtoId || quantidadeContada === undefined) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'inventarioId, produtoId e quantidadeContada são obrigatórios.', {}, ctx.requestId);
    }
    const inventario = DB_Query.get('INVENTARIOS', inventarioId);
    if (!inventario || !['ABERTO', 'EM_CONTAGEM'].includes(inventario.estado)) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'Inventário precisa estar ABERTO ou EM_CONTAGEM.', {}, ctx.requestId);
    }
    if (!_podeContar(inventario, ctx)) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.PERMISSION_DENIED, 'Você não está autorizado a contar este inventário.', {}, ctx.requestId);
    }
    const contagem = _findOrCreateContagem(inventarioId, produtoId);
    const financeiro = _recalcularValoresFinanceiros(contagem, quantidadeContada);
    DB_Update.byRowIndex('CONTAGENS', contagem._rowIndex, {
      contado: quantidadeContada, diferenca: Number(quantidadeContada) - Number(contagem.esperado || 0),
      operador: ctx.userId, dispositivo: dispositivo || '', dataHora: new Date(),
      valorContado: financeiro.valorContado, diferencaFinanceira: financeiro.diferencaFinanceira
    });
    _marcarInicioContagemSeNecessario(inventario, ctx);

    Audit_Service.record(ctx, 'CONTAGEM_MANUAL', { entidade: 'CONTAGENS', entidadeId: contagem.ID }, { contado: contagem.contado }, { contado: quantidadeContada });
    return Core_Response.ok(DB_Query.get('CONTAGENS', contagem.ID), 'Contagem manual registrada.', 'SUCCESS', {}, ctx.requestId);
  }

  // ---- RECONTAGEM ----
  function recount(ctx) {
    const { inventarioId, produtoId, quantidadeRecontada } = ctx.payload || {};
    const inventario = DB_Query.get('INVENTARIOS', inventarioId);
    if (!inventario) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Inventário não encontrado.', {}, ctx.requestId);
    if (!['EM_CONTAGEM', 'PENDENTE_APROVACAO'].includes(inventario.estado)) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'Recontagem só é permitida em EM_CONTAGEM ou PENDENTE_APROVACAO (estado atual: ' + inventario.estado + ').', {}, ctx.requestId);
    }
    if (!_podeContar(inventario, ctx)) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.PERMISSION_DENIED, 'Você não está autorizado a recontar este inventário.', {}, ctx.requestId);
    }
    const contagem = DB_Query.findOne('CONTAGENS', c => String(c.inventarioId) === String(inventarioId) && String(c.produtoId) === String(produtoId));
    if (!contagem) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Contagem do item não encontrada.', {}, ctx.requestId);

    const financeiro = _recalcularValoresFinanceiros(contagem, quantidadeRecontada);
    DB_Update.byRowIndex('CONTAGENS', contagem._rowIndex, {
      contado: quantidadeRecontada, diferenca: Number(quantidadeRecontada) - Number(contagem.esperado || 0),
      operador: ctx.userId, dataHora: new Date(),
      valorContado: financeiro.valorContado, diferencaFinanceira: financeiro.diferencaFinanceira
    });
    DB_Update.byId('INVENTARIOS', inventarioId, { estado: 'EM_RECONTAGEM' });
    Event_Bus.emit(EVENT_TYPES.INVENTARIO_RECONTAGEM, { inventarioId, produtoId }, ctx);
    Audit_Service.record(ctx, 'INVENTARIO_RECONTAGEM', { entidade: 'CONTAGENS', entidadeId: contagem.ID }, { contado: contagem.contado }, { contado: quantidadeRecontada });

    return Core_Response.ok(DB_Query.get('CONTAGENS', contagem.ID), 'Recontagem registrada.', 'SUCCESS', {}, ctx.requestId);
  }

  /**
   * BLOCO 04, seção 3/20 — `cancelar()`: a peça que faltava.
   * `CANCELADO` já existia no enum `INVENTARIO_ESTADOS` desde a
   * primeira versão do módulo, mas NENHUMA função jamais fazia
   * essa transição — um inventário nunca podia ser cancelado de
   * verdade, só reprovado (depois de já ter sido contado) ou
   * deixado pra sempre num estado ativo. Corrigido agora.
   *
   * Só cabe em estado ainda ATIVO (antes de aprovado/finalizado/
   * já cancelado) — depois de aprovado, a operação já ajustou
   * estoque de verdade, e desfazer isso é responsabilidade de
   * quem já existe pra isso (não um "cancelar" tardio).
   */
  function cancelar(ctx) {
    const { id, motivo } = ctx.payload || {};
    const inventario = DB_Query.get('INVENTARIOS', id);
    if (!inventario) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Inventário não encontrado.', {}, ctx.requestId);
    if (!ESTADOS_ATIVOS.includes(inventario.estado)) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR,
        'Só é possível cancelar um inventário em andamento (estado atual: ' + inventario.estado + ' — se já foi aprovado/finalizado, cancelar retroativamente não é seguro).', {}, ctx.requestId);
    }
    if (!_podeVer(inventario, ctx)) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.PERMISSION_DENIED, 'Você não tem acesso a este inventário.', {}, ctx.requestId);
    }

    DB_Update.byId('INVENTARIOS', inventario.ID, { estado: 'CANCELADO', dataFechamento: new Date() });
    Event_Bus.emit(EVENT_TYPES.INVENTARIO_CANCELADO, { inventarioId: inventario.ID, token: inventario.token, motivo: motivo || '' }, ctx);
    Audit_Service.record(ctx, 'INVENTARIO_CANCELADO', { entidade: 'INVENTARIOS', entidadeId: inventario.ID }, { estado: inventario.estado }, { estado: 'CANCELADO', motivo: motivo || '' });

    return Core_Response.ok(DB_Query.get('INVENTARIOS', inventario.ID), 'Inventário cancelado.', 'SUCCESS', {}, ctx.requestId);
  }

  /** Detecta movimentação real de estoque na localização durante a janela do inventário (seção 4 do contrato — nunca esconder isso). */
  function _movimentacoesDuranteInventario(inventario) {
    if (!inventario.dataAbertura) return [];
    const inicio = new Date(inventario.dataAbertura);
    const fim = inventario.dataFechamento ? new Date(inventario.dataFechamento) : new Date();
    return DB_Query.find('MOVIMENTOS', m =>
      (m.origem === inventario.localizacao || m.destino === inventario.localizacao) &&
      new Date(m.data) >= inicio && new Date(m.data) <= fim
    );
  }

  // ---- FINISH: fecha a contagem, registra divergência na tabela real, decide se precisa de aprovação ----
  function finish(ctx) {
    const inventario = DB_Query.get('INVENTARIOS', ctx.payload.id);
    if (!inventario) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Inventário não encontrado.', {}, ctx.requestId);
    if (!['EM_CONTAGEM', 'EM_RECONTAGEM'].includes(inventario.estado)) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'Inventário precisa ter itens contados antes de finalizar (estado atual: ' + inventario.estado + ').', {}, ctx.requestId);
    }

    const contagens = DB_Query.find('CONTAGENS', c => String(c.inventarioId) === String(inventario.ID));
    const divergentes = contagens.filter(c => Number(c.diferenca) !== 0);
    const movimentacoes = _movimentacoesDuranteInventario(inventario);

    if (divergentes.length === 0) {
      DB_Update.byId('INVENTARIOS', inventario.ID, { estado: 'FINALIZADO', dataFechamento: new Date() });
      Event_Bus.emit(EVENT_TYPES.INVENTARIO_FINALIZADO, { inventarioId: inventario.ID, divergencias: 0 }, ctx);
      Event_Bus.emit(EVENT_TYPES.INVENTARIO_FECHADO, { inventarioId: inventario.ID, token: inventario.token, divergencias: 0 }, ctx);
      Audit_Service.record(ctx, 'INVENTARIO_FINALIZADO', { entidade: 'INVENTARIOS', entidadeId: inventario.ID });
      return Core_Response.ok({
        inventario: DB_Query.get('INVENTARIOS', inventario.ID),
        impactadoPorMovimentacaoDuranteInventario: movimentacoes.length > 0, movimentacoes
      }, 'Inventário finalizado sem divergências.', 'SUCCESS', {}, ctx.requestId);
    }

    // Reaproveita a tabela DIVERGENCIAS real (mesmo padrão da Conferência de NF) — não inventa aba nova.
    const divergenciasRegistradas = divergentes.map(c => DB_Insert.insert('DIVERGENCIAS', {
      documento: inventario.token, item: c.produtoId, tipo: 'INVENTARIO',
      esperado: c.esperado, recebido: c.contado, diferenca: c.diferenca,
      motivo: '', observacao: '', responsavel: ctx.userId, status: 'PENDENTE', aprovador: '', data: new Date()
    }));

    DB_Update.byId('INVENTARIOS', inventario.ID, { estado: 'PENDENTE_APROVACAO' });
    Event_Bus.emit(EVENT_TYPES.INVENTARIO_DIVERGENCIA, { inventarioId: inventario.ID, token: inventario.token, total: divergentes.length }, ctx);
    Audit_Service.record(ctx, 'INVENTARIO_PENDENTE_APROVACAO', { entidade: 'INVENTARIOS', entidadeId: inventario.ID }, null, { divergencias: divergentes.length });

    return Core_Response.ok({
      inventario: DB_Query.get('INVENTARIOS', inventario.ID),
      divergentes, divergenciasRegistradas,
      impactadoPorMovimentacaoDuranteInventario: movimentacoes.length > 0, movimentacoes
    }, divergentes.length + ' item(ns) com divergência — aguardando aprovação (recontagem ou approve).', 'SUCCESS', {}, ctx.requestId);
  }

  /** NOVA — justificar uma divergência específica (seção 2.4 do contrato). */
  function justificarDivergencia(ctx) {
    const { divergenciaId, motivo, observacao } = ctx.payload || {};
    const div = DB_Query.get('DIVERGENCIAS', divergenciaId);
    if (!div || div.tipo !== 'INVENTARIO') return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Divergência de inventário não encontrada.', {}, ctx.requestId);
    DB_Update.byId('DIVERGENCIAS', div.ID, { motivo: motivo || '', observacao: observacao || '' });
    Audit_Service.record(ctx, 'INVENTARIO_DIVERGENCIA_JUSTIFICADA', { entidade: 'DIVERGENCIAS', entidadeId: div.ID });
    return Core_Response.ok(DB_Query.get('DIVERGENCIAS', div.ID), 'Justificativa registrada.', 'SUCCESS', {}, ctx.requestId);
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
      Event_Bus.emit(EVENT_TYPES.INVENTARIO_FECHADO, { inventarioId: inventario.ID, token: inventario.token, decisao: 'REPROVADO' }, ctx);
      Audit_Service.record(ctx, 'INVENTARIO_REPROVADO', { entidade: 'INVENTARIOS', entidadeId: inventario.ID }, null, { motivo: motivo || '' });
      return Core_Response.ok(DB_Query.get('INVENTARIOS', inventario.ID), 'Inventário reprovado — nenhum ajuste aplicado ao estoque.', 'SUCCESS', {}, ctx.requestId);
    }

    const contagens = DB_Query.find('CONTAGENS', c => String(c.inventarioId) === String(inventario.ID));
    const ajustes = [];
    contagens.filter(c => Number(c.diferenca) !== 0).forEach(c => {
      const resultado = Service_Estoque.adjust({
        userId: ctx.userId, requestId: ctx.requestId,
        payload: { produtoId: c.produtoId, localizacao: inventario.localizacao, novoSaldo: c.contado, motivo: 'Ajuste por inventário ' + inventario.token }
      });
      if (resultado.success) ajustes.push(resultado.data);
    });

    // Marca as divergências como aprovadas na tabela real (mesmo fluxo da Conferência).
    DB_Query.find('DIVERGENCIAS', d => d.documento === inventario.token && d.tipo === 'INVENTARIO').forEach(d => {
      DB_Update.byId('DIVERGENCIAS', d.ID, { status: 'APROVADA', aprovador: ctx.userId });
    });

    DB_Update.byId('INVENTARIOS', inventario.ID, { estado: 'APROVADO', dataFechamento: new Date() });
    Event_Bus.emit(EVENT_TYPES.INVENTARIO_FINALIZADO, { inventarioId: inventario.ID, divergencias: ajustes.length }, ctx);
    Event_Bus.emit(EVENT_TYPES.INVENTARIO_FECHADO, { inventarioId: inventario.ID, token: inventario.token, decisao: 'APROVADO' }, ctx);
    Audit_Service.record(ctx, 'INVENTARIO_APROVADO', { entidade: 'INVENTARIOS', entidadeId: inventario.ID }, null, { itensAjustados: ajustes.length });

    return Core_Response.ok({ inventario: DB_Query.get('INVENTARIOS', inventario.ID), ajustes },
      'Inventário aprovado — ' + ajustes.length + ' item(ns) ajustado(s) no estoque.', 'SUCCESS', {}, ctx.requestId);
  }

  /** NOVA — consulta individual, escopada (seção 2.2/7: "visualizar somente inventários dentro do escopo"). */
  function get(ctx) {
    const inventario = DB_Query.get('INVENTARIOS', ctx.payload.id);
    if (!inventario) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Inventário não encontrado.', {}, ctx.requestId);
    if (!_podeVer(inventario, ctx)) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.PERMISSION_DENIED, 'Você não tem acesso a este inventário.', {}, ctx.requestId);
    const contagens = DB_Query.find('CONTAGENS', c => String(c.inventarioId) === String(inventario.ID));
    return Core_Response.ok({ inventario, contagens }, '', 'SUCCESS', {}, ctx.requestId);
  }

  /** NOVA — lista, escopada por perfil/equipe. */
  function listar(ctx) {
    const p = ctx.payload || {};
    const perfisGestao = [CORE_CONSTANTS.PERFIS.ALMOXARIFE, CORE_CONSTANTS.PERFIS.GESTOR, CORE_CONSTANTS.PERFIS.ADMIN];
    const podeVerTodos = perfisGestao.includes(ctx.perfil);
    const rows = DB_Query.find('INVENTARIOS', inv => {
      if (!podeVerTodos && String(inv.responsavel) !== String(ctx.userId) && !_parseLista(inv.equipeAutorizada).includes(String(ctx.userId))) return false;
      if (p.estado && inv.estado !== p.estado) return false;
      if (p.obraId && inv.obraId !== p.obraId) return false;
      return true;
    }).sort((a, b) => new Date(b.dataAbertura || 0) - new Date(a.dataAbertura || 0));
    return Core_Response.ok(rows, '', 'SUCCESS', {}, ctx.requestId);
  }

  /**
   * NOVA — relatório discriminado (seção 2.6 do contrato). Reflete
   * exatamente o que já está persistido — nunca recalcula um saldo
   * esperado diferente do que foi congelado na abertura.
   */
  function relatorio(ctx) {
    const resultado = get(ctx);
    if (!resultado.success) return resultado;
    const { inventario, contagens } = resultado.data;

    const itens = contagens.map(c => {
      const produto = DB_Query.get('PRODUTOS', c.produtoId);
      const percentual = Number(c.esperado) > 0 ? Math.round((Number(c.diferenca) / Number(c.esperado)) * 1000) / 10 : null;
      return {
        produtoId: c.produtoId, codigo: produto ? produto.codigo : '', descricao: produto ? produto.descricaoOriginal : '',
        esperado: c.esperado, contado: c.contado, diferenca: c.diferenca, percentualDiferenca: percentual,
        operador: c.operador, dataHora: c.dataHora,
        // BLOCO 04, seção 6 — lado financeiro por item. Nunca
        // inventado: `valorUnitarioDisponivel:false` quando não
        // há histórico de preço real pro produto.
        valorUnitario: c.valorUnitario, valorUnitarioDisponivel: !!c.valorUnitarioDisponivel,
        valorSistemico: c.valorSistemico, valorContado: c.valorContado, diferencaFinanceira: c.diferencaFinanceira
      };
    });
    const divergencias = DB_Query.find('DIVERGENCIAS', d => d.documento === inventario.token && d.tipo === 'INVENTARIO');
    const recontagens = contagens.filter(c => c.dataHora && inventario.estado !== 'EM_CONTAGEM').length; // aproximação honesta: recontagem = teve edição após a 1ª contagem em EM_RECONTAGEM+
    const movimentacoes = _movimentacoesDuranteInventario(inventario);

    // BLOCO 04, seção 5 — "valor total"/"divergência total" do
    // inventário inteiro. Calculado SOB DEMANDA aqui, nunca
    // guardado como campo próprio em INVENTARIOS — evita o risco
    // de um total ficar desatualizado se uma contagem mudar
    // depois (mesmo raciocínio já usado pro "esperado" congelado).
    const itensComPreco = itens.filter(i => i.valorUnitarioDisponivel);
    const valorTotalSistemico = Utils_Currency.round2(Utils_Array.sum(itensComPreco, i => Number(i.valorSistemico || 0)));
    const valorTotalContado = Utils_Currency.round2(Utils_Array.sum(itensComPreco, i => Number(i.valorContado || 0)));
    const divergenciaFinanceiraTotal = Utils_Currency.round2(valorTotalContado - valorTotalSistemico);

    const relatorioMontado = {
      token: inventario.token, localizacao: inventario.localizacao, obraId: inventario.obraId, categoria: inventario.categoria, tipo: inventario.tipo,
      responsavel: inventario.responsavel, periodo: { abertura: inventario.dataAbertura, fechamento: inventario.dataFechamento },
      statusFinal: inventario.estado, totalItens: itens.length, itens,
      totalDivergencias: divergencias.length, divergencias,
      valorTotalSistemico, valorTotalContado, divergenciaFinanceiraTotal,
      totalItensSemPrecoDisponivel: itens.length - itensComPreco.length, // honesto: quantos itens ficaram fora do cálculo financeiro por falta de histórico de preço
      impactadoPorMovimentacaoDuranteInventario: movimentacoes.length > 0, movimentacoes
    };

    Event_Bus.emit(EVENT_TYPES.INVENTARIO_RELATORIO_PRONTO, { inventarioId: inventario.ID, token: inventario.token }, ctx);
    return Core_Response.ok(relatorioMontado, '', 'SUCCESS', {}, ctx.requestId);
  }

  /**
   * NOVA — geração automática D-1 (seção 2.1 do contrato).
   * Lê `INVENTARIO_D1_LOCALIZACOES` (JSON array) do Core_Config —
   * vazio por padrão, nunca inventa escopo sozinho. Cria E abre
   * automaticamente (pra já nascer pronto pra contagem no dia
   * seguinte); pula localização que já tem inventário ativo
   * (reaproveita a mesma checagem de conflito de create()).
   */
  function gerarInventarioD1(ctx) {
    let localizacoes = [];
    try { localizacoes = JSON.parse(Core_Config.get('INVENTARIO_D1_LOCALIZACOES') || '[]'); } catch (e) { localizacoes = []; }

    const gerados = [];
    localizacoes.forEach(localizacao => {
      if (_existeInventarioAtivoNoEscopo(localizacao, '')) return; // já tem um ativo, não duplica
      const criado = create(Object.assign({}, ctx, { payload: { localizacao, origem: 'D1_AUTOMATICO' } }));
      if (!criado.success) return;
      const aberto = open(Object.assign({}, ctx, { payload: { id: criado.data.ID } }));
      if (aberto.success) gerados.push(criado.data.token);
    });

    return { totalLocalizacoesConfiguradas: localizacoes.length, totalGerados: gerados.length, tokens: gerados };
  }

  return {
    create, liberar, open, scan, count, recount, finish, justificarDivergencia, approve, cancelar,
    get, listar, relatorio, gerarInventarioD1
  };
})();
