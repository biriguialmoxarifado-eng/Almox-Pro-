/**
 * ============================================================
 * ALMOXA PRO — Test_Bloco06_Ferramentas.gs
 * O núcleo de cadastrar/buscar/identificar/QR/retirar/devolver/
 * vistoriar/manutenção/não conformidade/extravio/baixar/histórico/
 * biometria já tinha teste próprio (Test_Modulo06_Ferramentas.gs,
 * entrega original) — não duplicado aqui. Este teste foca no que
 * é GENUINAMENTE NOVO: prazo real na retirada + ferramenta
 * atrasada, estado BLOQUEADA pra CRITICA (sem quebrar o caso ALTA
 * já testado), troca de ferramenta, disponibilidade agregada, e
 * os 2 eventos que nunca eram emitidos de verdade.
 * ============================================================
 */

function Test_Bloco06_Ferramentas_fluxoCompleto() {
  Core_API.bootstrap();
  const resultados = {};

  const admin = Core_API.call({ action: 'auth.login', payload: { identificacao: 'admin', senha: 'almoxa123' } });
  const sessionAdmin = admin.data.sessionId;
  const operador = Core_API.call({ action: 'loja.cadastro', payload: { nome: 'Operador B06', matricula: 'B06-OP-' + Date.now(), senha: '1234' } });

  const ferramenta1 = Core_API.call({ action: 'ferramenta.create', sessionId: sessionAdmin, payload: { codigo: 'B06-F1', descricao: 'Furadeira B06' } });
  const retirada = Core_API.call({ action: 'ferramenta.retirar', sessionId: operador.data.sessionId, payload: { ferramentaId: ferramenta1.data.ID, prazoPrevistoHoras: 1 } });
  resultados.retiradaGravaPrazoReal = retirada.success && !!retirada.data.prazoPrevisto && !!retirada.data.dataRetirada;

  DB_Update.byId('FERRAMENTAS', ferramenta1.data.ID, { prazoPrevisto: new Date(Date.now() - 3600 * 1000) });
  const verificacaoAtraso = Service_Ferramenta.verificarFerramentasAtrasadas({ userId: 'sistema' });
  resultados.detectaFerramentaAtrasadaDeVerdade = verificacaoAtraso.total >= 1;

  let recebeuEventoAtraso = false;
  Event_Bus.on(EVENT_TYPES.FERRAMENTA_ATRASADA, function () { recebeuEventoAtraso = true; });
  Service_Ferramenta.verificarFerramentasAtrasadas({ userId: 'sistema' });
  resultados.eventoDeAtrasoEmitidoDeVerdade = recebeuEventoAtraso;

  const ferramenta2 = Core_API.call({ action: 'ferramenta.create', sessionId: sessionAdmin, payload: { codigo: 'B06-F2', descricao: 'Serra B06' } });
  const naoConformidadeAlta = Core_API.call({ action: 'ferramenta.registrarNaoConformidade', sessionId: sessionAdmin, payload: { ferramentaId: ferramenta2.data.ID, gravidade: 'ALTA', descricao: 'Cabo desgastado' } });
  const ferramenta2Depois = Core_API.call({ action: 'ferramenta.get', sessionId: sessionAdmin, payload: { id: ferramenta2.data.ID } });
  resultados.altaContinuaComProblemaComoAntes = naoConformidadeAlta.success && ferramenta2Depois.data.estado === 'COM_PROBLEMA';

  const ferramenta3 = Core_API.call({ action: 'ferramenta.create', sessionId: sessionAdmin, payload: { codigo: 'B06-F3', descricao: 'Esmerilhadeira B06' } });
  const naoConformidadeCritica = Core_API.call({ action: 'ferramenta.registrarNaoConformidade', sessionId: sessionAdmin, payload: { ferramentaId: ferramenta3.data.ID, gravidade: 'CRITICA', descricao: 'Risco grave de segurança' } });
  const ferramenta3Depois = Core_API.call({ action: 'ferramenta.get', sessionId: sessionAdmin, payload: { id: ferramenta3.data.ID } });
  resultados.criticaVaiParaBloqueadaNovo = naoConformidadeCritica.success && ferramenta3Depois.data.estado === 'BLOQUEADA';

  const ferramentaComDefeito = Core_API.call({ action: 'ferramenta.create', sessionId: sessionAdmin, payload: { codigo: 'B06-DEFEITO', descricao: 'Ferramenta com defeito B06' } });
  const ferramentaSubstituta = Core_API.call({ action: 'ferramenta.create', sessionId: sessionAdmin, payload: { codigo: 'B06-SUBSTITUTA', descricao: 'Ferramenta substituta B06' } });
  Core_API.call({ action: 'ferramenta.retirar', sessionId: operador.data.sessionId, payload: { ferramentaId: ferramentaComDefeito.data.ID } });

  const troca = Core_API.call({ action: 'ferramenta.trocar', sessionId: sessionAdmin, payload: { ferramentaAnteriorId: ferramentaComDefeito.data.ID, ferramentaNovaId: ferramentaSubstituta.data.ID, motivo: 'Fio exposto' } });
  resultados.trocaFuncionaDeVerdade = troca.success && troca.data.ferramentaAnterior.estado === 'COM_PROBLEMA' && troca.data.ferramentaNova.estado === 'EM_USO';
  resultados.trocaMantemVinculoComOMesmoUsuario = troca.success && troca.data.ferramentaNova.responsavelAtual === operador.data.userId;

  const historicoTroca = DB_Query.find('FERRAMENTA_TROCAS', function (t) { return String(t.ferramentaAnteriorId) === String(ferramentaComDefeito.data.ID); });
  resultados.historicoDeTrocaRegistrado = historicoTroca.length === 1 && historicoTroca[0].motivo === 'Fio exposto';

  const tentaTrocarDisponivel = Core_API.call({ action: 'ferramenta.trocar', sessionId: sessionAdmin, payload: { ferramentaAnteriorId: ferramenta2.data.ID, ferramentaNovaId: ferramenta1.data.ID, motivo: 'x' } });
  resultados.bloqueiaTrocaDeFerramentaQueNaoEstaEmUso = !tentaTrocarDisponivel.success;

  const disponibilidade = Core_API.call({ action: 'ferramenta.disponibilidade', sessionId: sessionAdmin, payload: {} });
  resultados.disponibilidadeAgregadaFunciona = disponibilidade.success && typeof disponibilidade.data.porEstado.DISPONIVEL === 'number' &&
    typeof disponibilidade.data.porEstado.BLOQUEADA === 'number' && disponibilidade.data.total >= 5;

  const ferramentaManutencao = Core_API.call({ action: 'ferramenta.create', sessionId: sessionAdmin, payload: { codigo: 'B06-MANUT', descricao: 'Ferramenta manutenção B06' } });
  const manutencao = Core_API.call({ action: 'ferramenta.abrirManutencao', sessionId: sessionAdmin, payload: { ferramentaId: ferramentaManutencao.data.ID, motivo: 'Revisão' } });
  let recebeuEventoManutencaoConcluida = false;
  Event_Bus.on(EVENT_TYPES.FERRAMENTA_MANUTENCAO_CONCLUIDA, function () { recebeuEventoManutencaoConcluida = true; });
  Core_API.call({ action: 'ferramenta.concluirManutencao', sessionId: sessionAdmin, payload: { manutencaoId: manutencao.data.ID } });
  resultados.eventoDeManutencaoConcluidaEmitidoDeVerdade = recebeuEventoManutencaoConcluida;

  resultados.bloqueadaExisteNoEnumFormal = CORE_CONSTANTS.FERRAMENTA_ESTADOS.indexOf('BLOQUEADA') > -1;

  const passou = Object.values(resultados).every(Boolean);

  Logger.log('=== RESULTADOS BLOCO 06 (Ferramentas) ===');
  Logger.log(JSON.stringify(resultados, null, 2));
  Logger.log('=== ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌') + ' ===');
  SpreadsheetApp.getUi().alert('Teste Bloco 06: ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌ — veja o Logger.'));

  return resultados;
}
