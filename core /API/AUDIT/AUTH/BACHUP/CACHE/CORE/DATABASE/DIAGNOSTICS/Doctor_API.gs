/**
 * ============================================================
 * ALMOXA PRO — Doctor_API.gs
 * Verifica se todas as rotas registradas apontam para função
 * existente (detecta rota "fantasma" após refatoração).
 * ============================================================
 */
const Doctor_API = (function () {
  function check() {
    const routes = Core_Registry.getAllRoutes();
    const total = Object.keys(routes).length;
    const invalidas = Object.keys(routes).filter(action => typeof routes[action].handler !== 'function');
    return {
      status: invalidas.length ? CORE_CONSTANTS.DOCTOR_STATUS.ERROR : CORE_CONSTANTS.DOCTOR_STATUS.OK,
      totalRotas: total,
      rotasInvalidas: invalidas
    };
  }
  return { check };
})();
