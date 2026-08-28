/**
 * ============================================================
 * ALMOXA PRO — Doctor_Backup.gs
 * MÓDULO 08 — consulta a tabela BACKUPS real (a mesma que
 * Backup_Core.create() já grava desde a Fase 1) — nunca
 * reimplementa lógica de backup, só lê o estado dela.
 *
 * HONESTIDADE: não existe hoje um gatilho de tempo que rode
 * backup automaticamente (conferido em Gatilhos.gs antes de
 * escrever isso) — então "próximo backup" não pode ser uma data
 * calculada, porque não existe agendamento real. Reportamos
 * isso como uma lacuna, não inventamos uma data.
 * ============================================================
 */

const Doctor_Backup = (function () {

  const DIAS_MAX_SEM_BACKUP = 7;

  function check() {
    const backups = DB_Query.find('BACKUPS', () => true).sort((a, b) => new Date(b.data) - new Date(a.data));
    const ultimo = backups[0] || null;
    const existeGatilhoAgendado = false;

    let status = CORE_CONSTANTS.DOCTOR_STATUS.NOT_CONFIGURED;
    let diasDesdeUltimo = null;
    if (ultimo) {
      diasDesdeUltimo = Math.floor((Date.now() - new Date(ultimo.data).getTime()) / 86400000);
      status = diasDesdeUltimo > DIAS_MAX_SEM_BACKUP ? CORE_CONSTANTS.DOCTOR_STATUS.WARNING : CORE_CONSTANTS.DOCTOR_STATUS.OK;
    }

    return {
      status,
      ultimoBackup: ultimo ? { data: ultimo.data, versao: ultimo.versao, status: ultimo.status, responsavel: ultimo.responsavel } : null,
      diasDesdeUltimoBackup: diasDesdeUltimo,
      totalBackupsRegistrados: backups.length,
      proximoBackupAgendado: existeGatilhoAgendado ? null : 'Não há gatilho de backup automático configurado — backup só acontece quando alguém chama backup.create manualmente.',
      pastaConfigurada: !!Core_Config.get('DRIVE_FOLDER_BACKUP')
    };
  }

  return { check };
})();
