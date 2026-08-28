/**
 * ============================================================
 * ALMOXA PRO — Test_Modulo16_17_ArquiteturaFinal.gs
 * MÓDULO 16: Skills identificam vocabulário certo, delegam sem
 * nunca gravar dado, respeitam permissão (Diagnóstico é ADMIN).
 * MÓDULO 17: contrato sintetizado por módulo, mapa do sistema,
 * dependentes reversos corretos.
 * ============================================================
 */

function Test_Modulo16_17_ArquiteturaFinal_fluxoCompleto() {
  Core_API.bootstrap();
  const resultados = {};

  const admin = Core_API.call({ action: 'auth.login', payload: { identificacao: 'admin', senha: 'almoxa123' } });
  const sessionAdmin = admin.data.sessionId;
  const operador = Core_API.call({ action: 'loja.cadastro', payload: { nome: 'Operador M16', matricula: 'M16-OP-' + Date.now(), senha: '1234' } });

  const produto = Core_API.call({ action: 'produto.create', sessionId: sessionAdmin, payload: { descricaoOriginal: 'Item Skill M16', codigo: 'M16-SK' } });
  Core_API.call({ action: 'estoque.entry', sessionId: sessionAdmin, payload: { produtoId: produto.data.ID, localizacao: 'TESTE-M16/SKILL', quantidade: 15 } });

  const skillEstoque = Core_API.call({ action: 'skills.consultar', sessionId: sessionAdmin, payload: { pergunta: 'onde esta o Item Skill M16' } });
  resultados.identificaSkillEstoque = skillEstoque.success && skillEstoque.data.skillIdentificada === 'ESTOQUE' &&
    skillEstoque.data.resultado.some(r => r.produtoId === produto.data.ID);

  const skillRastreio = Core_API.call({ action: 'skills.consultar', sessionId: sessionAdmin, payload: { pergunta: 'de onde veio o Item Skill M16' } });
  resultados.skillRastreabilidadeDelegaCorretamente = skillRastreio.success && skillRastreio.data.skillIdentificada === 'RASTREABILIDADE' &&
    skillRastreio.data.resultado.trajetoria[0].etapa === 'CADASTRO';

  const semSkill = Core_API.call({ action: 'skills.consultar', sessionId: sessionAdmin, payload: { pergunta: 'qual é a capital da França' } });
  resultados.naoInventaSkillParaPerguntaDesconhecida = semSkill.success && semSkill.data.skillIdentificada === null;

  const diagnosticoDireto = Service_Skills.consultar({ userId: operador.data.userId, requestId: 'x', perfil: 'OPERADOR', payload: { pergunta: 'diagnostico do sistema' } });
  resultados.diagnosticoBloqueadoParaNaoAdmin = !diagnosticoDireto.success && diagnosticoDireto.code === CORE_CONSTANTS.RESPONSE_CODES.PERMISSION_DENIED;

  const saldoAntes = Core_API.call({ action: 'estoque.get', sessionId: sessionAdmin, payload: { produtoId: produto.data.ID, localizacao: 'TESTE-M16/SKILL' } }).data.saldo;
  const listaSkills = Service_Skills.listarSkills({ requestId: 'x' }).data;
  listaSkills.forEach(s => {
    try { Service_Skills.consultar({ userId: admin.data.userId, perfil: 'ADMIN', requestId: 'x', payload: { skill: s.nome, termo: 'Item Skill M16' } }); } catch (e) { /* algumas exigem termo específico, ok falhar */ }
  });
  const saldoDepois = Core_API.call({ action: 'estoque.get', sessionId: sessionAdmin, payload: { produtoId: produto.data.ID, localizacao: 'TESTE-M16/SKILL' } }).data.saldo;
  resultados.skillsNuncaAlteramEstoque = saldoAntes === saldoDepois;

  const viaAIEngine = Core_API.call({ action: 'ia.consultar', sessionId: sessionAdmin, payload: { pergunta: 'nota fiscal do fornecedor X' } });
  resultados.aiEngineDelegaPraSkillsSemQuebrarNada = viaAIEngine.success;

  const antigoAindaFunciona = Core_API.call({ action: 'ia.consultar', sessionId: sessionAdmin, payload: { pergunta: 'Quais reservas estão pendentes?' } });
  resultados.naoQuebrouComportamentoAntigoDoAIEngine = antigoAindaFunciona.success && Array.isArray(antigoAindaFunciona.data.dados);

  const contrato = Core_API.call({ action: 'doctor.moduleContract', sessionId: sessionAdmin, payload: { moduloId: 'MOD_21_NOTIFICACOES' } });
  resultados.contratoSintetizadoFunciona = contrato.success && contrato.data.id === 'MOD_21_NOTIFICACOES' && contrato.data.entradas.length > 0;

  const contratoEstoque = Core_API.call({ action: 'doctor.moduleContract', sessionId: sessionAdmin, payload: { moduloId: 'MOD_06_ESTOQUE' } });
  resultados.dependentesReversosCorretos = contratoEstoque.success && contratoEstoque.data.dependentes.includes('MOD_07_RESERVAS');

  const contratoInexistente = Core_API.call({ action: 'doctor.moduleContract', sessionId: sessionAdmin, payload: { moduloId: 'MODULO_QUE_NAO_EXISTE' } });
  resultados.moduloInexistenteTratado = !contratoInexistente.success && contratoInexistente.code === CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND;

  const mapa = Core_API.call({ action: 'doctor.systemMap', sessionId: sessionAdmin, payload: {} });
  resultados.mapaDoSistemaListaTodosOsModulos = mapa.success && mapa.data.length >= 20;

  const contratoNegado = Core_API.call({ action: 'doctor.moduleContract', sessionId: operador.data.sessionId, payload: { moduloId: 'MOD_21_NOTIFICACOES' } });
  resultados.bloqueiaContratoParaNaoAdmin = !contratoNegado.success && contratoNegado.code === CORE_CONSTANTS.RESPONSE_CODES.PERMISSION_DENIED;

  const passou = Object.values(resultados).every(Boolean);

  Logger.log('=== RESULTADOS MÓDULOS 16+17 (Arquitetura Final) ===');
  Logger.log(JSON.stringify(resultados, null, 2));
  Logger.log('=== ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌') + ' ===');
  SpreadsheetApp.getUi().alert('Teste Módulos 16+17: ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌ — veja o Logger.'));

  return resultados;
}
