/**
 * ============================================================
 * ALMOXA PRO — Test_Modulo01_Usuarios.gs
 * Cobre a seção 10 do contrato "PROMPTS_MODULOS_01_02_03":
 * login válido/inválido, sessão expirada/ausente, usuário comum
 * tentando administração, admin criando/atualizando, tentativa
 * de alterar outro usuário pelo payload, foto própria, campos
 * obrigatórios, perfil inexistente, e senha nunca exposta.
 * ============================================================
 */

function Test_Modulo01_Usuarios_fluxoCompleto() {
  Core_API.bootstrap();
  const resultados = {};

  // ---- 1) Login válido e inválido ----
  const loginValido = Core_API.call({ action: 'auth.login', payload: { identificacao: 'admin', senha: 'almoxa123' } });
  const loginInvalido = Core_API.call({ action: 'auth.login', payload: { identificacao: 'admin', senha: 'senhaErrada' } });
  resultados.loginValido = loginValido.success;
  resultados.loginInvalido = !loginInvalido.success;
  const sessionAdmin = loginValido.data.sessionId;
  const userIdAdmin = loginValido.data.userId;

  // ---- 2) Sessão ausente/expirada ----
  const semSessao = Core_API.call({ action: 'usuario.get', payload: { id: userIdAdmin } });
  resultados.semSessaoBloqueada = !semSessao.success && semSessao.code === CORE_CONSTANTS.RESPONSE_CODES.SESSION_EXPIRED;

  // ---- Cria um usuário comum (OPERADOR) pra usar nos testes de escopo ----
  const cadastroOperador = Core_API.call({ action: 'loja.cadastro', payload: { nome: 'Usuário Comum M1', matricula: 'M1-OP-' + Date.now(), senha: '1234' } });
  const sessionOperador = cadastroOperador.data.sessionId;
  const userIdOperador = cadastroOperador.data.userId;

  // ---- 3) Usuário comum tentando administração ----
  const createNegado = Core_API.call({
    action: 'usuario.create', sessionId: sessionOperador,
    payload: { nome: 'Invasor', matricula: 'M1-INV-' + Date.now(), senha: '1234', perfil: 'ADMIN' }
  });
  resultados.operadorNaoCriaUsuario = !createNegado.success && createNegado.code === CORE_CONSTANTS.RESPONSE_CODES.PERMISSION_DENIED;

  const updateNegado = Core_API.call({
    action: 'usuario.update', sessionId: sessionOperador, payload: { id: userIdAdmin, perfil: 'OPERADOR' }
  });
  resultados.operadorNaoAtualizaAdmin = !updateNegado.success && updateNegado.code === CORE_CONSTANTS.RESPONSE_CODES.PERMISSION_DENIED;

  // ---- 4) Admin criando e atualizando usuário ----
  const matriculaNovoUsuario = 'M1-NOVO-' + Date.now();
  const criarComoAdmin = Core_API.call({
    action: 'usuario.create', sessionId: sessionAdmin,
    payload: { nome: 'Criado Pelo Admin', matricula: matriculaNovoUsuario, senha: '1234', perfil: 'ALMOXARIFE' }
  });
  resultados.adminCriaUsuario = criarComoAdmin.success && criarComoAdmin.data.perfil === 'ALMOXARIFE';
  resultados.senhaNuncaExposta = criarComoAdmin.success && criarComoAdmin.data.senha_hash === undefined;

  const idNovoUsuario = criarComoAdmin.data.ID;
  const atualizarComoAdmin = Core_API.call({
    action: 'usuario.update', sessionId: sessionAdmin, payload: { id: idNovoUsuario, cargo: 'Almoxarife Sênior', status: 'ATIVO' }
  });
  resultados.adminAtualizaUsuario = atualizarComoAdmin.success && atualizarComoAdmin.data.cargo === 'Almoxarife Sênior';

  // ---- 5) Usuário tentando alterar OUTRO usuário pelo payload ----
  const alterarOutroPeloPayload = Core_API.call({
    action: 'usuario.update', sessionId: sessionOperador, payload: { id: idNovoUsuario, cargo: 'Hackeado' }
  });
  resultados.naoAlteraOutroPeloPayload = !alterarOutroPeloPayload.success && alterarOutroPeloPayload.code === CORE_CONSTANTS.RESPONSE_CODES.PERMISSION_DENIED;

  // ---- 6) Foto do próprio usuário (real) e sem sessão (deve falhar) ----
  const fotoMinima = '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=';
  const salvarFotoOk = Core_API.call({ action: 'usuario.salvarFoto', sessionId: sessionOperador, payload: { fotoBase64: fotoMinima } });
  resultados.salvaFotoPropria = salvarFotoOk.success && !!salvarFotoOk.data.fotoUrl;

  const salvarFotoSemSessao = Core_API.call({ action: 'usuario.salvarFoto', payload: { fotoBase64: fotoMinima } });
  resultados.fotoSemSessaoBloqueada = !salvarFotoSemSessao.success && salvarFotoSemSessao.code === CORE_CONSTANTS.RESPONSE_CODES.SESSION_EXPIRED;

  // ---- 7) Campos obrigatórios e perfil inexistente ----
  const criarSemCampos = Core_API.call({ action: 'usuario.create', sessionId: sessionAdmin, payload: { nome: 'Incompleto' } });
  resultados.bloqueiaCamposObrigatorios = !criarSemCampos.success;

  const criarPerfilInvalido = Core_API.call({
    action: 'usuario.create', sessionId: sessionAdmin,
    payload: { nome: 'Perfil Ruim', matricula: 'M1-PERFIL-' + Date.now(), senha: '1234', perfil: 'SUPER_ADMIN_FAKE' }
  });
  resultados.bloqueiaPerfilInexistente = !criarPerfilInvalido.success && criarPerfilInvalido.code === CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR;

  // ---- 8) Escopo de campos: operador buscando outro usuário não vê perfil/email ----
  const buscaComumM1 = Core_API.call({ action: 'usuario.search', sessionId: sessionOperador, payload: { query: 'Criado Pelo Admin' } });
  const linhaEncontrada = buscaComumM1.success ? buscaComumM1.data.find(u => u.ID === idNovoUsuario) : null;
  resultados.escopoLimitadoParaTerceiro = !!linhaEncontrada && linhaEncontrada.perfil === undefined && linhaEncontrada.email === undefined;

  const getComoAdmin = Core_API.call({ action: 'usuario.get', sessionId: sessionAdmin, payload: { id: idNovoUsuario } });
  resultados.adminVeCampoAdministrativo = getComoAdmin.success && getComoAdmin.data.perfil === 'ALMOXARIFE';

  const passou = Object.values(resultados).every(Boolean);

  Logger.log('=== RESULTADOS MÓDULO 01 (Usuários) ===');
  Logger.log(JSON.stringify(resultados, null, 2));
  Logger.log('=== ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌') + ' ===');
  SpreadsheetApp.getUi().alert('Teste Módulo 01 (Usuários): ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌ — veja o Logger para detalhes.'));

  return resultados;
}
