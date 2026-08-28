/**
 * ============================================================
 * ALMOXA PRO — Test_RouterAPI.gs
 * Simula uma requisição completa sem precisar de HTTP real —
 * roda direto no editor do Apps Script. Use isso para testar
 * qualquer rota nova sem publicar Web App.
 * ============================================================
 */

function Test_RouterAPI_simulate(action, payload, sessionId) {
  Core_API.bootstrap();
  const request = {
    action: action,
    requestId: Utilities.getUuid(),
    sessionId: sessionId || null,
    payload: payload || {}
  };
  const result = Core_API.call(request);
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

/** Fluxo completo: login -> chamar rota protegida -> logout. */
function Test_RouterAPI_fluxoCompleto() {
  Core_API.bootstrap();

  const login = Core_API.call({ action: 'auth.login', payload: { identificacao: 'admin', senha: 'almoxa123' } });
  Logger.log('LOGIN: ' + JSON.stringify(login));
  if (!login.success) return login;

  const sessionId = login.data.sessionId;

  const dashboard = Core_API.call({ action: 'dashboard.get', sessionId: sessionId, payload: {} });
  Logger.log('DASHBOARD: ' + JSON.stringify(dashboard));

  const logout = Core_API.call({ action: 'auth.logout', sessionId: sessionId, payload: {} });
  Logger.log('LOGOUT: ' + JSON.stringify(logout));

  return { login, dashboard, logout };
}
