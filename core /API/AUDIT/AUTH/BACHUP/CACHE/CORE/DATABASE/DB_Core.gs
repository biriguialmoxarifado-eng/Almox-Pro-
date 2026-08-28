/**
 * ============================================================
 * ALMOXA PRO — DB_Core.gs  (CAMADA 2)
 * Acesso base ao Google Sheets. NENHUM outro arquivo do sistema
 * deve chamar SpreadsheetApp diretamente — tudo passa por aqui
 * (seção 7 — regra absoluta).
 *
 * INTEGRAÇÃO 02 — "erro de conexão"/"recuperação de erro": antes,
 * uma falha transitória da API do Sheets (rate limit momentâneo,
 * timeout de rede) derrubava a operação inteira na primeira
 * tentativa. Agora `_withRetry` tenta de novo com espera curta
 * antes de desistir — só pra erro que TEM cara de transitório
 * (mensagem contém "timeout"/"rate"/"internal"/"temporarily"),
 * nunca pra erro real de configuração (ex: SPREADSHEET_ID
 * ausente, aba inexistente) — esses continuam falhando na hora,
 * porque tentar de novo não resolveria.
 * ============================================================
 */

const DB_Core = (function () {

  const MAX_TENTATIVAS = 3;
  const PADRAO_ESPERA_MS = 300;

  function _pareceTransitorio(mensagem) {
    const m = (mensagem || '').toLowerCase();
    return m.includes('timeout') || m.includes('rate limit') || m.includes('internal error') ||
      m.includes('temporarily') || m.includes('service spreadsheets') || m.includes('try again');
  }

  function _withRetry(fn) {
    let ultimoErro;
    for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
      try {
        return fn();
      } catch (e) {
        ultimoErro = e;
        if (tentativa === MAX_TENTATIVAS || !_pareceTransitorio(e.message)) throw e;
        Utilities.sleep(PADRAO_ESPERA_MS * tentativa); // backoff simples: 300ms, 600ms
      }
    }
    throw ultimoErro;
  }

  function ss() {
    const id = Core_Config.get('SPREADSHEET_ID');
    if (!id) throw new Error('SPREADSHEET_ID não configurado (Core_Config).');
    return _withRetry(function () { return SpreadsheetApp.openById(id); });
  }

  function sheet(tableName) {
    const sh = ss().getSheetByName(tableName);
    if (!sh) throw new Error('Tabela/aba não encontrada: ' + tableName);
    return sh;
  }

  function headers(sh) {
    const lastCol = sh.getLastColumn();
    return lastCol ? sh.getRange(1, 1, 1, lastCol).getValues()[0] : [];
  }

  function ensureSheet(tableName, headerList) {
    let sh = ss().getSheetByName(tableName);
    if (!sh) {
      sh = ss().insertSheet(tableName);
      sh.getRange(1, 1, 1, headerList.length).setValues([headerList]);
      sh.setFrozenRows(1);
    }
    return sh;
  }

  return { ss, sheet, headers, ensureSheet, _withRetry, _pareceTransitorio };
})();
