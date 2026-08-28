/**
 * ============================================================
 * ALMOXA PRO — Utils_Object.gs
 * ============================================================
 */
const Utils_Object = (function () {
  function pick(obj, keys) {
    const out = {};
    keys.forEach(k => { if (obj.hasOwnProperty(k)) out[k] = obj[k]; });
    return out;
  }
  function omit(obj, keys) {
    const out = Object.assign({}, obj);
    keys.forEach(k => delete out[k]);
    return out;
  }
  function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }
  return { pick, omit, deepClone };
})();
