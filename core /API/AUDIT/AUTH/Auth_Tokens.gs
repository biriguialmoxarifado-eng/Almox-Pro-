/**
 * ============================================================
 * ALMOXA PRO — Auth_Tokens.gs  (CAMADA 3)
 * Geração/verificação de hash de senha e tokens diversos.
 * Nenhuma senha em texto puro é armazenada ou logada.
 * ============================================================
 */

const Auth_Tokens = (function () {

  function hash(text) {
    const raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text);
    return raw.map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, '0')).join('');
  }

  function verify(text, hashed) { return hash(text) === hashed; }

  function generateToken() { return Utilities.getUuid(); }

  /** Token de recuperação de senha com expiração curta (via Cache). */
  function generateRecoveryToken(userId) {
    const token = Utilities.getUuid();
    CacheService.getScriptCache().put('RECOVERY_' + token, String(userId), 900); // 15 min
    return token;
  }

  function consumeRecoveryToken(token) {
    const key = 'RECOVERY_' + token;
    const userId = CacheService.getScriptCache().get(key);
    if (userId) CacheService.getScriptCache().remove(key);
    return userId;
  }

  return { hash, verify, generateToken, generateRecoveryToken, consumeRecoveryToken };
})();
