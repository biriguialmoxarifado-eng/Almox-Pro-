/**
 * ============================================================
 * ALMOXA PRO — Utils_Currency.gs
 * ============================================================
 */
const Utils_Currency = (function () {
  function formatBRL(value) {
    return 'R$ ' + Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function round2(value) { return Math.round((Number(value) + Number.EPSILON) * 100) / 100; }
  return { formatBRL, round2 };
})();
