/**
 * ============================================================
 * ALMOXA PRO — Service_Importacao.gs
 * FASE 10 — NOVO (MOD_02_IMPORTACAO estava vazio desde a Fase 1).
 *
 * Fluxo exato da seção 38:
 * ARQUIVO → LEITURA → VALIDAÇÃO → MAPEAMENTO → PRÉ-VISUALIZAÇÃO
 * → CONFERÊNCIA → IMPORTAÇÃO → AUDITORIA
 *
 * preview() faz leitura+mapeamento sugerido, sem gravar nada.
 * commit() só grava depois que você confirma o mapeamento —
 * nunca importa direto sem essa etapa (regra explícita da spec).
 *
 * Suporta qualquer tabela do DB_Mapping como destino — não é
 * exclusivo do SAP (Service_SAP.import é especializado nele).
 * ============================================================
 */

const Service_Importacao = (function () {

  function preview(ctx) {
    const { driveFileId, tabelaDestino } = ctx.payload || {};
    if (!driveFileId || !tabelaDestino) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'driveFileId e tabelaDestino são obrigatórios.', {}, ctx.requestId);
    }
    const colunasEsperadas = DB_Mapping.getExpectedHeaders(tabelaDestino);
    if (!colunasEsperadas) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'tabelaDestino desconhecida: ' + tabelaDestino, {}, ctx.requestId);
    }

    let parsed;
    try { parsed = Integration_SAP.parseArquivo(driveFileId); } // reaproveita o parser genérico CSV/Sheets
    catch (e) { return Core_Response.error(e.code || CORE_CONSTANTS.RESPONSE_CODES.INTERNAL_ERROR, e.message, {}, ctx.requestId); }

    // Sugestão automática de mapeamento por nome de coluna igual/parecido
    const sugestao = {};
    parsed.headers.forEach((h, idx) => {
      const norm = Utils_String.normalize(h);
      const campo = colunasEsperadas.find(c => Utils_String.normalize(c) === norm);
      if (campo) sugestao[campo] = idx;
    });

    return Core_Response.ok({
      tabelaDestino, colunasEsperadas,
      cabecalhoArquivo: parsed.headers,
      mapeamentoSugerido: sugestao,
      amostraLinhas: parsed.rows.slice(0, 5),
      totalLinhasNoArquivo: parsed.rows.length
    }, 'Pré-visualização gerada — confira o mapeamento antes de confirmar com import.commit.', 'SUCCESS', {}, ctx.requestId);
  }

  function commit(ctx) {
    const { driveFileId, tabelaDestino, mapeamento } = ctx.payload || {};
    if (!driveFileId || !tabelaDestino || !mapeamento) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'driveFileId, tabelaDestino e mapeamento são obrigatórios.', {}, ctx.requestId);
    }
    const colunasEsperadas = DB_Mapping.getExpectedHeaders(tabelaDestino);
    if (!colunasEsperadas) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'tabelaDestino desconhecida: ' + tabelaDestino, {}, ctx.requestId);
    }

    let parsed;
    try { parsed = Integration_SAP.parseArquivo(driveFileId); }
    catch (e) { return Core_Response.error(e.code || CORE_CONSTANTS.RESPONSE_CODES.INTERNAL_ERROR, e.message, {}, ctx.requestId); }

    const inseridos = [];
    const erros = [];

    parsed.rows.forEach((row, linhaIdx) => {
      const obj = {};
      Object.keys(mapeamento).forEach(campo => obj[campo] = row[mapeamento[campo]]);
      try {
        const registro = DB_Insert.insert(tabelaDestino, obj);
        inseridos.push(registro);
      } catch (e) {
        erros.push({ linha: linhaIdx + 2, erro: e.message, dados: obj }); // +2 = compensa cabeçalho + índice base 1
      }
    });

    Audit_Service.record(ctx, 'IMPORTACAO_CONCLUIDA', { entidade: tabelaDestino }, null, { inseridos: inseridos.length, erros: erros.length });

    return Core_Response.ok({ inseridos: inseridos.length, erros },
      inseridos.length + ' registro(s) importado(s)' + (erros.length ? ', ' + erros.length + ' com erro.' : '.'),
      'SUCCESS', {}, ctx.requestId);
  }

  return { preview, commit };
})();
