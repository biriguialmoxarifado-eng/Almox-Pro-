/**
 * ============================================================
 * ALMOXA PRO — Service_Relatorio.gs
 * FASE 9 — IMPLEMENTADO DE VERDADE.
 *
 * generate(): monta o dataset real (sempre disponível em JSON,
 * usado tanto pra tela quanto como base da exportação).
 * export(): pega o mesmo dataset e gera o arquivo no formato
 * pedido, salvo no Drive.
 *
 * Relatórios cobertos (seção 34) — os que já têm dado real
 * disponível nas fases já implementadas:
 * ESTOQUE, ESTOQUE_CRITICO, CURVA_ABC, MOVIMENTACOES, ENTRADAS,
 * SAIDAS, INVENTARIOS, DIVERGENCIAS, RESERVAS, OBRAS,
 * FORNECEDORES, NOTAS_FISCAIS, AUDITORIA.
 *
 * Os que dependem de módulos ainda não implementados (Compras,
 * Custo de Obra, R6, PEP como entidade) ficam de fora — não
 * finjo relatório com dado que não existe.
 * ============================================================
 */

const Service_Relatorio = (function () {

  function _dataNoIntervalo(dataStr, dataInicio, dataFim) {
    if (!dataStr) return !dataInicio && !dataFim;
    const d = new Date(dataStr);
    if (dataInicio && d < new Date(dataInicio)) return false;
    if (dataFim && d > new Date(dataFim)) return false;
    return true;
  }

  const BUILDERS = {

    ESTOQUE: (f) => DB_Query.find('ESTOQUE', r => {
      if (f.produtoId && String(r.produtoId) !== String(f.produtoId)) return false;
      if (f.localizacao && r.localizacao !== f.localizacao) return false;
      return true;
    }).map(r => {
      const produto = DB_Query.get('PRODUTOS', r.produtoId);
      return Object.assign({}, r, { produtoDescricao: produto ? produto.descricaoOriginal : '' });
    }),

    ESTOQUE_CRITICO: () => DB_Query.find('ESTOQUE', r => Number(r.estoqueMinimo) > 0 && Number(r.saldo) <= Number(r.estoqueMinimo))
      .map(r => {
        const produto = DB_Query.get('PRODUTOS', r.produtoId);
        return Object.assign({}, r, { produtoDescricao: produto ? produto.descricaoOriginal : '' });
      }),

    MOVIMENTACOES: (f) => DB_Query.find('MOVIMENTOS', m => {
      if (f.produtoId && String(m.produtoId) !== String(f.produtoId)) return false;
      if (f.obraId && m.obraId !== f.obraId) return false;
      if (f.tipo && m.tipo !== f.tipo) return false;
      return _dataNoIntervalo(m.data, f.dataInicio, f.dataFim);
    }),

    ENTRADAS: (f) => BUILDERS.MOVIMENTACOES(Object.assign({}, f, { tipo: 'ENTRADA' })),
    SAIDAS: (f) => BUILDERS.MOVIMENTACOES(Object.assign({}, f, { tipo: 'SAIDA' })),

    INVENTARIOS: (f) => DB_Query.find('INVENTARIOS', inv => {
      if (f.obraId && inv.obraId !== f.obraId) return false;
      if (f.status && inv.estado !== f.status) return false;
      return _dataNoIntervalo(inv.dataAbertura, f.dataInicio, f.dataFim);
    }),

    DIVERGENCIAS: (f) => DB_Query.find('DIVERGENCIAS', d => {
      if (f.status && d.status !== f.status) return false;
      return _dataNoIntervalo(d.data, f.dataInicio, f.dataFim);
    }),

    RESERVAS: (f) => DB_Query.find('RESERVAS', r => {
      if (f.obraId && r.obraId !== f.obraId) return false;
      if (f.status && r.status !== f.status) return false;
      if (f.produtoId && String(r.produtoId) !== String(f.produtoId)) return false;
      return _dataNoIntervalo(r.data, f.dataInicio, f.dataFim);
    }),

    OBRAS: (f) => DB_Query.find('OBRAS', o => !f.status || o.status === f.status),

    FORNECEDORES: (f) => DB_Query.find('FORNECEDORES', fo => !f.status || fo.status === f.status),

    NOTAS_FISCAIS: (f) => DB_Query.find('NOTAS_FISCAIS', n => {
      if (f.status && n.status !== f.status) return false;
      if (f.fornecedorCNPJ && n.emitenteCNPJ !== f.fornecedorCNPJ) return false;
      return _dataNoIntervalo(n.dataEmissao, f.dataInicio, f.dataFim);
    }),

    AUDITORIA: (f) => DB_Query.find('AUDITORIA', a => {
      if (f.usuario && a.usuario !== f.usuario) return false;
      if (f.modulo && a.modulo !== f.modulo) return false;
      return _dataNoIntervalo(a.data, f.dataInicio, f.dataFim);
    }),

    // Curva ABC por MOVIMENTAÇÃO (proxy de valor, já que PRODUTOS
    // não guarda custo unitário fixo nesta fase — seção 48 permite
    // basear em "valor/movimentação conforme configuração").
    CURVA_ABC: (f) => {
      const saidas = DB_Query.find('MOVIMENTOS', m => m.tipo === 'SAIDA' && _dataNoIntervalo(m.data, f.dataInicio, f.dataFim));
      const porProduto = Utils_Array.groupBy(saidas, m => m.produtoId);
      const totais = Object.keys(porProduto).map(produtoId => {
        const produto = DB_Query.get('PRODUTOS', produtoId);
        return {
          produtoId,
          produtoDescricao: produto ? produto.descricaoOriginal : '',
          quantidadeMovimentada: Utils_Array.sum(porProduto[produtoId], m => m.quantidade)
        };
      }).sort((a, b) => b.quantidadeMovimentada - a.quantidadeMovimentada);

      const totalGeral = Utils_Array.sum(totais, t => t.quantidadeMovimentada) || 1;
      let acumulado = 0;
      return totais.map(t => {
        acumulado += t.quantidadeMovimentada;
        const percentualAcumulado = (acumulado / totalGeral) * 100;
        const classe = percentualAcumulado <= 80 ? 'A' : (percentualAcumulado <= 95 ? 'B' : 'C');
        return Object.assign({}, t, {
          percentual: Utils_Currency.round2((t.quantidadeMovimentada / totalGeral) * 100),
          percentualAcumulado: Utils_Currency.round2(percentualAcumulado),
          classe
        });
      });
    }
  };

  function generate(ctx) {
    const { tipo, filtros } = ctx.payload || {};
    if (!tipo || !BUILDERS[tipo]) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR,
        'tipo inválido. Opções: ' + Object.keys(BUILDERS).join(', '), {}, ctx.requestId);
    }
    const dados = BUILDERS[tipo](filtros || {});
    Audit_Service.record(ctx, 'RELATORIO_GERADO', { entidade: 'RELATORIOS', entidadeId: tipo }, null, { totalRegistros: dados.length });

    return Core_Response.ok({
      tipo, filtros: filtros || {}, geradoEm: new Date().toISOString(),
      totalRegistros: dados.length, dados
    }, '', 'SUCCESS', {}, ctx.requestId);
  }

  // ---- Exportação real pro Drive ----

  function _toCSV(dados) {
    if (!dados.length) return '';
    const headers = Object.keys(dados[0]).filter(h => !h.startsWith('_'));
    const linhas = [headers.join(',')];
    dados.forEach(row => {
      linhas.push(headers.map(h => {
        const val = row[h] === undefined || row[h] === null ? '' : String(row[h]).replace(/"/g, '""');
        return val.includes(',') ? '"' + val + '"' : val;
      }).join(','));
    });
    return linhas.join('\n');
  }

  function _toHtmlTable(dados, titulo) {
    if (!dados.length) return '<h2>' + titulo + '</h2><p>Nenhum registro encontrado.</p>';
    const headers = Object.keys(dados[0]).filter(h => !h.startsWith('_'));
    let html = '<h2>' + titulo + '</h2><table border="1" cellspacing="0" cellpadding="4" style="border-collapse:collapse;font-family:Arial;font-size:12px;">';
    html += '<tr>' + headers.map(h => '<th>' + h + '</th>').join('') + '</tr>';
    dados.forEach(row => {
      html += '<tr>' + headers.map(h => '<td>' + (row[h] === undefined || row[h] === null ? '' : row[h]) + '</td>').join('') + '</tr>';
    });
    html += '</table>';
    return html;
  }

  function _pastaRelatorios() {
    const folderId = Core_Config.get('DRIVE_FOLDER_DOCS') || Core_Config.get('DRIVE_FOLDER_ID');
    if (!folderId) {
      throw Object.assign(new Error('Nenhuma pasta do Drive configurada (DRIVE_FOLDER_DOCS/DRIVE_FOLDER_ID) para salvar relatórios.'),
        { code: CORE_CONSTANTS.RESPONSE_CODES.EXTERNAL_INTEGRATION_NOT_CONFIGURED });
    }
    return Utils_File.getOrCreateFolder(folderId, 'Relatorios');
  }

  function exportar(ctx) {
    const { tipo, filtros, formato } = ctx.payload || {};
    const geracao = generate(ctx);
    if (!geracao.success) return geracao;

    const dados = geracao.data.dados;
    const nomeBase = 'relatorio_' + tipo.toLowerCase() + '_' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');

    try {
      const pasta = _pastaRelatorios();
      let arquivo;

      switch ((formato || 'JSON').toUpperCase()) {
        case 'CSV': {
          const blob = Utilities.newBlob(_toCSV(dados), 'text/csv', nomeBase + '.csv');
          arquivo = Integration_GoogleDrive.uploadFile(pasta.getId(), blob);
          break;
        }
        case 'PDF': {
          const html = _toHtmlTable(dados, 'Relatório: ' + tipo);
          const blob = Integration_PDF.fromHtml(html, nomeBase);
          arquivo = Integration_GoogleDrive.uploadFile(pasta.getId(), blob);
          break;
        }
        case 'EXCEL': {
          // Apps Script não escreve .xlsx binário nativo sem lib
          // externa — o caminho real aqui é gerar uma Google Sheet
          // de verdade (o usuário baixa como .xlsx pelo próprio
          // Drive/Sheets quando quiser: Arquivo → Fazer download →
          // Microsoft Excel). Não finjo gerar um binário xlsx puro.
          const resultado = Integration_GoogleSheets.exportRangeToNewSheet(tipo, () => true, nomeBase);
          // Sheets criada solta na raiz do Drive por padrão da API;
          // move pra pasta de relatórios pra ficar organizado.
          DriveApp.getFileById(resultado.spreadsheetId).moveTo(pasta);
          arquivo = { fileId: resultado.spreadsheetId, url: resultado.url };
          break;
        }
        case 'JSON':
        default: {
          const blob = Utilities.newBlob(Utils_JSON.safeStringify(geracao.data), 'application/json', nomeBase + '.json');
          arquivo = Integration_GoogleDrive.uploadFile(pasta.getId(), blob);
          break;
        }
      }

      DB_Insert.insert('DOCUMENTOS', {
        tipo: 'RELATORIO', referenciaModulo: 'RELATORIOS', referenciaId: tipo,
        driveFileId: arquivo.fileId, nomeArquivo: nomeBase, data: new Date()
      });
      Audit_Service.record(ctx, 'RELATORIO_EXPORTADO', { entidade: 'RELATORIOS', entidadeId: tipo }, null, { formato, arquivo: arquivo.fileId });

      return Core_Response.ok(Object.assign({ formato: (formato || 'JSON').toUpperCase() }, arquivo),
        'Relatório exportado.', 'SUCCESS', {}, ctx.requestId);

    } catch (e) {
      return Core_Response.error(e.code || CORE_CONSTANTS.RESPONSE_CODES.INTERNAL_ERROR, e.message, {}, ctx.requestId);
    }
  }

  return { generate, export: exportar };
})();
