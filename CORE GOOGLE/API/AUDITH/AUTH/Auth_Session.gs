/**
 * ============================================================
 * ALMOXA PRO — Auth_Session.gs  (CAMADA 3)
 * Sessão via CacheService (efêmera por natureza).
 * ============================================================
 */

const Auth_Session = (function () {

  const PREFIX = 'ALMOXA_SESSION_';

  function _cache() { return CacheService.getScriptCache(); }
  function _ttl() { return Math.min(Core_Config.get('SESSION_DURATION_MIN') * 60, 21600); }

  function create(user) {
    const sessionId = Utilities.getUuid();
    const payload = {
      sessionId: sessionId,
      userId: user.userId,
      email: user.email,
      nome: user.nome,
      perfil: user.perfil,
      obraAtual: user.obraAtual || null,
      createdAt: new Date().toISOString()
    };
    _cache().put(PREFIX + sessionId, JSON.stringify(payload), _ttl());
    return payload;
  }

  function validate(sessionId) {
    if (!sessionId) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.SESSION_EXPIRED, 'sessionId ausente.');
    }
    const raw = _cache().get(PREFIX + sessionId);
    if (!raw) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.SESSION_EXPIRED, 'Sessão expirada ou inexistente.');
    }
    return Core_Response.ok(JSON.parse(raw));
  }

  function destroy(sessionId) { _cache().remove(PREFIX + sessionId); }

  function currentUserEmailSafe() {
    try { return Session.getActiveUser().getEmail() || 'sistema'; }
    catch (e) { return 'sistema'; }
  }

  return { create, validate, destroy, currentUserEmailSafe };
})();
