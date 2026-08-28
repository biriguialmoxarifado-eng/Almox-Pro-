/**
 * ============================================================
 * ALMOXA PRO — DB_Query.gs  (CAMADA 2)
 * Leitura de dados. Toda leitura passa por aqui — nenhum módulo
 * lê aba diretamente.
 * ============================================================
 */

const DB_Query = (function () {

  function _rowsToObjects(sh) {
    const lastRow = sh.getLastRow();
    if (lastRow < 2) return [];
    const heads = DB_Core.headers(sh);
    const values = sh.getRange(2, 1, lastRow - 1, heads.length).getValues();
    return values.map((row, idx) => {
      const obj = { _rowIndex: idx + 2 };
      heads.forEach((h, i) => obj[h] = row[i]);
      return obj;
    });
  }

  function find(table, filterFn) {
    const sh = DB_Core.sheet(table);
    const rows = _rowsToObjects(sh);
    return filterFn ? rows.filter(filterFn) : rows;
  }

  function findOne(table, filterFn) {
    const rows = find(table, filterFn);
    return rows.length ? rows[0] : null;
  }

  function get(table, id) {
    return findOne(table, r => String(r.ID) === String(id));
  }

  function count(table, filterFn) {
    return find(table, filterFn).length;
  }

  function exists(table, filterFn) {
    return count(table, filterFn) > 0;
  }

  return { find, findOne, get, count, exists };
})();
