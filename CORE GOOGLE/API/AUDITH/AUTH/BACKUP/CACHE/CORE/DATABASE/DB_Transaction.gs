/**
 * ============================================================
 * ALMOXA PRO — DB_Transaction.gs  (CAMADA 2)
 * Google Sheets não tem transação nativa. Esta é uma transação
 * "best effort": agrupa operações sob um único Lock e reverte
 * manualmente em caso de erro (compensação), documentando a
 * limitação em vez de fingir atomicidade real.
 * ============================================================
 */

const DB_Transaction = (function () {

  function run(operations) {
    // operations: array de { execute: fn, compensate: fn }
    return DB_Lock.withLock(function () {
      const executed = [];
      try {
        const results = operations.map(op => {
          const r = op.execute();
          executed.push(op);
          return r;
        });
        return results;
      } catch (e) {
        // compensação em ordem reversa (best-effort)
        executed.reverse().forEach(op => {
          try { if (op.compensate) op.compensate(); } catch (e2) { /* loga e segue */ }
        });
        throw e;
      }
    });
  }

  return { run };
})();
