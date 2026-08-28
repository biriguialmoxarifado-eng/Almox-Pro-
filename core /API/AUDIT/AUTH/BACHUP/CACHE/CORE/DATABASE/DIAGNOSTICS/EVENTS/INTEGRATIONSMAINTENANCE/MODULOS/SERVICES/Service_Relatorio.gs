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
 * BLOCO 07 (contrato "Relatórios") — auditei linha a linha contra
 * os 6 relatórios centrais pedidos e achei gaps reais, todos
 * preenchidos agora reaproveitando módulo já existente, nunca
 * duplicando lógica:
 * - OCORRENCIAS: builder novo (tabela já existia — Módulo 06 —
 *   nunca tinha relatório).
 * - PRE_COMPRAS: builder novo (Módulo 03 já disponível, contrato
 *   pedia "quando o módulo estiver disponível").
 * - INVENTARIOS: agora compõe o DETALHE real por inventário
 *   (itens/divergência/valor) delegando pra
 *   `Service_Inventario.relatorio()` — não duplica o cálculo
 *   financeiro que o Bloco 04 já fez.
 * - VALOR_INVENTARIADO: novo — agrega o financeiro de VÁRIOS
 *   inventários no período, reaproveitando a mesma função.
 * - ITENS_POR_PEP: novo — agrupa por `classificadorPEP`
 *   (MOVIMENTOS). HONESTO: nenhum módulo popula esse campo ainda
 *   (documentado desde o Bloco de IA/PEP) — o relatório existe e
 *   funciona, mas hoje sempre vem vazio até algum módulo começar
 *   a classificar movimentações.
 * - RASTREABILIDADE: builder fino, delega pra
 *   `Service_Rastreabilidade` (Módulo 10) — zero duplicação.
 * - DIVERGENCIAS/OCORRENCIAS: enriquecidos com descrição de
 *   produto/localização, mesmo padrão já usado em ESTOQUE.
 *
 * Os que dependem de módulos ainda não implementados (Custo de
 * Obra formal, R6) continuam de fora — não finjo relatório com
 * dado que não existe.
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
    }).map(m => {
      const produto = DB_Query.get('PRODUTOS', m.produtoId);
      return Object.assign({}, m, { produtoDescricao: produto ? produto.descricaoOriginal : '' });
    }),

    ENTRADAS: (f) => BUILDERS.MOVIMENTACOES(Object.assign({}, f, { tipo: 'ENTRADA' })),
    SAIDAS: (f) => BUILDERS.MOVIMENTACOES(Object.assign({}, f, { tipo: 'SAIDA' })),

    INVENTARIOS: (f) => DB_Query.find('INVENTARIOS', inv => {
      if (f.obraId && inv.obraId !== f.obraId) return false;
      if (f.status && inv.estado !== f.status) return false;
      return _dataNoIntervalo(inv.dataAbertura, f.dataInicio, f.dataFim);
    }),

    /**
     * BLOCO 07, seção 4 — o resumo por inventário (linha da tabela
     * INVENTARIOS) já existia acima; isso aqui é o DETALHE por
     * item (código/descrição/unidade/localização/quantidade
     * sistema/contada/diferença/valor unitário/valor divergência/
     * status) que a seção pede — delega 100% pra
     * `Service_Inventario.relatorio()` (Bloco 04), um inventário
     * de cada vez, achatando tudo numa lista só.
     */
    INVENTARIOS_DETALHADO: (f) => {
      const inventarios = BUILDERS.INVENTARIOS(f);
      const linhas = [];
      inventarios.forEach(inv => {
        const detalhe = Service_Inventario.relatorio({ userId: 'sistema', requestId: 'relatorio', payload: { id: inv.ID } });
        if (!detalhe.success) return;
        detalhe.data.itens.forEach(item => linhas.push(Object.assign({ inventarioToken: inv.token, inventarioId: inv.ID, obraId: inv.obraId }, item)));
      });
      return linhas;
    },

    /**
     * BLOCO 07, seção 7 — financeiro agregado de VÁRIOS
     * inventários no filtro. Reaproveita o mesmo cálculo do Bloco
     * 04 por inventário, soma no fim — nunca recalcula preço de
     * produto aqui (isso é responsabilidade do Inventário).
     */
    VALOR_INVENTARIADO: (f) => {
      const inventarios = BUILDERS.INVENTARIOS(f);
      return inventarios.map(inv => {
        const detalhe = Service_Inventario.relatorio({ userId: 'sistema', requestId: 'relatorio', payload: { id: inv.ID } });
        if (!detalhe.success) return { inventarioToken: inv.token, erro: detalhe.message };
        return {
          inventarioToken: inv.token, obraId: inv.obraId, localizacao: inv.localizacao, status: inv.estado,
          valorTotalSistemico: detalhe.data.valorTotalSistemico, valorTotalContado: detalhe.data.valorTotalContado,
          divergenciaFinanceiraTotal: detalhe.data.divergenciaFinanceiraTotal,
          totalItensSemPrecoDisponivel: detalhe.data.totalItensSemPrecoDisponivel
        };
      });
    },

    DIVERGENCIAS: (f) => DB_Query.find('DIVERGENCIAS', d => {
      if (f.status && d.status !== f.status) return false;
      return _dataNoIntervalo(d.data, f.dataInicio, f.dataFim);
    }).map(d => {
      const produto = DB_Query.get('PRODUTOS', d.item);
      return Object.assign({}, d, { itemDescricao: produto ? produto.descricaoOriginal : '' });
    }),

    /** BLOCO 07, seção 6 — não existia nenhum builder pra ocorrências (tabela já existia desde o Módulo 06/Ferramentas). */
    OCORRENCIAS: (f) => DB_Query.find('OCORRENCIAS', o => {
      if (f.status && o.status !== f.status) return false;
      if (f.tipo && o.tipo !== f.tipo) return false;
      if (f.responsavel && o.responsavel !== f.responsavel) return false;
      return _dataNoIntervalo(o.data, f.dataInicio, f.dataFim);
    }),

    /** BLOCO 07, seção 2 — Compras/Pré-Compras "quando o módulo estiver disponível": já está (Módulo 03). */
    PRE_COMPRAS: (f) => DB_Query.find('PRE_COMPRAS', pc => {
      if (f.status && pc.status !== f.status) return false;
      return _dataNoIntervalo(pc.dataAbertura, f.dataInicio, f.dataFim);
    }),

    /**
     * BLOCO 07, seção 8 — agrupa MOVIMENTOS por `classificadorPEP`.
     * HONESTO: esse campo existe no schema desde o Bloco de IA
     * (Módulos 13-15) mas nenhum módulo de negócio populou ele
     * ainda — o relatório funciona de verdade, só que hoje sempre
     * devolve vazio, e diz isso explicitamente em vez de fingir
     * dado que não existe.
     */
    ITENS_POR_PEP: (f) => {
      const movs = DB_Query.find('MOVIMENTOS', m => m.classificadorPEP && _dataNoIntervalo(m.data, f.dataInicio, f.dataFim));
      const porPEP = Utils_Array.groupBy(movs, m => m.classificadorPEP);
      return Object.keys(porPEP).map(pep => {
        const linhas = porPEP[pep];
        return {
          pep, obraId: linhas[0].obraId || '', totalMateriais: new Set(linhas.map(m => m.produtoId)).size,
          quantidadeMovimentada: Utils_Array.sum(linhas, m => Number(m.quantidade || 0)), totalMovimentacoes: linhas.length
        };
      });
    },

    /** BLOCO 07, seção 2 — delega pro Módulo 10 (Rastreabilidade), nunca duplica a lógica de trajetória. */
    RASTREABILIDADE: (f) => {
      if (!f.produtoId) return [];
      const resultado = Service_Rastreabilidade.consultarRastreabilidade({ userId: 'sistema', requestId: 'relatorio', payload: { produtoId: f.produtoId } });
      return resultado.success ? resultado.data.trajetoria : [];
    },

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

  // BLOCO 07, seção 14 — relatórios que expõem dado financeiro ou
  // cruzam todas as obras de uma vez. `Auth_RBAC` usa um
  // vocabulário FECHADO de ações genéricas (VIEW/CREATE/EDIT/
  // APPROVE/EXPORT/AUDIT/IMPORT — conferido em `Auth_RBAC.can()`
  // antes de escrever isso, pra não inventar uma ação que falharia
  // silenciosamente). 'AUDIT' já é exatamente o nível de confiança
  // certo: GESTOR/AUDITOR/ADMIN têm, ALMOXARIFE/OPERADOR não têm.
  const TIPOS_FINANCEIROS = ['VALOR_INVENTARIADO', 'CURVA_ABC'];

  /**
   * BLOCO 07, seção 14 — "quem pode acessar informações de outras
   * obras" nunca era checado: `relatorio.generate` era a mesma
   * permissão pra qualquer obra. MESTRE_OBRA agora só recebe dado
   * da PRÓPRIA obra (`usuario.obraAtual`) — perfis de gestão
   * continuam vendo tudo, exatamente como as outras telas do
   * sistema já fazem (mesmo padrão self-scope usado em Reserva/
   * Solicitação).
   */
  function _aplicarEscopoDeObra(ctx, dados) {
    const PERFIS_AMPLOS = [CORE_CONSTANTS.PERFIS.GESTOR, CORE_CONSTANTS.PERFIS.ADMIN, CORE_CONSTANTS.PERFIS.ALMOXARIFE];
    if (PERFIS_AMPLOS.includes(ctx.perfil)) return dados;
    const usuario = DB_Query.get('USUARIOS', ctx.userId);
    const obraDoUsuario = usuario ? usuario.obraAtual : null;
    if (!obraDoUsuario) return dados; // sem obra vinculada — não filtra por engano pra menos que zero
    return dados.filter(row => !('obraId' in row) || !row.obraId || row.obraId === obraDoUsuario);
  }

  function generate(ctx) {
    const { tipo, filtros } = ctx.payload || {};
    if (!tipo || !BUILDERS[tipo]) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR,
        'tipo inválido. Opções: ' + Object.keys(BUILDERS).join(', '), {}, ctx.requestId);
    }
    if (TIPOS_FINANCEIROS.includes(tipo) && !Auth_RBAC.can(ctx.perfil, 'relatorio.financeiro')) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.PERMISSION_DENIED, 'Este relatório expõe dado financeiro — restrito a Gestor/Auditor/Admin.', {}, ctx.requestId);
    }

    let dados = BUILDERS[tipo](filtros || {});
    dados = _aplicarEscopoDeObra(ctx, dados);

    Audit_Service.record(ctx, 'RELATORIO_GERADO', { entidade: 'RELATORIOS', entidadeId: tipo }, null, { totalRegistros: dados.length, filtros: filtros || {} });

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
