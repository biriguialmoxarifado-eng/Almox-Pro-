/**
 * ============================================================
 * ALMOXA PRO — Test_Fase4_Estoque.gs
 * Fluxo: NF (10 un) → conferência bipando as 10 → finish (sem
 * divergência) → approve → confere que a entrada em ESTOQUE
 * aconteceu sozinha com a quantidade certa. Depois testa
 * transferência, saída e ajuste manualmente.
 * ============================================================
 */

function Test_Fase4_fluxoCompleto() {
  Core_API.bootstrap();

  const login = Core_API.call({ action: 'auth.login', payload: { identificacao: 'admin', senha: 'almoxa123' } });
  if (!login.success) { Logger.log('LOGIN FALHOU'); return login; }
  const sessionId = login.data.sessionId;

  Core_API.call({
    action: 'produto.create', sessionId,
    payload: { descricaoOriginal: 'Tijolo baiano 9 furos', codigo: 'TIJ-9F', codigoBarras: '7899990001112' }
  });

  const nf = Core_API.call({
    action: 'nf.create', sessionId,
    payload: {
      fornecedor: { cnpj: '11222333000144', razaoSocial: 'Cerâmica Teste LTDA' },
      nota: { numero: '000789', dataEmissao: '2026-08-21', valorTotal: 100.00 },
      itens: [{ descricao: 'Tijolo baiano 9 furos', codigo: 'TIJ-9F', codigoBarras: '7899990001112', quantidade: 10, valorUnitario: 10.00 }]
    }
  });
  const notaId = nf.data.nota.ID;
  const produtoId = nf.data.itens[0].produtoId;

  Core_API.call({ action: 'conferencia.start', sessionId, payload: { notaId } });
  for (let i = 0; i < 10; i++) {
    Core_API.call({ action: 'conferencia.scan', sessionId, payload: { notaId, codigo: '7899990001112' } });
    Utilities.sleep(2100);
  }
  const finish = Core_API.call({ action: 'conferencia.finish', sessionId, payload: { notaId } });
  Logger.log('FINISH (deve ser CONFERIDA, sem divergência): ' + JSON.stringify(finish));

  const approve = Core_API.call({ action: 'nf.approve', sessionId, payload: { id: notaId, localizacao: 'OBRA-CENTRAL/ALMOX' } });
  Logger.log('APPROVE (deve gerar entrada em estoque): ' + JSON.stringify(approve));

  const saldo = Core_API.call({ action: 'estoque.get', sessionId, payload: { produtoId, localizacao: 'OBRA-CENTRAL/ALMOX' } });
  Logger.log('SALDO APÓS APROVAÇÃO (esperado 10): ' + JSON.stringify(saldo));

  // Transferência
  const transfer = Core_API.call({
    action: 'estoque.transfer', sessionId,
    payload: { produtoId, origemLocalizacao: 'OBRA-CENTRAL/ALMOX', destinoLocalizacao: 'OBRA-CENTRAL/CANTEIRO', quantidade: 4 }
  });
  Logger.log('TRANSFERÊNCIA: ' + JSON.stringify(transfer));

  // Saída
  const exit = Core_API.call({
    action: 'estoque.exit', sessionId,
    payload: { produtoId, localizacao: 'OBRA-CENTRAL/CANTEIRO', quantidade: 2, motivo: 'Uso em alvenaria' }
  });
  Logger.log('SAÍDA: ' + JSON.stringify(exit));

  // Saída além do disponível — deve falhar
  const exitFalha = Core_API.call({
    action: 'estoque.exit', sessionId,
    payload: { produtoId, localizacao: 'OBRA-CENTRAL/CANTEIRO', quantidade: 999, motivo: 'Teste de limite' }
  });
  Logger.log('SAÍDA ALÉM DO SALDO (deve falhar): ' + JSON.stringify(exitFalha));

  // Ajuste
  const adjust = Core_API.call({
    action: 'estoque.adjust', sessionId,
    payload: { produtoId, localizacao: 'OBRA-CENTRAL/ALMOX', novoSaldo: 5, motivo: 'Contagem de inventário' }
  });
  Logger.log('AJUSTE: ' + JSON.stringify(adjust));

  const historico = Core_API.call({ action: 'estoque.history', sessionId, payload: { produtoId } });
  Logger.log('HISTÓRICO (' + (historico.data ? historico.data.length : 0) + ' movimentos): ' + JSON.stringify(historico));

  const passou =
    finish.data.notaStatus === 'CONFERIDA' &&
    approve.success && approve.data.entradasEstoque.length === 1 &&
    saldo.success && saldo.data.saldo === 10 &&
    transfer.success && transfer.data.origem.saldo === 6 && transfer.data.destino.saldo === 4 &&
    exit.success && exit.data.saldo === 2 &&
    !exitFalha.success && exitFalha.code === CORE_CONSTANTS.RESPONSE_CODES.ESTOQUE_INSUFICIENTE &&
    adjust.success && adjust.data.saldo === 5 &&
    historico.success && historico.data.length >= 4; // entrada + transferencia + saida + ajuste

  Logger.log('=== RESULTADO FASE 4: ' + (passou ? 'PASSOU' : 'FALHOU') + ' ===');
  SpreadsheetApp.getUi().alert('Teste Fase 4 (Estoque): ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌') + ' — log completo em Ver → Registros de execução.');
  return { login, nf, finish, approve, saldo, transfer, exit, exitFalha, adjust, historico, passou };
}
