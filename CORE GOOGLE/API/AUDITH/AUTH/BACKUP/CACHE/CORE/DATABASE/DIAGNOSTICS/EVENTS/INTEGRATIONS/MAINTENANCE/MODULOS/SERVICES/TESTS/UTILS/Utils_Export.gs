/**
 * ============================================================
 * ALMOXA PRO — Utils_Export.gs
 * FASE 10 — helper compartilhado de exportação (usado por
 * Service_SAP e Service_Exportacao; Service_Relatorio tem sua
 * própria versão desde a Fase 9 — mantida separada de propósito
 * pra não arriscar regressão numa fase já validada).
 * ============================================================
 */

const Utils_Export = (function () {

  function toCSV(dados) {
    if (!dados || !dados.length) return '';
    const headers = Object.keys(dados[0]).filter(h => !h.startsWith('_'));
    const linhas = [headers.join(',')];
    dados.forEach(row => {
      linhas.push(headers.map(h => {
        const val = row[h] === undefined || row[h] === null ? '' : String(row[h]).replace(/"/g, '""');
        return val.includes(',') ? '"' + val + '"' : val;
      }).join(','));
    });
    return linhas.join('\n');
  }

  function toJSONBlob(dados, nomeArquivo) {
    return Utilities.newBlob(Utils_JSON.safeStringify(dados), 'application/json', nomeArquivo + '.json');
  }

  return { toCSV, toJSONBlob };
})();
