/**
 * ============================================================
 * ALMOXA PRO — DB_Insert.gs  (CAMADA 2)
 * ============================================================
 */

const DB_Insert = (function () {

  function _nextId(sh) {
    const lastRow = sh.getLastRow();
    if (lastRow < 2) return 1;
    const heads = DB_Core.headers(sh);
    const idCol = heads.indexOf('ID') + 1;
    if (idCol < 1) return null;
    const ids = sh.getRange(2, idCol, lastRow - 1, 1).getValues().flat().map(Number).filter(n => !isNaN(n));
    return (ids.length ? Math.max.apply(null, ids) : 0) + 1;
  }

  function insert(table, obj) {
    return DB_Lock.withLock(function () {
      const sh = DB_Core.sheet(table);
      const heads = DB_Core.headers(sh);
      const record = Object.assign({}, obj);
      if (heads.includes('ID') && !record.ID) record.ID = _nextId(sh);
      record._updated_at = new Date();
      record._updated_by = Auth_Session.currentUserEmailSafe();
      const row = heads.map(h => record.hasOwnProperty(h) ? record[h] : '');
      sh.appendRow(row);
      return record;
    });
  }

  function batchInsert(table, objects) {
    return objects.map(o => insert(table, o));
  }

  return { insert, batchInsert };
})();
