/**
 * ============================================================
 * ALMOXA PRO — Test_Bloco04_Inventario.gs
 * O núcleo de criar/abrir/bipar/contar/aprovar/rastreabilidade/
 * escopo já tinha teste próprio (Módulo 04 original, ver
 * Test_Modulo04_Inventario.gs) — não duplicado aqui. Este teste
 * foca no que é GENUINAMENTE NOVO nesta entrega: divergência
 * financeira real (via histórico de preço reaproveitado, nunca
 * inventado) e a função cancelar() que nunca existia.
 * ============================================================
 */

function Test_Bloco04_Inventario_fluxoCompleto() {
  Core_API.bootstrap();
  const resultados = {};

  const admin = Core_API.call({ action: 'auth.login', payload: { identificacao: 'admin', senha: 'almoxa123' } });
  const sessionAdmin = admin.data.sessionId;

  const produtoComPreco = Core_API.call({ action: 'produto.create', sessionId: sessionAdmin, payload: { descricaoOriginal: 'Item Com Preço B04', codigo: 'B04-COMPRECO' } });
  const produtoSemPreco = Core_API.call({ action: 'produto.create', sessionId: sessionAdmin, payload: { descricaoOriginal: 'Item Sem Preço B04', codigo: 'B04-SEMPRECO' } });
  const local = 'TESTE-B04/INVENTARIO';

  const nf = Core_API.call({
    action: 'nf.create', sessionId: sessionAdmin,
    payload: {
      fornecedor: { cnpj: '55666777000188', razaoSocial: 'Fornecedor B04' },
      nota: { numero: 'B04-NF-1', dataEmissao: new Date().toISOString(), valorTotal: 100 },
      itens: [{ descricao: 'Item Com Preço B04', codigo: 'B04-COMPRECO', quantidade: 10, valorUnitario: 25, unidade: 'UN' }]
    }
  });
  if (nf.success) Core_API.call({ action: 'nf.approve', sessionId: sessionAdmin, payload: { id: nf.data.nota.ID } });

  Core_API.call({ action: 'estoque.entry', sessionId: sessionAdmin, payload: { produtoId: produtoComPreco.data.ID, localizacao: local, quantidade: 20 } });
  Core_API.call({ action: 'estoque.entry', sessionId: sessionAdmin, payload: { produtoId: produtoSemPreco.data.ID, localizacao: local, quantidade: 15 } });

  const criar = Core_API.call({ action: 'inventario.create', sessionId: sessionAdmin, payload: { localizacao: local, tipo: 'CICLICO' } });
  resultados.idNoFormatoExato = criar.success && /^INV-\d{4}-\d{6}$/.test(criar.data.token);
  resultados.tipoRegistradoCorretamente = criar.data.tipo === 'CICLICO';

  const abrir = Core_API.call({ action: 'inventario.open', sessionId: sessionAdmin, payload: { id: criar.data.ID } });
  const contagemComPreco = abrir.data.contagens.find(function (c) { return c.produtoId === produtoComPreco.data.ID; });
  const contagemSemPreco = abrir.data.contagens.find(function (c) { return c.produtoId === produtoSemPreco.data.ID; });
  resultados.valorUnitarioRealPopulado = contagemComPreco.valorUnitarioDisponivel === true && contagemComPreco.valorUnitario === 25 && contagemComPreco.valorSistemico === 500;
  resultados.honestoSemHistoricoDePreco = contagemSemPreco.valorUnitarioDisponivel === false && Number(contagemSemPreco.valorSistemico) === 0;

  Core_API.call({ action: 'inventario.count', sessionId: sessionAdmin, payload: { inventarioId: criar.data.ID, produtoId: produtoComPreco.data.ID, quantidadeContada: 18 } });
  const relatorioParcial = Core_API.call({ action: 'inventario.relatorio', sessionId: sessionAdmin, payload: { id: criar.data.ID } });
  const itemContado = relatorioParcial.data.itens.find(function (i) { return i.produtoId === produtoComPreco.data.ID; });
  resultados.calculoFinanceiroCorretoNaContagem = itemContado.valorContado === 450 && itemContado.diferencaFinanceira === -50;

  resultados.totaisFinanceirosCorretos = relatorioParcial.data.valorTotalSistemico === 500 && relatorioParcial.data.valorTotalContado === 450 &&
    relatorioParcial.data.divergenciaFinanceiraTotal === -50 && relatorioParcial.data.totalItensSemPrecoDisponivel === 1;

  const inventarioParaCancelar = Core_API.call({ action: 'inventario.create', sessionId: sessionAdmin, payload: { localizacao: 'TESTE-B04/CANCELAR' } });
  const cancelamento = Core_API.call({ action: 'inventario.cancelar', sessionId: sessionAdmin, payload: { id: inventarioParaCancelar.data.ID, motivo: 'Teste de cancelamento B04' } });
  resultados.cancelarFuncionaDeVerdade = cancelamento.success && cancelamento.data.estado === 'CANCELADO';

  const tentaAbrirCancelado = Core_API.call({ action: 'inventario.open', sessionId: sessionAdmin, payload: { id: inventarioParaCancelar.data.ID } });
  resultados.canceladoNaoPodeSerAberto = !tentaAbrirCancelado.success;

  Core_API.call({ action: 'inventario.finish', sessionId: sessionAdmin, payload: { id: criar.data.ID } });
  Core_API.call({ action: 'inventario.approve', sessionId: sessionAdmin, payload: { id: criar.data.ID, decisao: 'aprovar' } });
  const tentaCancelarAprovado = Core_API.call({ action: 'inventario.cancelar', sessionId: sessionAdmin, payload: { id: criar.data.ID } });
  resultados.naoCancelaInventarioJaAprovado = !tentaCancelarAprovado.success;

  const operador = Core_API.call({ action: 'loja.cadastro', payload: { nome: 'Operador B04', matricula: 'B04-OP-' + Date.now(), senha: '1234' } });
  const outroParaCancelar = Core_API.call({ action: 'inventario.create', sessionId: sessionAdmin, payload: { localizacao: 'TESTE-B04/CANCELAR2' } });
  const cancelamentoNegado = Core_API.call({ action: 'inventario.cancelar', sessionId: operador.data.sessionId, payload: { id: outroParaCancelar.data.ID } });
  resultados.bloqueiaCancelamentoSemAcesso = !cancelamentoNegado.success && cancelamentoNegado.code === CORE_CONSTANTS.RESPONSE_CODES.PERMISSION_DENIED;

  const passou = Object.values(resultados).every(Boolean);

  Logger.log('=== RESULTADOS BLOCO 04 (Módulo de Inventário) ===');
  Logger.log(JSON.stringify(resultados, null, 2));
  Logger.log('=== ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌') + ' ===');
  SpreadsheetApp.getUi().alert('Teste Bloco 04: ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌ — veja o Logger.'));

  return resultados;
}
