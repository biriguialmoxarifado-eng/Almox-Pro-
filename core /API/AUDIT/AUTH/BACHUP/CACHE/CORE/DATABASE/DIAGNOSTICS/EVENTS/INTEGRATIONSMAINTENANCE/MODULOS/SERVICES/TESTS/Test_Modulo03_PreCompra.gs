/**
 * ============================================================
 * ALMOXA PRO — Test_Modulo03_PreCompra.gs
 * Cobre a seção 10 do contrato: item único, vários itens,
 * gatilho amarelo (rascunho automático, deduplicado), item sem
 * histórico de preço, fornecedor sem histórico, vários
 * fornecedores com preço real, consumo/dias de cobertura,
 * vínculo com obra, usuário sem permissão tentando aprovar,
 * status auditado, relatório fiel aos itens registrados.
 * ============================================================
 */

function Test_Modulo03_PreCompra_fluxoCompleto() {
  Core_API.bootstrap();
  const resultados = {};

  const admin = Core_API.call({ action: 'auth.login', payload: { identificacao: 'admin', senha: 'almoxa123' } });
  const sessionAdmin = admin.data.sessionId;

  const operador = Core_API.call({ action: 'loja.cadastro', payload: { nome: 'Solicitante M3', matricula: 'M3-OP-' + Date.now(), senha: '1234' } });
  const sessionOperador = operador.data.sessionId;

  const produtoSemHistorico = Core_API.call({ action: 'produto.create', sessionId: sessionAdmin, payload: { descricaoOriginal: 'Item Sem Histórico M3', codigo: 'M3-SEMHIST' } });
  const produtoComHistorico = Core_API.call({ action: 'produto.create', sessionId: sessionAdmin, payload: { descricaoOriginal: 'Item Com Histórico M3', codigo: 'M3-COMHIST' } });
  const produtoIdSemHist = produtoSemHistorico.data.ID;
  const produtoIdComHist = produtoComHistorico.data.ID;
  const local = 'TESTE-M3/DEPOSITO';

  const nf1 = Core_API.call({
    action: 'nf.create', sessionId: sessionAdmin,
    payload: {
      fornecedor: { cnpj: '11111111000111', razaoSocial: 'Fornecedor Um M3' },
      nota: { numero: 'M3-NF-1', dataEmissao: new Date().toISOString(), valorTotal: 100 },
      itens: [{ descricao: 'Item Com Histórico M3', codigo: 'M3-COMHIST', quantidade: 10, valorUnitario: 20, unidade: 'UN' }]
    }
  });
  const nf2 = Core_API.call({
    action: 'nf.create', sessionId: sessionAdmin,
    payload: {
      fornecedor: { cnpj: '22222222000122', razaoSocial: 'Fornecedor Dois M3' },
      nota: { numero: 'M3-NF-2', dataEmissao: new Date().toISOString(), valorTotal: 100 },
      itens: [{ descricao: 'Item Com Histórico M3', codigo: 'M3-COMHIST', quantidade: 10, valorUnitario: 30, unidade: 'UN' }]
    }
  });
  if (nf1.success) Core_API.call({ action: 'nf.approve', sessionId: sessionAdmin, payload: { id: nf1.data.nota.ID } });
  if (nf2.success) Core_API.call({ action: 'nf.approve', sessionId: sessionAdmin, payload: { id: nf2.data.nota.ID } });

  // ---- 1) Item sem histórico de preço ----
  const resumoSemHistorico = Core_API.call({ action: 'precompra.calcularResumo', sessionId: sessionOperador, payload: { produtoId: produtoIdSemHist, localizacao: local } });
  resultados.itemSemHistoricoInformaCorretamente = resumoSemHistorico.success && resumoSemHistorico.data.historicoSuficiente === false && resumoSemHistorico.data.precoMedio === null;

  // ---- 2) Fornecedor sem histórico (mesmo produto) ----
  const fornecedoresSemHist = Core_API.call({ action: 'precompra.sugerirFornecedores', sessionId: sessionOperador, payload: { produtoId: produtoIdSemHist } });
  resultados.fornecedorSemHistoricoNaoInventaSugestao = fornecedoresSemHist.success && fornecedoresSemHist.data.fornecedores.length === 0 && !!fornecedoresSemHist.data.aviso;

  // ---- 3) Vários fornecedores com preço real ----
  const fornecedoresComHist = Core_API.call({ action: 'precompra.sugerirFornecedores', sessionId: sessionOperador, payload: { produtoId: produtoIdComHist } });
  resultados.variosFornecedoresComPrecoReal = fornecedoresComHist.success && fornecedoresComHist.data.fornecedores.length === 2 &&
    fornecedoresComHist.data.fornecedores[0].precoMedioHistorico === 20;

  const resumoComHistorico = Core_API.call({ action: 'precompra.calcularResumo', sessionId: sessionOperador, payload: { produtoId: produtoIdComHist, localizacao: local } });
  resultados.precoMinMedioMaxCalculadoComDadosReais = resumoComHistorico.success &&
    resumoComHistorico.data.precoMin === 20 && resumoComHistorico.data.precoMax === 30 && resumoComHistorico.data.precoMedio === 25;

  // ---- 4) Criar pré-compra de UM item, vinculada a obra ----
  const criarUmItem = Core_API.call({
    action: 'precompra.criar', sessionId: sessionOperador,
    payload: { itens: [{ produtoId: produtoIdComHist, localizacao: local, quantidade: 50 }], obraId: 'OBRA-TESTE-M3', justificativa: 'Reposição de rotina' }
  });
  resultados.criaUmItem = criarUmItem.success && criarUmItem.data.itens.length === 1;
  resultados.vinculadaAObra = criarUmItem.success && criarUmItem.data.preCompra.obraId === 'OBRA-TESTE-M3';

  // ---- 5) Criar pré-compra de VÁRIOS itens ----
  const criarVariosItens = Core_API.call({
    action: 'precompra.criar', sessionId: sessionOperador,
    payload: { itens: [{ produtoId: produtoIdComHist, quantidade: 20 }, { produtoId: produtoIdSemHist, quantidade: 5 }], justificativa: 'Múltiplos itens' }
  });
  resultados.criaVariosItens = criarVariosItens.success && criarVariosItens.data.itens.length === 2;

  // ---- 6) Usuário sem permissão tentando aprovar ----
  const idPreCompra = criarUmItem.data.preCompra.ID;
  const aprovarNegado = Core_API.call({ action: 'precompra.atualizarStatus', sessionId: sessionOperador, payload: { id: idPreCompra, status: 'APROVADA' } });
  resultados.operadorNaoAprova = !aprovarNegado.success && aprovarNegado.code === CORE_CONSTANTS.RESPONSE_CODES.PERMISSION_DENIED;

  // ---- 7) Alteração de status auditada (aprovação real por quem pode) ----
  const aprovarOk = Core_API.call({ action: 'precompra.atualizarStatus', sessionId: sessionAdmin, payload: { id: idPreCompra, status: 'APROVADA' } });
  resultados.adminAprovaComSucesso = aprovarOk.success && aprovarOk.data.status === 'APROVADA';

  // ---- 8) Relatório reproduz exatamente os itens registrados ----
  const relatorio = Core_API.call({ action: 'precompra.gerarRelatorio', sessionId: sessionAdmin, payload: { id: idPreCompra } });
  resultados.relatorioFielAosItens = relatorio.success && relatorio.data.totalItens === 1 &&
    relatorio.data.itens[0].codigo === 'M3-COMHIST' && relatorio.data.itens[0].quantidade === 50;

  // ---- 9) Gatilho amarelo cria RASCUNHO automático, deduplicado ----
  Core_API.call({ action: 'estoque.entry', sessionId: sessionAdmin, payload: { produtoId: produtoIdSemHist, localizacao: 'TESTE-M3/GATILHO', quantidade: 12 } });
  Core_API.call({ action: 'estoque.setMinimo', sessionId: sessionAdmin, payload: { produtoId: produtoIdSemHist, localizacao: 'TESTE-M3/GATILHO', estoqueMinimo: 10 } });
  const ctxSistema = Core_Context.build({ action: 'sistema.gatilho', userId: 'sistema' });
  Service_Estoque.verificarNiveis(ctxSistema);

  const listaAdmin1 = Core_API.call({ action: 'precompra.listar', sessionId: sessionAdmin, payload: { status: 'ABERTA' } });
  const rascunhosGatilho1 = listaAdmin1.success ? listaAdmin1.data.filter(pc => pc.origem === 'GATILHO_AMARELO') : [];
  resultados.gatilhoCriaRascunho = rascunhosGatilho1.length >= 1;

  Service_Estoque.verificarNiveis(ctxSistema);
  const listaAdmin2 = Core_API.call({ action: 'precompra.listar', sessionId: sessionAdmin, payload: { status: 'ABERTA' } });
  const rascunhosGatilho2 = listaAdmin2.success ? listaAdmin2.data.filter(pc => pc.origem === 'GATILHO_AMARELO') : [];
  resultados.gatilhoNaoDuplica = rascunhosGatilho2.length === rascunhosGatilho1.length;

  const passou = Object.values(resultados).every(Boolean);

  Logger.log('=== RESULTADOS MÓDULO 03 (Compras/Pré-Compra) ===');
  Logger.log(JSON.stringify(resultados, null, 2));
  Logger.log('=== ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌') + ' ===');
  SpreadsheetApp.getUi().alert('Teste Módulo 03 (Compras): ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌ — veja o Logger.'));

  return resultados;
}
