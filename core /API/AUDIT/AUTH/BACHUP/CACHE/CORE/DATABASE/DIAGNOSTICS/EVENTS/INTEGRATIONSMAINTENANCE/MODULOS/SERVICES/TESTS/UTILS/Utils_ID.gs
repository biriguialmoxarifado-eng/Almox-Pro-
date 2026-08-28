/**
 * ============================================================
 * ALMOXA PRO — Utils_ID.gs
 * ============================================================
 */
const Utils_ID = (function () {
  function uuid() { return Utilities.getUuid(); }

  /** Token legível tipo INV-2026-000001 (seção 28). */
  function tokenComAno(prefixo, sequencial) {
    const ano = new Date().getFullYear();
    const seq = String(sequencial).padStart(6, '0');
    return prefixo + '-' + ano + '-' + seq;
  }

  return { uuid, tokenComAno };
})();
