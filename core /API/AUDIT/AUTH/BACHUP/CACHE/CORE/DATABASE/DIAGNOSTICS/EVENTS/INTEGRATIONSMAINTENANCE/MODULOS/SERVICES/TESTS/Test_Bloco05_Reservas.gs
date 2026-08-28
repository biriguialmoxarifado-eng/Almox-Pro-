/**
 * ============================================================
 * ALMOXA PRO — Test_Bloco05_Reservas.gs
 * O núcleo de criar/aprovar/reprovar/separar/pronta/entregar total/
 * concluir/expirar/histórico/permissões já tinha teste próprio
 * (Test_Modulo05_Reservas.gs, entrega original) — não duplicado
 * aqui. Este teste foca no que é GENUINAMENTE NOVO: atendimento
 * parcial real (nunca existia) e motivo de cancelamento (coluna
 * existia, nunca era usada).
 * ============================================================
 */

function Test_Bloco05_Reservas_fluxoCompleto() {
  Core_API.bootstrap();
  const resultados = {};

  const admin = Core_API.call({ action: 'auth.login', payload: { identificacao: 'admin', senha: 'almoxa123' } });
  const sessionAdmin = admin.data.sessionId;
  const solicitante = Core_API.call({ action: 'loja.cadastro', payload: { nome: 'Solicitante B05', matricula: 'B05-SOL-' + Date.now(), senha: '1234' } });

  const produto = Core_API.call({ action: 'produto.create', sessionId: sessionAdmin, payload: { descricaoOriginal: 'Item Atendimento Parcial B05', codigo: 'B05-PARCIAL' } });
  const local = 'TESTE-B05/PARCIAL';
  Core_API.call({ action: 'estoque.entry', sessionId: sessionAdmin, payload: { produtoId: produto.data.ID, localizacao: local, quantidade: 100 } });

  const criar = Core_API.call({ action: 'reserva.create', sessionId: solicitante.data.sessionId, payload: { produtoId: produto.data.ID, localizacao: local, quantidade: 100 } });
  const idReserva = criar.data.reserva.ID;
  Core_API.call({ action: 'reserva.approve', sessionId: sessionAdmin, payload: { id: idReserva } });
  Core_API.call({ action: 'reserva.separar', sessionId: sessionAdmin, payload: { id: idReserva } });
  Core_API.call({ action: 'reserva.marcarPronta', sessionId: sessionAdmin, payload: { id: idReserva } });

  const primeiraEntrega = Core_API.call({ action: 'reserva.atenderParcial', sessionId: sessionAdmin, payload: { id: idReserva, quantidade: 60 } });
  resultados.entregaParcialFunciona = primeiraEntrega.success && primeiraEntrega.data.status === 'ATENDIMENTO_PARCIAL' && primeiraEntrega.data.restante === 40;

  const saldoAposPrimeira = Core_API.call({ action: 'estoque.get', sessionId: sessionAdmin, payload: { produtoId: produto.data.ID, localizacao: local } });
  resultados.saidaFisicaSoDaParteEntregue = saldoAposPrimeira.data.saldo === 40 && saldoAposPrimeira.data.reservado === 40;

  const historicoAtendimentos = DB_Query.find('RESERVA_ATENDIMENTOS', function (a) { return String(a.reservaId) === String(idReserva); });
  resultados.historicoDeAtendimentoRegistrado = historicoAtendimentos.length === 1 && historicoAtendimentos[0].quantidadeAtendida === 60;

  const segundaEntrega = Core_API.call({ action: 'reserva.entregar', sessionId: sessionAdmin, payload: { id: idReserva } });
  resultados.segundaEntregaCompletaFecha = segundaEntrega.success && segundaEntrega.data.status === 'ENTREGUE';

  const saldoFinal = Core_API.call({ action: 'estoque.get', sessionId: sessionAdmin, payload: { produtoId: produto.data.ID, localizacao: local } });
  resultados.saldoFinalCorreto = saldoFinal.data.saldo === 0 && saldoFinal.data.reservado === 0;

  const historicoAtendimentosFinal = DB_Query.find('RESERVA_ATENDIMENTOS', function (a) { return String(a.reservaId) === String(idReserva); });
  resultados.doisRegistrosDeHistoricoNuncaSobrescreveram = historicoAtendimentosFinal.length === 2;

  const tentaEntregarDeNovo = Core_API.call({ action: 'reserva.entregar', sessionId: sessionAdmin, payload: { id: idReserva } });
  resultados.bloqueiaEntregaAposCompleta = !tentaEntregarDeNovo.success;

  const ferramenta = Core_API.call({ action: 'ferramenta.create', sessionId: sessionAdmin, payload: { codigo: 'B05-FER', descricao: 'Ferramenta Teste B05' } });
  const reservaFerramenta = Core_API.call({ action: 'reserva.create', sessionId: solicitante.data.sessionId, payload: { ferramentaId: ferramenta.data.ID } });
  Core_API.call({ action: 'reserva.approve', sessionId: sessionAdmin, payload: { id: reservaFerramenta.data.reserva.ID } });
  Core_API.call({ action: 'reserva.separar', sessionId: sessionAdmin, payload: { id: reservaFerramenta.data.reserva.ID } });
  Core_API.call({ action: 'reserva.marcarPronta', sessionId: sessionAdmin, payload: { id: reservaFerramenta.data.reserva.ID } });
  const entregaFerramentaComQuantidadeIgnorada = Core_API.call({ action: 'reserva.entregar', sessionId: sessionAdmin, payload: { id: reservaFerramenta.data.reserva.ID, quantidade: 0.5 } });
  resultados.ferramentaContinuaTudoOuNada = entregaFerramentaComQuantidadeIgnorada.success && entregaFerramentaComQuantidadeIgnorada.data.status === 'ENTREGUE';

  const produto2 = Core_API.call({ action: 'produto.create', sessionId: sessionAdmin, payload: { descricaoOriginal: 'Item Cancelamento B05', codigo: 'B05-CANCEL' } });
  Core_API.call({ action: 'estoque.entry', sessionId: sessionAdmin, payload: { produtoId: produto2.data.ID, localizacao: local, quantidade: 10 } });
  const reservaParaCancelar = Core_API.call({ action: 'reserva.create', sessionId: solicitante.data.sessionId, payload: { produtoId: produto2.data.ID, localizacao: local, quantidade: 5 } });
  const cancelamento = Core_API.call({ action: 'reserva.cancel', sessionId: solicitante.data.sessionId, payload: { id: reservaParaCancelar.data.reserva.ID, motivo: 'Não preciso mais do material' } });
  resultados.motivoDeCancelamentoRegistradoDeVerdade = cancelamento.success && cancelamento.data.motivo === 'Não preciso mais do material';

  const produto3 = Core_API.call({ action: 'produto.create', sessionId: sessionAdmin, payload: { descricaoOriginal: 'Item Cancelar Parcial B05', codigo: 'B05-CANCELPARCIAL' } });
  Core_API.call({ action: 'estoque.entry', sessionId: sessionAdmin, payload: { produtoId: produto3.data.ID, localizacao: local, quantidade: 50 } });
  const reservaCancelarParcial = Core_API.call({ action: 'reserva.create', sessionId: solicitante.data.sessionId, payload: { produtoId: produto3.data.ID, localizacao: local, quantidade: 50 } });
  Core_API.call({ action: 'reserva.approve', sessionId: sessionAdmin, payload: { id: reservaCancelarParcial.data.reserva.ID } });
  Core_API.call({ action: 'reserva.separar', sessionId: sessionAdmin, payload: { id: reservaCancelarParcial.data.reserva.ID } });
  Core_API.call({ action: 'reserva.marcarPronta', sessionId: sessionAdmin, payload: { id: reservaCancelarParcial.data.reserva.ID } });
  Core_API.call({ action: 'reserva.atenderParcial', sessionId: sessionAdmin, payload: { id: reservaCancelarParcial.data.reserva.ID, quantidade: 30 } });
  const cancelaAposParcial = Core_API.call({ action: 'reserva.cancel', sessionId: sessionAdmin, payload: { id: reservaCancelarParcial.data.reserva.ID, motivo: 'Cancelar o restante' } });
  const saldoAposCancelarParcial = Core_API.call({ action: 'estoque.get', sessionId: sessionAdmin, payload: { produtoId: produto3.data.ID, localizacao: local } });
  resultados.cancelarAposParcialLiberaSoORestante = cancelaAposParcial.success && saldoAposCancelarParcial.data.saldo === 20 && saldoAposCancelarParcial.data.reservado === 0;

  const contrato = Core_API.call({ action: 'doctor.moduleContract', sessionId: sessionAdmin, payload: { moduloId: 'MOD_07_RESERVAS' } });
  resultados.doutorRefleteEventosReais = contrato.success && contrato.data.saidas.indexOf('RESERVA_ATENDIMENTO_PARCIAL') > -1 && contrato.data.saidas.length >= 10;

  const passou = Object.values(resultados).every(Boolean);

  Logger.log('=== RESULTADOS BLOCO 05 (Reservas) ===');
  Logger.log(JSON.stringify(resultados, null, 2));
  Logger.log('=== ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌') + ' ===');
  SpreadsheetApp.getUi().alert('Teste Bloco 05: ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌ — veja o Logger.'));

  return resultados;
}
