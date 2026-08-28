/**
 * ============================================================
 * ALMOXA PRO — Test_Bloco07_Relatorios.gs
 * ESTOQUE/MOVIMENTACOES/RESERVAS/OBRAS/FORNECEDORES/NOTAS_FISCAIS/
 * AUDITORIA/CURVA_ABC/exportação CSV-PDF-Excel já tinham teste
 * próprio (Test_Fase9_Relatorios.gs, entrega original) — não
 * duplicado aqui. Este teste foca no que é GENUINAMENTE NOVO:
 * OCORRENCIAS, PRE_COMPRAS, detalhe de inventário composto,
 * financeiro agregado, PEP honesto, rastreabilidade delegada,
 * permissão financeira e escopo de obra.
 * ============================================================
 */

function Test_Bloco07_Relatorios_fluxoCompleto() {
  Core_API.bootstrap();
  const resultados = {};

  const admin = Core_API.call({ action: 'auth.login', payload: { identificacao: 'admin', senha: 'almoxa123' } });
  const sessionAdmin = admin.data.sessionId;

  const ferramenta = Core_API.call({ action: 'ferramenta.create', sessionId: sessionAdmin, payload: { codigo: 'B07-FER', descricao: 'Ferramenta B07' } });
  Core_API.call({ action: 'ferramenta.registrarNaoConformidade', sessionId: sessionAdmin, payload: { ferramentaId: ferramenta.data.ID, gravidade: 'MEDIA', descricao: 'Teste B07' } });
  const relatorioOcorrencias = Core_API.call({ action: 'relatorio.generate', sessionId: sessionAdmin, payload: { tipo: 'OCORRENCIAS', filtros: {} } });
  resultados.ocorrenciasBuilderFunciona = relatorioOcorrencias.success && relatorioOcorrencias.data.dados.some(function (o) { return o.descricao === 'Teste B07'; });

  const produto = Core_API.call({ action: 'produto.create', sessionId: sessionAdmin, payload: { descricaoOriginal: 'Item B07 Compra', codigo: 'B07-COMPRA' } });
  Core_API.call({ action: 'estoque.entry', sessionId: sessionAdmin, payload: { produtoId: produto.data.ID, localizacao: 'TESTE-B07', quantidade: 1, estoqueMinimo: 100 } });
  const preCompra = Core_API.call({ action: 'precompra.criar', sessionId: sessionAdmin, payload: { itens: [{ produtoId: produto.data.ID, quantidade: 50 }] } });
  const relatorioPreCompras = Core_API.call({ action: 'relatorio.generate', sessionId: sessionAdmin, payload: { tipo: 'PRE_COMPRAS', filtros: {} } });
  resultados.preComprasBuilderFunciona = relatorioPreCompras.success && preCompra.success && relatorioPreCompras.data.totalRegistros > 0;

  const produtoInv = Core_API.call({ action: 'produto.create', sessionId: sessionAdmin, payload: { descricaoOriginal: 'Item Inventario B07', codigo: 'B07-INV' } });
  const localInv = 'TESTE-B07/INVENTARIO';
  Core_API.call({ action: 'estoque.entry', sessionId: sessionAdmin, payload: { produtoId: produtoInv.data.ID, localizacao: localInv, quantidade: 10 } });
  const inv = Core_API.call({ action: 'inventario.create', sessionId: sessionAdmin, payload: { localizacao: localInv } });
  Core_API.call({ action: 'inventario.open', sessionId: sessionAdmin, payload: { id: inv.data.ID } });
  Core_API.call({ action: 'inventario.count', sessionId: sessionAdmin, payload: { inventarioId: inv.data.ID, produtoId: produtoInv.data.ID, quantidadeContada: 8 } });

  const relatorioDetalhado = Core_API.call({ action: 'relatorio.generate', sessionId: sessionAdmin, payload: { tipo: 'INVENTARIOS_DETALHADO', filtros: {} } });
  const linhaDoItem = relatorioDetalhado.success ? relatorioDetalhado.data.dados.find(function (l) { return l.produtoId === produtoInv.data.ID && l.inventarioId === inv.data.ID; }) : null;
  resultados.inventarioDetalhadoComponhaDeVerdade = !!linhaDoItem && linhaDoItem.esperado === 10 && linhaDoItem.contado === 8 && linhaDoItem.diferenca === -2;

  const relatorioFinanceiro = Core_API.call({ action: 'relatorio.generate', sessionId: sessionAdmin, payload: { tipo: 'VALOR_INVENTARIADO', filtros: {} } });
  resultados.valorInventariadoFunciona = relatorioFinanceiro.success && relatorioFinanceiro.data.dados.some(function (l) { return l.inventarioToken === inv.data.token; });

  const operador = Core_API.call({ action: 'loja.cadastro', payload: { nome: 'Operador B07', matricula: 'B07-OP-' + Date.now(), senha: '1234' } });
  const tentativaFinanceiroPorOperador = Core_API.call({ action: 'relatorio.generate', sessionId: operador.data.sessionId, payload: { tipo: 'VALOR_INVENTARIADO', filtros: {} } });
  resultados.bloqueiaFinanceiroParaOperador = !tentativaFinanceiroPorOperador.success && tentativaFinanceiroPorOperador.code === CORE_CONSTANTS.RESPONSE_CODES.PERMISSION_DENIED;

  const relatorioComumParaOperador = Core_API.call({ action: 'relatorio.generate', sessionId: operador.data.sessionId, payload: { tipo: 'ESTOQUE', filtros: {} } });
  resultados.relatorioComumContinuaLiberado = relatorioComumParaOperador.success;

  const relatorioPEP = Core_API.call({ action: 'relatorio.generate', sessionId: sessionAdmin, payload: { tipo: 'ITENS_POR_PEP', filtros: {} } });
  resultados.pepHonestoQuandoSemClassificacao = relatorioPEP.success && Array.isArray(relatorioPEP.data.dados);

  const relatorioRastreio = Core_API.call({ action: 'relatorio.generate', sessionId: sessionAdmin, payload: { tipo: 'RASTREABILIDADE', filtros: { produtoId: produtoInv.data.ID } } });
  resultados.rastreabilidadeDelegaCorretamente = relatorioRastreio.success && relatorioRastreio.data.dados.some(function (t) { return t.etapa === 'CADASTRO'; });

  const mestreObra = Core_API.call({ action: 'loja.cadastro', payload: { nome: 'Mestre Obra B07', matricula: 'B07-MESTRE-' + Date.now(), senha: '1234' } });
  Core_API.call({ action: 'usuario.update', sessionId: sessionAdmin, payload: { id: mestreObra.data.userId, perfil: 'MESTRE_OBRA', obraAtual: 'OBRA-B07-A' } });

  const produtoObraA = Core_API.call({ action: 'produto.create', sessionId: sessionAdmin, payload: { descricaoOriginal: 'Item Obra A B07', codigo: 'B07-OBRAA' } });
  Core_API.call({ action: 'estoque.entry', sessionId: sessionAdmin, payload: { produtoId: produtoObraA.data.ID, localizacao: 'TESTE-B07/OBRAA', quantidade: 5, obraId: 'OBRA-B07-A' } });
  Core_API.call({ action: 'reserva.create', sessionId: sessionAdmin, payload: { produtoId: produtoObraA.data.ID, localizacao: 'TESTE-B07/OBRAA', quantidade: 1, obraId: 'OBRA-B07-A' } });
  Core_API.call({ action: 'reserva.create', sessionId: sessionAdmin, payload: { produtoId: produtoObraA.data.ID, localizacao: 'TESTE-B07/OBRAA', quantidade: 1, obraId: 'OBRA-B07-OUTRA' } });

  const relatorioReservasMestreObra = Core_API.call({ action: 'relatorio.generate', sessionId: mestreObra.data.sessionId, payload: { tipo: 'RESERVAS', filtros: {} } });
  const vazouObraAlheia = relatorioReservasMestreObra.success && relatorioReservasMestreObra.data.dados.some(function (r) { return r.obraId === 'OBRA-B07-OUTRA'; });
  resultados.escopoDeObraBloqueiaVazamento = relatorioReservasMestreObra.success && !vazouObraAlheia &&
    relatorioReservasMestreObra.data.dados.some(function (r) { return r.obraId === 'OBRA-B07-A'; });

  const relatorioReservasGestor = Core_API.call({ action: 'relatorio.generate', sessionId: sessionAdmin, payload: { tipo: 'RESERVAS', filtros: {} } });
  resultados.gestorVeTodasAsObras = relatorioReservasGestor.success && relatorioReservasGestor.data.dados.some(function (r) { return r.obraId === 'OBRA-B07-OUTRA'; });

  Core_API.call({ action: 'inventario.finish', sessionId: sessionAdmin, payload: { id: inv.data.ID } });
  const relatorioDivergencias = Core_API.call({ action: 'relatorio.generate', sessionId: sessionAdmin, payload: { tipo: 'DIVERGENCIAS', filtros: {} } });
  resultados.divergenciasEnriquecidasComDescricao = relatorioDivergencias.success &&
    (relatorioDivergencias.data.dados.length === 0 || relatorioDivergencias.data.dados.every(function (d) { return 'itemDescricao' in d; }));

  const passou = Object.values(resultados).every(Boolean);

  Logger.log('=== RESULTADOS BLOCO 07 (Relatórios) ===');
  Logger.log(JSON.stringify(resultados, null, 2));
  Logger.log('=== ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌') + ' ===');
  SpreadsheetApp.getUi().alert('Teste Bloco 07: ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌ — veja o Logger.'));

  return resultados;
}
