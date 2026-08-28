/**
 * ============================================================
 * ALMOXA PRO — Cache_Manager.gs  (CAMADA 4)
 * Invalidação de cache por módulo (Cache.clearModule). Cada
 * módulo registra suas próprias chaves de cache para poder ser
 * limpo em bloco sem precisar saber os nomes exatos.
 * ============================================================
 */

const Cache_Manager = (function () {

  const _keysByModule = {}; // moduleId -> [keys]

  function trackKey(moduleId, key) {
    if (!_keysByModule[moduleId]) _keysByModule[moduleId] = [];
    if (!_keysByModule[moduleId].includes(key)) _keysByModule[moduleId].push(key);
  }

  function clearModule(moduleId) {
    const keys = _keysByModule[moduleId] || [];
    keys.forEach(k => Cache_Core.remove(k));
    _keysByModule[moduleId] = [];
    return keys.length;
  }

  function clearAll() {
    Object.keys(_keysByModule).forEach(clearModule);
  }

  return { trackKey, clearModule, clearAll };
})();
