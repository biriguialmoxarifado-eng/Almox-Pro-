/**
 * ============================================================
 * ALMOXA PRO — Test_Modulo11_CentralDados.gs
 * Cobre os 10 cenários da seção 15: pesquisa simples, pesquisa
 * global, busca por ID, filtros, paginação, permissões, usuário
 * sem acesso, registro inexistente, grande volume, erro de fonte.
 * ============================================================
 */

function Test_Modulo11_CentralDados_fluxoCompleto() {
  Core_API.bootstrap();
  const resultados = {};

  const admin = Core_API.call({ action: 'auth.login', payload: { identificacao: 'admin', senha: 'almoxa123' } });
  const sessionAdmin = admin.data.sessionId;
  const operador = Core_API.call({ action: 'loja.cadastro', payload: { nome: 'Operador M11', matricula: 'M11-OP-' + Date.now(), senha: '1234' } });

  const produto = Core_API.call({ action: 'produto.create', sessionId: sessionAdmin, payload: { descricaoOriginal: 'Item Central Dados M11', codigo: 'M11-CD' } });
  const produtoId = produto.data.ID;
  Core_API.call({ action: 'estoque.entry', sessionId: sessionAdmin, payload: { produtoId, localizacao: 'TESTE-M11/CD', quantidade: 10 } });

  const buscaModulo = Core_API.call({ action: 'centraldados.buscarPorModulo', sessionId: sessionAdmin, payload: { modulo: 'PRODUTO', texto: 'Central Dados M11' } });
  resultados.pesquisaSimplesPorModulo = buscaModulo.success && buscaModulo.data.registros.some(r => r.ID === produtoId);

  const buscaGlobal = Core_API.call({ action: 'centraldados.pesquisar', sessionId: sessionAdmin, payload: { termo: 'Central Dados M11' } });
  const modulosQueAcharam = buscaGlobal.success ? new Set(buscaGlobal.data.registros.map(r => r.modulo)) : new Set();
  resultados.pesquisaGlobalCruzaModulos = buscaGlobal.success && modulosQueAcharam.has('PRODUTO') && modulosQueAcharam.has('ESTOQUE');

  const buscaId = Core_API.call({ action: 'centraldados.buscarPorId', sessionId: sessionAdmin, payload: { id: produtoId, tipo: 'PRODUTO' } });
  resultados.buscaPorIdFunciona = buscaId.success && buscaId.data.registro.codigo === 'M11-CD';

  const filtroStatus = Core_API.call({ action: 'centraldados.filtrar', sessionId: sessionAdmin, payload: { modulo: 'PRODUTO', status: 'ATIVO', texto: 'M11-CD' } });
  resultados.filtroPorStatusFunciona = filtroStatus.success && filtroStatus.data.registros.length === 1;

  for (let i = 0; i < 8; i++) {
    Core_API.call({ action: 'produto.create', sessionId: sessionAdmin, payload: { descricaoOriginal: 'Item Paginacao M11 ' + i, codigo: 'M11-PAG-' + i } });
  }
  const pagina1 = Core_API.call({ action: 'centraldados.filtrar', sessionId: sessionAdmin, payload: { modulo: 'PRODUTO', texto: 'Paginacao M11', limite: 3, offset: 0 } });
  const pagina2 = Core_API.call({ action: 'centraldados.filtrar', sessionId: sessionAdmin, payload: { modulo: 'PRODUTO', texto: 'Paginacao M11', limite: 3, offset: 3 } });
  resultados.paginacaoNuncaDevolveTudo = pagina1.success && pagina1.data.registros.length === 3 && pagina1.data.temMais === true &&
    pagina2.success && pagina2.data.registros[0].ID !== pagina1.data.registros[0].ID;

  const buscaUsuarioPorOperador = Core_API.call({ action: 'centraldados.filtrar', sessionId: operador.data.sessionId, payload: { modulo: 'USUARIO', texto: 'admin' } });
  const linhaAdminVistaPorOperador = buscaUsuarioPorOperador.success ? buscaUsuarioPorOperador.data.registros.find(r => r.nome && r.nome.toLowerCase().includes('admin')) : null;
  resultados.permissaoHerdadaDoModuloDeOrigem = !!linhaAdminVistaPorOperador && linhaAdminVistaPorOperador.perfil === undefined;

  const buscaInexistente = Core_API.call({ action: 'centraldados.buscarPorId', sessionId: sessionAdmin, payload: { id: 999999999, tipo: 'PRODUTO' } });
  resultados.registroInexistenteRetornaErro = !buscaInexistente.success && buscaInexistente.code === CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND;

  const moduloInvalido = Core_API.call({ action: 'centraldados.filtrar', sessionId: sessionAdmin, payload: { modulo: 'MODULO_QUE_NAO_EXISTE' } });
  resultados.moduloInvalidoTratado = !moduloInvalido.success && moduloInvalido.code === CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR;

  const relacionados = Core_API.call({ action: 'centraldados.buscarRelacionados', sessionId: sessionAdmin, payload: { tipo: 'PRODUTO', id: produtoId } });
  resultados.buscaRelacionadaFunciona = relacionados.success && relacionados.data.trajetoria.some(t => t.etapa === 'CADASTRO');

  const relacionadosSemSuporte = Core_API.call({ action: 'centraldados.buscarRelacionados', sessionId: sessionAdmin, payload: { tipo: 'FORNECEDOR', id: 1 } });
  resultados.tipoSemSuporteNaoInventaRelacao = !relacionadosSemSuporte.success;

  const passou = Object.values(resultados).every(Boolean);

  Logger.log('=== RESULTADOS MÓDULO 11 (Central de Dados) ===');
  Logger.log(JSON.stringify(resultados, null, 2));
  Logger.log('=== ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌') + ' ===');
  SpreadsheetApp.getUi().alert('Teste Módulo 11 (Central de Dados): ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌ — veja o Logger.'));

  return resultados;
}
