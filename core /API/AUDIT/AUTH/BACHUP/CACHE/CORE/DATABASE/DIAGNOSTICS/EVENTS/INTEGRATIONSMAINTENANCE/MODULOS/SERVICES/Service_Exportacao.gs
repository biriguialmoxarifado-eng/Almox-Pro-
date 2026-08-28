/**
 * ============================================================
 * ALMOXA PRO — Service_Exportacao.gs
 * FASE 10 — NOVO (MOD_11_EXPORTACAO estava vazio desde a Fase 1).
 * Exportação genérica de QUALQUER tabela do sistema (diferente
 * de Service_Relatorio, que já monta dataset com join/cálculo —
 * aqui é despejo bruto de tabela, útil pra backup pontual ou
 * integração externa simples).
 * ============================================================
 */

const Service_Exportacao = (function () {

  function _pastaExportacoes() {
    const folderId = Core_Config.get('DRIVE_FOLDER_DOCS') || Core_Config.get('DRIVE_FOLDER_ID');
    if (!folderId) {
      throw Object.assign(new Error('DRIVE_FOLDER_DOCS/DRIVE_FOLDER_ID não configurado.'), { code: CORE_CONSTANTS.RESPONSE_CODES.EXTERNAL_INTEGRATION_NOT_CONFIGURED });
    }
    return Utils_File.getOrCreateFolder(folderId, 'Exportacoes');
  }

  function generic(ctx) {
    const { tabela, filtros, formato } = ctx.payload || {};
    if (!tabela || !DB_Mapping.getExpectedHeaders(tabela)) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'tabela desconhecida ou não informada: ' + tabela, {}, ctx.requestId);
    }

    const dados = DB_Query.find(tabela, row => {
      if (!filtros) return true;
      return Object.keys(filtros).every(campo => String(row[campo]) === String(filtros[campo]));
    });

    try {
      const pasta = _pastaExportacoes();
      const nomeBase = 'export_' + tabela.toLowerCase() + '_' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');
      let blob;
      if ((formato || 'CSV').toUpperCase() === 'JSON') {
        blob = Utils_Export.toJSONBlob(dados, nomeBase);
      } else {
        blob = Utilities.newBlob(Utils_Export.toCSV(dados), 'text/csv', nomeBase + '.csv');
      }
      const arquivo = Integration_GoogleDrive.uploadFile(pasta.getId(), blob);

      DB_Insert.insert('DOCUMENTOS', { tipo: 'EXPORTACAO', referenciaModulo: 'EXPORTACAO', referenciaId: tabela, driveFileId: arquivo.fileId, nomeArquivo: nomeBase, data: new Date() });
      Audit_Service.record(ctx, 'EXPORTACAO_GENERICA', { entidade: tabela }, null, { totalRegistros: dados.length, formato });

      return Core_Response.ok(Object.assign({ totalRegistros: dados.length }, arquivo), 'Exportado.', 'SUCCESS', {}, ctx.requestId);
    } catch (e) {
      return Core_Response.error(e.code || CORE_CONSTANTS.RESPONSE_CODES.INTERNAL_ERROR, e.message, {}, ctx.requestId);
    }
  }

  return { generic };
})();
