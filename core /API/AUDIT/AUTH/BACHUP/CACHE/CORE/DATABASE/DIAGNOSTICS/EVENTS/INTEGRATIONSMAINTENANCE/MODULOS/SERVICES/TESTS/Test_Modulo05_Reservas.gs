/**
 * ============================================================
 * ALMOXA PRO — Test_Modulo05_Reservas.gs
 * Cobre a seção 11 do contrato, focando no que é NOVO (o núcleo
 * de criar/aprovar/reprovar/cancelar/expirar já tinha teste
 * próprio em Test_Loja_RotasPublicas.gs e Test_Reserva_Seguranca.gs
 * — não duplico aqui).
 * ============================================================
 */

function Test_Modulo05_Reservas_fluxoCompleto() {
  Core_API.bootstrap();
  const resultados = {};

  const admin = Core_API.call({ action: 'auth.login', payload: { identificacao: 'admin', senha: 'almoxa123' } });
  const sessionAdmin = admin.data.sessionId;

  const solicitante = Core_API.call({ action: 'loja.cadastro', payload: { nome: 'Solicitante M5', matricula: 'M5-SOL-' + Date.now(), senha: '1234' } });
  const sessionSolicitante = solicitante.data.sessionId;

  const produto = Core_API.call({ action: 'produto.create', sessionId: sessionAdmin, payload: { descricaoOriginal: 'Item Reserva M5', codigo: 'M5-RES' } });
  const produtoId = produto.data.ID;
  const local = 'TESTE-M5/RESERVA';
  Core_API.call({ action: 'estoque.entry', sessionId: sessionAdmin, payload: { produtoId, localizacao: local, quantidade: 30 } });

  const semSaldo = Core_API.call({ action: 'reserva.create', sessionId: sessionSolicitante, payload: { produtoId, localizacao: local, quantidade: 999 } });
  resultados.reservaSemSaldoFalha = !semSaldo.success && semSaldo.code === CORE_CONSTANTS.RESPONSE_CODES.ESTOQUE_INSUFICIENTE;

  const disponibilidade = Core_API.call({ action: 'reserva.disponibilidade', sessionId: sessionSolicitante, payload: { produtoId, localizacao: local } });
  resultados.disponibilidadeComposta = disponibilidade.success && disponibilidade.data.saldoDisponivel === 30;

  const criar = Core_API.call({ action: 'reserva.create', sessionId: sessionSolicitante, payload: { produtoId, localizacao: local, quantidade: 10 } });
  resultados.criaReservaComSaldo = criar.success;
  const idReserva = criar.data.reserva.ID;

  const saldoAposReservar = Core_API.call({ action: 'estoque.get', sessionId: sessionAdmin, payload: { produtoId, localizacao: local } });
  resultados.reservaReduzApenasDisponivel = saldoAposReservar.success && saldoAposReservar.data.saldo === 30 && saldoAposReservar.data.reservado === 10 && saldoAposReservar.data.saldoDisponivel === 20;

  const outroUsuario = Core_API.call({ action: 'loja.cadastro', payload: { nome: 'Outro M5', matricula: 'M5-OUTRO-' + Date.now(), senha: '1234' } });
  const cancelarDeOutro = Core_API.call({ action: 'reserva.cancel', sessionId: outroUsuario.data.sessionId, payload: { id: idReserva } });
  resultados.bloqueiaAlterarReservaDeOutro = !cancelarDeOutro.success && cancelarDeOutro.code === CORE_CONSTANTS.RESPONSE_CODES.PERMISSION_DENIED;

  const aprovarSemPermissao = Core_API.call({ action: 'reserva.approve', sessionId: sessionSolicitante, payload: { id: idReserva } });
  resultados.bloqueiaAprovarSemPermissao = !aprovarSemPermissao.success && aprovarSemPermissao.code === CORE_CONSTANTS.RESPONSE_CODES.PERMISSION_DENIED;

  const aprovar = Core_API.call({ action: 'reserva.approve', sessionId: sessionAdmin, payload: { id: idReserva, comentario: 'Aprovado, pode separar' } });
  resultados.aprovaComComentario = aprovar.success && aprovar.data.motivo === 'Aprovado, pode separar';

  const separar = Core_API.call({ action: 'reserva.separar', sessionId: sessionAdmin, payload: { id: idReserva } });
  resultados.separacaoFunciona = separar.success && separar.data.status === 'EM_SEPARACAO';

  const pronta = Core_API.call({ action: 'reserva.marcarPronta', sessionId: sessionAdmin, payload: { id: idReserva } });
  resultados.marcarProntaFunciona = pronta.success && pronta.data.status === 'PRONTA';

  const entregar = Core_API.call({ action: 'reserva.entregar', sessionId: sessionAdmin, payload: { id: idReserva } });
  resultados.entregaFunciona = entregar.success && entregar.data.status === 'ENTREGUE';

  const saldoAposEntrega = Core_API.call({ action: 'estoque.get', sessionId: sessionAdmin, payload: { produtoId, localizacao: local } });
  resultados.saidaFisicaRealAplicada = saldoAposEntrega.success && saldoAposEntrega.data.saldo === 20 && saldoAposEntrega.data.reservado === 0;

  const concluir = Core_API.call({ action: 'reserva.concluir', sessionId: sessionSolicitante, payload: { id: idReserva } });
  resultados.concluirFunciona = concluir.success && concluir.data.status === 'CONCLUIDA';

  const cancelarJaConcluida = Core_API.call({ action: 'reserva.cancel', sessionId: sessionSolicitante, payload: { id: idReserva } });
  resultados.bloqueiaCancelarJaConcluida = !cancelarJaConcluida.success;

  const historico = Core_API.call({ action: 'reserva.historico', sessionId: sessionSolicitante, payload: { id: idReserva } });
  resultados.historicoReproduzCiclo = historico.success && historico.data.length >= 5;

  Core_API.call({ action: 'estoque.entry', sessionId: sessionAdmin, payload: { produtoId, localizacao: local, quantidade: 5 } });
  const outroSolicitante = Core_API.call({ action: 'loja.cadastro', payload: { nome: 'Concorrente M5', matricula: 'M5-CONC-' + Date.now(), senha: '1234' } });
  const reserva1 = Core_API.call({ action: 'reserva.create', sessionId: sessionSolicitante, payload: { produtoId, localizacao: local, quantidade: 20 } });
  const reserva2 = Core_API.call({ action: 'reserva.create', sessionId: outroSolicitante.data.sessionId, payload: { produtoId, localizacao: local, quantidade: 20 } });
  resultados.reservasConcorrentesRespeitamSaldo = reserva1.success && !reserva2.success;

  const produto2 = Core_API.call({ action: 'produto.create', sessionId: sessionAdmin, payload: { descricaoOriginal: 'Item Reserva M5-B', codigo: 'M5-RES-B' } });
  Core_API.call({ action: 'estoque.entry', sessionId: sessionAdmin, payload: { produtoId: produto2.data.ID, localizacao: local, quantidade: 10 } });
  const criarParaReprovar = Core_API.call({ action: 'reserva.create', sessionId: sessionSolicitante, payload: { produtoId: produto2.data.ID, localizacao: local, quantidade: 5 } });
  const reprovar = Core_API.call({ action: 'reserva.reject', sessionId: sessionAdmin, payload: { id: criarParaReprovar.data.reserva.ID, motivo: 'Sem justificativa suficiente' } });
  resultados.reprovacaoRegistraMotivo = reprovar.success && reprovar.data.motivo === 'Sem justificativa suficiente';
  const notificacoesSolicitante = Core_API.call({ action: 'notificacao.list', sessionId: sessionSolicitante, payload: {} });
  resultados.reprovacaoNotifica = notificacoesSolicitante.success && notificacoesSolicitante.data.some(n => n.titulo === 'Reserva reprovada');

  const passou = Object.values(resultados).every(Boolean);

  Logger.log('=== RESULTADOS MÓDULO 05 (Reservas) ===');
  Logger.log(JSON.stringify(resultados, null, 2));
  Logger.log('=== ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌') + ' ===');
  SpreadsheetApp.getUi().alert('Teste Módulo 05 (Reservas): ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌ — veja o Logger.'));

  return resultados;
}
