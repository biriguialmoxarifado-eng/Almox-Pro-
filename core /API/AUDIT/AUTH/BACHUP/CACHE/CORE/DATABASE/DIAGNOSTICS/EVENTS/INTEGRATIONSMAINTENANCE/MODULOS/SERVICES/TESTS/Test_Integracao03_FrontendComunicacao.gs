/**
 * ============================================================
 * ALMOXA PRO — Test_Integracao03_FrontendComunicacao.gs
 *
 * HONESTIDADE: "celular/tablet/desktop" e renderização visual não
 * são testáveis a partir de um ambiente de backend — isso exige
 * um navegador de verdade (QA manual, já que não existe framework
 * de UI testing nesta arquitetura). O que ESTE teste cobre é tudo
 * que é backend-verificável e sustenta a promessa de "mesmo
 * backend pra todos os dispositivos": sessão isolada por
 * dispositivo/usuário, permissões corretas, sessão expirada,
 * comunicação e erro tratado.
 * ============================================================
 */

function Test_Integracao03_FrontendComunicacao_fluxoCompleto() {
  Core_API.bootstrap();
  const resultados = {};

  const loginAdmin = Core_API.call({ action: 'auth.login', payload: { identificacao: 'admin', senha: 'almoxa123' } });
  resultados.loginFunciona = loginAdmin.success && !!loginAdmin.data.sessionId;

  const operador1 = Core_API.call({ action: 'loja.cadastro', payload: { nome: 'Usuário Celular INT03', matricula: 'INT03-CEL-' + Date.now(), senha: '1234' } });
  const operador2 = Core_API.call({ action: 'loja.cadastro', payload: { nome: 'Usuário Desktop INT03', matricula: 'INT03-DESK-' + Date.now(), senha: '1234' } });
  // "celular" e "desktop" aqui são só dois clientes distintos do MESMO backend — a sessão não sabe nem precisa saber o dispositivo.
  const sessaoCelular = operador1.data.sessionId;
  const sessaoDesktop = operador2.data.sessionId;

  resultados.duasSessoesSimultaneasIndependentes = sessaoCelular !== sessaoDesktop &&
    Auth_Session.validate(sessaoCelular).success && Auth_Session.validate(sessaoDesktop).success;

  Auth_Session.destroy(sessaoCelular);
  const celularDepoisDeEncerrar = Auth_Session.validate(sessaoCelular);
  const desktopContinuaValida = Auth_Session.validate(sessaoDesktop);
  resultados.encerrarUmaSessaoNaoAfetaAOutra = !celularDepoisDeEncerrar.success && desktopContinuaValida.success;

  const relogin1 = Core_API.call({ action: 'auth.login', payload: { identificacao: 'admin', senha: 'almoxa123' } });
  const relogin2 = Core_API.call({ action: 'auth.login', payload: { identificacao: 'admin', senha: 'almoxa123' } });
  resultados.mesmoUsuarioDoisDispositivosDoisTokens = relogin1.data.sessionId !== relogin2.data.sessionId &&
    Auth_Session.validate(relogin1.data.sessionId).success && Auth_Session.validate(relogin2.data.sessionId).success;

  const perfilDoOperador = Auth_Session.validate(sessaoDesktop).data.perfil;
  const perfilDoAdmin = Auth_Session.validate(relogin1.data.sessionId).data.perfil;
  resultados.cadaSessaoTemPermissaoPropria = perfilDoOperador !== perfilDoAdmin;

  const tentativaAdminComSessaoDeOperador = Core_API.call({ action: 'backup.create', sessionId: sessaoDesktop, payload: {} });
  resultados.permissaoRespeitaSessaoCorreta = !tentativaAdminComSessaoDeOperador.success && tentativaAdminComSessaoDeOperador.code === CORE_CONSTANTS.RESPONSE_CODES.PERMISSION_DENIED;

  const sessaoInexistente = Core_API.call({ action: 'estoque.get', sessionId: 'token-jamais-emitido-' + Date.now(), payload: {} });
  resultados.sessaoExpiradaTratada = !sessaoInexistente.success && sessaoInexistente.code === CORE_CONSTANTS.RESPONSE_CODES.SESSION_EXPIRED;

  resultados.comunicacaoSempreFormatoPadrao = typeof sessaoInexistente.success === 'boolean' && typeof sessaoInexistente.code === 'string';

  const produto = Core_API.call({ action: 'produto.create', sessionId: relogin1.data.sessionId, payload: { descricaoOriginal: 'Item INT03', codigo: 'INT03-ITEM' } });
  Core_API.call({ action: 'estoque.entry', sessionId: relogin1.data.sessionId, payload: { produtoId: produto.data.ID, localizacao: 'TESTE-INT03', quantidade: 10 } });
  const leituraCelular = Core_API.call({ action: 'estoque.get', sessionId: sessaoDesktop, payload: { produtoId: produto.data.ID, localizacao: 'TESTE-INT03' } });
  resultados.atualizacaoVisivelParaOutraSessaoImediatamente = leituraCelular.success && leituraCelular.data.saldo === 10;

  const erroDeValidacao = Core_API.call({ action: 'produto.create', sessionId: relogin1.data.sessionId, payload: {} });
  resultados.erroTratadoSemQuebrar = !erroDeValidacao.success && typeof erroDeValidacao.message === 'string';

  const passou = Object.values(resultados).every(Boolean);

  Logger.log('=== RESULTADOS INTEGRAÇÃO 03 (Frontend↔Backend) ===');
  Logger.log(JSON.stringify(resultados, null, 2));
  Logger.log('NOTA: testes de renderização real em celular/tablet/desktop exigem QA manual em navegador — não automatizáveis neste ambiente.');
  Logger.log('=== ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌') + ' ===');
  SpreadsheetApp.getUi().alert('Teste Integração 03: ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌ — veja o Logger.'));

  return resultados;
}
