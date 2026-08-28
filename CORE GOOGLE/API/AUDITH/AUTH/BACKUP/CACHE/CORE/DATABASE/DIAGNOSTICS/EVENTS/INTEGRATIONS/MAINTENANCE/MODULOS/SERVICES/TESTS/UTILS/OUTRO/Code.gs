/**
 * ============================================================
 * ALMOXA PRO — Code.gs
 * Ponto de entrada do Web App. NESTA FASE: sem HTML nenhum
 * (regra explícita da spec). doGet devolve só um health-check
 * em JSON — útil pra confirmar que o deploy está de pé, nada
 * mais. O frontend real vem depois, consumindo Core_API.call().
 * ============================================================
 */

function doGet(e) {
  Core_API.bootstrap();
  const health = Core_API.healthCheck();
  return ContentService
    .createTextOutput(JSON.stringify(health, null, 2))
    .setMimeType(ContentService.MimeType.JSON);
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
