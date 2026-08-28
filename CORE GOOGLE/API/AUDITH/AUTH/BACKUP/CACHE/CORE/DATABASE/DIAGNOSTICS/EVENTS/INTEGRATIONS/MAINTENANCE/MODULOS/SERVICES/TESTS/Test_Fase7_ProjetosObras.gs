/**
 * ============================================================
 * ALMOXA PRO — Test_Fase7_ProjetosObras.gs
 * Fluxo: cria obra → cria projeto vinculado → cria atividade
 * vinculada → atribui colaborador à equipe → dá entrada em
 * estoque JÁ vinculando à atividade (rastreabilidade de
 * consumo, seção 25/30) → atualiza progresso da atividade.
 * ============================================================
 */

function Test_Fase7_fluxoCompleto() {
  Core_API.bootstrap();

  const login = Core_API.call({ action: 'auth.login', payload: { identificacao: 'admin', senha: 'almoxa123' } });
  if (!login.success) { Logger.log('LOGIN FALHOU'); return login; }
  const sessionId = login.data.sessionId;

  const obra = Core_API.call({ action: 'obra.create', sessionId, payload: { nome: 'Residencial Villa Teste', endereco: 'Rua Teste, 123' } });
  Logger.log('OBRA: ' + JSON.stringify(obra));

  const projeto = Core_API.call({ action: 'projeto.create', sessionId, payload: { nome: 'Fundação Bloco A', obraId: obra.data.ID, pep: 'PEP-001', centroCusto: 'CC-100' } });
  Logger.log('PROJETO: ' + JSON.stringify(projeto));

  // Projeto com obraId inválido deve falhar
  const projetoInvalido = Core_API.call({ action: 'projeto.create', sessionId, payload: { nome: 'Projeto Fantasma', obraId: 999999 } });
  Logger.log('PROJETO COM OBRA INVÁLIDA (deve falhar): ' + JSON.stringify(projetoInvalido));

  const atividade = Core_API.call({ action: 'atividade.create', sessionId, payload: { nome: 'Escavação e preparo do solo', obraId: obra.data.ID, projetoId: projeto.data.ID, etapa: 'Fundação' } });
  Logger.log('ATIVIDADE: ' + JSON.stringify(atividade));

  const equipe = Core_API.call({ action: 'equipe.assign', sessionId, payload: { colaborador: 'João Pedreiro', funcao: 'Pedreiro', obraId: obra.data.ID, equipe: 'Equipe Fundação' } });
  Logger.log('EQUIPE: ' + JSON.stringify(equipe));

  const produto = Core_API.call({ action: 'produto.create', sessionId, payload: { descricaoOriginal: 'Brita 1', codigo: 'BRITA-1' } });
  const entradaVinculada = Core_API.call({
    action: 'estoque.entry', sessionId,
    payload: { produtoId: produto.data.ID, localizacao: 'OBRA-VILLA/PATIO', quantidade: 5, obraId: obra.data.ID }
  });
  Logger.log('ENTRADA VINCULADA À OBRA: ' + JSON.stringify(entradaVinculada));

  const progresso = Core_API.call({ action: 'atividade.progress', sessionId, payload: { id: atividade.data.ID, progresso: 40 } });
  Logger.log('PROGRESSO (deve virar EM_ANDAMENTO): ' + JSON.stringify(progresso));

  const progressoFinal = Core_API.call({ action: 'atividade.progress', sessionId, payload: { id: atividade.data.ID, progresso: 100 } });
  Logger.log('PROGRESSO 100% (deve virar CONCLUIDA): ' + JSON.stringify(progressoFinal));

  const passou =
    obra.success && obra.data.status === 'ATIVA' &&
    projeto.success && !projetoInvalido.success &&
    atividade.success && atividade.data.status === 'PENDENTE' &&
    equipe.success && equipe.data.colaborador === 'João Pedreiro' &&
    entradaVinculada.success &&
    progresso.success && progresso.data.status === 'EM_ANDAMENTO' &&
    progressoFinal.success && progressoFinal.data.status === 'CONCLUIDA';

  Logger.log('=== RESULTADO FASE 7: ' + (passou ? 'PASSOU' : 'FALHOU') + ' ===');
  SpreadsheetApp.getUi().alert('Teste Fase 7 (Projetos/Obras/Atividades/Equipe): ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌') + ' — log completo em Ver → Registros de execução.');
  return { login, obra, projeto, projetoInvalido, atividade, equipe, entradaVinculada, progresso, progressoFinal, passou };
}
