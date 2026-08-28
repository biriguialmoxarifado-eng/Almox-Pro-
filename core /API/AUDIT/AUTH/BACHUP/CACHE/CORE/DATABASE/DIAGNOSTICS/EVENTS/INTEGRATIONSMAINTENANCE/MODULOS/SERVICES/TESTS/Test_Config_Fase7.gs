/**
 * ============================================================
 * ALMOXA PRO — Test_Config_Fase7.gs
 * Confere: (1) só ADMIN edita config; (2) editar HOME_CARDS_CONFIG
 * grava JSON válido e reflete de fato; (3) identidade da loja é
 * lida sem sessão (rota pública loja.config) e reflete edição.
 * ============================================================
 */

function Test_Config_Fase7_fluxoCompleto() {
  Core_API.bootstrap();

  const admin = Core_API.call({ action: 'auth.login', payload: { identificacao: 'admin', senha: 'almoxa123' } });
  const sessionAdmin = admin.data.sessionId;

  const operador = Core_API.call({ action: 'loja.cadastro', payload: { nome: 'Config Op', matricula: 'CFG-' + Date.now(), senha: '1234' } });
  const sessionOp = operador.data.sessionId;

  const updateNegado = Core_API.call({ action: 'config.update', sessionId: sessionOp, payload: { chave: 'STORE_WELCOME_TITLE', valor: 'Hackeado' } });
  Logger.log('OPERADOR TENTANDO EDITAR CONFIG (deve falhar): ' + JSON.stringify(updateNegado));

  const updateOk = Core_API.call({ action: 'config.update', sessionId: sessionAdmin, payload: { chave: 'STORE_WELCOME_TITLE', valor: 'Bem-vindo à Obra Teste' } });
  Logger.log('ADMIN EDITANDO (deve funcionar): ' + JSON.stringify(updateOk));

  const lojaConfig = Core_API.call({ action: 'loja.config', payload: {} });
  Logger.log('LOJA CONFIG PÚBLICA APÓS EDIÇÃO: ' + JSON.stringify(lojaConfig));

  const cardsAtuais = JSON.parse(Core_API.call({ action: 'config.get', sessionId: sessionAdmin, payload: { chave: 'HOME_CARDS_CONFIG' } }).data.valor);
  cardsAtuais.find(c => c.id === 'carrinho').visible = false;
  const salvarCards = Core_API.call({ action: 'config.update', sessionId: sessionAdmin, payload: { chave: 'HOME_CARDS_CONFIG', valor: JSON.stringify(cardsAtuais) } });
  Logger.log('SALVANDO CARDS (carrinho oculto): ' + JSON.stringify(salvarCards));

  const cardsDepois = JSON.parse(Core_API.call({ action: 'config.get', sessionId: sessionAdmin, payload: { chave: 'HOME_CARDS_CONFIG' } }).data.valor);
  const carrinhoOculto = cardsDepois.find(c => c.id === 'carrinho').visible === false;

  const passou =
    !updateNegado.success && updateNegado.code === CORE_CONSTANTS.RESPONSE_CODES.PERMISSION_DENIED &&
    updateOk.success &&
    lojaConfig.success && lojaConfig.data.welcomeTitle === 'Bem-vindo à Obra Teste' &&
    salvarCards.success && carrinhoOculto;

  Logger.log('=== RESULTADO CONFIG FASE 7: ' + (passou ? 'PASSOU' : 'FALHOU') + ' ===');
  SpreadsheetApp.getUi().alert('Teste Configuração (Fase 7 Front): ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌'));

  // limpeza — devolve o card de carrinho pro estado padrão
  cardsDepois.find(c => c.id === 'carrinho').visible = true;
  Core_API.call({ action: 'config.update', sessionId: sessionAdmin, payload: { chave: 'HOME_CARDS_CONFIG', valor: JSON.stringify(cardsDepois) } });

  return { updateNegado, updateOk, lojaConfig, salvarCards, passou };
}
