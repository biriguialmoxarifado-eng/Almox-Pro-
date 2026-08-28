/**
 * ============================================================
 * ALMOXA PRO — Test_IdentityService.gs
 * FASE 3 (V3) DO FRONT MOBILE.
 * ============================================================
 */

function Test_IdentityService_fluxoCompleto() {
  Core_API.bootstrap();

  const matriculaTeste = 'IDT-' + new Date().getTime();
  const cadastro = Core_API.call({
    action: 'loja.cadastro', payload: { nome: 'Teste Identidade', matricula: matriculaTeste, senha: '1234' }
  });
  if (!cadastro.success) { Logger.log('CADASTRO FALHOU: ' + JSON.stringify(cadastro)); return cadastro; }
  const sessionId = cadastro.data.sessionId;
  const userId = cadastro.data.userId;

  const contexto = Core_API.call({ action: 'identidade.contexto', sessionId, payload: {} });
  Logger.log('IDENTITY CONTEXT: ' + JSON.stringify(contexto));

  // Sem sessão, a rota deve continuar bloqueada (não é pública)
  const contextoSemSessao = Core_API.call({ action: 'identidade.contexto', payload: {} });
  Logger.log('IDENTITY CONTEXT SEM SESSÃO (deve falhar): ' + JSON.stringify(contextoSemSessao));

  const passou =
    contexto.success &&
    String(contexto.data.userId) === String(userId) &&
    String(contexto.data.identityId) === String(userId) && // seção 3: hoje identityId = userId
    contexto.data.profileId === CORE_CONSTANTS.PERFIS.OPERADOR &&
    contexto.data.authMethod === 'MATRICULA_SENHA' &&
    contexto.data.signatureReference === null && // seção 10: nunca inventado
    contexto.data.biometricReference === null && // usuário recém-criado, sem biometria ainda
    !contextoSemSessao.success && contextoSemSessao.code === CORE_CONSTANTS.RESPONSE_CODES.SESSION_EXPIRED;

  Logger.log('=== RESULTADO IDENTITY SERVICE: ' + (passou ? 'PASSOU' : 'FALHOU') + ' ===');
  SpreadsheetApp.getUi().alert('Teste Identidade Central (Fase 3 V3): ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌'));
  return { cadastro, contexto, contextoSemSessao, passou };
}
