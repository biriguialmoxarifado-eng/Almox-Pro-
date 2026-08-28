/**
 * ============================================================
 * ALMOXA PRO — Test_Fase6_Inventario.gs
 * Fluxo: entra 20 un em estoque → cria inventário → abre (deve
 * congelar esperado=20) → bipa só 18 (forçando divergência) →
 * finish (deve ir pra PENDENTE_APROVACAO) → approve (deve
 * ajustar o saldo real do estoque pra 18).
 * ============================================================
 */

function Test_Fase6_fluxoCompleto() {
  Core_API.bootstrap();

  const login = Core_API.call({ action: 'auth.login', payload: { identificacao: 'admin', senha: 'almoxa123' } });
  if (!login.success) { Logger.log('LOGIN FALHOU'); return login; }
  const sessionId = login.data.sessionId;

  const produto = Core_API.call({
    action: 'produto.create', sessionId,
    payload: { descricaoOriginal: 'Bloco de concreto 14x19x39', codigo: 'BLOCO-14', codigoBarras: '7891112223334' }
  });
  const produtoId = produto.data.ID;
  const localizacao = 'OBRA-TESTE/DEPOSITO-BLOCOS';

  Core_API.call({ action: 'estoque.entry', sessionId, payload: { produtoId, localizacao, quantidade: 20 } });

  const inv = Core_API.call({ action: 'inventario.create', sessionId, payload: { obraId: 'OBRA-TESTE', localizacao } });
  Logger.log('INVENTÁRIO CRIADO: ' + JSON.stringify(inv));
  const inventarioId = inv.data.ID;

  const open = Core_API.call({ action: 'inventario.open', sessionId, payload: { id: inventarioId } });
  Logger.log('ABERTO (esperado 20 pro produto): ' + JSON.stringify(open));

  for (let i = 0; i < 18; i++) {
    Core_API.call({ action: 'inventario.scan', sessionId, payload: { inventarioId, codigo: '7891112223334' } });
    Utilities.sleep(2100);
  }

  const finish = Core_API.call({ action: 'inventario.finish', sessionId, payload: { id: inventarioId } });
  Logger.log('FINISH (deve ir pra PENDENTE_APROVACAO): ' + JSON.stringify(finish));

  const approve = Core_API.call({ action: 'inventario.approve', sessionId, payload: { id: inventarioId, decisao: 'aprovar' } });
  Logger.log('APPROVE (deve ajustar saldo pra 18): ' + JSON.stringify(approve));

  const saldoFinal = Core_API.call({ action: 'estoque.get', sessionId, payload: { produtoId, localizacao } });
  Logger.log('SALDO FINAL (esperado 18): ' + JSON.stringify(saldoFinal));

  const passou =
    inv.success && inv.data.token.startsWith('INV-') &&
    open.success && open.data.contagens.length === 1 && open.data.contagens[0].esperado === 20 &&
    finish.success && finish.data.inventario.estado === 'PENDENTE_APROVACAO' &&
    approve.success && approve.data.ajustes.length === 1 &&
    saldoFinal.success && saldoFinal.data.saldo === 18;

  Logger.log('=== RESULTADO FASE 6: ' + (passou ? 'PASSOU' : 'FALHOU') + ' ===');
  SpreadsheetApp.getUi().alert('Teste Fase 6 (Inventário): ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌') + ' — log completo em Ver → Registros de execução.');
  return { login, produto, inv, open, finish, approve, saldoFinal, passou };
}
