/**
 * ============================================================
 * ALMOXA PRO — Test_Bloco03_APIInterna.gs
 * Foca no que é NOVO: contrato de resposta enriquecido (module/
 * action/error aninhado, seção 3), eventos de ciclo de vida de
 * módulo (seção 7), e confirma que a cadeia Core→API→Data Layer
 * (seção 13) já está coberta pelo Doctor_Communication da
 * Integração 01 — não duplicado aqui.
 *
 * HONESTIDADE sobre MODULE_ERROR: Core_ModuleManager.initAll()
 * só roda uma vez por execução (_initialized). Forçar uma falha
 * real de módulo pra testar a emissão do evento arriscaria
 * corromper ALL_MODULES/Core_Registry pro resto da suíte de
 * testes, que roda tudo na mesma execução (Test_RunTudo). Por
 * isso este teste confirma o MECANISMO (Event_Bus emite/recebe
 * os 3 nomes de evento) e o RESULTADO observável de um boot bem
 * sucedido (getReport()), sem injetar falha artificial num
 * módulo real.
 * ============================================================
 */

function Test_Bloco03_APIInterna_fluxoCompleto() {
  Core_API.bootstrap();
  const resultados = {};

  const admin = Core_API.call({ action: 'auth.login', payload: { identificacao: 'admin', senha: 'almoxa123' } });
  const sessionAdmin = admin.data.sessionId;
  const operador = Core_API.call({ action: 'loja.cadastro', payload: { nome: 'Op Bloco03', matricula: 'B03-OP-' + Date.now(), senha: '1234' } });

  const respostaSucesso = Core_API.call({ action: 'estoque.get', sessionId: sessionAdmin, payload: { produtoId: 999999, localizacao: 'x' } });
  resultados.respostaSucessoTemModuleEAction = respostaSucesso.module === 'estoque' && respostaSucesso.action === 'estoque.get';

  const respostaErro = Core_API.call({ action: 'backup.create', sessionId: operador.data.sessionId, payload: {} });
  resultados.respostaErroTemCamposSoltosPreservados = !respostaErro.success && typeof respostaErro.code === 'string' && typeof respostaErro.message === 'string';
  resultados.respostaErroTemObjetoAninhado = !respostaErro.success && !!respostaErro.error && respostaErro.error.code === respostaErro.code && respostaErro.error.message === respostaErro.message;
  resultados.respostaErroTambemTemModuleEAction = respostaErro.module === 'backup' && respostaErro.action === 'backup.create';

  const rotaSemPonto = Core_API.call({ action: 'acao_sem_ponto_que_nao_existe', sessionId: sessionAdmin, payload: {} });
  resultados.acaoSemPontoNaoQuebraDerivacaoDeModulo = rotaSemPonto.module === 'acao_sem_ponto_que_nao_existe';

  resultados.contratoAntigoPreservado = typeof respostaSucesso.success === 'boolean' && respostaSucesso.hasOwnProperty('code') &&
    respostaSucesso.hasOwnProperty('message') && respostaSucesso.hasOwnProperty('data') && respostaSucesso.hasOwnProperty('timestamp');

  let recebeuRegistered = false, recebeuStarted = false, recebeuError = false;
  Event_Bus.on(EVENT_TYPES.MODULE_REGISTERED, function () { recebeuRegistered = true; });
  Event_Bus.on(EVENT_TYPES.MODULE_STARTED, function () { recebeuStarted = true; });
  Event_Bus.on(EVENT_TYPES.MODULE_ERROR, function () { recebeuError = true; });
  Event_Bus.emit(EVENT_TYPES.MODULE_REGISTERED, { moduleId: 'TESTE_BLOCO03' }, {});
  Event_Bus.emit(EVENT_TYPES.MODULE_STARTED, { moduleId: 'TESTE_BLOCO03' }, {});
  Event_Bus.emit(EVENT_TYPES.MODULE_ERROR, { moduleId: 'TESTE_BLOCO03', error: 'erro de teste' }, {});
  resultados.eventosDeCicloDeVidaExistemEFuncionam = recebeuRegistered && recebeuStarted && recebeuError;

  const relatorioDeBoot = Core_ModuleManager.getReport();
  resultados.bootRealRegistrouModulosDeVerdade = relatorioDeBoot.length > 15 && relatorioDeBoot.some(function (m) { return m.id === 'MOD_06_ESTOQUE' && m.status !== CORE_CONSTANTS.MODULE_STATUS.ERROR; });

  const contratoEstoque = Core_API.call({ action: 'doctor.moduleContract', sessionId: sessionAdmin, payload: { moduloId: 'MOD_06_ESTOQUE' } });
  resultados.registroDeModuloComEndpointsEPermissoes = contratoEstoque.success && contratoEstoque.data.entradas.length > 0 && contratoEstoque.data.dependencias !== undefined;

  const cadeia = Core_API.call({ action: 'doctor.communication', sessionId: sessionAdmin, payload: {} });
  resultados.diagnosticoDeCadeiaJaExisteEFunciona = cadeia.success && cadeia.data.etapas.some(function (e) { return e.etapa === 'CORE' && e.status === 'OK'; }) &&
    cadeia.data.etapas.some(function (e) { return e.etapa === 'DATA_LAYER_BANCO' && e.status === 'OK'; });

  const acaoInvalida = Core_API.call({ action: 'modulo.inexistente.acao', sessionId: sessionAdmin, payload: {} });
  resultados.acaoInvalidaTratada = !acaoInvalida.success && acaoInvalida.code === CORE_CONSTANTS.RESPONSE_CODES.ROUTE_NOT_FOUND;

  const contratoModuloInexistente = Core_API.call({ action: 'doctor.moduleContract', sessionId: sessionAdmin, payload: { moduloId: 'MODULO_QUE_NUNCA_EXISTIU' } });
  resultados.moduloInexistenteTratado = !contratoModuloInexistente.success && contratoModuloInexistente.code === CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND;

  const passou = Object.values(resultados).every(Boolean);

  Logger.log('=== RESULTADOS BLOCO 03 (API Interna) ===');
  Logger.log(JSON.stringify(resultados, null, 2));
  Logger.log('=== ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌') + ' ===');
  SpreadsheetApp.getUi().alert('Teste Bloco 03: ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌ — veja o Logger.'));

  return resultados;
}
