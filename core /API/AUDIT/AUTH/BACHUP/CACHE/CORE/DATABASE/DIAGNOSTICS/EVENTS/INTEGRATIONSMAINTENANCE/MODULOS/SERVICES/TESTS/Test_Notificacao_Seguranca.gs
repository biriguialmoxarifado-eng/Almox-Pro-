/**
 * ============================================================
 * ALMOXA PRO — Test_Notificacao_Seguranca.gs
 * FASE 4 DO FRONT MOBILE — confirma a correção dos 2 bugs.
 * ============================================================
 */

function Test_Notificacao_Seguranca_fluxoCompleto() {
  Core_API.bootstrap();

  const usuarioA = Core_API.call({ action: 'loja.cadastro', payload: { nome: 'Usuário A', matricula: 'NOTIF-A-' + Date.now(), senha: '1234' } });
  const usuarioB = Core_API.call({ action: 'loja.cadastro', payload: { nome: 'Usuário B', matricula: 'NOTIF-B-' + Date.now(), senha: '1234' } });
  const sessionA = usuarioA.data.sessionId, userIdA = usuarioA.data.userId;
  const sessionB = usuarioB.data.sessionId, userIdB = usuarioB.data.userId;

  // Login admin pra enviar notificação de teste pro Usuário A
  const admin = Core_API.call({ action: 'auth.login', payload: { identificacao: 'admin', senha: 'almoxa123' } });
  const envio = Core_API.call({
    action: 'notificacao.send', sessionId: admin.data.sessionId,
    payload: { destinatario: userIdA, titulo: 'Teste', mensagem: 'Notificação de teste para A' }
  });
  const notifId = envio.data.ID;

  // Usuário B tenta ler notificações de A passando destinatario no payload
  const listVazamento = Core_API.call({ action: 'notificacao.list', sessionId: sessionB, payload: { destinatario: userIdA } });
  Logger.log('B TENTANDO LISTAR NOTIFICAÇÕES DE A (deve devolver vazio, não vazar): ' + JSON.stringify(listVazamento));

  // Usuário B tenta marcar como lida uma notificação que é de A
  const readInvasao = Core_API.call({ action: 'notificacao.read', sessionId: sessionB, payload: { id: notifId } });
  Logger.log('B TENTANDO MARCAR COMO LIDA NOTIFICAÇÃO DE A (deve falhar): ' + JSON.stringify(readInvasao));

  // Usuário A lendo a própria notificação (deve funcionar mesmo sendo OPERADOR)
  const readProprio = Core_API.call({ action: 'notificacao.read', sessionId: sessionA, payload: { id: notifId } });
  Logger.log('A MARCANDO A PRÓPRIA COMO LIDA (deve funcionar, mesmo sendo OPERADOR): ' + JSON.stringify(readProprio));

  const passou =
    listVazamento.success && listVazamento.data.length === 0 && // B não recebeu nada de A
    !readInvasao.success && readInvasao.code === CORE_CONSTANTS.RESPONSE_CODES.PERMISSION_DENIED &&
    readProprio.success && readProprio.data.lida === true;

  Logger.log('=== RESULTADO SEGURANÇA NOTIFICAÇÃO: ' + (passou ? 'PASSOU' : 'FALHOU') + ' ===');
  SpreadsheetApp.getUi().alert('Teste Segurança Notificações (Fase 4 Front): ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌'));
  return { usuarioA, usuarioB, envio, listVazamento, readInvasao, readProprio, passou };
}
