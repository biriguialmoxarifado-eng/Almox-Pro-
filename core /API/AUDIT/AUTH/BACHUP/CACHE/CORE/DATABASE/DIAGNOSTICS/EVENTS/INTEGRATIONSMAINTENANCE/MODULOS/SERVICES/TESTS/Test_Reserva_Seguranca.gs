/**
 * ============================================================
 * ALMOXA PRO — Test_Reserva_Seguranca.gs
 * FASE 6 DO FRONT MOBILE — confirma a correção de 3 bugs:
 * get() sem checar dono, calendar() vazando tudo, cancel()
 * bloqueado até pro próprio dono.
 * ============================================================
 */

function Test_Reserva_Seguranca_fluxoCompleto() {
  Core_API.bootstrap();

  const admin = Core_API.call({ action: 'auth.login', payload: { identificacao: 'admin', senha: 'almoxa123' } });
  const sessionAdmin = admin.data.sessionId;

  const produto = Core_API.call({ action: 'produto.create', sessionId: sessionAdmin, payload: { descricaoOriginal: 'Capacete teste reserva', codigo: 'CAP-RES' } });
  const produtoId = produto.data.ID;
  const localizacao = 'OBRA-TESTE/RESERVA';
  Core_API.call({ action: 'estoque.entry', sessionId: sessionAdmin, payload: { produtoId, localizacao, quantidade: 10 } });

  const usuarioA = Core_API.call({ action: 'loja.cadastro', payload: { nome: 'Reserva A', matricula: 'RES-A-' + Date.now(), senha: '1234' } });
  const usuarioB = Core_API.call({ action: 'loja.cadastro', payload: { nome: 'Reserva B', matricula: 'RES-B-' + Date.now(), senha: '1234' } });
  const sessionA = usuarioA.data.sessionId, sessionB = usuarioB.data.sessionId;

  const reserva = Core_API.call({ action: 'reserva.create', sessionId: sessionA, payload: { produtoId, localizacao, quantidade: 2 } });
  const reservaId = reserva.data.reserva.ID;

  const getInvasao = Core_API.call({ action: 'reserva.get', sessionId: sessionB, payload: { id: reservaId } });
  Logger.log('B TENTANDO VER RESERVA DE A (deve falhar): ' + JSON.stringify(getInvasao));

  const calendarB = Core_API.call({ action: 'reserva.calendar', sessionId: sessionB, payload: {} });
  Logger.log('B LISTANDO CALENDÁRIO (não deve conter a reserva de A): ' + JSON.stringify(calendarB));

  const cancelInvasao = Core_API.call({ action: 'reserva.cancel', sessionId: sessionB, payload: { id: reservaId } });
  Logger.log('B TENTANDO CANCELAR RESERVA DE A (deve falhar): ' + JSON.stringify(cancelInvasao));

  const cancelProprio = Core_API.call({ action: 'reserva.cancel', sessionId: sessionA, payload: { id: reservaId } });
  Logger.log('A CANCELANDO A PRÓPRIA RESERVA (deve funcionar, mesmo sendo OPERADOR): ' + JSON.stringify(cancelProprio));

  const passou =
    !getInvasao.success && getInvasao.code === CORE_CONSTANTS.RESPONSE_CODES.PERMISSION_DENIED &&
    calendarB.success && !calendarB.data.some(r => r.ID === reservaId) &&
    !cancelInvasao.success && cancelInvasao.code === CORE_CONSTANTS.RESPONSE_CODES.PERMISSION_DENIED &&
    cancelProprio.success && cancelProprio.data.status === 'CANCELADA';

  Logger.log('=== RESULTADO SEGURANÇA RESERVA: ' + (passou ? 'PASSOU' : 'FALHOU') + ' ===');
  SpreadsheetApp.getUi().alert('Teste Segurança Reservas (Fase 6 Front): ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌'));
  return { reserva, getInvasao, calendarB, cancelInvasao, cancelProprio, passou };
}
