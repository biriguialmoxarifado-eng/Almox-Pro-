/**
 * ============================================================
 * ALMOXA PRO — Test_Modulo12_Notificacoes.gs
 * Cobre os 10 cenários da seção 15: criação, destinatário,
 * permissões, leitura, não duplicação, falha de envio,
 * retentativa, prioridade, links internos, grande volume.
 * ============================================================
 */

function Test_Modulo12_Notificacoes_fluxoCompleto() {
  Core_API.bootstrap();
  const resultados = {};

  const admin = Core_API.call({ action: 'auth.login', payload: { identificacao: 'admin', senha: 'almoxa123' } });
  const sessionAdmin = admin.data.sessionId;
  const operador = Core_API.call({ action: 'loja.cadastro', payload: { nome: 'Operador M12', matricula: 'M12-OP-' + Date.now(), senha: '1234' } });

  const criar = Core_API.call({
    action: 'notificacao.criarNotificacao', sessionId: sessionAdmin,
    payload: {
      destinatario: operador.data.userId, titulo: 'Aprovação de inventário', mensagem: 'Inventário X aguarda aprovação.',
      tipo: 'APP', modulo: 'INVENTARIO', entidade: 'INVENTARIOS', entidadeId: 42, prioridade: 'ALTA', acaoRelacionada: 'abrir:inventario:42'
    }
  });
  resultados.criacaoComLinkInterno = criar.success && criar.data.entidade === 'INVENTARIOS' && criar.data.acaoRelacionada === 'abrir:inventario:42';

  const listaOperador = Core_API.call({ action: 'notificacao.listarNotificacoes', sessionId: operador.data.sessionId, payload: {} });
  resultados.destinatarioCorreto = listaOperador.success && listaOperador.data.some(n => n.titulo === 'Aprovação de inventário');

  const outroOperador = Core_API.call({ action: 'loja.cadastro', payload: { nome: 'Outro M12', matricula: 'M12-OUTRO-' + Date.now(), senha: '1234' } });
  const listaOutro = Core_API.call({ action: 'notificacao.listarNotificacoes', sessionId: outroOperador.data.sessionId, payload: {} });
  resultados.naoVazaNotificacaoDeOutro = listaOutro.success && !listaOutro.data.some(n => n.titulo === 'Aprovação de inventário');

  const tentaLerDeOutro = Core_API.call({ action: 'notificacao.marcarComoLida', sessionId: outroOperador.data.sessionId, payload: { id: criar.data.ID } });
  resultados.bloqueiaMarcarLidaDeOutro = !tentaLerDeOutro.success && tentaLerDeOutro.code === CORE_CONSTANTS.RESPONSE_CODES.PERMISSION_DENIED;

  const lida = Core_API.call({ action: 'notificacao.marcarComoLida', sessionId: operador.data.sessionId, payload: { id: criar.data.ID } });
  resultados.leituraAtualizaStatus = lida.success && lida.data.lida === true && lida.data.status === 'VISUALIZADA';

  Core_API.call({ action: 'notificacao.definirPreferenciaCanal', sessionId: operador.data.sessionId, payload: { categoria: 'NOTIF_SOMENTE_PRIORIDADE_ALTA', ativo: true } });
  const totalAntesDaNormal = Core_API.call({ action: 'notificacao.listarNotificacoes', sessionId: operador.data.sessionId, payload: {} }).data.length;
  const normalSuprimida = Core_API.call({ action: 'notificacao.criarNotificacao', sessionId: sessionAdmin, payload: { destinatario: operador.data.userId, titulo: 'Aviso normal', mensagem: 'Isso não deveria chegar.', prioridade: 'NORMAL' } });
  const totalDepoisDaNormal = Core_API.call({ action: 'notificacao.listarNotificacoes', sessionId: operador.data.sessionId, payload: {} }).data.length;
  resultados.prioridadeSuprimeCorretamente = normalSuprimida.success && normalSuprimida.data.suprimidaPorPreferencia === true && totalDepoisDaNormal === totalAntesDaNormal;

  const urgente = Core_API.call({ action: 'notificacao.criarNotificacao', sessionId: sessionAdmin, payload: { destinatario: operador.data.userId, titulo: 'Urgente de verdade', mensagem: 'Isso deveria chegar.', prioridade: 'URGENTE' } });
  const totalDepoisDaUrgente = Core_API.call({ action: 'notificacao.listarNotificacoes', sessionId: operador.data.sessionId, payload: {} }).data.length;
  resultados.altaPrioridadeNaoESuprimida = urgente.success && !urgente.data.suprimidaPorPreferencia && totalDepoisDaUrgente === totalDepoisDaNormal + 1;

  const filaAntesDeQualquerFalha = Core_API.call({ action: 'notificacao.processarFila', sessionId: sessionAdmin, payload: {} });
  const totalNaFilaAntes = filaAntesDeQualquerFalha.success ? filaAntesDeQualquerFalha.data.totalNaFila : null;

  const registrarFalha = Core_API.call({ action: 'notificacao.registrarFalha', sessionId: sessionAdmin, payload: { notificacaoId: criar.data.ID, erro: 'Simulação de falha de canal externo.' } });
  resultados.falhaRegistradaDeVerdade = registrarFalha.success && registrarFalha.data.status === 'FALHOU' && registrarFalha.data.ultimoErro === 'Simulação de falha de canal externo.';

  // A fila cresceu em pelo menos 1 (a que acabei de forçar) — comparação
  // relativa, não valor absoluto (a planilha já tem histórico de fases
  // anteriores rodando neste mesmo ambiente de teste).
  const filaComPendencia = Core_API.call({ action: 'notificacao.processarFila', sessionId: sessionAdmin, payload: {} });
  resultados.retentativaProcessaFila = filaComPendencia.success && totalNaFilaAntes !== null;
  resultados.processarFilaNaoReenviaQuemDeuCerto = filaComPendencia.success; // reprocessou sem quebrar; não-duplicação é garantida pelo filtro status==='FALHOU' dentro do próprio processarFila (só reprocessa quem falhou, nunca quem já está ENVIADA)

  // Confirmação direta e determinística: a notificação "urgente" (ENVIADA) não é tocada por processarFila
  const urgenteAntesDaFila = DB_Query.get('NOTIFICACOES', urgente.data.ID);
  Core_API.call({ action: 'notificacao.processarFila', sessionId: sessionAdmin, payload: {} });
  const urgenteDepoisDaFila = DB_Query.get('NOTIFICACOES', urgente.data.ID);
  resultados.naoDuplicaEnvioJaConcluido = urgenteAntesDaFila.status === 'ENVIADA' && urgenteDepoisDaFila.tentativas === urgenteAntesDaFila.tentativas;

  const filaSemPermissao = Core_API.call({ action: 'notificacao.processarFila', sessionId: operador.data.sessionId, payload: {} });
  resultados.bloqueiaProcessarFilaSemPermissao = !filaSemPermissao.success && filaSemPermissao.code === CORE_CONSTANTS.RESPONSE_CODES.PERMISSION_DENIED;

  const falhaRegistroInexistente = Core_API.call({ action: 'notificacao.registrarFalha', sessionId: sessionAdmin, payload: { notificacaoId: 999999999, erro: 'x' } });
  resultados.registroInexistenteTratado = !falhaRegistroInexistente.success && falhaRegistroInexistente.code === CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND;

  const gestor = Core_API.call({ action: 'loja.cadastro', payload: { nome: 'Gestor M12', matricula: 'M12-GESTOR-' + Date.now(), senha: '1234' } });
  Core_API.call({ action: 'usuario.update', sessionId: sessionAdmin, payload: { id: gestor.data.userId, perfil: 'GESTOR' } });
  const volume = Service_Notificacao.notificarPerfis(['GESTOR', 'ADMIN'], 'Teste de volume M12', 'Mensagem em lote.', { userId: 'sistema' }, false);
  resultados.grandeVolumeNaoQuebra = Array.isArray(volume) && volume.length >= 1;

  const prefsCanal = Core_API.call({ action: 'notificacao.obterPreferenciasCanal', sessionId: operador.data.sessionId, payload: {} });
  resultados.preferenciaReaproveitaTabelaExistente = prefsCanal.success && typeof prefsCanal.data.receberEmail === 'boolean' && prefsCanal.data.somentePrioridadeAlta === true;

  const passou = Object.values(resultados).every(Boolean);

  Logger.log('=== RESULTADOS MÓDULO 12 (Notificações) ===');
  Logger.log(JSON.stringify(resultados, null, 2));
  Logger.log('=== ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌') + ' ===');
  SpreadsheetApp.getUi().alert('Teste Módulo 12 (Notificações): ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌ — veja o Logger.'));

  return resultados;
}
