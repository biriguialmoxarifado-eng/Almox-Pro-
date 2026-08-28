/**
 * ============================================================
 * ALMOXA PRO — Test_Modulo09_AIEngine.gs
 * Testa: assistente por palavra-chave respondendo com dado real,
 * resumo diferente por perfil, alertas com explicação, IA nunca
 * grava em tabela de negócio, preferências, e auditoria da IA.
 * ============================================================
 */

function Test_Modulo09_AIEngine_fluxoCompleto() {
  Core_API.bootstrap();
  const resultados = {};

  const admin = Core_API.call({ action: 'auth.login', payload: { identificacao: 'admin', senha: 'almoxa123' } });
  const sessionAdmin = admin.data.sessionId;

  const produto = Core_API.call({ action: 'produto.create', sessionId: sessionAdmin, payload: { descricaoOriginal: 'Item IA M9', codigo: 'M9-IA' } });
  const local = 'TESTE-M9/IA';
  Core_API.call({ action: 'estoque.entry', sessionId: sessionAdmin, payload: { produtoId: produto.data.ID, localizacao: local, quantidade: 5 } });
  Core_API.call({ action: 'estoque.setMinimo', sessionId: sessionAdmin, payload: { produtoId: produto.data.ID, localizacao: local, estoqueMinimo: 10 } });

  const perguntaCritico = Core_API.call({ action: 'ia.consultar', sessionId: sessionAdmin, payload: { pergunta: 'Quais materiais estão críticos?' } });
  resultados.assistenteReconhecePerguntaCritico = perguntaCritico.success && perguntaCritico.data.dados.some(d => d.produtoId === produto.data.ID);

  const perguntaEstranha = Core_API.call({ action: 'ia.consultar', sessionId: sessionAdmin, payload: { pergunta: 'Qual é a capital da França?' } });
  resultados.naoInventaRespostaParaPerguntaDesconhecida = perguntaEstranha.success && perguntaEstranha.data.dados === null && perguntaEstranha.data.respostaResumo.includes('Não reconheci');

  const alertas = Core_API.call({ action: 'ia.alertasInteligentes', sessionId: sessionAdmin, payload: {} });
  const alertaDoItem = alertas.success ? alertas.data.estoque.find(a => a.produtoId === produto.data.ID) : null;
  resultados.alertaTemExplicacaoReal = !!alertaDoItem && alertaDoItem.explicacao.length > 20 && alertaDoItem.nivel === 'VERMELHO';

  const operador = Core_API.call({ action: 'loja.cadastro', payload: { nome: 'Operador M9', matricula: 'M9-OP-' + Date.now(), senha: '1234' } });
  const resumoAdmin = Core_API.call({ action: 'ia.resumoOperacional', sessionId: sessionAdmin, payload: {} });
  const resumoOperador = Core_API.call({ action: 'ia.resumoOperacional', sessionId: operador.data.sessionId, payload: {} });
  resultados.resumoDiferentePorPerfil = resumoAdmin.success && resumoOperador.success &&
    JSON.stringify(Object.keys(resumoAdmin.data.resumo).sort()) !== JSON.stringify(Object.keys(resumoOperador.data.resumo).sort());

  Core_API.call({ action: 'estoque.exit', sessionId: sessionAdmin, payload: { produtoId: produto.data.ID, localizacao: local, quantidade: 1 } });
  const previsao = Core_API.call({ action: 'ia.preverConsumo', sessionId: sessionAdmin, payload: { produtoId: produto.data.ID } });
  resultados.previsaoAvisaQueEhEstimativa = previsao.success && previsao.data.aviso.toUpperCase().includes('ESTIMATIVA');

  const mensagem = Core_API.call({ action: 'ia.montarMensagemNotificacao', sessionId: sessionAdmin, payload: {} });
  resultados.montaMensagemPersonalizada = mensagem.success && mensagem.data.mensagem.startsWith('Olá,');

  Core_API.call({ action: 'ia.definirPreferencia', sessionId: sessionAdmin, payload: { userId: operador.data.userId, categoria: 'FERRAMENTAS', ativo: false } });
  const minhasPreferencias = Core_API.call({ action: 'ia.obterPreferencias', sessionId: operador.data.sessionId, payload: {} });
  resultados.preferenciaConfiguradaPeloAdminReflete = minhasPreferencias.success && minhasPreferencias.data.preferencias.FERRAMENTAS === false;
  resultados.categoriaPadraoAtivaSemConfiguracao = minhasPreferencias.success && minhasPreferencias.data.preferencias.ESTOQUE === true;

  const outroOperador = Core_API.call({ action: 'loja.cadastro', payload: { nome: 'Outro M9', matricula: 'M9-OUTRO-' + Date.now(), senha: '1234' } });
  const tentaVerPreferenciaDeOutro = Core_API.call({ action: 'ia.obterPreferencias', sessionId: outroOperador.data.sessionId, payload: { userId: operador.data.userId } });
  resultados.bloqueiaVerPreferenciaDeOutro = !tentaVerPreferenciaDeOutro.success && tentaVerPreferenciaDeOutro.code === CORE_CONSTANTS.RESPONSE_CODES.PERMISSION_DENIED;

  // Bug corrigido: operador comum NÃO pode configurar preferência de outro usuário
  const tentaDefinirPreferenciaDeOutro = Core_API.call({
    action: 'ia.definirPreferencia', sessionId: outroOperador.data.sessionId,
    payload: { userId: operador.data.userId, categoria: 'SISTEMA', ativo: false }
  });
  resultados.bloqueiaDefinirPreferenciaDeOutro = !tentaDefinirPreferenciaDeOutro.success && tentaDefinirPreferenciaDeOutro.code === CORE_CONSTANTS.RESPONSE_CODES.PERMISSION_DENIED;

  const historico = Core_API.call({ action: 'ia.historicoInteracoes', sessionId: sessionAdmin, payload: {} });
  resultados.auditoriaDaIaRegistraInteracao = historico.success && historico.data.some(h => h.pergunta === 'Quais materiais estão críticos?');

  const saldoAntesDeQualquerConsultaIA = Core_API.call({ action: 'estoque.get', sessionId: sessionAdmin, payload: { produtoId: produto.data.ID, localizacao: local } }).data.saldo;
  Core_API.call({ action: 'ia.consultar', sessionId: sessionAdmin, payload: { pergunta: 'Quais reservas estão pendentes?' } });
  Core_API.call({ action: 'ia.alertasInteligentes', sessionId: sessionAdmin, payload: {} });
  Core_API.call({ action: 'ia.relatorioInteligente', sessionId: sessionAdmin, payload: { tipo: 'ESTOQUE' } });
  const saldoDepois = Core_API.call({ action: 'estoque.get', sessionId: sessionAdmin, payload: { produtoId: produto.data.ID, localizacao: local } }).data.saldo;
  resultados.iaNuncaAlteraEstoque = saldoAntesDeQualquerConsultaIA === saldoDepois;

  const passou = Object.values(resultados).every(Boolean);

  Logger.log('=== RESULTADOS MÓDULO 09 (AI Engine) ===');
  Logger.log(JSON.stringify(resultados, null, 2));
  Logger.log('=== ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌') + ' ===');
  SpreadsheetApp.getUi().alert('Teste Módulo 09 (AI Engine): ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌ — veja o Logger.'));

  return resultados;
}
