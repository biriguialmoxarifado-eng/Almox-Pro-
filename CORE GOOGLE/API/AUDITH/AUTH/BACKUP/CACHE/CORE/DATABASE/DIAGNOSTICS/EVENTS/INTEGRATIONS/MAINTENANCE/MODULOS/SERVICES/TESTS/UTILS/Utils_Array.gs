/**
 * ============================================================
 * ALMOXA PRO — Utils_Array.gs
 * ============================================================
 */
const Utils_Array = (function () {
  function groupBy(arr, keyFn) {
    return arr.reduce((acc, item) => {
      const key = keyFn(item);
      (acc[key] = acc[key] || []).push(item);
      return acc;
    }, {});
  }
  function sum(arr, valueFn) { return arr.reduce((s, i) => s + (Number(valueFn(i)) || 0), 0); }
  function unique(arr) { return [...new Set(arr)]; }
  function chunk(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }
  return { groupBy, sum, unique, chunk };
})();
