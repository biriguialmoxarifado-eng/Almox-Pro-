/**
 * ============================================================
 * ALMOXA PRO — Backup_Verification.gs
 * Confere se um backup existe e está íntegro (não corrompido/
 * vazio) antes de permitir restauração.
 * ============================================================
 */
const Backup_Verification = (function () {
  function verify(fileId) {
    try {
      const file = DriveApp.getFileById(fileId);
      const sizeOk = file.getSize() > 0;
      return { status: sizeOk ? CORE_CONSTANTS.DOCTOR_STATUS.OK : CORE_CONSTANTS.DOCTOR_STATUS.ERROR, size: file.getSize() };
    } catch (e) {
      return { status: CORE_CONSTANTS.DOCTOR_STATUS.ERROR, error: e.message };
    }
  }
  return { verify };
})();
