/**
 * ============================================================
 * ALMOXA PRO — Doctor_Modules.gs
 * ============================================================
 */
const Doctor_Modules = (function () {
  function check() { return Core_ModuleManager.healthCheckAll(); }
  return { check };
})();
