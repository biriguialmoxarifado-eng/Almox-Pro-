/**
 * ============================================================
 * ALMOXA PRO — DB_Validation.gs  (CAMADA 2)
 * Validação genérica de dados antes de gravar. Validações
 * específicas de negócio ficam no Service do módulo — aqui só
 * o que é comum a qualquer tabela (campos obrigatórios, tipos).
 * ============================================================
 */

const DB_Validation = (function () {

  function requireFields(obj, fields) {
    const missing = fields.filter(f => obj[f] === undefined || obj[f] === null || obj[f] === '');
    if (missing.length) {
      throw Object.assign(new Error('Campos obrigatórios ausentes: ' + missing.join(', ')), {
        code: CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR
      });
    }
    return true;
  }

  function isValidEmail(str) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(str || '')); }
  function isValidCNPJ(str) { return /^\d{14}$/.test(String(str || '').replace(/\D/g, '')); }

  return { requireFields, isValidEmail, isValidCNPJ };
})();
