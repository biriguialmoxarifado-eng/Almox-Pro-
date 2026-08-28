/**
 * ============================================================
 * ALMOXA PRO — Test_Bloco08_Etiquetas.gs
 * generate()/print() com QR real e fallback honesto já tinham
 * cobertura própria (Test_Fase12_EtiquetasIAConfig.gs, entrega
 * original) — não duplicado aqui. Este teste foca no que é
 * GENUINAMENTE NOVO: modelos (CRUD completo), conteúdo
 * configurável real, geração em lote, ZPL separado do PDF,
 * leitura de QR (incluindo o tipo INVENTARIO novo) e permissões.
 * ============================================================
 */

function Test_Bloco08_Etiquetas_fluxoCompleto() {
  Core_API.bootstrap();
  const resultados = {};

  const admin = Core_API.call({ action: 'auth.login', payload: { identificacao: 'admin', senha: 'almoxa123' } });
  const sessionAdmin = admin.data.sessionId;
  const operador = Core_API.call({ action: 'loja.cadastro', payload: { nome: 'Operador B08', matricula: 'B08-OP-' + Date.now(), senha: '1234' } });

  const modelo = Core_API.call({ action: 'etiqueta.criarModelo', sessionId: sessionAdmin, payload: { nome: 'Modelo Padrão Material B08', tipo: 'PRODUTO', largura: 80, altura: 50, camposExibidos: ['codigo', 'descricao', 'localizacao', 'qr'] } });
  resultados.criarModeloFunciona = modelo.success && modelo.data.tipo === 'PRODUTO' && modelo.data.situacao === 'ATIVO';

  const listaModelos = Core_API.call({ action: 'etiqueta.listarModelos', sessionId: sessionAdmin, payload: { tipo: 'PRODUTO' } });
  resultados.listarModelosFunciona = listaModelos.success && listaModelos.data.some(function (m) { return m.ID === modelo.data.ID; });

  const atualizacao = Core_API.call({ action: 'etiqueta.atualizarModelo', sessionId: sessionAdmin, payload: { id: modelo.data.ID, tamanhoFonte: 14, negrito: true } });
  resultados.atualizarModeloFunciona = atualizacao.success && atualizacao.data.tamanhoFonte === 14 && atualizacao.data.negrito === true;

  const duplicata = Core_API.call({ action: 'etiqueta.duplicarModelo', sessionId: sessionAdmin, payload: { id: modelo.data.ID } });
  resultados.duplicarModeloFunciona = duplicata.success && duplicata.data.ID !== modelo.data.ID && duplicata.data.nome.indexOf('cópia') > -1;

  const definirPadrao = Core_API.call({ action: 'etiqueta.definirModeloPadrao', sessionId: sessionAdmin, payload: { id: modelo.data.ID } });
  resultados.definirPadraoFunciona = definirPadrao.success && definirPadrao.data.padrao === true;
  const duplicataNaoEhPadrao = Core_API.call({ action: 'etiqueta.getModelo', sessionId: sessionAdmin, payload: { id: duplicata.data.ID } });
  resultados.soUmPadraoPorTipo = duplicataNaoEhPadrao.success && duplicataNaoEhPadrao.data.padrao === false;

  const exclusao = Core_API.call({ action: 'etiqueta.excluirModelo', sessionId: sessionAdmin, payload: { id: duplicata.data.ID } });
  const buscaAposExcluir = Core_API.call({ action: 'etiqueta.getModelo', sessionId: sessionAdmin, payload: { id: duplicata.data.ID } });
  resultados.softDeleteFunciona = exclusao.success && !buscaAposExcluir.success;
  const linhaAindaExisteNoBanco = DB_Query.get('ETIQUETA_MODELOS', duplicata.data.ID);
  resultados.softDeleteNuncaApagaALinha = !!linhaAindaExisteNoBanco && linhaAindaExisteNoBanco.situacao === 'EXCLUIDO';

  const tentativaModeloPorOperador = Core_API.call({ action: 'etiqueta.criarModelo', sessionId: operador.data.sessionId, payload: { nome: 'x', tipo: 'PRODUTO' } });
  resultados.bloqueiaModeloParaNaoAdmin = !tentativaModeloPorOperador.success && tentativaModeloPorOperador.code === CORE_CONSTANTS.RESPONSE_CODES.PERMISSION_DENIED;

  const produto = Core_API.call({ action: 'produto.create', sessionId: sessionAdmin, payload: { descricaoOriginal: 'Item Etiqueta B08', codigo: 'B08-ITEM' } });
  Core_API.call({ action: 'estoque.entry', sessionId: sessionAdmin, payload: { produtoId: produto.data.ID, localizacao: 'TESTE-B08', quantidade: 12 } });
  const etiquetaComModelo = Core_API.call({ action: 'etiqueta.generate', sessionId: sessionAdmin, payload: { referenciaId: produto.data.ID, modeloId: modelo.data.ID } });
  resultados.geracaoHerdaConfigDoModelo = etiquetaComModelo.success && etiquetaComModelo.data.tamanho === '80X50' && etiquetaComModelo.data.camposExibidos.indexOf('localizacao') > -1;

  const impressao = Core_API.call({ action: 'etiqueta.print', sessionId: sessionAdmin, payload: { id: etiquetaComModelo.data.ID } });
  resultados.impressaoFuncionaComCamposConfiguraveis = impressao.success;

  const produto2 = Core_API.call({ action: 'produto.create', sessionId: sessionAdmin, payload: { descricaoOriginal: 'Item Lote B08 A', codigo: 'B08-LOTE-A' } });
  const produto3 = Core_API.call({ action: 'produto.create', sessionId: sessionAdmin, payload: { descricaoOriginal: 'Item Lote B08 B', codigo: 'B08-LOTE-B' } });
  const lote = Core_API.call({ action: 'etiqueta.gerarLote', sessionId: sessionAdmin, payload: { tipo: 'PRODUTO', referenciaIds: [produto2.data.ID, produto3.data.ID], camposExibidos: ['codigo', 'qr'] } });
  resultados.geracaoEmLoteFunciona = lote.success && lote.data.totalGerado === 2;

  const localLote = 'TESTE-B08/LOTE';
  Core_API.call({ action: 'estoque.entry', sessionId: sessionAdmin, payload: { produtoId: produto2.data.ID, localizacao: localLote, quantidade: 1 } });
  Core_API.call({ action: 'estoque.entry', sessionId: sessionAdmin, payload: { produtoId: produto3.data.ID, localizacao: localLote, quantidade: 1 } });
  const loteFiltro = Core_API.call({ action: 'etiqueta.gerarLote', sessionId: sessionAdmin, payload: { tipo: 'PRODUTO', filtro: { localizacao: localLote } } });
  resultados.loteComFiltroDeLocalizacaoFunciona = loteFiltro.success && loteFiltro.data.totalGerado === 2;

  const zpl = Core_API.call({ action: 'etiqueta.gerarZPL', sessionId: sessionAdmin, payload: { id: etiquetaComModelo.data.ID } });
  resultados.zplGeradoComEstruturaCorreta = zpl.success && zpl.data.zpl.indexOf('^XA') === 0 && zpl.data.zpl.indexOf('^XZ') > -1;
  resultados.zplTemComandoQRNativo = zpl.success && zpl.data.zpl.indexOf('^BQ') > -1;
  resultados.zplNuncaAfirmaImprimir = zpl.success && zpl.message.indexOf('dispositivo') > -1;

  const inv = Core_API.call({ action: 'inventario.create', sessionId: sessionAdmin, payload: { localizacao: 'TESTE-B08/INV' } });
  const etiquetaInventario = Core_API.call({ action: 'etiqueta.generate', sessionId: sessionAdmin, payload: { tipo: 'INVENTARIO', referenciaId: inv.data.ID } });
  resultados.tipoInventarioFunciona = etiquetaInventario.success && etiquetaInventario.data.descricao === inv.data.token;

  const leituraInventario = Core_API.call({ action: 'etiqueta.lerQR', sessionId: sessionAdmin, payload: { conteudoQR: 'INVENTARIO:' + inv.data.ID } });
  resultados.leituraDeQrDeInventarioFunciona = leituraInventario.success;

  const leituraProduto = Core_API.call({ action: 'etiqueta.lerQR', sessionId: sessionAdmin, payload: { conteudoQR: 'PRODUTO:' + produto.data.ID } });
  resultados.leituraDeQrDeProdutoContinuaFuncionando = leituraProduto.success;

  const tipoInvalido = Core_API.call({ action: 'etiqueta.generate', sessionId: sessionAdmin, payload: { tipo: 'EPI', referenciaId: 1 } });
  resultados.tipoNaoSuportadoBloqueado = !tipoInvalido.success;

  const qrInvalido = Core_API.call({ action: 'etiqueta.lerQR', sessionId: sessionAdmin, payload: { conteudoQR: 'sem-formato-valido' } });
  resultados.qrInvalidoTratado = !qrInvalido.success;

  const passou = Object.values(resultados).every(Boolean);

  Logger.log('=== RESULTADOS BLOCO 08 (Etiquetas/QR Code) ===');
  Logger.log(JSON.stringify(resultados, null, 2));
  Logger.log('=== ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌') + ' ===');
  SpreadsheetApp.getUi().alert('Teste Bloco 08: ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌ — veja o Logger.'));

  return resultados;
}
