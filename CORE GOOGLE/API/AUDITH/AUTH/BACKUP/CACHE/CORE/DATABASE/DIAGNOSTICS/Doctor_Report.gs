/**
 * ============================================================
 * ALMOXA PRO — Doctor_Report.gs
 * Monta o relatório final consolidado (usado pela rota
 * doctor.diagnostics).
 * ============================================================
 */
const Doctor_Report = (function () {
  function generate() {
    return {
      timestamp: new Date().toISOString(),
      core: { status: CORE_CONSTANTS.DOCTOR_STATUS.OK },
      database: Doctor_Database.check(),
      api: Doctor_API.check(),
      modules: Doctor_Modules.check(),
      integrations: Core_Health.fullReport().integrations
    };
  }
  return { generate };
})();
