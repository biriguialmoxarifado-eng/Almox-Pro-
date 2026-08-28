/**
 * ============================================================
 * ALMOXA PRO — DB_Delete.gs  (CAMADA 2)
 * Delete lógico por padrão (status=INATIVO) — delete físico só
 * quando explicitamente solicitado, por rastreabilidade.
 * ============================================================
 */

const DB_Delete = (function () {

  function logical(table, id) {
    return DB_Update.byId(table, id, { status: 'INATIVO' });
  }

  function physical(table, id) {
    return DB_Lock.withLock(function () {
      const row = DB_Query.get(table, id);
      if (!row) return false;
      DB_Core.sheet(table).deleteRow(row._rowIndex);
      return true;
    });
  }

  return { logical, physical };
})();
