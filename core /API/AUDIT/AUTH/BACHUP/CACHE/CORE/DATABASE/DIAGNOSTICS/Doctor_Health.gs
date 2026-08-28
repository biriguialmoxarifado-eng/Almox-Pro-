/**
 * ============================================================
 * ALMOXA PRO — Doctor_Health.gs
 * Agrega tudo (delegando a Core_Health, que já centraliza).
 * ============================================================
 */
const Doctor_Health = (function () {
  function check() { return Core_Health.fullReport(); }
  return { check };
})();
