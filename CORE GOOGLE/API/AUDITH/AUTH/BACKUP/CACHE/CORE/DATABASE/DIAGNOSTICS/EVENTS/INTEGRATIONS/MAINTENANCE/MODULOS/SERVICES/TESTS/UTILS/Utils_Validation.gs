/**
 * ============================================================
 * ALMOXA PRO — Utils_Validation.gs
 * ============================================================
 */
const Utils_Validation = (function () {
  function isEmpty(v) { return v === null || v === undefined || v === ''; }
  function isPositiveNumber(v) { return typeof v === 'number' && v > 0; }
  function isOneOf(v, list) { return list.includes(v); }
  return { isEmpty, isPositiveNumber, isOneOf };
})();
