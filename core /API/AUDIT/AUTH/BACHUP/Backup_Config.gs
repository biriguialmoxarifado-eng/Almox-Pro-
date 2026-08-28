/**
 * ============================================================
 * ALMOXA PRO — Backup_Config.gs
 * Backup só das configurações (Script Properties) — útil para
 * restaurar ambiente sem mexer em dados.
 * ============================================================
 */
const Backup_Config = (function () {
  function snapshot() { return Core_Config.getAll(); }
  return { snapshot };
})();
