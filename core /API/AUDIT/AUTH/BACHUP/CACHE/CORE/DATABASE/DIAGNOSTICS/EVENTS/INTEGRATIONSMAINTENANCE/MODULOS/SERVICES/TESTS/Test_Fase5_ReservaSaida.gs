/**
 * ============================================================
 * ALMOXA PRO — Test_Fase5_ReservaSaida.gs
 * Fluxo: entrada direta em estoque (20 un) → reserva de 15 →
 * confere que ficou só 5 disponível → tenta reservar de novo
 * (deve travar duplicada) → aprova a reserva → gera saída a
 * partir dela → confirma → confere saldo final e reservado.
 * ============================================================
 */

function Test_Fase5_fluxoCompleto() {
  Core_API.bootstrap();

  const login = Core_API.call({ action: 'auth.login', payload: { identificacao: 'admin', senha: 'almoxa123' } });
  if (!login.success) { Logger.log('LOGIN FALHOU'); return login; }
  const sessionId = login.data.sessionId;

  const produto = Core_API.call({
    action: 'produto.create', sessionId,
    payload: { descricaoOriginal: 'Areia média m³', codigo: 'AREIA-M3' }
  });
  const produtoId = produto.data.ID;
  const localizacao = 'OBRA-TESTE/PATIO';

  Core_API.call({ action: 'estoque.entry', sessionId, payload: { produtoId, localizacao, quantidade: 20 } });

  const reserva = Core_API.call({
    action: 'reserva.create', sessionId,
    payload: { produtoId, localizacao, quantidade: 15, obraId: 'OBRA-TESTE' }
  });
  Logger.log('RESERVA CRIADA: ' + JSON.stringify(reserva));

  const saldoAposReserva = Core_API.call({ action: 'estoque.get', sessionId, payload: { produtoId, localizacao } });
  Logger.log('SALDO APÓS RESERVA (saldo=20, reservado=15, disponível=5): ' + JSON.stringify(saldoAposReserva));

  const reservaDuplicada = Core_API.call({
    action: 'reserva.create', sessionId,
    payload: { produtoId, localizacao, quantidade: 3, obraId: 'OBRA-TESTE' }
  });
  Logger.log('RESERVA DUPLICADA (deve falhar, mesmo solicitante): ' + JSON.stringify(reservaDuplicada));

  const aprovacao = Core_API.call({ action: 'reserva.approve', sessionId, payload: { id: reserva.data.reserva.ID } });
  Logger.log('APROVAÇÃO: ' + JSON.stringify(aprovacao));

  const saida = Core_API.call({ action: 'saida.create', sessionId, payload: { reservaId: reserva.data.reserva.ID } });
  Logger.log('SAÍDA CRIADA: ' + JSON.stringify(saida));

  const confirmacao = Core_API.call({ action: 'saida.confirm', sessionId, payload: { id: saida.data.ID } });
  Logger.log('SAÍDA CONFIRMADA: ' + JSON.stringify(confirmacao));

  const saldoFinal = Core_API.call({ action: 'estoque.get', sessionId, payload: { produtoId, localizacao } });
  Logger.log('SALDO FINAL (esperado saldo=5, reservado=0, disponível=5): ' + JSON.stringify(saldoFinal));

  const passou =
    reserva.success && saldoAposReserva.data.reservado === 15 && saldoAposReserva.data.saldoDisponivel === 5 &&
    !reservaDuplicada.success &&
    aprovacao.success && aprovacao.data.status === 'APROVADA' &&
    saida.success && confirmacao.success &&
    saldoFinal.success && saldoFinal.data.saldo === 5 && saldoFinal.data.reservado === 0 && saldoFinal.data.saldoDisponivel === 5;

  Logger.log('=== RESULTADO FASE 5: ' + (passou ? 'PASSOU' : 'FALHOU') + ' ===');
  SpreadsheetApp.getUi().alert('Teste Fase 5 (Reservas/Saídas): ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌') + ' — log completo em Ver → Registros de execução.');
  return { login, produto, reserva, saldoAposReserva, reservaDuplicada, aprovacao, saida, confirmacao, saldoFinal, passou };
}
