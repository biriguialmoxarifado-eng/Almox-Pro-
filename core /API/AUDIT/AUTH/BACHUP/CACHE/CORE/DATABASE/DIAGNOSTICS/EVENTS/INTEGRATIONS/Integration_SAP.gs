/**
 * ============================================================
 * ALMOXA PRO — Integration_SAP.gs
 * NÃO conecta em API do SAP — a especificação exige que a
 * integração seja por IMPORTAÇÃO de exportação/planilha
 * (ME80FN, ME5K, ME23N, ME2N, ME5A, MB51, M24). Este adapter só
 * sabe ler o arquivo já exportado, nunca inventa um client SAP.
 * ============================================================
 */
const Integration_SAP = (function () {
  function lerArquivoExportado(driveFileId, layout) {
    // O parsing real (mapear colunas do layout SAP -> PEDIDOS)
    // entra na Fase 16. Aqui só valida que o arquivo existe e é
    // acessível, sem inventar dado.
    const file = DriveApp.getFileById(driveFileId);
    return { nome: file.getName(), tamanho: file.getSize(), layoutEsperado: layout, status: 'AGUARDANDO_PARSING_FASE_16' };
  }

  /**
   * FASE 10 — parser real. Suporta CSV e Google Sheets nativos.
   * NÃO suporta .xlsx binário puro (o Apps Script não tem parser
   * nativo pra esse formato sem biblioteca externa) — se o
   * arquivo vier assim, orienta a converter pra CSV ou Sheets
   * antes de importar. Isso é uma limitação real, documentada,
   * não uma promessa vazia.
   */
  function parseArquivo(driveFileId) {
    const file = DriveApp.getFileById(driveFileId);
    const mime = file.getMimeType();

    if (mime === MimeType.GOOGLE_SHEETS) {
      const ss = SpreadsheetApp.openById(driveFileId);
      const sh = ss.getSheets()[0];
      const values = sh.getDataRange().getValues();
      if (!values.length) return { headers: [], rows: [] };
      return { headers: values[0].map(String), rows: values.slice(1) };
    }

    if (mime === MimeType.CSV || file.getName().toLowerCase().endsWith('.csv')) {
      const conteudo = file.getBlob().getDataAsString('UTF-8');
      const matriz = Utilities.parseCsv(conteudo);
      if (!matriz.length) return { headers: [], rows: [] };
      return { headers: matriz[0].map(String), rows: matriz.slice(1) };
    }

    throw Object.assign(
      new Error('Formato não suportado nesta fase (' + mime + '). Converta o arquivo pra CSV ou Google Sheets antes de importar.'),
      { code: CORE_CONSTANTS.RESPONSE_CODES.EXTERNAL_INTEGRATION_NOT_CONFIGURED }
    );
  }

  function healthCheck() {
    const configured = !!Core_Config.get('SAP_IMPORT_FOLDER_ID');
    return { status: configured ? CORE_CONSTANTS.DOCTOR_STATUS.OK : CORE_CONSTANTS.DOCTOR_STATUS.NOT_CONFIGURED };
  }
  return { lerArquivoExportado, parseArquivo, healthCheck };
})();
