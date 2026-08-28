/**
 * ============================================================
 * ALMOXA PRO — Service_SAP.gs
 * FASE 10 — IMPLEMENTADO DE VERDADE.
 *
 * NÃO conecta em API do SAP (a spec proíbe inventar isso, seção
 * 32/37). A integração é por IMPORTAÇÃO de arquivo exportado do
 * SAP (ME80FN, ME5K, ME23N, ME2N, ME5A, MB51, M24).
 *
 * O mapeamento de colunas é HEURÍSTICO: como cada empresa
 * configura a exportação do SAP de um jeito, este mapeador
 * procura por nomes de coluna parecidos (normalizados, sem
 * acento) em vez de exigir um layout fixo rígido. Colunas não
 * reconhecidas ficam de fora — não inventa valor.
 * ============================================================
 */

const Service_SAP = (function () {

  // Alias conhecidos por campo de destino (normalizados: sem
  // acento, maiúsculo). Adicione mais aliases aqui se o layout
  // real da sua empresa usar nomes diferentes.
  const ALIASES = {
    numeroPedido:   ['PEDIDO', 'NUMERO PEDIDO', 'PURCHASE ORDER', 'EBELN'],
    item:           ['ITEM', 'EBELP'],
    produtoCodigo:  ['MATERIAL', 'CODIGO', 'COD MATERIAL', 'MATNR'],
    quantidade:     ['QUANTIDADE', 'QTD', 'MENGE'],
    valorUnitario:  ['VALOR UNITARIO', 'PRECO', 'PRECO UNITARIO', 'NETPR'],
    dataEntrega:    ['DATA ENTREGA', 'DATA PREVISTA', 'EINDT'],
    centroCusto:    ['CENTRO CUSTO', 'CENTRO DE CUSTO', 'KOSTL'],
    pep:            ['PEP', 'PS_PSP_PNR', 'ELEMENTO PEP'],
    fornecedorCNPJ: ['CNPJ', 'FORNECEDOR', 'LIFNR']
  };

  function _detectarMapeamento(headers) {
    const normalizados = headers.map(h => Utils_String.normalize(h));
    const mapeamento = {};
    Object.keys(ALIASES).forEach(campo => {
      const idx = normalizados.findIndex(h => ALIASES[campo].some(alias => h === Utils_String.normalize(alias)));
      if (idx > -1) mapeamento[campo] = idx;
    });
    return mapeamento;
  }

  function _pastaSAP() {
    const folderId = Core_Config.get('SAP_IMPORT_FOLDER_ID');
    if (!folderId) {
      throw Object.assign(new Error('SAP_IMPORT_FOLDER_ID não configurado.'), { code: CORE_CONSTANTS.RESPONSE_CODES.EXTERNAL_INTEGRATION_NOT_CONFIGURED });
    }
    return folderId;
  }

  function importFn(ctx) {
    const { driveFileId, tipoRelatorio } = ctx.payload || {};
    if (!driveFileId || !tipoRelatorio) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'driveFileId e tipoRelatorio são obrigatórios.', {}, ctx.requestId);
    }

    let parsed;
    try {
      parsed = Integration_SAP.parseArquivo(driveFileId);
    } catch (e) {
      return Core_Response.error(e.code || CORE_CONSTANTS.RESPONSE_CODES.INTERNAL_ERROR, e.message, {}, ctx.requestId);
    }
    if (!parsed.rows.length) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'Arquivo sem linhas de dados.', {}, ctx.requestId);
    }

    const mapeamento = _detectarMapeamento(parsed.headers);
    const camposEssenciais = ['numeroPedido', 'produtoCodigo', 'quantidade'];
    const faltando = camposEssenciais.filter(c => mapeamento[c] === undefined);
    if (faltando.length) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR,
        'Não identifiquei as colunas: ' + faltando.join(', ') + '. Cabeçalhos encontrados no arquivo: ' + parsed.headers.join(', '), {}, ctx.requestId);
    }

    const importados = parsed.rows.map(row => {
      const dados = {};
      Object.keys(mapeamento).forEach(campo => dados[campo] = row[mapeamento[campo]]);
      const produto = dados.produtoCodigo ? DB_Query.findOne('PRODUTOS', p => p.codigo === String(dados.produtoCodigo)) : null;

      return DB_Insert.insert('SISTEMA_SAP', {
        tipoRelatorio, arquivoId: driveFileId,
        numeroPedido: dados.numeroPedido || '', item: dados.item || '',
        produtoCodigo: dados.produtoCodigo || '', produtoId: produto ? produto.ID : '',
        quantidade: dados.quantidade || 0, valorUnitario: dados.valorUnitario || 0,
        dataEntrega: dados.dataEntrega || '', centroCusto: dados.centroCusto || '',
        pep: dados.pep || '', fornecedorCNPJ: dados.fornecedorCNPJ || '',
        status: produto ? 'IMPORTADO' : 'PENDENTE_PRODUTO', importadoEm: new Date()
      });
    });

    Audit_Service.record(ctx, 'SAP_IMPORTADO', { entidade: 'SISTEMA_SAP', entidadeId: driveFileId }, null, { totalLinhas: importados.length, tipoRelatorio });

    return Core_Response.ok({
      totalImportado: importados.length,
      colunasReconhecidas: Object.keys(mapeamento),
      colunasIgnoradas: parsed.headers.filter((h, i) => !Object.values(mapeamento).includes(i)),
      pendentesDeProduto: importados.filter(i => i.status === 'PENDENTE_PRODUTO').length,
      registros: importados
    }, importados.length + ' linha(s) importada(s).', 'SUCCESS', {}, ctx.requestId);
  }

  function validateFn(ctx) {
    const { tipoRelatorio } = ctx.payload || {};
    const registros = DB_Query.find('SISTEMA_SAP', r => !tipoRelatorio || r.tipoRelatorio === tipoRelatorio);

    const pendentes = registros.filter(r => r.status === 'PENDENTE_PRODUTO');
    pendentes.forEach(r => {
      const produto = DB_Query.findOne('PRODUTOS', p => p.codigo === r.produtoCodigo);
      if (produto) DB_Update.byId('SISTEMA_SAP', r.ID, { produtoId: produto.ID, status: 'IMPORTADO' });
    });

    const resumo = {
      total: registros.length,
      ok: registros.filter(r => r.produtoId).length,
      pendentesDeProduto: registros.length - registros.filter(r => r.produtoId).length
    };
    return Core_Response.ok(resumo, 'Validação concluída.', 'SUCCESS', {}, ctx.requestId);
  }

  function exportFn(ctx) {
    const { tipoRelatorio } = ctx.payload || {};
    const registros = DB_Query.find('SISTEMA_SAP', r => !tipoRelatorio || r.tipoRelatorio === tipoRelatorio);
    if (!registros.length) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Nenhum registro pra exportar.', {}, ctx.requestId);
    }
    try {
      const pasta = Utils_File.getOrCreateFolder(_pastaSAP(), 'Exportacoes');
      const nome = 'sap_export_' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss') + '.csv';
      const blob = Utilities.newBlob(Utils_Export.toCSV(registros), 'text/csv', nome);
      const arquivo = Integration_GoogleDrive.uploadFile(pasta.getId(), blob);
      Audit_Service.record(ctx, 'SAP_EXPORTADO', { entidade: 'SISTEMA_SAP' }, null, { total: registros.length });
      return Core_Response.ok(arquivo, 'Exportado.', 'SUCCESS', {}, ctx.requestId);
    } catch (e) {
      return Core_Response.error(e.code || CORE_CONSTANTS.RESPONSE_CODES.INTERNAL_ERROR, e.message, {}, ctx.requestId);
    }
  }

  return { import: importFn, validate: validateFn, export: exportFn };
})();
