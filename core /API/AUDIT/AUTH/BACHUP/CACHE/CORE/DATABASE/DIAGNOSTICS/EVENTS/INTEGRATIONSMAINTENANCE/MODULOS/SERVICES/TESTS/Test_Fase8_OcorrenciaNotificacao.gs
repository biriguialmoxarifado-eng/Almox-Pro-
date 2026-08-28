/**
 * ============================================================
 * ALMOXA PRO — Test_Fase8_OcorrenciaNotificacao.gs
 * Fluxo: cria ocorrência URGENTE (deve notificar admin
 * automaticamente) → confere notificação in-app → define
 * estoque mínimo → entra com saldo abaixo do mínimo → roda
 * gatilho de estoque crítico manualmente → confere notificação.
 * ============================================================
 */

function Test_Fase8_fluxoCompleto() {
  Core_API.bootstrap();

  const login = Core_API.call({ action: 'auth.login', payload: { identificacao: 'admin', senha: 'almoxa123' } });
  if (!login.success) { Logger.log('LOGIN FALHOU'); return login; }
  const sessionId = login.data.sessionId;
  const adminUserId = login.data.userId;

  // ---- Ocorrência urgente → notificação automática ----
  const ocorrencia = Core_API.call({
    action: 'ocorrencia.create', sessionId,
    payload: { tipo: 'ACIDENTE', prioridade: 'URGENTE', descricao: 'Vazamento de produto químico no depósito.' }
  });
  Logger.log('OCORRÊNCIA: ' + JSON.stringify(ocorrencia));

  const notificacoes1 = Core_API.call({ action: 'notificacao.list', sessionId, payload: { destinatario: adminUserId } });
  Logger.log('NOTIFICAÇÕES APÓS OCORRÊNCIA (deve ter pelo menos 1): ' + JSON.stringify(notificacoes1));

  // ---- Estoque crítico via gatilho ----
  const produto = Core_API.call({ action: 'produto.create', sessionId, payload: { descricaoOriginal: 'Cal hidratada 20kg', codigo: 'CAL-20' } });
  const produtoId = produto.data.ID;
  const localizacao = 'OBRA-TESTE/DEPOSITO-CAL';

  Core_API.call({ action: 'estoque.entry', sessionId, payload: { produtoId, localizacao, quantidade: 3 } });
  const minimo = Core_API.call({ action: 'estoque.setMinimo', sessionId, payload: { produtoId, localizacao, estoqueMinimo: 10 } });
  Logger.log('MÍNIMO DEFINIDO (saldo=3, minimo=10 → crítico): ' + JSON.stringify(minimo));

  const totalCriticos = Gatilho_VerificarEstoqueCritico();
  Logger.log('GATILHO ESTOQUE CRÍTICO — total notificado: ' + totalCriticos);

  const notificacoes2 = Core_API.call({ action: 'notificacao.list', sessionId, payload: { destinatario: adminUserId } });
  Logger.log('NOTIFICAÇÕES APÓS GATILHO (deve ter aumentado): ' + JSON.stringify(notificacoes2));

  // Marca a primeira como lida
  let leitura = null;
  if (notificacoes2.success && notificacoes2.data.length) {
    leitura = Core_API.call({ action: 'notificacao.read', sessionId, payload: { id: notificacoes2.data[0].ID } });
    Logger.log('MARCAR COMO LIDA: ' + JSON.stringify(leitura));
  }

  const passou =
    ocorrencia.success &&
    notificacoes1.success && notificacoes1.data.length >= 1 &&
    minimo.success &&
    totalCriticos >= 1 &&
    notificacoes2.success && notificacoes2.data.length > notificacoes1.data.length &&
    leitura && leitura.success && leitura.data.lida === true;

  Logger.log('=== RESULTADO FASE 8: ' + (passou ? 'PASSOU' : 'FALHOU') + ' ===');
  SpreadsheetApp.getUi().alert('Teste Fase 8 (Ocorrências/Notificações): ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌') + ' — log completo em Ver → Registros de execução.');
  return { login, ocorrencia, notificacoes1, minimo, totalCriticos, notificacoes2, leitura, passou };
}
