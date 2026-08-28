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

    LOG_LEVEL: 'INFO',

    // ---- Lojinha (Front Mobile — seção 7 da spec) ----
    STORE_BANNER_URL: '',
    STORE_WELCOME_TITLE: 'Bem-vindo ao ALMOXA PRO',
    STORE_WELCOME_SUBTITLE: 'Solicite materiais de forma rápida e segura.',

    // ---- FASE 7 (Front Mobile) — Cards da Home e Módulos do
    // Menu, configuráveis pelo ADMIN (antes eram fixos no código
    // do Front — seção 23/30/59/60 do doc de telas). Os defaults
    // abaixo reproduzem EXATAMENTE o comportamento das fases
    // anteriores, então nenhuma instalação existente muda de
    // aparência até o admin editar algo de propósito.
    HOME_CARDS_CONFIG: JSON.stringify([
      { id: 'notificacoes', icon: '🔔', title: 'Notificações', route: '/notificacoes', visible: true, order: 1, profiles: null },
      { id: 'carrinho', icon: '🛒', title: 'Seu carrinho', route: '/carrinho', visible: true, order: 2, profiles: null },
      { id: 'perfil', icon: '👤', title: 'Meu perfil', route: '/perfil', visible: true, order: 3, profiles: null },
      { id: 'solicitacoes', icon: '📋', title: 'Solicitações', route: '/solicitacoes', visible: true, order: 4, profiles: null }
    ]),
    MENU_MODULES_CONFIG: JSON.stringify([
      { id: 'solicitacoes', icon: '📋', label: 'Solicitações', route: '/solicitacoes', visible: true, order: 1, profiles: null },
      { id: 'reservas', icon: '📅', label: 'Reservas', route: '/reservas', visible: true, order: 2, profiles: null },
      { id: 'estoque', icon: '📦', label: 'Consultar Estoque', route: '/estoque', visible: true, order: 3, profiles: ['ALMOXARIFE', 'GESTOR', 'ADMIN'] },
      { id: 'relatorios', icon: '📊', label: 'Relatórios', route: '/relatorios', visible: true, order: 4, profiles: ['ALMOXARIFE', 'GESTOR', 'ADMIN'] },
      { id: 'loja', icon: '🛍️', label: 'Loja', visible: true, order: 5, profiles: null,
        submenu: [{ icon: '📂', label: 'Categorias', route: '/categorias' }, { icon: '🛒', label: 'Meu carrinho', route: '/carrinho' }] },
      { id: 'configuracoes', icon: '⚙️', label: 'Configurações', route: '/configuracoes', visible: true, order: 6, profiles: ['ADMIN'] },
      { id: 'diagnostico', icon: '🩺', label: 'Diagnóstico do Sistema', route: '/diagnostico', visible: true, order: 7, profiles: ['ADMIN'] }
    ]),

    LOG_LEVEL: 'INFO',

    // ---- MÓDULO 02 (Estoque) — limiares de classificação
    // verde/amarelo/vermelho e janela de cálculo de consumo
    // médio. Configuráveis de propósito (não hardcoded no meio
    // da lógica) — dá pra ajustar sem redeploy de código.
    ESTOQUE_FATOR_ALERTA_AMARELO: 1.5, // disponível <= mínimo × este fator → AMARELO
    ESTOQUE_CONSUMO_DIAS_JANELA: 30,    // janela pra calcular consumo médio diário
    ESTOQUE_CONSUMO_MIN_EVENTOS: 3,       // mínimo de saídas na janela pra considerar "histórico suficiente"

    // ---- MÓDULO 04 (Inventário) — localizações com geração
    // automática de inventário D-1. JSON array de strings, ex:
    // '["OBRA-CENTRAL/ALMOX","OBRA-CENTRAL/EPI"]'. Vazio por
    // padrão — não gera nenhum D-1 até alguém configurar de
    // propósito (nunca inventa escopo sozinho).
    INVENTARIO_D1_LOCALIZACOES: '[]',

    // ---- FRONT-B01, seção 9 (Painel Digital) — conteúdo
    // configurável, nunca rigidamente codificado no HTML. JSON
    // array de {tipo, titulo, mensagem, icone}. Vazio por padrão
    // — reaproveita config.get/config.update que já existem
    // (Fase 12), nenhuma rota nova precisou ser criada.
    PAINEL_DIGITAL_CONTEUDO: '[]',

    // ---- BLOCO 06 (Ferramentas) — prazo padrão de retirada, em
    // horas, quando quem retira não informa um prazo específico.
    // Sem isso, "ferramenta atrasada" (seção 18) não teria como
    // ser calculado — não existia nenhum prazo gravado antes.
    FERRAMENTA_PRAZO_PADRAO_HORAS: 24,

    // ---- MÓDULO 12 (Notificações) — nunca preenchidas no
    // código; vazio até alguém contratar e configurar de verdade.
    WHATSAPP_API_TOKEN: '',
    WHATSAPP_API_URL: '',
    NOTIFICACAO_MAX_TENTATIVAS: 3
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
