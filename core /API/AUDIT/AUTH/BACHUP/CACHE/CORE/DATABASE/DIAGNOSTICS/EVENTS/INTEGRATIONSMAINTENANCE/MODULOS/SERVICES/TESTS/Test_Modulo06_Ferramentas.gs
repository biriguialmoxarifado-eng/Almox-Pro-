/**
 * ============================================================
 * ALMOXA PRO — Test_Modulo06_Ferramentas.gs
 * Cobre a seção 10 do contrato: cadastro, identificação, consulta,
 * reserva reaproveitando o Reserva central, dupla reserva
 * impedida, retirada (com e sem biometria — inclusive biometria
 * incorreta), devolução, vistoria com não conformidade bloqueando
 * a ferramenta, manutenção, extravio, baixa autorizada, usuário
 * sem permissão, histórico, notificações.
 * ============================================================
 */

function Test_Modulo06_Ferramentas_fluxoCompleto() {
  Core_API.bootstrap();
  const resultados = {};

  const admin = Core_API.call({ action: 'auth.login', payload: { identificacao: 'admin', senha: 'almoxa123' } });
  const sessionAdmin = admin.data.sessionId;

  const operador = Core_API.call({ action: 'loja.cadastro', payload: { nome: 'Operador Ferramenta M6', matricula: 'M6-OP-' + Date.now(), senha: '1234' } });
  const sessionOperador = operador.data.sessionId;
  const userIdOperador = operador.data.userId;

  const criar = Core_API.call({
    action: 'ferramenta.create', sessionId: sessionAdmin,
    payload: { codigo: 'FER-M6-01', descricao: 'Furadeira de Impacto', categoria: 'Elétrica', numeroSerie: 'SN-001', localizacao: 'ALMOX-CENTRAL' }
  });
  resultados.cadastraFerramenta = criar.success && criar.data.estado === 'DISPONIVEL';
  const idFerramenta = criar.data.ID;

  const identificar = Core_API.call({ action: 'ferramenta.identificar', sessionId: sessionOperador, payload: { codigo: 'SN-001' } });
  resultados.identificaPorNumeroSerie = identificar.success && identificar.data.ID === idFerramenta;

  const qr = Core_API.call({ action: 'ferramenta.gerarQR', sessionId: sessionAdmin, payload: { id: idFerramenta } });
  resultados.geraQRReaproveitandoEtiqueta = qr.success && qr.data.conteudoQR === 'FERRAMENTA:' + idFerramenta;

  const busca = Core_API.call({ action: 'ferramenta.search', sessionId: sessionOperador, payload: { busca: 'Furadeira' } });
  resultados.consultaFerramenta = busca.success && busca.data.length === 1;

  const reservar = Core_API.call({ action: 'reserva.create', sessionId: sessionOperador, payload: { ferramentaId: idFerramenta } });
  resultados.reservaViaModuloCentral = reservar.success && reservar.data.ferramenta.estado === 'RESERVADA';
  const idReserva = reservar.data.reserva.ID;

  const outroOperador = Core_API.call({ action: 'loja.cadastro', payload: { nome: 'Outro M6', matricula: 'M6-OUTRO-' + Date.now(), senha: '1234' } });
  const dupla = Core_API.call({ action: 'reserva.create', sessionId: outroOperador.data.sessionId, payload: { ferramentaId: idFerramenta } });
  resultados.impedeDuplaReserva = !dupla.success;

  Core_API.call({ action: 'reserva.approve', sessionId: sessionAdmin, payload: { id: idReserva } });
  Core_API.call({ action: 'reserva.separar', sessionId: sessionAdmin, payload: { id: idReserva } });
  Core_API.call({ action: 'reserva.marcarPronta', sessionId: sessionAdmin, payload: { id: idReserva } });
  const entregar = Core_API.call({ action: 'reserva.entregar', sessionId: sessionAdmin, payload: { id: idReserva } });
  const ferramentaAposEntrega = Core_API.call({ action: 'ferramenta.get', sessionId: sessionAdmin, payload: { id: idFerramenta } });
  resultados.entregaViaReservaMoveFerramentaParaEmUso = entregar.success && ferramentaAposEntrega.data.estado === 'EM_USO' && String(ferramentaAposEntrega.data.responsavelAtual) === String(userIdOperador);

  const devolver = Core_API.call({ action: 'ferramenta.devolver', sessionId: sessionOperador, payload: { ferramentaId: idFerramenta, condicaoProblema: true, condicao: 'Fio desencapado' } });
  resultados.devolucaoComProblemaAbreVistoria = devolver.success && devolver.data.estado === 'AGUARDANDO_VISTORIA';

  const vistoria = Core_API.call({
    action: 'ferramenta.abrirVistoria', sessionId: sessionAdmin,
    payload: { ferramentaId: idFerramenta, naoConformidade: true, gravidade: 'ALTA', dano: 'Fio exposto', recomendacao: 'Trocar cabo antes de novo uso' }
  });
  resultados.vistoriaNaoConformeBloqueiaFerramenta = vistoria.success && vistoria.data.ferramenta.estado === 'COM_PROBLEMA';

  const naoConformidades = Core_API.call({ action: 'ferramenta.painel', sessionId: sessionAdmin, payload: {} });
  resultados.painelContaPendenciaDeNaoConformidade = naoConformidades.success && naoConformidades.data.pendenciasNaoConformidade >= 1;

  const retirarComProblema = Core_API.call({ action: 'ferramenta.retirar', sessionId: sessionOperador, payload: { ferramentaId: idFerramenta } });
  resultados.bloqueiaRetiradaComProblema = !retirarComProblema.success;

  const abrirManutencao = Core_API.call({ action: 'ferramenta.abrirManutencao', sessionId: sessionAdmin, payload: { ferramentaId: idFerramenta, motivo: 'Trocar cabo' } });
  resultados.abreManutencao = abrirManutencao.success;
  const concluirManutencao = Core_API.call({ action: 'ferramenta.concluirManutencao', sessionId: sessionAdmin, payload: { manutencaoId: abrirManutencao.data.ID } });
  resultados.concluiManutencaoLiberaFerramenta = concluirManutencao.success && concluirManutencao.data.status === 'CONCLUIDA';

  const retiradaDireta = Core_API.call({ action: 'ferramenta.retirar', sessionId: sessionOperador, payload: { ferramentaId: idFerramenta } });
  resultados.retiradaDiretaFunciona = retiradaDireta.success && retiradaDireta.data.estado === 'EM_USO';

  Core_API.call({ action: 'ferramenta.devolver', sessionId: sessionOperador, payload: { ferramentaId: idFerramenta } });
  const biometriaErrada = Core_API.call({
    action: 'ferramenta.retirar', sessionId: sessionOperador,
    payload: { ferramentaId: idFerramenta, confirmarBiometria: true, deviceSecret: 'segredo-que-nao-bate-1234567890' }
  });
  resultados.biometriaIncorretaBloqueiaRetirada = !biometriaErrada.success;

  const baixarSemPermissao = Core_API.call({ action: 'ferramenta.baixar', sessionId: sessionOperador, payload: { ferramentaId: idFerramenta, motivo: 'Quebrou', tipoBaixa: 'dano_irreparavel' } });
  resultados.bloqueiaBaixaSemPermissao = !baixarSemPermissao.success && baixarSemPermissao.code === CORE_CONSTANTS.RESPONSE_CODES.PERMISSION_DENIED;

  Core_API.call({ action: 'ferramenta.devolver', sessionId: sessionOperador, payload: { ferramentaId: idFerramenta } });
  const baixar = Core_API.call({ action: 'ferramenta.baixar', sessionId: sessionAdmin, payload: { ferramentaId: idFerramenta, motivo: 'Fim de vida útil', tipoBaixa: 'administrativa' } });
  resultados.baixaAutorizadaFunciona = baixar.success && baixar.data.estado === 'BAIXADA';

  const ferramenta2 = Core_API.call({ action: 'ferramenta.create', sessionId: sessionAdmin, payload: { codigo: 'FER-M6-02', descricao: 'Nível a Laser' } });
  const extravio = Core_API.call({ action: 'ferramenta.reportarExtravio', sessionId: sessionAdmin, payload: { ferramentaId: ferramenta2.data.ID, motivo: 'Não encontrada após inventário' } });
  resultados.extravioFunciona = extravio.success && extravio.data.estado === 'EXTRAVIADA';

  const historico = Core_API.call({ action: 'ferramenta.historico', sessionId: sessionAdmin, payload: { id: idFerramenta } });
  resultados.historicoPreservaEventos = historico.success && historico.data.eventos.length >= 5 && historico.data.reservas.length === 1;

  const notificacoesGestao = Core_API.call({ action: 'notificacao.list', sessionId: sessionAdmin, payload: {} });
  resultados.notificaNaoConformidade = notificacoesGestao.success && notificacoesGestao.data.some(n => n.titulo === 'Ferramenta com não conformidade');

  const passou = Object.values(resultados).every(Boolean);

  Logger.log('=== RESULTADOS MÓDULO 06 (Ferramentas) ===');
  Logger.log(JSON.stringify(resultados, null, 2));
  Logger.log('=== ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌') + ' ===');
  SpreadsheetApp.getUi().alert('Teste Módulo 06 (Ferramentas): ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌ — veja o Logger.'));

  return resultados;
}
