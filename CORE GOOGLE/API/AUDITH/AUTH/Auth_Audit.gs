/**
 * ============================================================
 * ALMOXA PRO — Auth_Audit.gs  (CAMADA 3)
 * Conveniência: eventos de autenticação com nomenclatura fixa,
 * delegando sempre para Audit_Service (não duplica auditoria).
 * ============================================================
 */

const Auth_Audit = (function () {

  function loginSuccess(ctx, userId) { Audit_Service.record(ctx, 'USUARIO_LOGIN', { userId }); }
  function loginFailed(ctx, identificacao) { Audit_Service.record(ctx, 'LOGIN_FAILED', { identificacao }); }
  function logout(ctx, userId) { Audit_Service.record(ctx, 'USUARIO_LOGOUT', { userId }); }
  function accessDenied(ctx, action) { Audit_Service.record(ctx, 'ACCESS_DENIED', { action }); }

  return { loginSuccess, loginFailed, logout, accessDenied };
})();
