/**
 * ============================================================
 * ALMOXA PRO — API_NF.gs
 * Rotas expostas via Core_Router. Cada função é um handler fino:
 * delega a lógica para o Service correspondente e devolve o
 * Core_Response já formatado pelo Service (que hoje retorna
 * MODULE_NOT_IMPLEMENTED até a fase real entrar).
 * ============================================================
 */
function create_nf(ctx) {
  return Service_NF.create(ctx);
}

function get_nf(ctx) {
  return Service_NF.get(ctx);
}

function search_nf(ctx) {
  return Service_NF.search(ctx);
}

function importXML_nf(ctx) {
  return Service_NF.importXML(ctx);
}

function processOCR_nf(ctx) {
  return Service_NF.processOCR(ctx);
}

function consultKey_nf(ctx) {
  return Service_NF.consultKey(ctx);
}

function validate_nf(ctx) {
  return Service_NF.validate(ctx);
}

function confer_nf(ctx) {
  return Service_NF.confer(ctx);
}

function approve_nf(ctx) {
  return Service_NF.approve(ctx);
}

function reject_nf(ctx) {
  return Service_NF.reject(ctx);
}

function extract_nf(ctx) {
  return Service_NF.extract(ctx);
}

function extract_ocr(ctx) {
  return Service_OCR.extract(ctx);
}

function nf_ocr(ctx) {
  return Service_OCR.nf(ctx);
}

function API_NF_getRoutes() {
  return {
    'nf.create': create_nf,
    'nf.get': get_nf,
    'nf.search': search_nf,
    'nf.importXML': importXML_nf,
    'nf.processOCR': processOCR_nf,
    'nf.consultKey': consultKey_nf,
    'nf.validate': validate_nf,
    'nf.confer': confer_nf,
    'nf.approve': approve_nf,
    'nf.reject': reject_nf,
    'nf.extract': extract_nf,
    'ocr.extract': extract_ocr,
    'ocr.nf': nf_ocr
  };
}

function API_NF_registerPermissions() {
  Auth_RBAC.registerActionPermission('nf.create', 'NF.CREATE');
  Auth_RBAC.registerActionPermission('nf.get', 'NF.VIEW');
  Auth_RBAC.registerActionPermission('nf.search', 'NF.VIEW');
  Auth_RBAC.registerActionPermission('nf.importXML', 'NF.CREATE');
  Auth_RBAC.registerActionPermission('nf.processOCR', 'NF.CREATE');
  Auth_RBAC.registerActionPermission('nf.consultKey', 'NF.VIEW');
  Auth_RBAC.registerActionPermission('nf.validate', 'NF.EDIT');
  Auth_RBAC.registerActionPermission('nf.confer', 'NF.EDIT');
  Auth_RBAC.registerActionPermission('nf.approve', 'NF.APPROVE');
  Auth_RBAC.registerActionPermission('nf.reject', 'NF.REJECT');
  Auth_RBAC.registerActionPermission('nf.extract', 'NF.VIEW');
  Auth_RBAC.registerActionPermission('ocr.extract', 'OCR.VIEW');
  Auth_RBAC.registerActionPermission('ocr.nf', 'OCR.VIEW');
}

