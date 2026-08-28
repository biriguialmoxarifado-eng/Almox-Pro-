/**
 * ============================================================
 * ALMOXA PRO — DB_Update.gs  (CAMADA 2)
 * ============================================================
 */

const DB_Update = (function () {

  function byRowIndex(table, rowIndex, patch) {
    return DB_Lock.withLock(function () {
      const sh = DB_Core.sheet(table);
      const heads = DB_Core.headers(sh);
      const record = Object.assign({}, patch);
      record._updated_at = new Date();
      record._updated_by = Auth_Session.currentUserEmailSafe();
      heads.forEach((h, i) => {
        if (record.hasOwnProperty(h)) sh.getRange(rowIndex, i + 1).setValue(record[h]);
      });
      return true;
    });
  }

  function byId(table, id, patch) {
    const row = DB_Query.get(table, id);
    if (!row) throw Object.assign(new Error('Registro não encontrado: ' + table + '#' + id), { code: CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND });
    return byRowIndex(table, row._rowIndex, patch);
  }

  function upsert(table, filterFn, obj) {
    const existing = DB_Query.findOne(table, filterFn);
    if (existing) {
      byRowIndex(table, existing._rowIndex, obj);
      return Object.assign({}, existing, obj);
    }
    return DB_Insert.insert(table, obj);
  }

  function batchUpdate(table, updates) {
    // updates: [{ id, patch }]
    return updates.map(u => byId(table, u.id, u.patch));
  }

  return { byRowIndex, byId, upsert, batchUpdate };
})();
