/**
 * ============================================================
 * ALMOXA PRO — Service_Notificacao.gs
 * FASE 8 — IMPLEMENTADO DE VERDADE.
 *
 * O CANAL de envio (Integration_Email/GmailApp) já existia desde
 * a Fase 1 — o que faltava eram os GATILHOS. Esta fase entrega:
 *
 * 1. Notificação in-app (tabela NOTIFICACOES) — sempre gravada.
 * 2. E-mail (opcional, via Integration_Email) — só se o
 *    destinatário tiver e-mail cadastrado e notificações por
 *    e-mail estiverem habilitadas (Core_Config).
 * 3. notificarPerfis() — helper de broadcast pra todo usuário
 *    ativo de um ou mais perfis (ex: avisar todo GESTOR/ADMIN).
 *
 * Os gatilhos automáticos (ocorrência crítica, reserva vencendo,
 * divergência de NF) ficam em Notificacao_Events.gs, plugados no
 * Event_Bus — rodam sozinhos dentro da mesma execução que gerou
 * o evento (ver limitação documentada no Event_Bus).
 * ============================================================
 */

const Service_Notificacao = (function () {

  function _resolveEmail(destinatarioUserId) {
    const user = DB_Query.get('USUARIOS', destinatarioUserId);
    return user ? user.email : null;
  }

  function list(ctx) {
    const p = ctx.payload || {};
    const destinatario = p.destinatario || ctx.userId;
    const rows = DB_Query.find('NOTIFICACOES', n => {
      if (String(n.destinatario) !== String(destinatario)) return false;
      if (p.lida !== undefined && String(n.lida) !== String(p.lida)) return false;
      return true;
    }).sort((a, b) => new Date(b.data) - new Date(a.data));
    return Core_Response.ok(rows, '', 'SUCCESS', {}, ctx.requestId);
  }

  function read(ctx) {
    const notif = DB_Query.get('NOTIFICACOES', ctx.payload.id);
    if (!notif) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Notificação não encontrada.', {}, ctx.requestId);
    DB_Update.byId('NOTIFICACOES', notif.ID, { lida: true });
    return Core_Response.ok(DB_Query.get('NOTIFICACOES', notif.ID), '', 'SUCCESS', {}, ctx.requestId);
  }

  function send(ctx) {
    const { destinatario, titulo, mensagem, tipo, enviarEmail } = ctx.payload || {};
    try { DB_Validation.requireFields(ctx.payload || {}, ['destinatario', 'titulo', 'mensagem']); }
    catch (e) { return Core_Response.error(e.code || CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, e.message, {}, ctx.requestId); }

    const registro = _criarNotificacaoInterna(destinatario, titulo, mensagem, tipo || 'APP', enviarEmail, ctx);
    return Core_Response.ok(registro, 'Notificação enviada.', 'SUCCESS', {}, ctx.requestId);
  }

  /** Usada internamente (rotas e gatilhos automáticos). */
  function _criarNotificacaoInterna(destinatarioUserId, titulo, mensagem, tipo, enviarEmail, ctx) {
    const registro = DB_Insert.insert('NOTIFICACOES', {
      tipo: tipo || 'APP', destinatario: destinatarioUserId, titulo, mensagem, lida: false, data: new Date()
    });

    if (enviarEmail && Core_Config.get('EMAIL_NOTIFICATIONS_ENABLED')) {
      const email = _resolveEmail(destinatarioUserId);
      if (email) {
        try { Integration_Email.send(email, titulo, '<p>' + mensagem + '</p>'); }
        catch (e) { console.error('[Service_Notificacao] Falha ao enviar e-mail: ' + e.message); }
      }
    }
    return registro;
  }

  /** Broadcast pra todo usuário ativo de um/vários perfis (ex: GESTOR, ADMIN). */
  function notificarPerfis(perfis, titulo, mensagem, ctx, enviarEmail) {
    const destinatarios = DB_Query.find('USUARIOS', u => perfis.includes(u.perfil) && u.status === 'ATIVO');
    return destinatarios.map(u => _criarNotificacaoInterna(u.ID, titulo, mensagem, 'SISTEMA', !!enviarEmail, ctx));
  }

  // ---- Verificações programadas (chamar via Gatilhos.gs / trigger de tempo) ----

  function verificarEstoqueCritico(ctx) {
    const criticos = DB_Query.find('ESTOQUE', r => Number(r.estoqueMinimo) > 0 && Number(r.saldo) <= Number(r.estoqueMinimo));
    criticos.forEach(item => {
      const produto = DB_Query.get('PRODUTOS', item.produtoId);
      const nome = produto ? produto.descricaoOriginal : ('produto #' + item.produtoId);
      notificarPerfis(
        [CORE_CONSTANTS.PERFIS.GESTOR, CORE_CONSTANTS.PERFIS.ADMIN],
        'Estoque crítico: ' + nome,
        nome + ' está com saldo ' + item.saldo + ' em ' + item.localizacao + ' (mínimo: ' + item.estoqueMinimo + ').',
        ctx, true
      );
    });
    return criticos.length;
  }

  function verificarReservasVencendo(horasAntes) {
    const limite = new Date(Date.now() + (horasAntes || 6) * 3600 * 1000);
    const vencendo = DB_Query.find('RESERVAS', r =>
      ['PENDENTE', 'APROVADA'].includes(r.status) && new Date(r.validade) <= limite && new Date(r.validade) > new Date()
    );
    vencendo.forEach(reserva => {
      _criarNotificacaoInterna(
        reserva.solicitante, 'Reserva vencendo em breve',
        'Sua reserva #' + reserva.ID + ' vence em ' + Utils_Date.format(new Date(reserva.validade)) + '.',
        'SISTEMA', true, {}
      );
    });
    return vencendo.length;
  }

  return { list, read, send, notificarPerfis, verificarEstoqueCritico, verificarReservasVencendo, _criarNotificacaoInterna };
})();
