/**
 * ============================================================
 * ALMOXA PRO — Test_Solicitacao_fluxoCompleto.gs
 * FASE 6 DO FRONT MOBILE.
 * Fluxo: cria produto+estoque → funcionário (OPERADOR) cria
 * solicitação → gestor aprova → almoxarife separa → almoxarife
 * conclui (baixa real de estoque) → confere notificações geradas.
 * ============================================================
 */

function Test_Solicitacao_fluxoCompleto() {
  Core_API.bootstrap();

  const admin = Core_API.call({ action: 'auth.login', payload: { identificacao: 'admin', senha: 'almoxa123' } });
  const sessionAdmin = admin.data.sessionId;

  const produto = Core_API.call({ action: 'produto.create', sessionId: sessionAdmin, payload: { descricaoOriginal: 'Luva de raspa', codigo: 'LUVA-01', categoria: 'EPI' } });
  const produtoId = produto.data.ID;
  const localizacao = 'OBRA-TESTE/DEPOSITO-EPI';
  Core_API.call({ action: 'estoque.entry', sessionId: sessionAdmin, payload: { produtoId, localizacao, quantidade: 20 } });

  // Funcionário se autocadastra (OPERADOR) e faz a solicitação
  const funcionario = Core_API.call({ action: 'loja.cadastro', payload: { nome: 'Funcionário Solic', matricula: 'SOLIC-' + Date.now(), senha: '1234' } });
  const sessionFunc = funcionario.data.sessionId;

  const criar = Core_API.call({
    action: 'solicitacao.criar', sessionId: sessionFunc,
    payload: { itens: [{ produtoId, quantidade: 3 }], observacao: 'Preciso pra amanhã' }
  });
  Logger.log('SOLICITAÇÃO CRIADA: ' + JSON.stringify(criar));
  if (!criar.success) return criar;
  const solicitacaoId = criar.data.solicitacao.ID;

  // OPERADOR não pode aprovar a própria solicitação
  const aprovarNegado = Core_API.call({ action: 'solicitacao.aprovar', sessionId: sessionFunc, payload: { id: solicitacaoId } });
  Logger.log('OPERADOR TENTANDO APROVAR (deve falhar): ' + JSON.stringify(aprovarNegado));

  // Admin aprova (tem permissão de GESTOR/ADMIN)
  const aprovar = Core_API.call({ action: 'solicitacao.aprovar', sessionId: sessionAdmin, payload: { id: solicitacaoId } });
  Logger.log('APROVAÇÃO: ' + JSON.stringify(aprovar));

  const separar = Core_API.call({ action: 'solicitacao.separar', sessionId: sessionAdmin, payload: { id: solicitacaoId } });
  Logger.log('SEPARAÇÃO: ' + JSON.stringify(separar));

  const concluir = Core_API.call({ action: 'solicitacao.concluir', sessionId: sessionAdmin, payload: { id: solicitacaoId, localizacaoSaida: localizacao } });
  Logger.log('CONCLUSÃO (deve baixar estoque de verdade): ' + JSON.stringify(concluir));

  const saldoFinal = Core_API.call({ action: 'estoque.get', sessionId: sessionAdmin, payload: { produtoId, localizacao } });
  Logger.log('SALDO FINAL (esperado 17): ' + JSON.stringify(saldoFinal));

  const notificacoesFunc = Core_API.call({ action: 'notificacao.list', sessionId: sessionFunc, payload: {} });
  Logger.log('NOTIFICAÇÕES DO FUNCIONÁRIO (deve ter aprovação + conclusão): ' + JSON.stringify(notificacoesFunc));

  const minhasSolicitacoes = Core_API.call({ action: 'solicitacao.list', sessionId: sessionFunc, payload: {} });
  Logger.log('MINHAS SOLICITAÇÕES: ' + JSON.stringify(minhasSolicitacoes));

  const passou =
    criar.success &&
    !aprovarNegado.success && aprovarNegado.code === CORE_CONSTANTS.RESPONSE_CODES.PERMISSION_DENIED &&
    aprovar.success && aprovar.data.status === 'APROVADA' &&
    separar.success && separar.data.status === 'EM_SEPARACAO' &&
    concluir.success && concluir.data.status === 'CONCLUIDA' && concluir.data.entregues === 1 &&
    saldoFinal.success && saldoFinal.data.saldo === 17 &&
    notificacoesFunc.success && notificacoesFunc.data.length >= 2 &&
    minhasSolicitacoes.success && minhasSolicitacoes.data.length === 1;

  Logger.log('=== RESULTADO SOLICITAÇÃO: ' + (passou ? 'PASSOU' : 'FALHOU') + ' ===');
  SpreadsheetApp.getUi().alert('Teste Solicitações (Fase 6 Front): ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌'));
  return { criar, aprovarNegado, aprovar, separar, concluir, saldoFinal, notificacoesFunc, minhasSolicitacoes, passou };
}
