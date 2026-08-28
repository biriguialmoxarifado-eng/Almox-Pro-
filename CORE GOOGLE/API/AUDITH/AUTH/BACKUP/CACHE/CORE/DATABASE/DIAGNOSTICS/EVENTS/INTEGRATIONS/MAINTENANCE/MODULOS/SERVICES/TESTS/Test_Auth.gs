/**
 * ============================================================
 * ALMOXA PRO — Test_Auth.gs
 * ============================================================
 */
function Test_Auth_hashConsistente() {
  const h1 = Auth_Tokens.hash('teste123');
  const h2 = Auth_Tokens.hash('teste123');
  const ok = h1 === h2 && h1.length === 64;
  Logger.log('Test_Auth_hashConsistente: ' + (ok ? 'PASSOU' : 'FALHOU'));
  return ok;
}

function Test_Auth_loginInvalido() {
  Core_API.bootstrap();
  const result = Core_API.call({ action: 'auth.login', payload: { identificacao: 'nao_existe', senha: 'x' } });
  const ok = result.success === false && result.code === CORE_CONSTANTS.RESPONSE_CODES.AUTH_INVALID;
  Logger.log('Test_Auth_loginInvalido: ' + (ok ? 'PASSOU' : 'FALHOU') + ' — ' + JSON.stringify(result));
  return ok;
}
