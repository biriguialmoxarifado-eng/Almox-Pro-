/**
 * ============================================================
 * ALMOXA PRO — Core_Version.gs  (CAMADA 5)
 * Versionamento do sistema e de cada camada (seção 47).
 * ============================================================
 */

const Core_Version = (function () {
  const VERSIONS = {
    APP_VERSION: '2.0.0-skeleton',
    CORE_VERSION: '1.0.0',
    DB_VERSION: '1.0.0',
    API_VERSION: '1.0.0'
  };

  function get(key) { return VERSIONS[key] || null; }
  function getAll() { return Object.assign({}, VERSIONS); }

  return { get, getAll };
})();
