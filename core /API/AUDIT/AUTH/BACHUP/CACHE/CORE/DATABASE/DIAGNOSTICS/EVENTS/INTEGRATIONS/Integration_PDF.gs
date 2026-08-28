/**
 * ============================================================
 * ALMOXA PRO — Integration_PDF.gs
 * Geração de PDF (relatórios, comprovantes, etiquetas). Usa o
 * recurso nativo do Apps Script de exportar HTML/Sheet como PDF.
 * ============================================================
 */
const Integration_PDF = (function () {
  function fromHtml(htmlContent, filename) {
    const blob = Utilities.newBlob(htmlContent, 'text/html', filename + '.html').getAs('application/pdf');
    blob.setName(filename + '.pdf');
    return blob;
  }
  return { fromHtml };
})();
