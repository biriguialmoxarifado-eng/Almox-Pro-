/**
 * ============================================================
 * ALMOXA PRO — Service_Etiqueta.gs
 * FASE 12 — IMPLEMENTADO DE VERDADE.
 *
 * generate(): monta o CONTEÚDO real que vai codificado no QR/
 * código de barras — isso sempre funciona, sem depender de nada
 * externo (é só texto/dados).
 *
 * print(): tenta gerar a IMAGEM do QR via um serviço público
 * (api.qrserver.com, através do Integration_ExternalAPI já
 * existente desde a Fase 1) e monta um PDF de verdade pronto pra
 * imprimir. Se o serviço externo estiver fora do ar, a etiqueta
 * ainda é gerada em PDF — só sem a imagem, com o código impresso
 * como texto grande (qualquer leitor aceita digitação manual, e
 * o Doutor do Sistema pode reportar a indisponibilidade). Não
 * finjo sucesso total quando só parte funcionou.
 * ============================================================
 */

const Service_Etiqueta = (function () {

  const TIPOS_VALIDOS = ['PRODUTO', 'PRATELEIRA', 'LOCALIZACAO', 'CAIXA', 'PATRIMONIO'];

  function _montarConteudo(tipo, referenciaId) {
    // Conteúdo do QR é um payload simples e legível por qualquer
    // leitor: TIPO:ID. O app mobile (fase de frontend) decodifica
    // isso pra buscar o registro certo via scanner.identificarPorCodigo.
    return tipo + ':' + referenciaId;
  }

  function _descricaoDoAlvo(tipo, referenciaId) {
    if (tipo === 'PRODUTO') {
      const p = DB_Query.get('PRODUTOS', referenciaId);
      return p ? p.descricaoOriginal : ('Produto #' + referenciaId);
    }
    if (tipo === 'LOCALIZACAO' || tipo === 'PRATELEIRA') {
      return String(referenciaId); // localização é uma string livre nesta fase (ver Fase 4)
    }
    return String(referenciaId);
  }

  function generate(ctx) {
    const { tipo, referenciaId, tamanho, fonte } = ctx.payload || {};
    if (!tipo || !TIPOS_VALIDOS.includes(tipo) || !referenciaId) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR,
        'tipo (' + TIPOS_VALIDOS.join('/') + ') e referenciaId são obrigatórios.', {}, ctx.requestId);
    }

    const conteudoQR = _montarConteudo(tipo, referenciaId);
    let codigoBarras = '';
    if (tipo === 'PRODUTO') {
      const produto = DB_Query.get('PRODUTOS', referenciaId);
      codigoBarras = produto ? (produto.codigoBarras || produto.codigo || '') : '';
    }

    const registro = DB_Insert.insert('ETIQUETA', {
      tipo, referenciaId, conteudoQR, codigoBarras,
      tamanho: tamanho || 'PEQUENA', fonte: fonte || 'ARIAL', geradoEm: new Date()
    });
    Audit_Service.record(ctx, 'ETIQUETA_GERADA', { entidade: 'ETIQUETA', entidadeId: registro.ID });

    return Core_Response.ok(Object.assign({}, registro, { descricao: _descricaoDoAlvo(tipo, referenciaId) }),
      'Etiqueta gerada. Use etiqueta.print pra montar o PDF pronto pra imprimir.', 'SUCCESS', {}, ctx.requestId);
  }

  function _buscarImagemQR(conteudo) {
    // Serviço público, sem chave/custo — melhor esforço (Integration_ExternalAPI
    // já centraliza UrlFetchApp desde a Fase 1). Se cair, print() segue sem imagem.
    const url = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(conteudo);
    const resposta = Integration_ExternalAPI.call(url, { method: 'get' });
    if (resposta.status !== 200) throw new Error('Serviço de QR indisponível (status ' + resposta.status + ').');
    return resposta.body; // bytes da imagem como string — ver uso abaixo com Utilities.newBlob
  }

  function print(ctx) {
    const etiqueta = DB_Query.get('ETIQUETA', ctx.payload.id);
    if (!etiqueta) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Etiqueta não encontrada.', {}, ctx.requestId);

    const descricao = _descricaoDoAlvo(etiqueta.tipo, etiqueta.referenciaId);
    let imgTag = '';
    let imagemGerada = false;

    try {
      const url = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(etiqueta.conteudoQR);
      const resposta = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      if (resposta.getResponseCode() === 200) {
        const base64 = Utilities.base64Encode(resposta.getBlob().getBytes());
        imgTag = '<img src="data:image/png;base64,' + base64 + '" width="150" height="150"/>';
        imagemGerada = true;
      }
    } catch (e) {
      // segue sem imagem — não trava a etiqueta por causa de um serviço externo
    }

    const html =
      '<div style="width:280px;border:1px solid #000;padding:10px;font-family:Arial;text-align:center;">' +
      '<div style="font-size:11px;font-weight:bold;">' + descricao + '</div>' +
      (imgTag || '<div style="padding:20px;font-size:10px;color:#999;">QR indisponível — código abaixo</div>') +
      '<div style="font-size:14px;letter-spacing:1px;margin-top:6px;">' + etiqueta.conteudoQR + '</div>' +
      (etiqueta.codigoBarras ? '<div style="font-size:11px;margin-top:4px;">Cód. barras: ' + etiqueta.codigoBarras + '</div>' : '') +
      '</div>';

    let blob;
    try {
      blob = Integration_PDF.fromHtml(html, 'etiqueta_' + etiqueta.ID);
    } catch (e) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.INTERNAL_ERROR, 'Falha ao gerar PDF: ' + e.message, {}, ctx.requestId);
    }

    let arquivo = null;
    try {
      const folderId = Core_Config.get('DRIVE_FOLDER_DOCS') || Core_Config.get('DRIVE_FOLDER_ID');
      if (folderId) {
        const pasta = Utils_File.getOrCreateFolder(folderId, 'Etiquetas');
        arquivo = Integration_GoogleDrive.uploadFile(pasta.getId(), blob);
      }
    } catch (e) { /* segue sem salvar no Drive se não configurado */ }

    Audit_Service.record(ctx, 'ETIQUETA_IMPRESSA', { entidade: 'ETIQUETA', entidadeId: etiqueta.ID }, null, { imagemGerada, salvoNoDrive: !!arquivo });

    return Core_Response.ok({
      imagemGerada, arquivo,
      aviso: imagemGerada ? null : 'Serviço público de QR indisponível no momento — PDF gerado só com o código em texto.'
    }, 'Etiqueta pronta.', 'SUCCESS', {}, ctx.requestId);
  }

  return { generate, print };
})();
