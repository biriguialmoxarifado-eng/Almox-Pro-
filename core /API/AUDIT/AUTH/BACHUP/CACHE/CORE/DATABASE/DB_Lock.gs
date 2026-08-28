/**
 * ============================================================
 * ALMOXA PRO — DB_Lock.gs  (CAMADA 2)
 * Concorrência via LockService (seção 41). Usado em toda
 * operação de escrita — entrada, saída, inventário, reserva,
 * aprovação, geração de ID, importação, backup.
 * ============================================================
 */

const DB_Lock = (function () {

  function withLock(fn) {
    const lock = LockService.getScriptLock();
    const ok = lock.tryLock(Core_Config.get('LOCK_TIMEOUT_MS'));
    if (!ok) {
      throw Object.assign(new Error('Não foi possível obter lock — operação concorrente em andamento.'), {
        code: CORE_CONSTANTS.RESPONSE_CODES.LOCK_TIMEOUT
      });
    }
    try {
      return fn();
    } finally {
      lock.releaseLock();
    }
  }

  return { withLock };
})();
