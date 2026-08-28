/**
 * ============================================================
 * ALMOXA PRO — Cache_Core.gs  (CAMADA 4)
 * Wrapper fino sobre CacheService (seção 40). Nunca usado como
 * fonte de verdade — só para reduzir leitura repetida de Sheets.
 * ============================================================
 */

const Cache_Core = (function () {

  function _cache() { return CacheService.getScriptCache(); }

  function get(key) {
    const raw = _cache().get(key);
    return raw ? JSON.parse(raw) : null;
  }

  function set(key, value, ttlSec) {
    _cache().put(key, JSON.stringify(value), ttlSec || Core_Config.get('CACHE_DEFAULT_TTL_SEC'));
  }

  function remove(key) { _cache().remove(key); }

  return { get, set, remove };
})();
