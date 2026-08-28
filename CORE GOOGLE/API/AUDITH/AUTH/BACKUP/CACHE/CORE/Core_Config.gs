/**
 * ============================================================
 * ALMOXA PRO — Core_Config.gs  (CAMADA 1)
 * Configuração central. Nenhum ID, chave ou URL deve viver
 * espalhado pelo código — tudo é lido/gravado por aqui.
 * ============================================================
 */

const Core_Config = (function () {

  const DEFAULTS = {
    APP_NAME: 'ALMOXA PRO',
    APP_VERSION: '2.0.0-skeleton',
    ENVIRONMENT: CORE_CONSTANTS.ENVIRONMENTS.DEV,
    MAINTENANCE_MODE: false,
    DEBUG_MODE: true,
    MOCK_MODE: false,

    SPREADSHEET_ID: '',
    DRIVE_FOLDER_ID: '',
    DRIVE_FOLDER_NF: '',
    DRIVE_FOLDER_BACKUP: '',
    DRIVE_FOLDER_DOCS: '',

    API_BASE_URL: '',
    SESSION_DURATION_MIN: 480,
    LOCK_TIMEOUT_MS: CORE_CONSTANTS.LOCK_TIMEOUT_MS,
    CACHE_DEFAULT_TTL_SEC: 600,

    // Integrações (ver /INTEGRATIONS) — chaves ficam vazias até
    // serem configuradas de verdade; nenhuma integração deve se
    // declarar "ativa" com chave vazia (ver Doctor_Core).
    OCR_PROVIDER: 'NONE',
    OCR_API_KEY: '',
    SAP_IMPORT_FOLDER_ID: '',
    BIOMETRIC_PROVIDER: 'DEVICE_SECRET',
    EMAIL_NOTIFICATIONS_ENABLED: true,

    LOG_LEVEL: 'INFO'
  };

  function _props() { return PropertiesService.getScriptProperties(); }

  function get(key) {
    const val = _props().getProperty(key);
    if (val === null || val === undefined) {
      return DEFAULTS.hasOwnProperty(key) ? DEFAULTS[key] : null;
    }
    if (val === 'true') return true;
    if (val === 'false') return false;
    if (!isNaN(val) && val.trim() !== '') return Number(val);
    return val;
  }

  function set(key, value) {
    _props().setProperty(key, String(value));
    return get(key);
  }

  function getAll() {
    const out = Object.assign({}, DEFAULTS);
    const stored = _props().getProperties();
    Object.keys(stored).forEach(k => out[k] = get(k));
    return out;
  }

  function ensureBootstrap() {
    const current = _props().getProperties();
    Object.keys(DEFAULTS).forEach(key => {
      if (!(key in current)) _props().setProperty(key, String(DEFAULTS[key]));
    });
  }

  function isProd() { return get('ENVIRONMENT') === CORE_CONSTANTS.ENVIRONMENTS.PROD; }
  function isMaintenance() { return get('MAINTENANCE_MODE') === true; }

  return { get, set, getAll, ensureBootstrap, isProd, isMaintenance };
})();
