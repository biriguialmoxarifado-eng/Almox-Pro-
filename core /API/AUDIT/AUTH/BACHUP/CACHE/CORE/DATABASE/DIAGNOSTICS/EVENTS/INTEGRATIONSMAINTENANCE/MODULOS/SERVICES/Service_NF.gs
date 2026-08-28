/**
 * ============================================================
 * ALMOXA PRO — Service_NF.gs
 * FASE 2 — IMPLEMENTADO: entrada MANUAL de nota fiscal
 * (create/get/search/validate/approve/reject).
 *
 * AINDA PENDENTE (fica honesto — não finge funcionar):
 *   importXML, processOCR, consultKey, extract, confer
 *   → confer() é da Fase 9 (Conferência); as outras exigem
 *     integração real (XML parser / Cloud Vision) que ainda
 *     não foi configurada nesta etapa reduzida da Fase 2.
 *
 * Fluxo implementado (seção 14, até "ENTRADA" —
 * a baixa em ESTOQUE em si é Fase 10, ainda não existe):
 * NOTA → CAPTURA(manual) → NORMALIZAÇÃO → FORNECEDOR → PRODUTOS
 * → ITENS → status RECEBIDA → APROVAÇÃO → status APROVADA
 * ============================================================
 */

const Service_NF = (function () {

  function create(ctx) {
    const payload = ctx.payload || {};
    const { fornecedor, nota, itens } = payload;

    try {
      DB_Validation.requireFields(nota || {}, ['numero', 'dataEmissao', 'valorTotal']);
      if (!Array.isArray(itens) || itens.length === 0) {
        throw Object.assign(new Error('A nota precisa de ao menos um item.'), { code: CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR });
      }
    } catch (e) {
      return Core_Response.error(e.code || CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, e.message, {}, ctx.requestId);
    }

    // ---- FORNECEDOR (seção 18) ----
    let fornecedorResult;
    try {
      fornecedorResult = Service_Fornecedor.findOrCreateByCNPJ(fornecedor || {});
    } catch (e) {
      return Core_Response.error(e.code || CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, e.message, {}, ctx.requestId);
    }

    // ---- NOTA ----
    const notaRegistrada = DB_Insert.insert('NOTAS_FISCAIS', {
      chaveNFe: nota.chaveNFe || '',
      numero: nota.numero,
      serie: nota.serie || '',
      modelo: nota.modelo || '',
      dataEmissao: nota.dataEmissao,
      dataEntrada: new Date(),
      emitenteCNPJ: fornecedorResult.fornecedor.cnpj,
      emitenteNome: fornecedorResult.fornecedor.razaoSocial,
      destinatarioCNPJ: nota.destinatarioCNPJ || '',
      valorProdutos: nota.valorProdutos || nota.valorTotal,
      valorFrete: nota.valorFrete || 0,
      valorSeguro: nota.valorSeguro || 0,
      valorDesconto: nota.valorDesconto || 0,
      valorIPI: nota.valorIPI || 0,
      valorICMS: nota.valorICMS || 0,
      valorICMSST: nota.valorICMSST || 0,
      valorPIS: nota.valorPIS || 0,
      valorCOFINS: nota.valorCOFINS || 0,
      valorTotal: nota.valorTotal,
      naturezaOperacao: nota.naturezaOperacao || '',
      CFOP: nota.CFOP || '',
      observacoes: nota.observacoes || '',
      xmlFileId: '',
      pdfFileId: '',
      ocrSource: 'MANUAL',
      status: 'RECEBIDA'
    });

    // ---- ITENS (seção 16/17) ----
    const itensProcessados = itens.map((item, idx) => {
      const classificacao = Service_Produto.findOrSuggest(item);
      let produtoId = '', statusItem = '';

      if (classificacao.situacao === 'ENCONTRADO') {
        produtoId = classificacao.produto.ID;
        statusItem = 'PRODUTO_VINCULADO';
      } else if (classificacao.situacao === 'SEMELHANTE') {
        statusItem = 'AGUARDANDO_CONFIRMACAO';
      } else {
        statusItem = 'PENDENTE_CADASTRO_PRODUTO';
      }

      const itemRegistrado = DB_Insert.insert('NOTAS_ITENS', {
        notaId: notaRegistrada.ID,
        itemId: idx + 1,
        codigoProduto: item.codigo || '',
        codigoBarras: item.codigoBarras || '',
        descricaoOriginal: item.descricao || '',
        descricaoNormalizada: Utils_String.normalize(item.descricao || ''),
        produtoId: produtoId,
        NCM: item.NCM || '',
        CFOP: item.CFOP || '',
        unidade: item.unidade || 'UN',
        quantidade: item.quantidade,
        valorUnitario: item.valorUnitario,
        valorTotal: Utils_Currency.round2((Number(item.quantidade) || 0) * (Number(item.valorUnitario) || 0)),
        desconto: item.desconto || 0,
        lote: item.lote || '',
        validade: item.validade || '',
        observacoes: statusItem
      });

      return Object.assign({}, itemRegistrado, {
        classificacaoProduto: classificacao
      });
    });

    Event_Bus.emit(EVENT_TYPES.NF_RECEBIDA, { notaId: notaRegistrada.ID, fornecedorId: fornecedorResult.fornecedor.ID }, ctx);
    Audit_Service.record(ctx, 'NF_CRIADA', { entidade: 'NOTAS_FISCAIS', entidadeId: notaRegistrada.ID });

    const pendencias = itensProcessados.filter(i => i.classificacaoProduto.situacao !== 'ENCONTRADO').length;

    return Core_Response.ok({
      nota: notaRegistrada,
      fornecedor: fornecedorResult.fornecedor,
      fornecedorCriadoAgora: fornecedorResult.criado,
      itens: itensProcessados,
      pendenciasDeProduto: pendencias
    }, pendencias > 0
      ? pendencias + ' item(ns) precisam de atenção antes da conferência (produto não encontrado ou só parecido).'
      : 'Nota registrada — todos os itens já vinculados a produtos existentes.',
      'SUCCESS', {}, ctx.requestId);
  }

  function get(ctx) {
    const nota = DB_Query.get('NOTAS_FISCAIS', ctx.payload.id);
    if (!nota) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Nota não encontrada.', {}, ctx.requestId);
    const itens = DB_Query.find('NOTAS_ITENS', i => String(i.notaId) === String(nota.ID));
    return Core_Response.ok({ nota, itens }, '', 'SUCCESS', {}, ctx.requestId);
  }

  function search(ctx) {
    const f = ctx.payload || {};
    const rows = DB_Query.find('NOTAS_FISCAIS', r => {
      if (f.status && r.status !== f.status) return false;
      if (f.emitenteCNPJ && r.emitenteCNPJ !== f.emitenteCNPJ) return false;
      if (f.numero && String(r.numero) !== String(f.numero)) return false;
      return true;
    });
    return Core_Response.ok(rows, '', 'SUCCESS', {}, ctx.requestId);
  }

  function validate(ctx) {
    const nota = DB_Query.get('NOTAS_FISCAIS', ctx.payload.id);
    if (!nota) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Nota não encontrada.', {}, ctx.requestId);
    const itens = DB_Query.find('NOTAS_ITENS', i => String(i.notaId) === String(nota.ID));
    const semProduto = itens.filter(i => !i.produtoId);
    return Core_Response.ok({
      pronta_para_aprovacao: semProduto.length === 0,
      totalItens: itens.length,
      itensSemProdutoVinculado: semProduto.length
    }, '', 'SUCCESS', {}, ctx.requestId);
  }

  function approve(ctx) {
    const nota = DB_Query.get('NOTAS_FISCAIS', ctx.payload.id);
    if (!nota) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Nota não encontrada.', {}, ctx.requestId);
    if (nota.status === 'APROVADA') {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'Nota já está aprovada.', {}, ctx.requestId);
    }
    DB_Update.byId('NOTAS_FISCAIS', nota.ID, { status: 'APROVADA' });
    Event_Bus.emit(EVENT_TYPES.NF_APROVADA, { notaId: nota.ID, aprovadoPor: ctx.userId }, ctx);
    Audit_Service.record(ctx, 'NF_APROVADA', { entidade: 'NOTAS_FISCAIS', entidadeId: nota.ID }, { status: nota.status }, { status: 'APROVADA' });

    // ---- FASE 4: fecha o fluxo principal (seção 65) — ENTRADA→ESTOQUE ----
    const entradasGeradas = _processarEntradaEstoque(nota, ctx);

    return Core_Response.ok(
      Object.assign({}, DB_Query.get('NOTAS_FISCAIS', nota.ID), { entradasEstoque: entradasGeradas }),
      'Nota aprovada. ' + entradasGeradas.length + ' item(ns) deram entrada no estoque.',
      'SUCCESS', {}, ctx.requestId
    );
  }

  /**
   * Gera a entrada real em ESTOQUE para os itens desta nota.
   * Se a conferência já rodou (Fase 3), usa a quantidade
   * efetivamente RECEBIDA (evita dar entrada de algo que faltou).
   * Se não houve conferência, usa a quantidade nominal da NF —
   * fluxo simplificado, ainda válido (nem toda empresa concilia
   * bipagem, e a spec não obriga conferência antes de aprovar).
   * A localização usa ctx.payload.localizacao, com fallback para
   * 'RECEBIMENTO' (área de triagem padrão).
   */
  function _processarEntradaEstoque(nota, ctx) {
    const localizacao = (ctx.payload && ctx.payload.localizacao) || 'RECEBIMENTO';
    const itensNota = DB_Query.find('NOTAS_ITENS', i => String(i.notaId) === String(nota.ID));
    const conferencias = DB_Query.find('CONFERENCIAS', c => String(c.notaId) === String(nota.ID));
    const confPorItem = {};
    conferencias.forEach(c => confPorItem[c.itemId] = c);

    const entradas = [];
    itensNota.forEach(item => {
      if (!item.produtoId) return; // pendência de cadastro — não entra em estoque sem produto vinculado

      const conf = confPorItem[item.itemId];
      const quantidadeEntrada = conf ? Number(conf.recebido || 0) : Number(item.quantidade || 0);
      if (quantidadeEntrada <= 0) return;

      const saldoAtualizado = Service_Estoque._registrarEntradaInterna(
        item.produtoId, localizacao, quantidadeEntrada,
        { documentoId: nota.ID, obraId: ctx.payload.obraId || '' }, ctx
      );
      entradas.push(saldoAtualizado);
    });
    return entradas;
  }

  function reject(ctx) {
    const nota = DB_Query.get('NOTAS_FISCAIS', ctx.payload.id);
    if (!nota) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Nota não encontrada.', {}, ctx.requestId);
    const motivo = ctx.payload.motivo || '';
    DB_Update.byId('NOTAS_FISCAIS', nota.ID, { status: 'REJEITADA', observacoes: motivo });
    Audit_Service.record(ctx, 'NF_REJEITADA', { entidade: 'NOTAS_FISCAIS', entidadeId: nota.ID }, { status: nota.status }, { status: 'REJEITADA', motivo });
    return Core_Response.ok(DB_Query.get('NOTAS_FISCAIS', nota.ID), 'Nota rejeitada.', 'SUCCESS', {}, ctx.requestId);
  }

  // ---- Ainda pendentes nesta etapa reduzida da Fase 2 ----
  function _pending(fn, fase) {
    return Core_Response.error(
      CORE_CONSTANTS.RESPONSE_CODES.MODULE_NOT_IMPLEMENTED,
      'Service_NF.' + fn + '() depende de integração ainda não configurada nesta etapa (' + fase + ').'
    );
  }
  function importXML(ctx) { return _pending('importXML', 'parser de XML de NF-e'); }
  function processOCR(ctx) { return _pending('processOCR', 'Integration_OCR — configure OCR_API_KEY'); }
  function consultKey(ctx) { return _pending('consultKey', 'consulta de chave NF-e via SEFAZ'); }
  function extract(ctx) { return _pending('extract', 'Integration_OCR'); }
  function confer(ctx) { return _pending('confer', 'Fase 9 — Conferência'); }

  return { create, get, search, validate, approve, reject, importXML, processOCR, consultKey, extract, confer };
})();
