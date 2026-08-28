/**
 * ============================================================
 * ALMOXA PRO — Service_PreCompra.gs
 * MÓDULO 03 — COMPRAS / PRÉ-COMPRA
 *
 * Camada NOVA (não existia nada equivalente no pacote — inventário
 * confirmado antes de criar). NÃO substitui o processo corporativo
 * de compras: prepara e organiza a necessidade pra análise humana.
 *
 * Reaproveita, sem duplicar:
 * - Service_Estoque (saldo, classificação, consumo médio)
 * - Service_Fornecedor (cadastro de fornecedores)
 * - NOTAS_ITENS/NOTAS_FISCAIS (histórico REAL de preço — achei
 *   essa tabela no inventário; sem ela, "referência de preço"
 *   seria inventado, o que o contrato proíbe explicitamente)
 * - Event_Bus/Audit_Service/Auth_RBAC (nenhuma segunda fonte de
 *   verdade pra autorização ou eventos)
 * ============================================================
 */

const Service_PreCompra = (function () {

  const STATUS_ABERTOS = ['RASCUNHO', 'ABERTA', 'EM_ANALISE'];

  // ---- Snapshot real de estoque no momento da pré-compra (nunca congela um número inventado) ----
  function _snapshotEstoque(produtoId, localizacao) {
    if (!localizacao) return { saldoNoMomento: null, estoqueMinimoNoMomento: null, classificacaoNoMomento: 'SEM_LOCALIZACAO_INFORMADA', consumoMedioDiarioNoMomento: null, diasCoberturaNoMomento: null };
    const row = DB_Query.findOne('ESTOQUE', e => String(e.produtoId) === String(produtoId) && e.localizacao === localizacao);
    if (!row) return { saldoNoMomento: 0, estoqueMinimoNoMomento: 0, classificacaoNoMomento: 'SEM_REGISTRO_DE_ESTOQUE', consumoMedioDiarioNoMomento: null, diasCoberturaNoMomento: null };
    const c = Service_Estoque.classificar(row);
    return {
      saldoNoMomento: Service_Estoque._saldoDisponivel(row), estoqueMinimoNoMomento: c.estoqueMinimo,
      classificacaoNoMomento: c.classificacao, consumoMedioDiarioNoMomento: c.consumoMedioDiario, diasCoberturaNoMomento: c.diasCobertura
    };
  }

  /**
   * Histórico REAL de preço — de NOTAS_ITENS vinculadas a notas
   * fiscais já APROVADAS (não conta cotação/rascunho como preço
   * confirmado). Sem registro nenhum → "sem histórico suficiente",
   * nunca um valor chutado (regra explícita do contrato).
   */
  function _historicoPrecos(produtoId) {
    const itens = DB_Query.find('NOTAS_ITENS', i => String(i.produtoId) === String(produtoId) && Number(i.valorUnitario) > 0);
    const itensValidos = itens.filter(i => {
      const nota = DB_Query.get('NOTAS_FISCAIS', i.notaId);
      return nota && nota.status === 'APROVADA';
    });

    if (!itensValidos.length) {
      return { historicoSuficiente: false, precoMin: null, precoMedio: null, precoMax: null, totalRegistros: 0 };
    }
    const precos = itensValidos.map(i => Number(i.valorUnitario));
    const min = Math.min(...precos), max = Math.max(...precos);
    const media = Utils_Array.sum(itensValidos, i => Number(i.valorUnitario)) / itensValidos.length;
    return {
      historicoSuficiente: true,
      precoMin: Utils_Currency.round2(min), precoMedio: Utils_Currency.round2(media), precoMax: Utils_Currency.round2(max),
      totalRegistros: itensValidos.length
    };
  }

  /**
   * Fornecedores elegíveis = quem JÁ forneceu esse produto de
   * verdade (via nota fiscal aprovada), cruzado com o cadastro
   * real de FORNECEDORES. Sem inventar recomendação — se
   * ninguém forneceu antes, devolve lista vazia com aviso,
   * nunca um "fornecedor sugerido" chutado.
   */
  function sugerirFornecedores(ctx) {
    const { produtoId } = ctx.payload || {};
    if (!produtoId) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'produtoId é obrigatório.', {}, ctx.requestId);

    const itens = DB_Query.find('NOTAS_ITENS', i => String(i.produtoId) === String(produtoId) && Number(i.valorUnitario) > 0);
    const porCnpj = {};
    itens.forEach(item => {
      const nota = DB_Query.get('NOTAS_FISCAIS', item.notaId);
      if (!nota || nota.status !== 'APROVADA' || !nota.emitenteCNPJ) return;
      if (!porCnpj[nota.emitenteCNPJ]) porCnpj[nota.emitenteCNPJ] = { cnpj: nota.emitenteCNPJ, nome: nota.emitenteNome, precos: [], ultimaCompra: nota.dataEmissao };
      porCnpj[nota.emitenteCNPJ].precos.push(Number(item.valorUnitario));
      if (new Date(nota.dataEmissao) > new Date(porCnpj[nota.emitenteCNPJ].ultimaCompra)) porCnpj[nota.emitenteCNPJ].ultimaCompra = nota.dataEmissao;
    });

    const lista = Object.values(porCnpj).map(f => {
      const cadastro = DB_Query.findOne('FORNECEDORES', forn => forn.cnpj === f.cnpj);
      return {
        cnpj: f.cnpj, nome: f.nome,
        fornecedorId: cadastro ? cadastro.ID : null,
        avaliacao: cadastro ? cadastro.avaliacao : null,
        precoMedioHistorico: Utils_Currency.round2(Utils_Array.sum(f.precos, p => p) / f.precos.length),
        totalFornecimentos: f.precos.length, ultimaCompra: f.ultimaCompra
      };
    }).sort((a, b) => a.precoMedioHistorico - b.precoMedioHistorico); // menor preço médio primeiro — dado real, não opinião

    return Core_Response.ok({
      fornecedores: lista,
      totalCadastradosNoSistema: DB_Query.count('FORNECEDORES', () => true),
      aviso: lista.length ? null : 'Nenhum fornecedor com histórico de fornecimento deste item — considere o cadastro geral de fornecedores.'
    }, '', 'SUCCESS', {}, ctx.requestId);
  }

  /** Prévia sem criar registro — pro Front mostrar dado real antes de a pessoa confirmar a pré-compra. */
  function calcularResumo(ctx) {
    const { produtoId, localizacao } = ctx.payload || {};
    if (!produtoId) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'produtoId é obrigatório.', {}, ctx.requestId);
    const produto = DB_Query.get('PRODUTOS', produtoId);
    if (!produto) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Produto não encontrado.', {}, ctx.requestId);

    return Core_Response.ok(Object.assign(
      { produtoId, codigo: produto.codigo, descricao: produto.descricaoOriginal, unidade: produto.unidade },
      _snapshotEstoque(produtoId, localizacao),
      _historicoPrecos(produtoId)
    ), '', 'SUCCESS', {}, ctx.requestId);
  }

  /**
   * Cria a pré-compra (um ou vários itens, seção 5 do contrato).
   * Cada item recebe um SNAPSHOT real (nunca recalculado depois —
   * é o retrato do momento da solicitação, útil pro histórico).
   */
  function criar(ctx) {
    const p = ctx.payload || {};
    if (!Array.isArray(p.itens) || !p.itens.length) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'A pré-compra precisa de ao menos um item.', {}, ctx.requestId);
    }

    const sequencial = DB_Query.count('PRE_COMPRAS', () => true) + 1;
    const numero = Utils_ID.tokenComAno('PC', sequencial);

    const preCompra = DB_Insert.insert('PRE_COMPRAS', {
      numero, status: 'ABERTA', origem: p.origem || 'MANUAL',
      solicitanteId: ctx.userId, obraId: p.obraId || '', projetoId: p.projetoId || '', atividadeId: p.atividadeId || '',
      justificativa: p.justificativa || '', dataAbertura: new Date(), dataAtualizacao: new Date(),
      aprovadorId: '', dataAprovacao: '', motivoReprovacao: ''
    });

    const itensRegistrados = p.itens.map(item => {
      const produto = DB_Query.get('PRODUTOS', item.produtoId);
      const snapshotEstoque = _snapshotEstoque(item.produtoId, item.localizacao);
      const historicoPreco = _historicoPrecos(item.produtoId);
      return DB_Insert.insert('PRE_COMPRA_ITENS', {
        preCompraId: preCompra.ID, produtoId: item.produtoId,
        codigoProduto: produto ? produto.codigo : '', descricaoProduto: produto ? produto.descricaoOriginal : '',
        quantidadeSugerida: item.quantidade || '', unidade: produto ? produto.unidade : '',
        saldoNoMomento: snapshotEstoque.saldoNoMomento, estoqueMinimoNoMomento: snapshotEstoque.estoqueMinimoNoMomento,
        classificacaoNoMomento: snapshotEstoque.classificacaoNoMomento,
        consumoMedioDiarioNoMomento: snapshotEstoque.consumoMedioDiarioNoMomento, diasCoberturaNoMomento: snapshotEstoque.diasCoberturaNoMomento,
        precoReferenciaMin: historicoPreco.precoMin, precoReferenciaMedio: historicoPreco.precoMedio, precoReferenciaMax: historicoPreco.precoMax,
        historicoPrecoSuficiente: historicoPreco.historicoSuficiente, fornecedorSugeridoId: ''
      });
    });

    Event_Bus.emit(EVENT_TYPES.PRE_COMPRA_CRIADA, { preCompraId: preCompra.ID, numero, origem: preCompra.origem }, ctx);
    Audit_Service.record(ctx, 'PRE_COMPRA_CRIADA', { entidade: 'PRE_COMPRAS', entidadeId: preCompra.ID });

    return Core_Response.ok({ preCompra, itens: itensRegistrados }, 'Pré-compra ' + numero + ' criada.', 'SUCCESS', {}, ctx.requestId);
  }

  function _podeVer(preCompra, ctx) {
    const perfisCompras = [CORE_CONSTANTS.PERFIS.COMPRAS, CORE_CONSTANTS.PERFIS.GESTOR, CORE_CONSTANTS.PERFIS.ADMIN];
    return perfisCompras.includes(ctx.perfil) || String(preCompra.solicitanteId) === String(ctx.userId);
  }

  function get(ctx) {
    const preCompra = DB_Query.get('PRE_COMPRAS', ctx.payload.id);
    if (!preCompra) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Pré-compra não encontrada.', {}, ctx.requestId);
    if (!_podeVer(preCompra, ctx)) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.PERMISSION_DENIED, 'Esta pré-compra não é sua.', {}, ctx.requestId);
    const itens = DB_Query.find('PRE_COMPRA_ITENS', i => String(i.preCompraId) === String(preCompra.ID));
    return Core_Response.ok({ preCompra, itens }, '', 'SUCCESS', {}, ctx.requestId);
  }

  function listar(ctx) {
    const p = ctx.payload || {};
    const perfisCompras = [CORE_CONSTANTS.PERFIS.COMPRAS, CORE_CONSTANTS.PERFIS.GESTOR, CORE_CONSTANTS.PERFIS.ADMIN];
    const podeVerTodas = perfisCompras.includes(ctx.perfil);
    const rows = DB_Query.find('PRE_COMPRAS', pc => {
      if (!podeVerTodas && String(pc.solicitanteId) !== String(ctx.userId)) return false;
      if (p.status && pc.status !== p.status) return false;
      return true;
    }).sort((a, b) => new Date(b.dataAbertura) - new Date(a.dataAbertura));
    return Core_Response.ok(rows, '', 'SUCCESS', {}, ctx.requestId);
  }

  function enviarAprovacao(ctx) {
    const preCompra = DB_Query.get('PRE_COMPRAS', ctx.payload.id);
    if (!preCompra) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Pré-compra não encontrada.', {}, ctx.requestId);
    if (!['RASCUNHO', 'ABERTA'].includes(preCompra.status)) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'Só é possível enviar pra aprovação a partir de rascunho/aberta.', {}, ctx.requestId);
    }
    DB_Update.byId('PRE_COMPRAS', preCompra.ID, { status: 'EM_ANALISE', dataAtualizacao: new Date() });
    Event_Bus.emit(EVENT_TYPES.PRE_COMPRA_ENVIADA_APROVACAO, { preCompraId: preCompra.ID, numero: preCompra.numero }, ctx);
    Audit_Service.record(ctx, 'PRE_COMPRA_ENVIADA_APROVACAO', { entidade: 'PRE_COMPRAS', entidadeId: preCompra.ID }, { status: preCompra.status }, { status: 'EM_ANALISE' });
    return Core_Response.ok(DB_Query.get('PRE_COMPRAS', preCompra.ID), 'Enviada para aprovação.', 'SUCCESS', {}, ctx.requestId);
  }

  /**
   * Único ponto que muda status pra APROVADA/REPROVADA/ENCAMINHADA/
   * CONCLUIDA/CANCELADA. Só COMPRAS/GESTOR/ADMIN mudam pra frente
   * (aprovação real); o próprio solicitante só pode CANCELAR
   * enquanto ainda está em RASCUNHO/ABERTA (mesmo padrão já usado
   * em Solicitações).
   */
  function atualizarStatus(ctx) {
    const { id, status, motivo } = ctx.payload || {};
    const preCompra = DB_Query.get('PRE_COMPRAS', id);
    if (!preCompra) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Pré-compra não encontrada.', {}, ctx.requestId);

    const perfisAprovacao = [CORE_CONSTANTS.PERFIS.COMPRAS, CORE_CONSTANTS.PERFIS.GESTOR, CORE_CONSTANTS.PERFIS.ADMIN];
    const ehSolicitante = String(preCompra.solicitanteId) === String(ctx.userId);
    const statusValidos = ['APROVADA', 'REPROVADA', 'ENCAMINHADA', 'CONCLUIDA', 'CANCELADA'];
    if (!statusValidos.includes(status)) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'Status inválido. Use um de: ' + statusValidos.join(', '), {}, ctx.requestId);
    }
    if (status === 'CANCELADA') {
      if (!ehSolicitante && !perfisAprovacao.includes(ctx.perfil)) {
        return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.PERMISSION_DENIED, 'Você só pode cancelar sua própria pré-compra.', {}, ctx.requestId);
      }
      if (!STATUS_ABERTOS.includes(preCompra.status)) {
        return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'Só é possível cancelar enquanto está em aberto/análise.', {}, ctx.requestId);
      }
    } else if (!perfisAprovacao.includes(ctx.perfil)) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.PERMISSION_DENIED, 'Somente Compras/Gestor/Admin decidem o status desta pré-compra.', {}, ctx.requestId);
    }

    const alteracoes = { status, dataAtualizacao: new Date() };
    if (status === 'APROVADA') { alteracoes.aprovadorId = ctx.userId; alteracoes.dataAprovacao = new Date(); }
    if (status === 'REPROVADA') { alteracoes.motivoReprovacao = motivo || ''; }

    DB_Update.byId('PRE_COMPRAS', id, alteracoes);
    Event_Bus.emit(EVENT_TYPES.PRE_COMPRA_ATUALIZADA, { preCompraId: id, numero: preCompra.numero, status }, ctx);
    Audit_Service.record(ctx, 'PRE_COMPRA_ATUALIZADA', { entidade: 'PRE_COMPRAS', entidadeId: id }, { status: preCompra.status }, { status });

    return Core_Response.ok(DB_Query.get('PRE_COMPRAS', id), 'Status atualizado para ' + status + '.', 'SUCCESS', {}, ctx.requestId);
  }

  /**
   * Relatório discriminado (seção 5/9 do contrato). Reaproveita a
   * mesma pré-compra já persistida — reproduz EXATAMENTE os itens
   * registrados, nunca recalcula silenciosamente um número
   * diferente do que foi salvo na criação.
   */
  function gerarRelatorio(ctx) {
    const resultado = get(ctx);
    if (!resultado.success) return resultado;
    const { preCompra, itens } = resultado.data;
    return Core_Response.ok({
      numero: preCompra.numero, status: preCompra.status, dataAbertura: preCompra.dataAbertura,
      justificativa: preCompra.justificativa,
      itens: itens.map(i => ({
        codigo: i.codigoProduto, descricao: i.descricaoProduto, quantidade: i.quantidadeSugerida, unidade: i.unidade,
        situacaoEstoque: i.classificacaoNoMomento, precoReferencia: i.historicoPrecoSuficiente
          ? { min: i.precoReferenciaMin, medio: i.precoReferenciaMedio, max: i.precoReferenciaMax }
          : 'sem histórico suficiente'
      })),
      totalItens: itens.length
    }, '', 'SUCCESS', {}, ctx.requestId);
  }

  /**
   * Reage ao gatilho do Módulo 02 (ESTOQUE_AMARELO_IDENTIFICADO)
   * criando uma pré-compra RASCUNHO — nunca uma compra executada
   * (regra explícita do contrato: "não transformar o alerta
   * amarelo em pedido automático irreversível"). Com deduplicação:
   * não cria rascunho novo se já existe um aberto pro mesmo
   * produto/localização, pra não empilhar sugestão repetida a
   * cada rodada do gatilho (que roda 1x por dia).
   */
  function _criarRascunhoPorGatilhoAmarelo(payload, ctxOrigem) {
    const jaExiste = DB_Query.exists('PRE_COMPRA_ITENS', item => {
      if (String(item.produtoId) !== String(payload.produtoId)) return false;
      const pai = DB_Query.get('PRE_COMPRAS', item.preCompraId);
      return pai && STATUS_ABERTOS.includes(pai.status) && pai.origem === 'GATILHO_AMARELO';
    });
    if (jaExiste) return; // já tem sugestão em aberto pra esse item — não duplica

    const ctxSistema = Core_Context.build({ action: 'sistema.gatilho', userId: 'sistema' });
    criar(Object.assign({}, ctxSistema, {
      payload: {
        origem: 'GATILHO_AMARELO',
        justificativa: 'Gerada automaticamente: estoque em nível de alerta (disponível ' + payload.disponivel + ', mínimo ' + payload.estoqueMinimo + ').',
        itens: [{ produtoId: payload.produtoId, localizacao: payload.localizacao, quantidade: '' }]
      }
    }));
  }

  /**
   * BLOCO 04 (Inventário) — repasse fino de `_historicoPrecos`,
   * exposto pra reaproveitamento por outros módulos (Inventário
   * precisa de "valor unitário" real pra calcular divergência
   * financeira — nunca duplicar essa consulta, só reaproveitar).
   */
  function obterPrecoReferencia(produtoId) {
    return _historicoPrecos(produtoId);
  }

  function getRoutes() {
    return {
      'precompra.criar': criar,
      'precompra.get': get,
      'precompra.listar': listar,
      'precompra.calcularResumo': calcularResumo,
      'precompra.sugerirFornecedores': sugerirFornecedores,
      'precompra.gerarRelatorio': gerarRelatorio,
      'precompra.enviarAprovacao': enviarAprovacao,
      'precompra.atualizarStatus': atualizarStatus
    };
  }
  function getServices() { return { Service_PreCompra }; }
  function getEvents() { return [EVENT_TYPES.PRE_COMPRA_CRIADA, EVENT_TYPES.PRE_COMPRA_ENVIADA_APROVACAO, EVENT_TYPES.PRE_COMPRA_ATUALIZADA]; }
  function getVersion() { return '1.0.0'; }
  function init() {
    Auth_RBAC.registerActionPermission('precompra.criar', 'PRECOMPRA.CREATE');
    Auth_RBAC.registerActionPermission('precompra.get', 'PRECOMPRA.VIEW');
    Auth_RBAC.registerActionPermission('precompra.listar', 'PRECOMPRA.VIEW');
    Auth_RBAC.registerActionPermission('precompra.calcularResumo', 'PRECOMPRA.VIEW');
    Auth_RBAC.registerActionPermission('precompra.sugerirFornecedores', 'PRECOMPRA.VIEW');
    Auth_RBAC.registerActionPermission('precompra.gerarRelatorio', 'PRECOMPRA.VIEW');
    Auth_RBAC.registerActionPermission('precompra.enviarAprovacao', 'PRECOMPRA.CREATE');
    // atualizarStatus fica sem permissão de papel única de propósito:
    // a função distingue por dentro CANCELAR (dono ou aprovação) de
    // APROVAR/REPROVAR/ENCAMINHAR/CONCLUIR (só Compras/Gestor/Admin).
    Auth_RBAC.registerActionPermission('precompra.atualizarStatus', 'PRECOMPRA.VIEW');

    Event_Bus.on(EVENT_TYPES.ESTOQUE_AMARELO_IDENTIFICADO, function (payload, ctxOrigem) {
      _criarRascunhoPorGatilhoAmarelo(payload, ctxOrigem);
    });
  }
  function healthCheck() { return { status: CORE_CONSTANTS.DOCTOR_STATUS.OK }; }

  return {
    criar, get, listar, calcularResumo, sugerirFornecedores, gerarRelatorio, enviarAprovacao, atualizarStatus, obterPrecoReferencia,
    getRoutes, getServices, getEvents, getVersion, init, healthCheck, id: 'PRECOMPRA'
  };
})();
