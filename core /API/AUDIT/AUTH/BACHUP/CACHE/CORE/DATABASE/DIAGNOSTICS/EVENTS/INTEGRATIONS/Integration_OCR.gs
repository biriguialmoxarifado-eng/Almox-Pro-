/**
 * ============================================================
 * ALMOXA PRO — Integration_OCR.gs
 * ADAPTER/CONTRACT (seção 70) — a especificação permite Google
 * Cloud Vision (DOCUMENT_TEXT_DETECTION) para OCR de NF. A
 * chamada real via UrlFetchApp só é feita se OCR_API_KEY estiver
 * configurada; caso contrário, retorna erro honesto de
 * integração não configurada — nunca finge sucesso.
 * ============================================================
 */
const OCR_Provider = (function () {
  function extractText(imageBlob) {
    const apiKey = Core_Config.get('OCR_API_KEY');
    if (!apiKey || Core_Config.get('OCR_PROVIDER') !== 'GOOGLE_VISION') {
      throw Object.assign(new Error('OCR não configurado (OCR_PROVIDER/OCR_API_KEY).'), {
        code: CORE_CONSTANTS.RESPONSE_CODES.EXTERNAL_INTEGRATION_NOT_CONFIGURED
      });
    }
    const body = {
      requests: [{
        image: { content: Utilities.base64Encode(imageBlob.getBytes()) },
        features: [{ type: 'DOCUMENT_TEXT_DETECTION' }]
      }]
    };
    const response = UrlFetchApp.fetch(
      'https://vision.googleapis.com/v1/images:annotate?key=' + apiKey,
      { method: 'post', contentType: 'application/json', payload: JSON.stringify(body), muteHttpExceptions: true }
    );
    return JSON.parse(response.getContentText());
  }
  return { extractText };
})();

const Integration_OCR = (function () {
  function extractDocument(blob) { return OCR_Provider.extractText(blob); }
  function healthCheck() {
    const configured = Core_Config.get('OCR_PROVIDER') !== 'NONE' && !!Core_Config.get('OCR_API_KEY');
    return { status: configured ? CORE_CONSTANTS.DOCTOR_STATUS.OK : CORE_CONSTANTS.DOCTOR_STATUS.NOT_CONFIGURED };
  }
  return { extractDocument, healthCheck, OCR_Provider };
})();
