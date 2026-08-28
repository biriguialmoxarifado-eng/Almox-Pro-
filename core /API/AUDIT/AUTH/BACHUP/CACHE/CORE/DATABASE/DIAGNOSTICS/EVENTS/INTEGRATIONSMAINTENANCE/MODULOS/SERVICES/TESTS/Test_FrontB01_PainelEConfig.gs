/**
 * ============================================================
 * ALMOXA PRO — Test_FrontB01_PainelEConfig.gs
 * FRONT-B01: confirma que a chave nova (PAINEL_DIGITAL_CONTEUDO)
 * segue o modelo real de permissão — qualquer perfil lê
 * (config.get = VIEW), só ADMIN edita (config.update = CONFIG).
 * Não testa renderização visual (Screen_Users/Permissions/Panel/
 * FloatingButton) — isso exige navegador real, ver relatório.
 * ============================================================
 */

function Test_FrontB01_PainelEConfig_fluxoCompleto() {
  Core_API.bootstrap();
  const resultados = {};

  const admin = Core_API.call({ action: 'auth.login', payload: { identificacao: 'admin', senha: 'almoxa123' } });
  const sessionAdmin = admin.data.sessionId;
  const operador = Core_API.call({ action: 'loja.cadastro', payload: { nome: 'Operador FrontB01', matricula: 'FB01-OP-' + Date.now(), senha: '1234' } });

  const leituraInicial = Core_API.call({ action: 'config.get', sessionId: sessionAdmin, payload: { chave: 'PAINEL_DIGITAL_CONTEUDO' } });
  resultados.chaveExisteComPadraoVazio = leituraInicial.success && leituraInicial.data.valor === '[]';

  const leituraPorOperador = Core_API.call({ action: 'config.get', sessionId: operador.data.sessionId, payload: { chave: 'PAINEL_DIGITAL_CONTEUDO' } });
  resultados.qualquerPerfilLeOPainel = leituraPorOperador.success;

  const tentativaEditarPorOperador = Core_API.call({ action: 'config.update', sessionId: operador.data.sessionId, payload: { chave: 'PAINEL_DIGITAL_CONTEUDO', valor: '[{"titulo":"hack"}]' } });
  resultados.operadorNaoEditaOPainel = !tentativaEditarPorOperador.success && tentativaEditarPorOperador.code === CORE_CONSTANTS.RESPONSE_CODES.PERMISSION_DENIED;

  const edicaoPorAdmin = Core_API.call({ action: 'config.update', sessionId: sessionAdmin, payload: { chave: 'PAINEL_DIGITAL_CONTEUDO', valor: JSON.stringify([{ titulo: 'Bem-vindo', mensagem: 'Teste FRONT-B01', icone: '📌' }]) } });
  resultados.adminEditaOPainel = edicaoPorAdmin.success;

  const leituraAposEdicao = Core_API.call({ action: 'config.get', sessionId: operador.data.sessionId, payload: { chave: 'PAINEL_DIGITAL_CONTEUDO' } });
  const conteudo = leituraAposEdicao.success ? JSON.parse(leituraAposEdicao.data.valor) : [];
  resultados.conteudoEditadoVisivelParaTodos = conteudo.length === 1 && conteudo[0].titulo === 'Bem-vindo';

  const mapaPorAdmin = Core_API.call({ action: 'doctor.systemMap', sessionId: sessionAdmin, payload: {} });
  const mapaPorOperador = Core_API.call({ action: 'doctor.systemMap', sessionId: operador.data.sessionId, payload: {} });
  resultados.telaPermissoesReaproveitaRotaExistente = mapaPorAdmin.success && !mapaPorOperador.success;

  const criarUsuarioComoNaTela = Core_API.call({ action: 'usuario.create', sessionId: sessionAdmin, payload: { nome: 'Criado via FRONT-B01', matricula: 'FB01-NOVO-' + Date.now(), senha: '1234', perfil: 'OPERADOR' } });
  resultados.telaUsuariosReaproveitaRotasExistentes = criarUsuarioComoNaTela.success;

  const passou = Object.values(resultados).every(Boolean);

  Logger.log('=== RESULTADOS FRONT-B01 (Painel/Config/Usuários/Permissões) ===');
  Logger.log(JSON.stringify(resultados, null, 2));
  Logger.log('NOTA: renderização visual, responsividade e identidade visual exigem QA manual em navegador — ver relatório.');
  Logger.log('=== ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌') + ' ===');
  SpreadsheetApp.getUi().alert('Teste FRONT-B01: ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌ — veja o Logger.'));

  return resultados;
}
