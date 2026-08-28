/**
 * ============================================================
 * ALMOXA PRO — Utils_JSON.gs
 * ============================================================
 */
const Utils_JSON = (function () {
  function safeParse(str, fallback) {
    try { return JSON.parse(str); } catch (e) { return fallback !== undefined ? fallback : null; }
  }
  function safeStringify(obj, fallback) {
    try { return JSON.stringify(obj); } catch (e) { return fallback !== undefined ? fallback : '{}'; }
  }
  return { safeParse, safeStringify };
})();
