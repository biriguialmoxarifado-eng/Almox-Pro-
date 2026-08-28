/**
 * ============================================================
 * ALMOXA PRO — Test_Integracao01_CoreModulos.gs
 * Cobre os 7 cenários pedidos: módulo registrado, módulo ativo,
 * módulo indisponível, erro de comunicação, usuário sem
 * permissão, sessão inválida, resposta inválida.
 *
 * Os cenários "módulo indisponível", "erro de comunicação" e
 * "resposta inválida" usam rotas de TESTE registradas na hora,
 * direto via Core_Registry.registerRoute — nunca tocam em
 * módulo de negócio real pra provocar a falha.
 * ============================================================
 */

function Test_Integracao01_CoreModulos_fluxoCompleto() {
  Core_API.bootstrap();
  const resultados = {};

  const admin = Core_API.call({ action: 'auth.login', payload: { identificacao: 'admin', senha: 'almoxa123' } });
  const sessionAdmin = admin.data.sessionId;

  const moduloReservas = Core_Registry.getModule('MOD_07_RESERVAS');
  resultados.moduloRegistrado = !!moduloReservas && moduloReservas.id === 'MOD_07_RESERVAS';

  const moduloAtivo = Core_API.call({ action: 'estoque.get', sessionId: sessionAdmin, payload: { produtoId: 999999, localizacao: 'x' } });
  resultados.moduloAtivoExecutaRota = moduloAtivo.code !== CORE_CONSTANTS.RESPONSE_CODES.MODULE_DISABLED;

  const statusOriginal = moduloReservas.status;
  moduloReservas.status = CORE_CONSTANTS.MODULE_STATUS.DISABLED;
  const chamadaComModuloDesativado = Core_API.call({ action: 'reserva.calendar', sessionId: sessionAdmin, payload: {} });
  resultados.moduloIndisponivelBloqueiaRota = !chamadaComModuloDesativado.success && chamadaComModuloDesativado.code === CORE_CONSTANTS.RESPONSE_CODES.MODULE_DISABLED;
  moduloReservas.status = statusOriginal;

  const chamadaDepoisDeRestaurar = Core_API.call({ action: 'reserva.calendar', sessionId: sessionAdmin, payload: {} });
  resultados.moduloVoltaAFuncionarAposRestaurarStatus = chamadaDepoisDeRestaurar.success;

  Core_Registry.registerRoute('teste.rotaComErro', function () { throw new Error('Falha proposital de comunicação.'); }, 'MOD_TESTE_INTEGRACAO');
  const erroComunicacao = Core_API.call({ action: 'teste.rotaComErro', sessionId: sessionAdmin, payload: {} });
  resultados.erroDeComunicacaoTratado = !erroComunicacao.success && erroComunicacao.code === CORE_CONSTANTS.RESPONSE_CODES.INTERNAL_ERROR;

  const operador = Core_API.call({ action: 'loja.cadastro', payload: { nome: 'Operador Integracao01', matricula: 'INT01-OP-' + Date.now(), senha: '1234' } });
  const semPermissao = Core_API.call({ action: 'backup.create', sessionId: operador.data.sessionId, payload: {} });
  resultados.usuarioSemPermissaoBloqueado = !semPermissao.success && semPermissao.code === CORE_CONSTANTS.RESPONSE_CODES.PERMISSION_DENIED;

  const sessaoInvalida = Core_API.call({ action: 'estoque.get', sessionId: 'sessao-que-nao-existe-jamais', payload: {} });
  resultados.sessaoInvalidaBloqueada = !sessaoInvalida.success && sessaoInvalida.code === CORE_CONSTANTS.RESPONSE_CODES.SESSION_EXPIRED;

  const rotaInexistente = Core_API.call({ action: 'isso.nao.existe', sessionId: sessionAdmin, payload: {} });
  resultados.rotaInexistenteTratada = !rotaInexistente.success && rotaInexistente.code === CORE_CONSTANTS.RESPONSE_CODES.ROUTE_NOT_FOUND;

  Core_Registry.registerRoute('teste.rotaComRespostaInvalida', function () { return { qualquerCoisa: 'sem o campo success' }; }, 'MOD_TESTE_INTEGRACAO');
  const respostaInvalida = Core_API.call({ action: 'teste.rotaComRespostaInvalida', sessionId: sessionAdmin, payload: {} });
  resultados.respostaInvalidaDetectadaECorrigida = !respostaInvalida.success && respostaInvalida.code === CORE_CONSTANTS.RESPONSE_CODES.INTERNAL_ERROR &&
    respostaInvalida.message.includes('formato inválido');

  const respostaValidaContinuaFuncionando = Core_API.call({ action: 'auth.login', payload: { identificacao: 'admin', senha: 'almoxa123' } });
  resultados.respostaValidaNaoAfetada = respostaValidaContinuaFuncionando.success === true;

  const passou = Object.values(resultados).every(Boolean);

  Logger.log('=== RESULTADOS INTEGRAÇÃO 01 (Core/API/Módulos) ===');
  Logger.log(JSON.stringify(resultados, null, 2));
  Logger.log('=== ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌') + ' ===');
  SpreadsheetApp.getUi().alert('Teste Integração 01: ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌ — veja o Logger.'));

  return resultados;
}
