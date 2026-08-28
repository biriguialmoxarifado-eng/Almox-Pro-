/**
 * ============================================================
 * ALMOXA PRO — Core_Registry.gs  (CAMADA 5)
 * Registro central: onde módulos e rotas se anunciam ao Core.
 * O Core NÃO conhece regra de negócio — só sabe que "a rota X
 * pertence ao módulo Y e chama a função Z".
 * ============================================================
 */

const Core_Registry = (function () {

  let _modules = {};   // id -> descriptor (contrato do módulo)
  let _routes = {};    // action -> { handler, moduleId }

  function registerModule(descriptor) {
    if (!descriptor || !descriptor.id) {
      throw new Error('Core_Registry.registerModule: descriptor inválido (falta id).');
    }
    _modules[descriptor.id] = descriptor;

    // Um módulo pode declarar suas rotas via getRoutes() (contrato,
    // seção 63). O Registry as absorve automaticamente.
    if (typeof descriptor.getRoutes === 'function') {
      const routes = descriptor.getRoutes() || {};
      Object.keys(routes).forEach(action => {
        registerRoute(action, routes[action], descriptor.id);
      });
    }
  }

  function registerRoute(action, handlerFn, moduleId) {
    if (_routes[action]) {
      Logger_Utils_maybe_warn(action);
    }
    _routes[action] = { handler: handlerFn, moduleId: moduleId };
  }

  function Logger_Utils_maybe_warn(action) {
    // Log defensivo — rota sendo sobrescrita indica conflito
    // entre módulos, algo que o Doutor deve reportar.
    try { console.warn('[Core_Registry] Rota já registrada, sobrescrevendo: ' + action); } catch (e) {}
  }

  function getModule(id) { return _modules[id] || null; }
  function getAllModules() { return Object.values(_modules); }
  function getRoute(action) { return _routes[action] || null; }
  function getAllRoutes() { return Object.assign({}, _routes); }

  function reset() { _modules = {}; _routes = {}; } // uso exclusivo em testes

  return { registerModule, registerRoute, getModule, getAllModules, getRoute, getAllRoutes, reset };
})();
