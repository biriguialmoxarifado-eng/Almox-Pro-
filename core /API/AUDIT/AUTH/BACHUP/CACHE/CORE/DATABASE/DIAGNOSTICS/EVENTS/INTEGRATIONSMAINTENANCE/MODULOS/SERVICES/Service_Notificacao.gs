/**
 * ============================================================
 * ALMOXA PRO — Service_Notificacao.gs
 * FASE 8 — núcleo real preservado (list/read/send/notificarPerfis
 * /verificarEstoqueCritico/verificarReservasVencendo continuam
 * funcionando exatamente como antes).
 *
 * MÓDULO 12 (contrato "Notificações e Comunicação") — AMPLIA sem
 * quebrar nenhum dos 21 pontos que já chamam
 * `_criarNotificacaoInterna`/`notificarPerfis` em `Notificacao_Events
 * .gs`: todo parâmetro novo entra OPCIONAL, no final da lista —
 * conferido caso a caso antes de mexer.
 *
 * O QUE JÁ EXISTIA E NÃO FOI DUPLICADO:
 * - Preferência de notificação por categoria → já existe desde o
 *   Módulo 09 (`IA_PREFERENCIAS`). Este módulo REAPROVEITA a
 *   mesma tabela pra canal (e-mail/WhatsApp) e prioridade mínima,
 *   com namespace de categoria próprio (`NOTIF_CANAL_*`), sem
 *   criar uma segunda tabela de preferência.
 * - Canal in-app + e-mail → já existiam (Fase 8). O que faltava:
 *   status formal, registro de falha real (antes era só um
 *   `console.error` silencioso), retentativa controlada, e o
 *   contrato de WhatsApp preparado (`Integration_WhatsApp`, novo).
 * ============================================================
 */

const Service_Notificacao = (function () {

  const CATEGORIA_CANAL_EMAIL = 'NOTIF_CANAL_EMAIL';
  const CATEGORIA_CANAL_WHATSAPP = 'NOTIF_CANAL_WHATSAPP';
  const CATEGORIA_SOMENTE_PRIORIDADE_ALTA = 'NOTIF_SOMENTE_PRIORIDADE_ALTA';

  function _resolveEmail(destinatarioUserId) {
    const user = DB_Query.get('USUARIOS', destinatarioUserId);
    return user ? user.email : null;
  }

  function _resolveTelefone(destinatarioUserId) {
    const user = DB_Query.get('USUARIOS', destinatarioUserId);
    return user ? user.telefone : null;
  }

  /**
   * PREFERÊNCIAS (seção 8) — reaproveita `IA_PREFERENCIAS` do
   * Módulo 09 (mesma tabela genérica {userId, categoria, ativo}),
   * com categorias PRÓPRIAS deste módulo (não mexe nas categorias
   * do Módulo 09, não usa `Service_AIEngine` pra isso — são
   * domínios diferentes compartilhando só o armazenamento).
   */
  function _preferenciaAtiva(userId, categoria, padrao) {
    const pref = DB_Query.findOne('IA_PREFERENCIAS', p => String(p.userId) === String(userId) && p.categoria === categoria);
    return pref ? !!pref.ativo : padrao;
  }

  function definirPreferenciaCanal(ctx) {
    const p = ctx.payload || {};
    const userIdAlvo = p.userId || ctx.userId;
    if (String(userIdAlvo) !== String(ctx.userId) && ctx.perfil !== CORE_CONSTANTS.PERFIS.ADMIN) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.PERMISSION_DENIED, 'Só ADMIN pode configurar preferência de outro usuário.', {}, ctx.requestId);
    }
    const categoriasValidas = [CATEGORIA_CANAL_EMAIL, CATEGORIA_CANAL_WHATSAPP, CATEGORIA_SOMENTE_PRIORIDADE_ALTA];
    if (!categoriasValidas.includes(p.categoria)) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'categoria deve ser uma de: ' + categoriasValidas.join(', '), {}, ctx.requestId);
    }
    const existente = DB_Query.findOne('IA_PREFERENCIAS', pref => String(pref.userId) === String(userIdAlvo) && pref.categoria === p.categoria);
    if (existente) DB_Update.byId('IA_PREFERENCIAS', existente.ID, { ativo: !!p.ativo });
    else DB_Insert.insert('IA_PREFERENCIAS', { userId: userIdAlvo, categoria: p.categoria, ativo: !!p.ativo });
    return Core_Response.ok({ userId: userIdAlvo, categoria: p.categoria, ativo: !!p.ativo }, 'Preferência salva.', 'SUCCESS', {}, ctx.requestId);
  }

  function obterPreferenciasCanal(ctx) {
    const userId = (ctx.payload && ctx.payload.userId) || ctx.userId;
    if (String(userId) !== String(ctx.userId) && ctx.perfil !== CORE_CONSTANTS.PERFIS.ADMIN) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.PERMISSION_DENIED, 'Você só pode ver suas próprias preferências.', {}, ctx.requestId);
    }
    return Core_Response.ok({
      userId,
      receberEmail: _preferenciaAtiva(userId, CATEGORIA_CANAL_EMAIL, true),
      receberWhatsapp: _preferenciaAtiva(userId, CATEGORIA_CANAL_WHATSAPP, false),
      somentePrioridadeAlta: _preferenciaAtiva(userId, CATEGORIA_SOMENTE_PRIORIDADE_ALTA, false)
    }, '', 'SUCCESS', {}, ctx.requestId);
  }

  function list(ctx) {
    const p = ctx.payload || {};
    const destinatario = (ctx.perfil === CORE_CONSTANTS.PERFIS.ADMIN && p.destinatario) ? p.destinatario : ctx.userId;
    const rows = DB_Query.find('NOTIFICACOES', n => {
      if (String(n.destinatario) !== String(destinatario)) return false;
      if (p.lida !== undefined && String(n.lida) !== String(p.lida)) return false;
      if (p.tipo && n.tipo !== p.tipo) return false;
      if (p.prioridade && n.prioridade !== p.prioridade) return false;
      if (p.modulo && n.modulo !== p.modulo) return false;
      return true;
    }).sort((a, b) => new Date(b.data) - new Date(a.data));
    return Core_Response.ok(rows, '', 'SUCCESS', {}, ctx.requestId);
  }

  function read(ctx) {
    const notif = DB_Query.get('NOTIFICACOES', ctx.payload.id);
    if (!notif) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Notificação não encontrada.', {}, ctx.requestId);
    if (String(notif.destinatario) !== String(ctx.userId) && ctx.perfil !== CORE_CONSTANTS.PERFIS.ADMIN) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.PERMISSION_DENIED, 'Esta notificação não é sua.', {}, ctx.requestId);
    }
    DB_Update.byId('NOTIFICACOES', notif.ID, { lida: true, status: 'VISUALIZADA' });
    return Core_Response.ok(DB_Query.get('NOTIFICACOES', notif.ID), '', 'SUCCESS', {}, ctx.requestId);
  }

  function send(ctx) {
    const { destinatario, titulo, mensagem, tipo, enviarEmail } = ctx.payload || {};
    try { DB_Validation.requireFields(ctx.payload || {}, ['destinatario', 'titulo', 'mensagem']); }
    catch (e) { return Core_Response.error(e.code || CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, e.message, {}, ctx.requestId); }

    const registro = _criarNotificacaoInterna(destinatario, titulo, mensagem, tipo || 'APP', enviarEmail, ctx);
    return Core_Response.ok(registro, 'Notificação enviada.', 'SUCCESS', {}, ctx.requestId);
  }

  /**
   * Usada internamente (rotas e os 21 gatilhos automáticos já
   * existentes). `extras` é NOVO e OPCIONAL — nenhuma chamada
   * existente precisa mudar. Contém: modulo, entidade, entidadeId,
   * prioridade, acaoRelacionada, tentarWhatsapp.
   *
   * FALHA REGISTRADA DE VERDADE (bug corrigido — antes era só um
   * `console.error` que ninguém via): se o canal de e-mail falhar,
   * a notificação in-app continua criada (nunca depende do canal
   * externo pra existir — seção 9 do contrato: "não bloquear a
   * operação principal só porque uma notificação externa falhou"),
   * mas o status vira FALHOU com o erro registrado, disponível
   * pra `processarFila()` tentar de novo depois.
   */
  function _criarNotificacaoInterna(destinatarioUserId, titulo, mensagem, tipo, enviarEmail, ctx, extras) {
    const ex = extras || {};
    const somentePrioridadeAlta = _preferenciaAtiva(destinatarioUserId, CATEGORIA_SOMENTE_PRIORIDADE_ALTA, false);
    const prioridade = ex.prioridade || 'NORMAL';
    if (somentePrioridadeAlta && !['ALTA', 'URGENTE'].includes(prioridade)) {
      // Preferência real sendo respeitada (seção 7/8): a pessoa
      // pediu pra só ser incomodada com prioridade alta — a
      // notificação nem chega a ser criada (não é "criada e
      // escondida", é genuinamente não gerada, por decisão dela).
      return { suprimidaPorPreferencia: true };
    }

    const registro = DB_Insert.insert('NOTIFICACOES', {
      tipo: tipo || 'APP', destinatario: destinatarioUserId, titulo, mensagem, lida: false, data: new Date(),
      modulo: ex.modulo || '', entidade: ex.entidade || '', entidadeId: ex.entidadeId || '',
      prioridade, status: 'CRIADA', canal: 'APP', tentativas: 0, ultimoErro: '', acaoRelacionada: ex.acaoRelacionada || ''
    });

    let statusFinal = 'ENVIADA'; // in-app já "enviado" no instante em que foi gravado — é o canal garantido
    let ultimoErro = '';

    const quereEmail = enviarEmail && _preferenciaAtiva(destinatarioUserId, CATEGORIA_CANAL_EMAIL, true);
    if (quereEmail && Core_Config.get('EMAIL_NOTIFICATIONS_ENABLED')) {
      const email = _resolveEmail(destinatarioUserId);
      if (email) {
        try { Integration_Email.send(email, titulo, '<p>' + mensagem + '</p>'); }
        catch (e) { statusFinal = 'FALHOU'; ultimoErro = 'E-mail: ' + e.message; }
      }
    }

    const quereWhatsapp = ex.tentarWhatsapp && _preferenciaAtiva(destinatarioUserId, CATEGORIA_CANAL_WHATSAPP, false);
    if (quereWhatsapp) {
      const telefone = _resolveTelefone(destinatarioUserId);
      const resultado = telefone ? Integration_WhatsApp.send(telefone, titulo + ': ' + mensagem) : { enviado: false, motivo: 'Usuário sem telefone cadastrado.' };
      if (!resultado.enviado) { statusFinal = 'FALHOU'; ultimoErro = (ultimoErro ? ultimoErro + ' | ' : '') + 'WhatsApp: ' + resultado.motivo; }
    }

    DB_Update.byId('NOTIFICACOES', registro.ID, { status: statusFinal, ultimoErro, tentativas: ultimoErro ? 1 : 0 });
    return Object.assign({}, registro, { status: statusFinal, ultimoErro });
  }

  /** Broadcast pra todo usuário ativo de um/vários perfis. `extras` é NOVO e OPCIONAL. */
  function notificarPerfis(perfis, titulo, mensagem, ctx, enviarEmail, extras) {
    const destinatarios = DB_Query.find('USUARIOS', u => perfis.includes(u.perfil) && u.status === 'ATIVO');
    return destinatarios.map(u => _criarNotificacaoInterna(u.ID, titulo, mensagem, 'SISTEMA', !!enviarEmail, ctx, extras));
  }

  // ---- Alias de API (seção 13 do contrato) — mesma função por baixo, nomes que o contrato pede ----
  function criarNotificacao(ctx) {
    const p = ctx.payload || {};
    try { DB_Validation.requireFields(p, ['destinatario', 'titulo', 'mensagem']); }
    catch (e) { return Core_Response.error(e.code || CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, e.message, {}, ctx.requestId); }
    const registro = _criarNotificacaoInterna(p.destinatario, p.titulo, p.mensagem, p.tipo, p.enviarEmail, ctx, {
      modulo: p.modulo, entidade: p.entidade, entidadeId: p.entidadeId, prioridade: p.prioridade, acaoRelacionada: p.acaoRelacionada, tentarWhatsapp: p.tentarWhatsapp
    });
    return Core_Response.ok(registro, 'Notificação criada.', 'SUCCESS', {}, ctx.requestId);
  }
  function enviarNotificacao(ctx) { return send(ctx); }
  function marcarComoLida(ctx) { return read(ctx); }
  function listarNotificacoes(ctx) { return list(ctx); }

  /**
   * FILA/RETENTATIVA (seção 9/10) — reprocessa só quem está
   * FALHOU e ainda não estourou o limite de tentativas. Nunca
   * reenvia quem já deu certo (evita duplicidade — seção 10).
   */
  function processarFila(ctx) {
    const maxTentativas = Core_Config.get('NOTIFICACAO_MAX_TENTATIVAS') || 3;
    const pendentes = DB_Query.find('NOTIFICACOES', n => n.status === 'FALHOU' && Number(n.tentativas || 0) < maxTentativas);

    let reprocessadas = 0, aindaFalhando = 0;
    pendentes.forEach(notif => {
      let novoStatus = 'ENVIADA', novoErro = '';
      if (notif.ultimoErro && notif.ultimoErro.startsWith('E-mail')) {
        const email = _resolveEmail(notif.destinatario);
        if (email) {
          try { Integration_Email.send(email, notif.titulo, '<p>' + notif.mensagem + '</p>'); }
          catch (e) { novoStatus = 'FALHOU'; novoErro = 'E-mail: ' + e.message; }
        } else { novoStatus = 'FALHOU'; novoErro = 'Usuário sem e-mail cadastrado.'; }
      }
      DB_Update.byId('NOTIFICACOES', notif.ID, { status: novoStatus, ultimoErro: novoErro, tentativas: Number(notif.tentativas || 0) + 1 });
      if (novoStatus === 'FALHOU') aindaFalhando++; else reprocessadas++;
    });

    return Core_Response.ok({ totalNaFila: pendentes.length, reprocessadasComSucesso: reprocessadas, aindaFalhando }, '', 'SUCCESS', {}, ctx.requestId);
  }

  /** Registro explícito de falha (seção 11/13) — chamado por qualquer módulo que tentou notificar por fora deste serviço e quer deixar rastro. */
  function registrarFalha(ctx) {
    const { notificacaoId, erro } = ctx.payload || {};
    const notif = DB_Query.get('NOTIFICACOES', notificacaoId);
    if (!notif) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Notificação não encontrada.', {}, ctx.requestId);
    DB_Update.byId('NOTIFICACOES', notif.ID, { status: 'FALHOU', ultimoErro: erro || 'Falha não especificada.', tentativas: Number(notif.tentativas || 0) + 1 });
    return Core_Response.ok(DB_Query.get('NOTIFICACOES', notif.ID), 'Falha registrada.', 'SUCCESS', {}, ctx.requestId);
  }

  // ---- Verificações programadas (preservadas, intocadas) ----

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
      Event_Bus.emit(EVENT_TYPES.RESERVA_EXPIRANDO, { reservaId: reserva.ID }, {});
      _criarNotificacaoInterna(
        reserva.solicitante, 'Reserva vencendo em breve',
        'Sua reserva #' + reserva.ID + ' vence em ' + Utils_Date.format(new Date(reserva.validade)) + '.',
        'SISTEMA', true, {}
      );
    });
    return vencendo.length;
  }

  return {
    list, read, send, notificarPerfis, verificarEstoqueCritico, verificarReservasVencendo, _criarNotificacaoInterna,
    criarNotificacao, enviarNotificacao, marcarComoLida, listarNotificacoes, processarFila, registrarFalha,
    definirPreferenciaCanal, obterPreferenciasCanal
  };
})();
