/**
 * ============================================================
 * ALMOXA PRO — Test_Database.gs
 * ============================================================
 */
function Test_Database_conexao() {
  try {
    DB_Core.ss();
    Logger.log('Test_Database_conexao: PASSOU');
    return true;
  } catch (e) {
    Logger.log('Test_Database_conexao: FALHOU — ' + e.message);
    return false;
  }
}

function Test_Database_diagnostico() {
  const check = Doctor_Database.check();
  Logger.log('Test_Database_diagnostico: ' + JSON.stringify(check));
  return check.status !== CORE_CONSTANTS.DOCTOR_STATUS.ERROR;
}
