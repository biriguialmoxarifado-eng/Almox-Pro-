/**
 * ============================================================
 * ALMOXA PRO — Utils_Security.gs
 * Sanitização básica de entrada (seção 53). Validação de
 * negócio específica continua no Service de cada módulo.
 * ============================================================
 */
const Utils_Security = (function () {
  function sanitizeString(str) {
    return String(str == null ? '' : str).replace(/[<>]/g, '');
  }
  function maskSensitive(str, visibleChars) {
    const s = String(str || '');
    const keep = visibleChars || 4;
    if (s.length <= keep) return '*'.repeat(s.length);
    return '*'.repeat(s.length - keep) + s.slice(-keep);
  }
  return { sanitizeString, maskSensitive };
})();
