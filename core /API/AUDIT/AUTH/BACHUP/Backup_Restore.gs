/**
 * ============================================================
 * ALMOXA PRO — Backup_Restore.gs
 * Restauração NUNCA automática (seção 46) — sempre exige
 * confirmação explícita no payload (confirm: true).
 * ============================================================
 */
const Backup_Restore = (function () {
  function restore(fileId, confirm) {
    if (confirm !== true) {
      throw Object.assign(new Error('Restauração exige confirmação explícita (confirm=true).'), {
        code: CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR
      });
    }
    const verification = Backup_Verification.verify(fileId);
    if (verification.status !== CORE_CONSTANTS.DOCTOR_STATUS.OK) {
      throw new Error('Backup não passou na verificação — restauração abortada.');
    }
    // Restauração real (sobrescrever SPREADSHEET_ID ativo) é uma
    // operação destrutiva demais para ficar automática nesta
    // fase — o esqueleto prepara o contrato e a verificação;
    // a execução fica condicionada à revisão manual do time.
    return { status: 'PENDENTE_REVISAO_MANUAL', fileId: fileId };
  }
  return { restore };
})();
