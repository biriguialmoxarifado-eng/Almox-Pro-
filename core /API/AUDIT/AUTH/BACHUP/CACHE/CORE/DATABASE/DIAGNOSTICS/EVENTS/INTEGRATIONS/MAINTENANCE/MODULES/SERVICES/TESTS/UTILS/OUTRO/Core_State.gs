/**
 * ============================================================
 * ALMOXA PRO — Core_State.gs  (CAMADA 5)
 * Estado efêmero de execução (não é banco — cada execução do
 * Apps Script começa com estado zerado). Usado para acumular
 * informação DENTRO de uma mesma requisição/execução, como
 * feature flags resolvidas e contadores de diagnóstico.
 * ============================================================
 */

const Core_State = (function () {
  let _state = {};

  function set(key, value) { _state[key] = value; }
  function get(key) { return _state.hasOwnProperty(key) ? _state[key] : null; }
  function clear() { _state = {}; }
  function snapshot() { return Object.assign({}, _state); }

  return { set, get, clear, snapshot };
})();
