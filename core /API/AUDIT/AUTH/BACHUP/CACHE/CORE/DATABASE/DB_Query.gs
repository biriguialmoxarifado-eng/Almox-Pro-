/**
 * ============================================================
 * ALMOXA PRO — DB_Query.gs  (CAMADA 2)
 * Leitura de dados. Toda leitura passa por aqui — nenhum módulo
 * lê aba diretamente.
 * ============================================================
 */

/**
 * ============================================================
 * ALMOXA PRO — DB_Query.gs  (CAMADA 2)
 * Leitura de dados. Toda leitura passa por aqui — nenhum módulo
 * lê aba diretamente.
 *
 * INTEGRAÇÃO 02 — dois primitivos novos, aditivos:
 * `paginate()` (não existia uma paginação genérica — cada módulo
 * que precisava reimplementava slice() na mão) e `findCached()`
 * (leitura com cache curto, OPT-IN — nunca aplicado ao `find()`
 * original, que continua sempre lendo fresco; forçar cache em
 * TODA leitura seria arriscado demais pra dado como saldo de
 * estoque, que precisa estar sempre atual).
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

  /**
   * NOVA — paginação genérica (seção "preparar arquitetura pra
   * grande quantidade de registros" do contrato). Um único lugar
   * pra fatiar resultado, com teto absoluto — nunca deixa alguém
   * pedir um `limite` gigante e devolver tudo mesmo assim.
   */
  function paginate(table, filterFn, limite, offset) {
    const todos = find(table, filterFn);
    const lim = Math.min(limite || 20, 200);
    const off = offset || 0;
    return { registros: todos.slice(off, off + lim), totalEncontrado: todos.length, limite: lim, offset: off, temMais: off + lim < todos.length };
  }

  /**
   * NOVA — leitura com cache curto, OPT-IN. Cacheia as linhas
   * BRUTAS da tabela (nunca o resultado já filtrado — o filtro
   * roda sempre fresco em cima do que veio do cache), pra um
   * `find()` chamado várias vezes seguidas na mesma execução (ou
   * em execuções próximas) não reler a planilha inteira de novo.
   * TTL curto de propósito (padrão 15s) — nunca use isto pra dado
   * que precisa estar sempre 100% atual (saldo de estoque,
   * disponibilidade de reserva); sirva pra listagem/consulta
   * informativa, mesmo padrão já usado manualmente em
   * `Service_CentralDados.pesquisar()`.
   *
   * LIMITAÇÃO HONESTA: como o cache serializa em JSON, um campo
   * de data que normalmente vem como objeto `Date` (leitura
   * direta do Sheets) volta como string ISO depois do cache.
   * Quem usar `findCached` num campo de data precisa envolver
   * com `new Date(valor)` antes de comparar — documentado aqui
   * pra não virar um bug silencioso depois.
   */
  function findCached(table, filterFn, ttlSec) {
    const cacheKey = 'DB_QUERY_RAW_' + table;
    let rows;
    try {
      const cacheado = Cache_Core.get(cacheKey);
      rows = cacheado ? JSON.parse(cacheado) : null;
    } catch (e) { rows = null; }

    if (!rows) {
      rows = find(table, null);
      try { Cache_Core.set(cacheKey, JSON.stringify(rows), ttlSec || 15); } catch (e) { /* cache indisponível não impede a leitura */ }
    }
    return filterFn ? rows.filter(filterFn) : rows;
  }

  return { find, findOne, get, count, exists, paginate, findCached };
})();
