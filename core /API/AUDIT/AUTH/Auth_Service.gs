/**
 * ============================================================
 * ALMOXA PRO — Auth_Service.gs  (CAMADA 3)
 * Serviço de autenticação. Login por matrícula/e-mail + senha
 * (biometria entra via Auth_Biometric, como fator adicional).
 * ============================================================
 */

const Auth_Service = (function () {

  const MODULE_ID = 'AUTH';

  function login(ctx) {
    const { identificacao, senha } = ctx.payload || {};
    if (!identificacao || !senha) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'Informe usuário e senha.', {}, ctx.requestId);
    }

    const user = DB_Query.findOne('USUARIOS', u =>
      (u.email === identificacao || u.matricula === identificacao) && u.status === 'ATIVO'
    );

    if (!user) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.AUTH_INVALID, 'Usuário não encontrado ou inativo.', {}, ctx.requestId);
    }
    if (!Auth_Tokens.verify(senha, user.senha_hash)) {
      Audit_Service.record(ctx, 'LOGIN_FAILED', { identificacao: identificacao });
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.AUTH_INVALID, 'Usuário ou senha inválidos.', {}, ctx.requestId);
    }

    DB_Update.byId('USUARIOS', user.ID, { ultimoAcesso: new Date() });

    const session = Auth_Session.create({
      userId: user.ID, email: user.email, nome: user.nome,
      perfil: user.perfil, obraAtual: user.obraAtual
    });

    Audit_Service.record(ctx, 'LOGIN_SUCCESS', { userId: user.ID });
    return Core_Response.ok(session, 'Login realizado.', CORE_CONSTANTS.RESPONSE_CODES.SUCCESS, {}, ctx.requestId);
  }

  function logout(ctx) {
    Auth_Session.destroy(ctx.sessionId);
    Audit_Service.record(ctx, 'LOGOUT', {});
    return Core_Response.ok(null, 'Sessão encerrada.', CORE_CONSTANTS.RESPONSE_CODES.SUCCESS, {}, ctx.requestId);
  }

  function session(ctx) {
    const result = Auth_Session.validate(ctx.sessionId);
    return result.success
      ? Core_Response.ok(result.data, '', CORE_CONSTANTS.RESPONSE_CODES.SUCCESS, {}, ctx.requestId)
      : Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.SESSION_EXPIRED, result.message, {}, ctx.requestId);
  }

  function permissions(ctx) {
    const sessionResult = Auth_Session.validate(ctx.sessionId);
    if (!sessionResult.success) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.SESSION_EXPIRED, sessionResult.message, {}, ctx.requestId);
    }
    return Core_Response.ok(Auth_Permissions.getEffectivePermissions(sessionResult.data.perfil), '', CORE_CONSTANTS.RESPONSE_CODES.SUCCESS, {}, ctx.requestId);
  }

  // ---- Contrato de módulo (seção 63) ----
  function getRoutes() {
    return {
      'auth.login': login,
      'auth.logout': logout,
      'auth.session': session,
      'auth.permissions': permissions
    };
  }
  function getServices() { return { Auth_Service }; }
  function getEvents() { return ['USUARIO_LOGIN', 'USUARIO_LOGOUT']; }
  function getVersion() { return '1.0.0'; }
  function init() { /* nada a inicializar nesta fase */ }
  function healthCheck() {
    return { status: CORE_CONSTANTS.DOCTOR_STATUS.OK };
  }

  return {
    login, logout, session, permissions,
    getRoutes, getServices, getEvents, getVersion, init, healthCheck,
    id: MODULE_ID
  };
})();
