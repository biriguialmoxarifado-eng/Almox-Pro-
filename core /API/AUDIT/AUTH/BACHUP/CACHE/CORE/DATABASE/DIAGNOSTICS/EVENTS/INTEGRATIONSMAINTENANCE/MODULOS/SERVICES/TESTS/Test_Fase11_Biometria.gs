/**
 * ============================================================
 * ALMOXA PRO — Test_Fase11_Biometria.gs
 * Fluxo: registra biometria do admin (deviceSecret simulando o
 * que o app mobile geraria após Face ID/digital) → verifica com
 * segredo certo (deve passar) → verifica com segredo errado
 * (deve falhar) → identifica 1:N pelo segredo → remove.
 * Também confere que um segredo curto (senha fraca disfarçada
 * de "biometria") é rejeitado.
 * ============================================================
 */

function Test_Fase11_fluxoCompleto() {
  Core_API.bootstrap();

  const login = Core_API.call({ action: 'auth.login', payload: { identificacao: 'admin', senha: 'almoxa123' } });
  if (!login.success) { Logger.log('LOGIN FALHOU'); return login; }
  const sessionId = login.data.sessionId;
  const userId = login.data.userId;

  // Simula o segredo que o app geraria (aleatório, longo) após o
  // desbloqueio biométrico nativo do aparelho — NUNCA é a senha
  // do usuário digitada.
  const deviceSecretCorreto = Utilities.getUuid() + Utilities.getUuid();
  const deviceSecretErrado = Utilities.getUuid() + Utilities.getUuid();

  const segredoFraco = Core_API.call({
    action: 'biometria.register', sessionId,
    payload: { consentimento: true, deviceSecret: '12345' }
  });
  Logger.log('SEGREDO FRACO (deve rejeitar): ' + JSON.stringify(segredoFraco));

  const semConsentimento = Core_API.call({
    action: 'biometria.register', sessionId,
    payload: { deviceSecret: deviceSecretCorreto }
  });
  Logger.log('SEM CONSENTIMENTO (deve rejeitar): ' + JSON.stringify(semConsentimento));

  const registro = Core_API.call({
    action: 'biometria.register', sessionId,
    payload: { consentimento: true, deviceSecret: deviceSecretCorreto }
  });
  Logger.log('REGISTRO: ' + JSON.stringify(registro));

  const verificaCerta = Core_API.call({ action: 'biometria.verify', sessionId, payload: { deviceSecret: deviceSecretCorreto } });
  Logger.log('VERIFICAÇÃO COM SEGREDO CERTO (deve passar): ' + JSON.stringify(verificaCerta));

  const verificaErrada = Core_API.call({ action: 'biometria.verify', sessionId, payload: { deviceSecret: deviceSecretErrado } });
  Logger.log('VERIFICAÇÃO COM SEGREDO ERRADO (deve falhar): ' + JSON.stringify(verificaErrada));

  const identificacao = Core_API.call({ action: 'biometria.identify', sessionId, payload: { deviceSecret: deviceSecretCorreto } });
  Logger.log('IDENTIFICAÇÃO 1:N (deve achar o admin): ' + JSON.stringify(identificacao));

  const statusAntes = Core_API.call({ action: 'biometria.status', sessionId, payload: {} });
  Logger.log('STATUS ANTES DE REMOVER: ' + JSON.stringify(statusAntes));

  const remocao = Core_API.call({ action: 'biometria.delete', sessionId, payload: {} });
  Logger.log('REMOÇÃO: ' + JSON.stringify(remocao));

  const verificaAposRemocao = Core_API.call({ action: 'biometria.verify', sessionId, payload: { deviceSecret: deviceSecretCorreto } });
  Logger.log('VERIFICAÇÃO APÓS REMOÇÃO (deve falhar): ' + JSON.stringify(verificaAposRemocao));

  const passou =
    !segredoFraco.success &&
    !semConsentimento.success &&
    registro.success &&
    verificaCerta.success && verificaCerta.data.verificado === true &&
    verificaErrada.success && verificaErrada.data.verificado === false &&
    identificacao.success && identificacao.data.encontrado === true && String(identificacao.data.userId) === String(userId) &&
    statusAntes.data.cadastro.ativo === true &&
    remocao.success && remocao.data.removido === true &&
    verificaAposRemocao.success && verificaAposRemocao.data.verificado === false;

  Logger.log('=== RESULTADO FASE 11: ' + (passou ? 'PASSOU' : 'FALHOU') + ' ===');
  SpreadsheetApp.getUi().alert('Teste Fase 11 (Biometria): ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌') + ' — log completo em Ver → Registros de execução.');
  return { login, segredoFraco, semConsentimento, registro, verificaCerta, verificaErrada, identificacao, statusAntes, remocao, verificaAposRemocao, passou };
}
