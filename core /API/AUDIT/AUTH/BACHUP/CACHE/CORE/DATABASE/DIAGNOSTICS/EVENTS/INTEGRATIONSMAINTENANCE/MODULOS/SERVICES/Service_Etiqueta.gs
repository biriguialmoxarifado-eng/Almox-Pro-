/**
 * ============================================================
 * ALMOXA PRO — Service_Etiqueta.gs
 * FASE 12 — base real (generate/print com QR via serviço público
 * + PDF via Integration_PDF, honesto quando o QR externo falha).
 *
 * BLOCO 08 (contrato "Etiquetas/QR Code") — auditei o arquivo
 * antes de tocar (regra 1 do contrato: localizar EtiquetaService/
 * QRCodeService/etc. antes de criar qualquer coisa). Achei a base
 * real, mas faltavam gaps genuínos comparados item a item:
 *
 * - MODELOS (seção 17/18): não existia NADA — nem tabela, nem
 *   CRUD. Criado do zero: criarModelo/listarModelos/getModelo/
 *   atualizarModelo/duplicarModelo/excluirModelo (soft delete)/
 *   definirModeloPadrao.
 * - CONTEÚDO CONFIGURÁVEL (seção 5): generate() só gravava tipo/
 *   referência — não guardava QUAIS campos exibir. Agora aceita
 *   camposExibidos (direto ou herdado de um modelo).
 * - GERAÇÃO EM LOTE (seção 10): não existia — gerarLote() novo,
 *   reaproveitando generate() pra cada item, nunca duplicando a
 *   lógica de montar QR/código de barras.
 * - ZEBRA (seção 11): "separar geração de envio pra impressora" —
 *   gerarZPL() novo, HONESTO: Apps Script não tem como falar com
 *   uma impressora física de verdade (sem driver/rede local
 *   acessível do servidor) — a função gera o COMANDO ZPL (texto),
 *   que o dispositivo/Front é quem efetivamente envia pra
 *   impressora. Documentado, não fingido como "imprimiu".
 * - LEITURA DE QR (seção 9): já existe — Service_Skills
 *   .consultarPorQRCode() (Módulo 15) já faz exatamente o fluxo
 *   "QR → API → registro → rastreabilidade". Não duplicado aqui —
 *   só ampliei aquela função com o tipo INVENTARIO que faltava, e
 *   registrei um alias de rota etiqueta.lerQR pra ficar
 *   descobrível dentro do próprio namespace de etiquetas.
 * - TIPO INVENTARIO (seção 3): adicionado — real, tabela existe.
 *   EPI NÃO foi adicionado: não existe módulo de EPI com backend
 *   real no sistema (pendência já documentada desde o Módulo 05/06)
 *   — a seção 3 do próprio contrato diz "não disponibilizar tipos
 *   que não possuam suporte real".
 * ============================================================
 */

const Service_Etiqueta = (function () {

  const TIPOS_VALIDOS = ['PRODUTO', 'PRATELEIRA', 'LOCALIZACAO', 'CAIXA', 'PATRIMONIO', 'FERRAMENTA', 'INVENTARIO'];
  const TAMANHOS_PADRAO = ['60X40', '80X50', '100X50', 'PERSONALIZADO'];
  const CAMPOS_SUPORTADOS = ['codigo', 'descricao', 'localizacao', 'unidade', 'quantidade', 'pep', 'obra', 'qr', 'codigoBarras', 'data', 'responsavel'];

  function _montarConteudo(tipo, referenciaId) {
    return tipo + ':' + referenciaId;
  }

  function _descricaoDoAlvo(tipo, referenciaId) {
    if (tipo === 'PRODUTO') {
      const p = DB_Query.get('PRODUTOS', referenciaId);
      return p ? p.descricaoOriginal : ('Produto #' + referenciaId);
    }
    if (tipo === 'LOCALIZACAO' || tipo === 'PRATELEIRA') {
      return String(referenciaId);
    }
    if (tipo === 'FERRAMENTA') {
      const f = DB_Query.get('FERRAMENTAS', referenciaId);
      return f ? (f.codigo + ' — ' + f.descricao) : ('Ferramenta #' + referenciaId);
    }
    if (tipo === 'INVENTARIO') {
      const inv = DB_Query.get('INVENTARIOS', referenciaId);
      return inv ? inv.token : ('Inventário #' + referenciaId);
    }
    return String(referenciaId);
  }

  /** BLOCO 08, seção 5 — monta o VALOR real de cada campo pedido, nunca inventa dado. Campo sem correspondência real fica vazio, não "N/A" fictício. */
  function _valoresDosCampos(tipo, referenciaId, camposExibidos) {
    const valores = {};
    const produto = tipo === 'PRODUTO' ? DB_Query.get('PRODUTOS', referenciaId) : null;
    const estoque = produto ? DB_Query.findOne('ESTOQUE', function (e) { return String(e.produtoId) === String(referenciaId); }) : null;
    const ferramenta = tipo === 'FERRAMENTA' ? DB_Query.get('FERRAMENTAS', referenciaId) : null;

    (camposExibidos || []).forEach(function (campo) {
      switch (campo) {
        case 'codigo': valores.codigo = produto ? produto.codigo : (ferramenta ? ferramenta.codigo : String(referenciaId)); break;
        case 'descricao': valores.descricao = _descricaoDoAlvo(tipo, referenciaId); break;
        case 'localizacao': valores.localizacao = estoque ? estoque.localizacao : (ferramenta ? ferramenta.localizacao : (tipo === 'LOCALIZACAO' ? String(referenciaId) : '')); break;
        case 'unidade': valores.unidade = produto ? (produto.unidade || '') : ''; break;
        case 'quantidade': valores.quantidade = estoque ? estoque.saldo : ''; break;
        case 'pep': valores.pep = ''; break; // honesto: nenhum módulo popula classificadorPEP em nível de produto/estoque ainda (mesma limitação documentada nos Blocos de IA/Relatórios)
        case 'obra': valores.obra = estoque ? (estoque.obraId || '') : ''; break;
        case 'data': valores.data = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy'); break;
        case 'responsavel': valores.responsavel = ''; break; // preenchido por quem gera, não pela etiqueta em si — ver print()
        default: break;
      }
    });
    return valores;
  }

  function generate(ctx) {
    const p = ctx.payload || {};
    let tipo = p.tipo, referenciaId = p.referenciaId, tamanho = p.tamanho, fonte = p.fonte, camposExibidos = p.camposExibidos, modeloId = p.modeloId;

    let modelo = null;
    if (modeloId) {
      modelo = DB_Query.get('ETIQUETA_MODELOS', modeloId);
      if (!modelo || modelo.situacao === 'EXCLUIDO') return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Modelo não encontrado.', {}, ctx.requestId);
      tipo = tipo || modelo.tipo;
      tamanho = tamanho || modelo.largura + 'X' + modelo.altura;
      fonte = fonte || modelo.fonte;
      camposExibidos = camposExibidos || (modelo.camposExibidos ? modelo.camposExibidos.split(',') : null);
    }

    if (!tipo || TIPOS_VALIDOS.indexOf(tipo) === -1 || !referenciaId) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR,
        'tipo (' + TIPOS_VALIDOS.join('/') + ') e referenciaId são obrigatórios.', {}, ctx.requestId);
    }
    const camposFinal = Array.isArray(camposExibidos) ? camposExibidos.filter(function (c) { return CAMPOS_SUPORTADOS.indexOf(c) > -1; }) : ['codigo', 'descricao', 'qr'];

    const conteudoQR = _montarConteudo(tipo, referenciaId);
    let codigoBarras = '';
    if (tipo === 'PRODUTO') {
      const produto = DB_Query.get('PRODUTOS', referenciaId);
      codigoBarras = produto ? (produto.codigoBarras || produto.codigo || '') : '';
    }

    const registro = DB_Insert.insert('ETIQUETA', {
      tipo: tipo, referenciaId: referenciaId, conteudoQR: conteudoQR, codigoBarras: codigoBarras,
      tamanho: tamanho || '60X40', fonte: fonte || 'ARIAL', geradoEm: new Date(),
      modeloId: modeloId || '', camposExibidos: camposFinal.join(',')
    });
    Audit_Service.record(ctx, 'ETIQUETA_GERADA', { entidade: 'ETIQUETA', entidadeId: registro.ID }, null, { tipo: tipo, referenciaId: referenciaId, modeloId: modeloId || null });

    return Core_Response.ok(Object.assign({}, registro, { descricao: _descricaoDoAlvo(tipo, referenciaId) }),
      'Etiqueta gerada. Use etiqueta.print pra montar o PDF pronto pra imprimir.', 'SUCCESS', {}, ctx.requestId);
  }

  /**
   * BLOCO 08, seção 10 — geração em lote. Nunca reimplementa
   * generate() — só resolve QUAIS referências gerar e chama a
   * função de sempre pra cada uma. Suporta lista explícita de IDs
   * ou um filtro (localização/inventário/busca) resolvido pelas
   * funções de busca que os módulos de origem já têm.
   */
  function gerarLote(ctx) {
    const p = ctx.payload || {};
    let referenciaIds = Array.isArray(p.referenciaIds) ? p.referenciaIds.slice() : [];

    if (!referenciaIds.length && p.filtro) {
      if (p.tipo === 'PRODUTO' && p.filtro.localizacao) {
        referenciaIds = DB_Query.find('ESTOQUE', function (e) { return e.localizacao === p.filtro.localizacao; }).map(function (e) { return e.produtoId; });
      } else if (p.tipo === 'PRODUTO' && p.filtro.busca) {
        const r = Service_Produto.search({ userId: ctx.userId, requestId: ctx.requestId, perfil: ctx.perfil, payload: { descricao: p.filtro.busca } });
        referenciaIds = r.success ? r.data.map(function (prod) { return prod.ID; }) : [];
      } else if (p.tipo === 'PRODUTO' && p.filtro.inventarioId) {
        const rel = Service_Inventario.relatorio({ userId: ctx.userId, requestId: ctx.requestId, payload: { id: p.filtro.inventarioId } });
        referenciaIds = rel.success ? rel.data.itens.map(function (item) { return item.produtoId; }) : [];
      } else if (p.tipo === 'FERRAMENTA' && p.filtro.busca) {
        const r = Service_Ferramenta.search({ userId: ctx.userId, requestId: ctx.requestId, perfil: ctx.perfil, payload: { busca: p.filtro.busca } });
        referenciaIds = r.success ? r.data.map(function (f) { return f.ID; }) : [];
      }
    }

    const limite = Math.min(referenciaIds.length, Number(p.limiteMaximo) || 200); // nunca gera volume descontrolado numa chamada só
    const geradas = [];
    const erros = [];
    referenciaIds.slice(0, limite).forEach(function (refId) {
      const resultado = generate({ userId: ctx.userId, requestId: ctx.requestId, perfil: ctx.perfil, payload: {
        tipo: p.tipo, referenciaId: refId, tamanho: p.tamanho, fonte: p.fonte, camposExibidos: p.camposExibidos, modeloId: p.modeloId
      }});
      if (resultado.success) geradas.push(resultado.data); else erros.push({ referenciaId: refId, erro: resultado.message });
    });

    Audit_Service.record(ctx, 'ETIQUETA_LOTE_GERADO', { entidade: 'ETIQUETA', entidadeId: 'LOTE' }, null, { totalSolicitado: referenciaIds.length, totalGerado: geradas.length, totalErros: erros.length });
    return Core_Response.ok({ totalGerado: geradas.length, etiquetas: geradas, erros: erros },
      geradas.length + ' etiqueta(s) gerada(s) em lote.', 'SUCCESS', {}, ctx.requestId);
  }

  function _buscarImagemQR(conteudo) {
    const url = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(conteudo);
    const resposta = Integration_ExternalAPI.call(url, { method: 'get' });
    if (resposta.status !== 200) throw new Error('Serviço de QR indisponível (status ' + resposta.status + ').');
    return resposta.body;
  }

  function print(ctx) {
    const etiqueta = DB_Query.get('ETIQUETA', ctx.payload.id);
    if (!etiqueta) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Etiqueta não encontrada.', {}, ctx.requestId);

    const camposExibidos = etiqueta.camposExibidos ? etiqueta.camposExibidos.split(',') : ['codigo', 'descricao', 'qr'];
    const valores = _valoresDosCampos(etiqueta.tipo, etiqueta.referenciaId, camposExibidos);
    if (camposExibidos.indexOf('responsavel') > -1) valores.responsavel = ctx.userId;

    let imgTag = '';
    let imagemGerada = false;
    if (camposExibidos.indexOf('qr') > -1) {
      try {
        const url = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(etiqueta.conteudoQR);
        const resposta = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
        if (resposta.getResponseCode() === 200) {
          const base64 = Utilities.base64Encode(resposta.getBlob().getBytes());
          imgTag = '<img src="data:image/png;base64,' + base64 + '" width="150" height="150"/>';
          imagemGerada = true;
        }
      } catch (e) { /* segue sem imagem — não trava a etiqueta por causa de um serviço externo */ }
    }

    // BLOCO 08, seção 5 — monta o corpo da etiqueta só com os campos que foram pedidos de verdade, cada um com o valor real (nunca "N/A" fictício).
    const linhasCampo = Object.keys(valores)
      .filter(function (campo) { return valores[campo] !== '' && valores[campo] !== null && valores[campo] !== undefined; })
      .map(function (campo) { return '<div style="font-size:9px;color:#666;margin-top:4px;">' + campo.toUpperCase() + '</div><div style="font-size:12px;font-weight:bold;">' + valores[campo] + '</div>'; })
      .join('');

    const html =
      '<div style="width:280px;border:1px solid #000;padding:10px;font-family:' + (etiqueta.fonte || 'Arial') + ';text-align:center;">' +
      '<div style="font-size:10px;color:#999;">ALMOXA PRO</div>' + linhasCampo +
      (camposExibidos.indexOf('qr') > -1 ? (imgTag || '<div style="padding:20px;font-size:10px;color:#999;">QR indisponível — código abaixo</div>') : '') +
      (camposExibidos.indexOf('qr') > -1 ? '<div style="font-size:14px;letter-spacing:1px;margin-top:6px;">' + etiqueta.conteudoQR + '</div>' : '') +
      (camposExibidos.indexOf('codigoBarras') > -1 && etiqueta.codigoBarras ? '<div style="font-size:11px;margin-top:4px;">Cód. barras: ' + etiqueta.codigoBarras + '</div>' : '') +
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

    Audit_Service.record(ctx, 'ETIQUETA_IMPRESSA', { entidade: 'ETIQUETA', entidadeId: etiqueta.ID }, null, { imagemGerada: imagemGerada, salvoNoDrive: !!arquivo });

    return Core_Response.ok({
      imagemGerada: imagemGerada, arquivo: arquivo,
      aviso: imagemGerada ? null : 'Serviço público de QR indisponível no momento — PDF gerado só com o código em texto.'
    }, 'Etiqueta pronta.', 'SUCCESS', {}, ctx.requestId);
  }

  /**
   * BLOCO 08, seção 11 — "separar GERAÇÃO da etiqueta de ENVIO
   * pra impressora". HONESTO: Apps Script roda no servidor do
   * Google, sem acesso a rede local nem driver de impressora —
   * não tem como "enviar pra Zebra" de dentro daqui de verdade.
   * O que esta função faz é gerar o COMANDO ZPL (texto puro, o
   * idioma que impressoras Zebra entendem) — o envio real pra
   * impressora é responsabilidade do dispositivo/Front (app
   * mobile com SDK de impressora, ou serviço local na rede da
   * obra). Isso É a separação que a seção 11 pede: geração aqui,
   * envio em outra camada, nunca acoplado.
   */
  function gerarZPL(ctx) {
    const etiqueta = DB_Query.get('ETIQUETA', ctx.payload.id);
    if (!etiqueta) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Etiqueta não encontrada.', {}, ctx.requestId);

    const mapaDimensoes = { '60X40': [480, 320], '80X50': [640, 400], '100X50': [800, 400] };
    const dimensoes = mapaDimensoes[etiqueta.tamanho] || [480, 320];
    const camposExibidos = etiqueta.camposExibidos ? etiqueta.camposExibidos.split(',') : ['codigo', 'descricao', 'qr'];
    const descricao = _descricaoDoAlvo(etiqueta.tipo, etiqueta.referenciaId);

    // ZPL mínimo real: cabeçalho + texto + QR nativo da impressora (^BQ), sem depender de nenhum serviço externo de imagem.
    let zpl = '^XA\n^PW' + dimensoes[0] + '\n^LL' + dimensoes[1] + '\n';
    zpl += '^FO20,20^A0N,20,20^FDALMOXA PRO^FS\n';
    zpl += '^FO20,50^A0N,24,24^FD' + descricao + '^FS\n';
    if (camposExibidos.indexOf('qr') > -1) {
      zpl += '^FO20,90^BQN,2,5\n^FDQA,' + etiqueta.conteudoQR + '^FS\n';
    }
    if (camposExibidos.indexOf('codigoBarras') > -1 && etiqueta.codigoBarras) {
      zpl += '^FO20,220^BY2\n^BCN,60,Y,N,N\n^FD' + etiqueta.codigoBarras + '^FS\n';
    }
    zpl += '^XZ';

    Audit_Service.record(ctx, 'ETIQUETA_ZPL_GERADO', { entidade: 'ETIQUETA', entidadeId: etiqueta.ID });
    return Core_Response.ok({ zpl: zpl, tamanho: etiqueta.tamanho },
      'Comando ZPL gerado — o envio pra impressora física é feito pelo dispositivo/app, não pelo backend.', 'SUCCESS', {}, ctx.requestId);
  }

  // ---- MODELOS (seção 17/18) — não existia nada disso antes ----

  function criarModelo(ctx) {
    const p = ctx.payload || {};
    if (!p.nome || !p.tipo) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'nome e tipo são obrigatórios.', {}, ctx.requestId);
    if (TIPOS_VALIDOS.indexOf(p.tipo) === -1) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'tipo inválido: ' + p.tipo, {}, ctx.requestId);

    const camposFinal = Array.isArray(p.camposExibidos) ? p.camposExibidos.filter(function (c) { return CAMPOS_SUPORTADOS.indexOf(c) > -1; }) : ['codigo', 'descricao', 'qr'];
    const agora = new Date();
    const modelo = DB_Insert.insert('ETIQUETA_MODELOS', {
      nome: p.nome, tipo: p.tipo, largura: p.largura || 60, altura: p.altura || 40,
      margem: p.margem || 2, fonte: p.fonte || 'ARIAL', tamanhoFonte: p.tamanhoFonte || 10,
      negrito: !!p.negrito, alinhamento: p.alinhamento || 'CENTRO', espacamento: p.espacamento || 4,
      tamanhoQR: p.tamanhoQR || 150, posicaoQR: p.posicaoQR || 'INFERIOR', orientacao: p.orientacao || 'RETRATO',
      temCodigoBarras: !!p.temCodigoBarras, camposExibidos: camposFinal.join(','),
      impressoraPadrao: p.impressoraPadrao || '', padrao: false, situacao: 'ATIVO',
      criadoPor: ctx.userId, dataCriacao: agora, dataAtualizacao: agora
    });
    Audit_Service.record(ctx, 'ETIQUETA_MODELO_CRIADO', { entidade: 'ETIQUETA_MODELOS', entidadeId: modelo.ID });
    return Core_Response.ok(modelo, 'Modelo criado.', 'SUCCESS', {}, ctx.requestId);
  }

  function listarModelos(ctx) {
    const p = ctx.payload || {};
    const modelos = DB_Query.find('ETIQUETA_MODELOS', function (m) { return m.situacao !== 'EXCLUIDO' && (!p.tipo || m.tipo === p.tipo); });
    return Core_Response.ok(modelos, '', 'SUCCESS', {}, ctx.requestId);
  }

  function getModelo(ctx) {
    const modelo = DB_Query.get('ETIQUETA_MODELOS', ctx.payload.id);
    if (!modelo || modelo.situacao === 'EXCLUIDO') return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Modelo não encontrado.', {}, ctx.requestId);
    return Core_Response.ok(modelo, '', 'SUCCESS', {}, ctx.requestId);
  }

  function atualizarModelo(ctx) {
    const id = (ctx.payload || {}).id;
    const modelo = DB_Query.get('ETIQUETA_MODELOS', id);
    if (!modelo || modelo.situacao === 'EXCLUIDO') return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Modelo não encontrado.', {}, ctx.requestId);

    const camposEditaveis = ['nome', 'largura', 'altura', 'margem', 'fonte', 'tamanhoFonte', 'negrito', 'alinhamento', 'espacamento', 'tamanhoQR', 'posicaoQR', 'orientacao', 'temCodigoBarras', 'impressoraPadrao'];
    const alteracoes = { dataAtualizacao: new Date() };
    camposEditaveis.forEach(function (campo) { if (ctx.payload[campo] !== undefined) alteracoes[campo] = ctx.payload[campo]; });
    if (Array.isArray(ctx.payload.camposExibidos)) alteracoes.camposExibidos = ctx.payload.camposExibidos.filter(function (c) { return CAMPOS_SUPORTADOS.indexOf(c) > -1; }).join(',');

    DB_Update.byId('ETIQUETA_MODELOS', id, alteracoes);
    Audit_Service.record(ctx, 'ETIQUETA_MODELO_ATUALIZADO', { entidade: 'ETIQUETA_MODELOS', entidadeId: id }, modelo, alteracoes);
    return Core_Response.ok(DB_Query.get('ETIQUETA_MODELOS', id), 'Modelo atualizado.', 'SUCCESS', {}, ctx.requestId);
  }

  function duplicarModelo(ctx) {
    const original = DB_Query.get('ETIQUETA_MODELOS', ctx.payload.id);
    if (!original || original.situacao === 'EXCLUIDO') return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Modelo não encontrado.', {}, ctx.requestId);

    const agora = new Date();
    const copia = Object.assign({}, original, {
      nome: original.nome + ' (cópia)', padrao: false,
      criadoPor: ctx.userId, dataCriacao: agora, dataAtualizacao: agora
    });
    delete copia.ID; delete copia._rowIndex;
    const novoModelo = DB_Insert.insert('ETIQUETA_MODELOS', copia);
    Audit_Service.record(ctx, 'ETIQUETA_MODELO_DUPLICADO', { entidade: 'ETIQUETA_MODELOS', entidadeId: novoModelo.ID }, null, { origemId: original.ID });
    return Core_Response.ok(novoModelo, 'Modelo duplicado.', 'SUCCESS', {}, ctx.requestId);
  }

  /** Soft delete obrigatório (seção 18) — nunca remove a linha, só marca. */
  function excluirModelo(ctx) {
    const modelo = DB_Query.get('ETIQUETA_MODELOS', ctx.payload.id);
    if (!modelo || modelo.situacao === 'EXCLUIDO') return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Modelo não encontrado.', {}, ctx.requestId);
    DB_Update.byId('ETIQUETA_MODELOS', modelo.ID, { situacao: 'EXCLUIDO', dataAtualizacao: new Date() });
    Audit_Service.record(ctx, 'ETIQUETA_MODELO_EXCLUIDO', { entidade: 'ETIQUETA_MODELOS', entidadeId: modelo.ID });
    return Core_Response.ok({ excluido: true }, 'Modelo excluído (soft delete).', 'SUCCESS', {}, ctx.requestId);
  }

  function definirModeloPadrao(ctx) {
    const modelo = DB_Query.get('ETIQUETA_MODELOS', ctx.payload.id);
    if (!modelo || modelo.situacao === 'EXCLUIDO') return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Modelo não encontrado.', {}, ctx.requestId);

    DB_Query.find('ETIQUETA_MODELOS', function (m) { return m.tipo === modelo.tipo && m.padrao; }).forEach(function (m) { DB_Update.byId('ETIQUETA_MODELOS', m.ID, { padrao: false }); });
    DB_Update.byId('ETIQUETA_MODELOS', modelo.ID, { padrao: true, dataAtualizacao: new Date() });
    Audit_Service.record(ctx, 'ETIQUETA_MODELO_PADRAO_DEFINIDO', { entidade: 'ETIQUETA_MODELOS', entidadeId: modelo.ID });
    return Core_Response.ok(DB_Query.get('ETIQUETA_MODELOS', modelo.ID), 'Modelo definido como padrão.', 'SUCCESS', {}, ctx.requestId);
  }

  /** BLOCO 08, seção 9 — alias fino: a leitura de QR já existe de verdade no Módulo 15 (Skills). Nunca duplicada aqui. */
  function lerQR(ctx) {
    return Service_Skills.consultarPorQRCode(ctx);
  }

  return {
    generate: generate, print: print, gerarLote: gerarLote, gerarZPL: gerarZPL, lerQR: lerQR,
    criarModelo: criarModelo, listarModelos: listarModelos, getModelo: getModelo, atualizarModelo: atualizarModelo,
    duplicarModelo: duplicarModelo, excluirModelo: excluirModelo, definirModeloPadrao: definirModeloPadrao,
    TIPOS_VALIDOS: TIPOS_VALIDOS, TAMANHOS_PADRAO: TAMANHOS_PADRAO, CAMPOS_SUPORTADOS: CAMPOS_SUPORTADOS
  };
})();
