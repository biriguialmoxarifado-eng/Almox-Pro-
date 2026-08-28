/**
 * ============================================================
 * ALMOXA PRO — Test_Fase2_NotaFiscal.gs
 * Roda o fluxo completo da Fase 2: login → criar produto de
 * teste → lançar NF manual (fornecedor novo + 1 item que bate
 * com o produto + 1 item novo) → validar → aprovar.
 * ============================================================
 */

function Test_Fase2_fluxoCompleto() {
  Core_API.bootstrap();

  const login = Core_API.call({ action: 'auth.login', payload: { identificacao: 'admin', senha: 'almoxa123' } });
  Logger.log('1) LOGIN: ' + JSON.stringify(login));
  if (!login.success) return login;
  const sessionId = login.data.sessionId;

  // Produto já existente, pra testar o "match exato" (seção 17)
  const produtoExistente = Core_API.call({
    action: 'produto.create', sessionId,
    payload: { descricaoOriginal: 'Cimento CP-II 50kg', codigo: 'CIM-50' }
  });
  Logger.log('2) PRODUTO PRÉ-EXISTENTE: ' + JSON.stringify(produtoExistente));

  const nf = Core_API.call({
    action: 'nf.create', sessionId,
    payload: {
      fornecedor: { cnpj: '12345678000199', razaoSocial: 'Fornecedor Teste LTDA' },
      nota: { numero: '000123', dataEmissao: '2026-08-20', valorTotal: 1500.00 },
      itens: [
        { descricao: 'Cimento CP-II 50kg', codigo: 'CIM-50', quantidade: 10, valorUnitario: 35.00 },
        { descricao: 'Parafuso sextavado 1/2 novo modelo', quantidade: 100, valorUnitario: 1.15 }
      ]
    }
  });
  Logger.log('3) NF CRIADA: ' + JSON.stringify(nf));
  if (!nf.success) return { login, produtoExistente, nf };

  const validate = Core_API.call({ action: 'nf.validate', sessionId, payload: { id: nf.data.nota.ID } });
  Logger.log('4) VALIDAÇÃO: ' + JSON.stringify(validate));

  const approve = Core_API.call({ action: 'nf.approve', sessionId, payload: { id: nf.data.nota.ID } });
  Logger.log('5) APROVAÇÃO: ' + JSON.stringify(approve));

  const resultado = {
    passou:
      login.success && nf.success &&
      nf.data.pendenciasDeProduto === 1 && // o parafuso "novo modelo" não deve bater com nada
      validate.success && approve.success && approve.data.status === 'APROVADA',
    login, produtoExistente, nf, validate, approve
  };

  Logger.log('=== RESULTADO FASE 2: ' + (resultado.passou ? 'PASSOU' : 'FALHOU') + ' ===');
  SpreadsheetApp.getUi().alert('Teste Fase 2 (Nota Fiscal): ' + (resultado.passou ? 'PASSOU ✅' : 'FALHOU ❌') + ' — veja o log completo em Ver → Registros de execução.');
  return resultado;
}
