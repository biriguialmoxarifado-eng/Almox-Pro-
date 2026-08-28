/**
 * ============================================================
 * ALMOXA PRO — Code.gs
 * Ponto de entrada do Web App. NESTA FASE: sem HTML nenhum
 * (regra explícita da spec). doGet devolve só um health-check
 * em JSON — útil pra confirmar que o deploy está de pé, nada
 * mais. O frontend real vem depois, consumindo Core_API.call().
 * ============================================================
 */

/**
 * ============================================================
 * ALMOXA PRO — Code.gs
 * FASE 1 DO FRONT MOBILE: doGet agora serve o App Shell em HTML
 * (HtmlService). O health-check em JSON continua acessível via
 * ?formato=json — não tirei essa porta, só deixei de ser a
 * resposta padrão (o Doutor do Sistema e os testes de backend
 * continuam usando ela).
 *
 * doPost continua igual — é a porta HTTP direta pra integrações
 * externas. O Front Mobile NÃO usa doPost: ele fala com o
 * backend via google.script.run (ver função apiCall() abaixo),
 * que é o jeito nativo do HtmlService conversar com o Apps
 * Script sem precisar de fetch/HTTP.
 * ============================================================
 */

function doGet(e) {
  Core_API.bootstrap();

  const params = (e && e.parameter) || {};
  if (params.formato === 'json') {
    return _json(Core_API.healthCheck());
  }

  // FASE 9 (PWA) — manifest servido pela mesma URL do Web App,
  // via parâmetro (Apps Script não serve arquivo em caminho
  // separado tipo /manifest.json — HtmlService só serve uma
  // "página" por requisição).
  if (params.manifest === '1') return _manifest();

  const template = HtmlService.createTemplateFromFile('Front_App');
  template.appName = Core_Config.get('APP_NAME');
  template.appVersion = Core_Config.get('APP_VERSION');
  template.appUrl = ScriptApp.getService().getUrl();
  template.iconDataUri = _iconDataUri();
  return template.evaluate()
    .setTitle(Core_Config.get('APP_NAME'))
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * FASE 9 — Web App Manifest real. Permite "Adicionar à tela
 * inicial" com ícone e nome corretos. NÃO inclui Service Worker
 * (ver relatório da fase — limitação real e confirmada do Apps
 * Script/HtmlService, não escolha nossa) — o manifest sozinho já
 * habilita atalho no iOS Safari e ajuda o Android a reconhecer o
 * app como instalável, mesmo sem o prompt automático completo do
 * Chrome (que exige Service Worker).
 */
function _manifest() {
  const url = ScriptApp.getService().getUrl();
  const manifest = {
    name: Core_Config.get('APP_NAME'),
    short_name: Core_Config.get('APP_NAME'),
    start_url: url,
    scope: url,
    display: 'standalone',
    background_color: '#0a1626',
    theme_color: '#0a1626',
    icons: [{ src: _iconDataUri(), sizes: 'any', type: 'image/svg+xml', purpose: 'any' }]
  };
  return ContentService.createTextOutput(JSON.stringify(manifest)).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Ícone como data URI — o mesmo losango dourado do Header/login.
 * NÃO existe `ContentService.MimeType.SVG` no Apps Script (só
 * CSV/ICAL/JAVASCRIPT/JSON/TEXT/VCARD — conferido antes de
 * escrever isso, não é suposição), então servir a imagem numa
 * rota própria com Content-Type correto não é possível. Um data
 * URI embutido direto no manifest/HTML contorna essa limitação
 * de verdade, sem inventar uma rota que quebraria.
 */
function _iconDataUri() {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192">' +
    '<rect width="192" height="192" rx="28" fill="#0a1626"/>' +
    '<g transform="translate(96 96) rotate(45)">' +
    '<rect x="-42" y="-42" width="84" height="84" rx="18" fill="#f2a93b"/>' +
    '</g></svg>';
  return 'data:image/svg+xml;base64,' + Utilities.base64Encode(svg, Utilities.Charset.UTF_8);
}

function doPost(e) {
  Core_API.bootstrap();
  let request;
  try {
    request = JSON.parse(e.postData.contents);
  } catch (err) {
    return _json(Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'JSON inválido no corpo da requisição.'));
  }
  const result = Core_API.call(request);
  return _json(result);
}

function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/**
 * ---- Ponte Front ↔ Backend (usada por JS/API.html via google.script.run) ----
 * Esta é a ÚNICA porta que o Front usa pra falar com o Core —
 * nenhum módulo futuro deve criar outra (regra da spec, seção 8).
 */
function apiCall(request) {
  return Core_API.call(request);
}

function apiBootstrap() {
  return Core_API.bootstrap();
}

/** Permite <?!= include('Arquivo') ?> dentro dos templates HTML do Front. */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
