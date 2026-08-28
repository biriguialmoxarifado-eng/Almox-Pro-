/**
 * ============================================================
 * ALMOXA PRO — Test_Modulo10_Rastreabilidade.gs
 * Cobre os 9 cenários da seção 12 do contrato: criação de
 * evento, consulta de histórico, rastreabilidade, busca por ID,
 * filtros, permissões, registro inexistente, erro, e grande
 * quantidade de registros (paginação).
 * ============================================================
 */

function Test_Modulo10_Rastreabilidade_fluxoCompleto() {
  Core_API.bootstrap();
  const resultados = {};

  const admin = Core_API.call({ action: 'auth.login', payload: { identificacao: 'admin', senha: 'almoxa123' } });
  const sessionAdmin = admin.data.sessionId;
  const operador = Core_API.call({ action: 'loja.cadastro', payload: { nome: 'Operador M10', matricula: 'M10-OP-' + Date.now(), senha: '1234' } });

  const produto = Core_API.call({ action: 'produto.create', sessionId: sessionAdmin, payload: { descricaoOriginal: 'Item Rastreio M10', codigo: 'M10-RAST' } });
  const produtoId = produto.data.ID;
  const local = 'TESTE-M10/RASTREIO';

  // ---- 1) Criação de evento (registrarEvento é o mesmo Audit_Service.record por baixo) ----
  const totalAntes = Core_API.call({ action: 'rastreabilidade.consultarHistorico', sessionId: sessionAdmin, payload: { entidade: 'PRODUTOS', entidadeId: produtoId } }).data.totalEncontrado;
  const evento = Core_API.call({
    action: 'rastreabilidade.registrarEvento', sessionId: sessionAdmin,
    payload: { acao: 'TESTE_EVENTO_M10', entidade: 'PRODUTOS', entidadeId: produtoId, depois: { teste: true } }
  });
  const totalDepois = Core_API.call({ action: 'rastreabilidade.consultarHistorico', sessionId: sessionAdmin, payload: { entidade: 'PRODUTOS', entidadeId: produtoId } }).data.totalEncontrado;
  resultados.criaEventoDeVerdade = evento.success && totalDepois === totalAntes + 1;

  // ---- 2) Consulta de histórico com filtro ----
  Core_API.call({ action: 'estoque.entry', sessionId: sessionAdmin, payload: { produtoId, localizacao: local, quantidade: 20 } });
  const historicoFiltrado = Core_API.call({ action: 'rastreabilidade.consultarHistorico', sessionId: sessionAdmin, payload: { entidade: 'ESTOQUE' } });
  resultados.consultaHistoricoComFiltro = historicoFiltrado.success && historicoFiltrado.data.registros.every(r => r.entidade === 'ESTOQUE');

  // ---- 3) Rastreabilidade — trajetória por ID, cadastro sempre primeiro ----
  Core_API.call({ action: 'estoque.exit', sessionId: sessionAdmin, payload: { produtoId, localizacao: local, quantidade: 5 } });
  const rastreio = Core_API.call({ action: 'rastreabilidade.consultarRastreabilidade', sessionId: sessionAdmin, payload: { produtoId } });
  resultados.rastreabilidadeFunciona = rastreio.success && rastreio.data.trajetoria[0].etapa === 'CADASTRO' &&
    rastreio.data.trajetoria.some(t => t.etapa === 'MOVIMENTO_ENTRADA') && rastreio.data.trajetoria.some(t => t.etapa === 'MOVIMENTO_SAIDA');

  // ---- 4) Busca por ID — universal, sem informar tipo ----
  const buscaSemTipo = Core_API.call({ action: 'rastreabilidade.buscarPorId', sessionId: sessionAdmin, payload: { id: produtoId } });
  resultados.buscaPorIdUniversal = buscaSemTipo.success && buscaSemTipo.data.tipo === 'PRODUTO';

  const buscaComTipo = Core_API.call({ action: 'rastreabilidade.buscarPorId', sessionId: sessionAdmin, payload: { id: produtoId, tipo: 'PRODUTO' } });
  resultados.buscaPorIdComTipoExplicito = buscaComTipo.success && buscaComTipo.data.registro.codigo === 'M10-RAST';

  // ---- 5) Registro inexistente ----
  const buscaInexistente = Core_API.call({ action: 'rastreabilidade.buscarPorId', sessionId: sessionAdmin, payload: { id: 999999999, tipo: 'PRODUTO' } });
  resultados.registroInexistenteRetornaErroClaro = !buscaInexistente.success && buscaInexistente.code === CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND;

  // ---- 6) Erro — payload inválido não derruba o sistema ----
  const semId = Core_API.call({ action: 'rastreabilidade.buscarPorId', sessionId: sessionAdmin, payload: {} });
  resultados.erroDeValidacaoTratado = !semId.success && semId.code === CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR;

  // ---- 7) Permissões: operador só vê o PRÓPRIO histórico ----
  Core_API.call({ action: 'produto.create', sessionId: sessionAdmin, payload: { descricaoOriginal: 'Item de outro M10', codigo: 'M10-OUTRO' } });
  const historicoOperador = Core_API.call({ action: 'rastreabilidade.consultarHistorico', sessionId: operador.data.sessionId, payload: {} });
  resultados.operadorSoVeProprioHistorico = historicoOperador.success && historicoOperador.data.registros.every(r => String(r.usuario) === String(operador.data.userId));

  const tentaVerHistoricoDeOutro = Core_API.call({ action: 'rastreabilidade.consultarHistorico', sessionId: operador.data.sessionId, payload: { usuario: admin.data.userId } });
  resultados.naoVazaHistoricoDeOutro = tentaVerHistoricoDeOutro.success && tentaVerHistoricoDeOutro.data.registros.every(r => String(r.usuario) === String(operador.data.userId));

  const adminVeHistoricoDoOperador = Core_API.call({ action: 'rastreabilidade.consultarHistorico', sessionId: sessionAdmin, payload: { usuario: operador.data.userId } });
  resultados.perfilAmploVeHistoricoDeOutro = adminVeHistoricoDoOperador.success && adminVeHistoricoDoOperador.data.totalEncontrado > 0;

  // ---- 8) Grande quantidade de registros — paginação nunca devolve tudo de uma vez ----
  for (let i = 0; i < 15; i++) {
    Core_API.call({ action: 'rastreabilidade.registrarEvento', sessionId: sessionAdmin, payload: { acao: 'TESTE_PAGINACAO_M10_' + i, entidade: 'TESTE_PAGINACAO', entidadeId: 'X' } });
  }
  const paginaUm = Core_API.call({ action: 'rastreabilidade.consultarHistorico', sessionId: sessionAdmin, payload: { entidade: 'TESTE_PAGINACAO', limite: 5, offset: 0 } });
  const paginaDois = Core_API.call({ action: 'rastreabilidade.consultarHistorico', sessionId: sessionAdmin, payload: { entidade: 'TESTE_PAGINACAO', limite: 5, offset: 5 } });
  resultados.paginacaoFunciona = paginaUm.success && paginaUm.data.registros.length === 5 && paginaUm.data.temMais === true &&
    paginaDois.success && paginaDois.data.registros.length === 5 &&
    paginaUm.data.registros[0].acao !== paginaDois.data.registros[0].acao;

  // ---- 9) Linha do tempo genérica de um registro (Reserva, reaproveitando entidade/entidadeId) ----
  Core_API.call({ action: 'estoque.entry', sessionId: sessionAdmin, payload: { produtoId, localizacao: local, quantidade: 50 } });
  const reserva = Core_API.call({ action: 'reserva.create', sessionId: sessionAdmin, payload: { produtoId, localizacao: local, quantidade: 5 } });
  const linhaDoTempo = Core_API.call({ action: 'rastreabilidade.buscarLinhaDoTempo', sessionId: sessionAdmin, payload: { entidade: 'RESERVAS', entidadeId: reserva.data.reserva.ID } });
  resultados.linhaDoTempoGenericaFunciona = linhaDoTempo.success && linhaDoTempo.data.totalEventos >= 1 && linhaDoTempo.data.linhaDoTempo[0].acao === 'RESERVA_CRIADA';

  const passou = Object.values(resultados).every(Boolean);

  Logger.log('=== RESULTADOS MÓDULO 10 (Rastreabilidade) ===');
  Logger.log(JSON.stringify(resultados, null, 2));
  Logger.log('=== ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌') + ' ===');
  SpreadsheetApp.getUi().alert('Teste Módulo 10 (Rastreabilidade): ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌ — veja o Logger.'));

  return resultados;
}
