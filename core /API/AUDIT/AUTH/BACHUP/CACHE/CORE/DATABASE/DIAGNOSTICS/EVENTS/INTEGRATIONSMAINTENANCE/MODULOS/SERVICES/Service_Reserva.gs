/**
 * ============================================================
 * ALMOXA PRO — Service_Reserva.gs
 * FASE 5 do backend — núcleo real preservado (create/get/
 * approve/reject/cancel/calendar/schedule já funcionavam).
 *
 * MÓDULO 05 (contrato "PROMPTS_MODULOS_04_05_06") — AMPLIA sem
 * recriar. Auditoria confirmou uma lacuna real e central: NENHUMA
 * reserva jamais gerava saída física de verdade no estoque — o
 * saldo ficava reservado indefinidamente até cancelar/expirar.
 * A regra fundamental da spec ("reserva reduz disponível; o
 * físico só muda na saída real") nunca tinha o outro lado do
 * ciclo implementado. Completado agora:
 *
 * PENDENTE → APROVADA → EM_SEPARACAO → PRONTA → ENTREGUE (aqui
 * sim sai do físico de verdade) → CONCLUIDA
 *          ↘ REPROVADA          ↘ CANCELADA (em qualquer ponto
 *                                  antes de ENTREGUE, libera saldo)
 *          ↘ EXPIRADA (se vencer antes de aprovar/entregar)
 *
 * DECISÃO DOCUMENTADA sobre os estados: a spec pede também
 * "Rascunho", "Em análise" e "Pré-reserva" antes de "Reservada".
 * Não criei esses três como estados distintos — o `PENDENTE`
 * atual já cumpre exatamente essa função (saldo travado, aguardando
 * decisão) desde a Fase 5. Renomear ou desdobrar isso só pra bater
 * litteralmente com o vocabulário da spec quebraria compatibilidade
 * sem agregar comportamento novo — contraria a própria regra do
 * contrato de "não duplicar enum".
 * ============================================================
 */

const Service_Reserva = (function () {

  const ESTADOS_CANCELAVEIS = ['PENDENTE', 'APROVADA', 'EM_SEPARACAO', 'PRONTA', 'ATENDIMENTO_PARCIAL'];
  const PERFIS_GESTAO = [CORE_CONSTANTS.PERFIS.ALMOXARIFE, CORE_CONSTANTS.PERFIS.GESTOR, CORE_CONSTANTS.PERFIS.ADMIN];

  function _expirarSeVencida(reserva, ctx) {
    if (reserva.status !== 'PENDENTE' && reserva.status !== 'APROVADA') return reserva;
    if (!reserva.validade || new Date(reserva.validade) > new Date()) return reserva;

    Service_Estoque._liberarReservaInterno(reserva.produtoId, reserva.localizacao, reserva.quantidade);
    DB_Update.byId('RESERVAS', reserva.ID, { status: 'EXPIRADA' });
    Event_Bus.emit(EVENT_TYPES.RESERVA_EXPIRADA, { reservaId: reserva.ID }, ctx || {});
    return DB_Query.get('RESERVAS', reserva.ID);
  }

  /**
   * MÓDULO 06 (Ferramentas) — `create()` agora aceita DOIS tipos
   * de alvo, pra não criar um segundo mecanismo de reserva:
   *   (a) produtoId+localizacao+quantidade → saldo fungível do
   *       Estoque (comportamento original, intocado);
   *   (b) ferramentaId → bem individual/serializado, sem conceito
   *       de "quantidade disponível" (é binário: livre ou não).
   * O restante do ciclo (approve/reject/cancel/separar/
   * marcarPronta/entregar/concluir/historico) é o MESMO código
   * pros dois casos — só os 3 pontos que tocam o recurso físico
   * (aqui, cancel/reject, e entregar) precisam saber a diferença.
   */
  function create(ctx) {
    const p = ctx.payload || {};

    if (p.ferramentaId) return _criarReservaDeFerramenta(ctx, p);

    const { produtoId, localizacao, quantidade, obraId, validadeHoras } = p;
    try {
      DB_Validation.requireFields(p, ['produtoId', 'localizacao', 'quantidade']);
    } catch (e) {
      return Core_Response.error(e.code || CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, e.message, {}, ctx.requestId);
    }
    if (!Utils_Validation.isPositiveNumber(Number(quantidade))) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'quantidade deve ser positiva.', {}, ctx.requestId);
    }

    const duplicada = DB_Query.findOne('RESERVAS', r =>
      String(r.produtoId) === String(produtoId) && r.localizacao === localizacao &&
      r.solicitante === ctx.userId && (r.status === 'PENDENTE' || r.status === 'APROVADA')
    );
    if (duplicada) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'Já existe uma reserva sua em aberto para este produto/local (reserva #' + duplicada.ID + ').', {}, ctx.requestId);
    }

    let saldoAtualizado;
    try {
      saldoAtualizado = Service_Estoque._reservarSaldoInterno(produtoId, localizacao, quantidade);
    } catch (e) {
      return Core_Response.error(e.code || CORE_CONSTANTS.RESPONSE_CODES.INTERNAL_ERROR, e.message, {}, ctx.requestId);
    }

    const horas = validadeHoras || Core_Config.get('RESERVATION_DEFAULT_HOURS') || 48;
    const reserva = DB_Insert.insert('RESERVAS', {
      produtoId, localizacao, quantidade,
      solicitante: ctx.userId, obraId: obraId || '',
      status: 'PENDENTE', validade: Utils_Date.addDays(new Date(), horas / 24),
      aprovador: '', motivo: '', separadorId: '', dataSeparacao: '',
      entregadorId: '', dataEntrega: '', dataConclusao: '', ferramentaId: '', quantidadeAtendida: 0, data: new Date()
    });

    Event_Bus.emit(EVENT_TYPES.RESERVA_CRIADA, { reservaId: reserva.ID, produtoId, quantidade }, ctx);
    Event_Bus.emit(EVENT_TYPES.RESERVA_APROVACAO_SOLICITADA, { reservaId: reserva.ID }, ctx);
    Audit_Service.record(ctx, 'RESERVA_CRIADA', { entidade: 'RESERVAS', entidadeId: reserva.ID });

    return Core_Response.ok({ reserva, saldo: saldoAtualizado }, 'Reserva criada — saldo travado até aprovação/expiração.', 'SUCCESS', {}, ctx.requestId);
  }

  function _criarReservaDeFerramenta(ctx, p) {
    const ferramenta = DB_Query.get('FERRAMENTAS', p.ferramentaId);
    if (!ferramenta) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Ferramenta não encontrada.', {}, ctx.requestId);
    if (ferramenta.estado !== 'DISPONIVEL') {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR,
        'Ferramenta não está disponível (estado atual: ' + ferramenta.estado + ') — impede dupla reserva incompatível.', {}, ctx.requestId);
    }
    const horas = p.validadeHoras || Core_Config.get('RESERVATION_DEFAULT_HOURS') || 48;

    DB_Update.byId('FERRAMENTAS', ferramenta.ID, { estado: 'RESERVADA' });
    const reserva = DB_Insert.insert('RESERVAS', {
      produtoId: '', localizacao: ferramenta.localizacao, quantidade: 1,
      solicitante: ctx.userId, obraId: p.obraId || '',
      status: 'PENDENTE', validade: Utils_Date.addDays(new Date(), horas / 24),
      aprovador: '', motivo: '', separadorId: '', dataSeparacao: '',
      entregadorId: '', dataEntrega: '', dataConclusao: '', ferramentaId: ferramenta.ID, quantidadeAtendida: 0, data: new Date()
    });

    Event_Bus.emit(EVENT_TYPES.RESERVA_CRIADA, { reservaId: reserva.ID, ferramentaId: ferramenta.ID }, ctx);
    Event_Bus.emit(EVENT_TYPES.RESERVA_APROVACAO_SOLICITADA, { reservaId: reserva.ID }, ctx);
    Event_Bus.emit(EVENT_TYPES.FERRAMENTA_RESERVADA, { ferramentaId: ferramenta.ID, reservaId: reserva.ID }, ctx);
    Audit_Service.record(ctx, 'RESERVA_CRIADA', { entidade: 'RESERVAS', entidadeId: reserva.ID });

    return Core_Response.ok({ reserva, ferramenta: DB_Query.get('FERRAMENTAS', ferramenta.ID) }, 'Ferramenta reservada.', 'SUCCESS', {}, ctx.requestId);
  }

  /** NOVA — consulta disponibilidade sem criar reserva (seção 3/6 do contrato). Compõe com Estoque, nunca recalcula por fora. */
  function disponibilidade(ctx) {
    const { produtoId, localizacao } = ctx.payload || {};
    if (!produtoId || !localizacao) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'produtoId e localizacao são obrigatórios.', {}, ctx.requestId);
    return Service_Estoque.get({ userId: ctx.userId, requestId: ctx.requestId, perfil: ctx.perfil, payload: { produtoId, localizacao } });
  }

  function _podeVerReserva(reserva, ctx) {
    return PERFIS_GESTAO.includes(ctx.perfil) || String(reserva.solicitante) === String(ctx.userId);
  }

  function get(ctx) {
    const row = DB_Query.get('RESERVAS', ctx.payload.id);
    if (!row) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Reserva não encontrada.', {}, ctx.requestId);
    if (!_podeVerReserva(row, ctx)) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.PERMISSION_DENIED, 'Esta reserva não é sua.', {}, ctx.requestId);
    }
    return Core_Response.ok(_expirarSeVencida(row, ctx), '', 'SUCCESS', {}, ctx.requestId);
  }

  /** NOVA — histórico real (reaproveita AUDITORIA, não duplica trilha própria — seção 10 do contrato). */
  function historico(ctx) {
    const reserva = DB_Query.get('RESERVAS', ctx.payload.id);
    if (!reserva) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Reserva não encontrada.', {}, ctx.requestId);
    if (!_podeVerReserva(reserva, ctx)) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.PERMISSION_DENIED, 'Esta reserva não é sua.', {}, ctx.requestId);
    const eventos = DB_Query.find('AUDITORIA', a => a.entidade === 'RESERVAS' && String(a.entidadeId) === String(reserva.ID))
      .sort((a, b) => new Date(a.data) - new Date(b.data));
    return Core_Response.ok(eventos, '', 'SUCCESS', {}, ctx.requestId);
  }

  function approve(ctx) {
    const reserva = DB_Query.get('RESERVAS', ctx.payload.id);
    if (!reserva) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Reserva não encontrada.', {}, ctx.requestId);
    const atual = _expirarSeVencida(reserva, ctx);
    if (atual.status !== 'PENDENTE') {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'Reserva não está pendente (status atual: ' + atual.status + ').', {}, ctx.requestId);
    }
    DB_Update.byId('RESERVAS', reserva.ID, { status: 'APROVADA', aprovador: ctx.userId, motivo: (ctx.payload || {}).comentario || '' });
    Event_Bus.emit(EVENT_TYPES.RESERVA_APROVADA, { reservaId: reserva.ID }, ctx);
    Audit_Service.record(ctx, 'RESERVA_APROVADA', { entidade: 'RESERVAS', entidadeId: reserva.ID }, { status: 'PENDENTE' }, { status: 'APROVADA' });
    return Core_Response.ok(DB_Query.get('RESERVAS', reserva.ID), 'Reserva aprovada.', 'SUCCESS', {}, ctx.requestId);
  }

  function reject(ctx) {
    const reserva = DB_Query.get('RESERVAS', ctx.payload.id);
    if (!reserva) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Reserva não encontrada.', {}, ctx.requestId);
    if (reserva.status !== 'PENDENTE') {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'Só é possível reprovar reserva pendente.', {}, ctx.requestId);
    }
    if (reserva.ferramentaId) {
      DB_Update.byId('FERRAMENTAS', reserva.ferramentaId, { estado: 'DISPONIVEL' });
    } else {
      Service_Estoque._liberarReservaInterno(reserva.produtoId, reserva.localizacao, reserva.quantidade);
    }
    const motivo = (ctx.payload || {}).motivo || '';
    DB_Update.byId('RESERVAS', reserva.ID, { status: 'REPROVADA', aprovador: ctx.userId, motivo });
    // MÓDULO 05 — bug corrigido: reject() nunca emitia evento
    // nenhum antes; o solicitante não era avisado da reprovação.
    Event_Bus.emit(EVENT_TYPES.RESERVA_REPROVADA, { reservaId: reserva.ID, motivo }, ctx);
    Audit_Service.record(ctx, 'RESERVA_REPROVADA', { entidade: 'RESERVAS', entidadeId: reserva.ID }, { status: 'PENDENTE' }, { status: 'REPROVADA', motivo });
    return Core_Response.ok(DB_Query.get('RESERVAS', reserva.ID), 'Reserva reprovada — saldo liberado.', 'SUCCESS', {}, ctx.requestId);
  }

  /**
   * BLOCO 05, seção 4.7 — gap corrigido: a coluna `motivo` já
   * existia em `RESERVAS` (usada por `approve`/`reject`), mas
   * `cancel()` nunca gravava nada nela — "registrar quem
   * cancelou, quando, motivo" só cumpria 2 dos 3 itens.
   */
  function cancel(ctx) {
    const reserva = DB_Query.get('RESERVAS', ctx.payload.id);
    if (!reserva) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Reserva não encontrada.', {}, ctx.requestId);
    if (!_podeVerReserva(reserva, ctx)) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.PERMISSION_DENIED, 'Você só pode cancelar sua própria reserva.', {}, ctx.requestId);
    }
    if (!ESTADOS_CANCELAVEIS.includes(reserva.status)) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'Reserva não pode ser cancelada (status: ' + reserva.status + ').', {}, ctx.requestId);
    }
    const motivo = (ctx.payload || {}).motivo || '';
    let quantidadeLiberada = 0;
    if (reserva.ferramentaId) {
      DB_Update.byId('FERRAMENTAS', reserva.ferramentaId, { estado: 'DISPONIVEL' });
    } else {
      // Se já houve atendimento parcial, só a parte AINDA reservada é liberada — o que já saiu fisicamente não volta.
      quantidadeLiberada = Number(reserva.quantidade) - Number(reserva.quantidadeAtendida || 0);
      Service_Estoque._liberarReservaInterno(reserva.produtoId, reserva.localizacao, quantidadeLiberada);
    }
    DB_Update.byId('RESERVAS', reserva.ID, { status: 'CANCELADA', motivo: motivo });
    Event_Bus.emit(EVENT_TYPES.RESERVA_CANCELADA, { reservaId: reserva.ID, motivo: motivo, quantidadeLiberada: quantidadeLiberada }, ctx);
    Audit_Service.record(ctx, 'RESERVA_CANCELADA', { entidade: 'RESERVAS', entidadeId: reserva.ID }, { status: reserva.status }, { status: 'CANCELADA', motivo: motivo, quantidadeLiberada: quantidadeLiberada });
    return Core_Response.ok(DB_Query.get('RESERVAS', reserva.ID), 'Reserva cancelada — saldo liberado.', 'SUCCESS', {}, ctx.requestId);
  }

  /** NOVA — inicia a separação física (seção 7 do contrato). */
  function separar(ctx) {
    const reserva = DB_Query.get('RESERVAS', ctx.payload.id);
    if (!reserva) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Reserva não encontrada.', {}, ctx.requestId);
    if (reserva.status !== 'APROVADA') {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'Reserva precisa estar aprovada antes de separar (status atual: ' + reserva.status + ').', {}, ctx.requestId);
    }
    DB_Update.byId('RESERVAS', reserva.ID, { status: 'EM_SEPARACAO', separadorId: ctx.userId, dataSeparacao: new Date() });
    Event_Bus.emit(EVENT_TYPES.RESERVA_SEPARACAO, { reservaId: reserva.ID }, ctx);
    Audit_Service.record(ctx, 'RESERVA_SEPARACAO', { entidade: 'RESERVAS', entidadeId: reserva.ID }, { status: 'APROVADA' }, { status: 'EM_SEPARACAO' });
    return Core_Response.ok(DB_Query.get('RESERVAS', reserva.ID), 'Reserva em separação.', 'SUCCESS', {}, ctx.requestId);
  }

  /** NOVA — marca item(ns) já separado(s), pronto pra retirada. */
  function marcarPronta(ctx) {
    const reserva = DB_Query.get('RESERVAS', ctx.payload.id);
    if (!reserva) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Reserva não encontrada.', {}, ctx.requestId);
    if (reserva.status !== 'EM_SEPARACAO') {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'Reserva precisa estar em separação (status atual: ' + reserva.status + ').', {}, ctx.requestId);
    }
    DB_Update.byId('RESERVAS', reserva.ID, { status: 'PRONTA' });
    Event_Bus.emit(EVENT_TYPES.RESERVA_PRONTA, { reservaId: reserva.ID }, ctx);
    Audit_Service.record(ctx, 'RESERVA_PRONTA', { entidade: 'RESERVAS', entidadeId: reserva.ID }, { status: 'EM_SEPARACAO' }, { status: 'PRONTA' });
    return Core_Response.ok(DB_Query.get('RESERVAS', reserva.ID), 'Reserva pronta para retirada.', 'SUCCESS', {}, ctx.requestId);
  }

  /**
   * NOVA — o elo que faltava de verdade (seção 7: "somente a
   * retirada/saída real movimenta estoque físico"). Registra
   * entrega/retirada E efetiva a saída real via Service_Estoque,
   * liberando o reservado como parte da mesma operação — nunca
   * duplica a lógica de baixa, reaproveita `_registrarSaidaInterna`
   * exatamente como Service_Solicitacao já fazia.
   */
  /**
   * BLOCO 05, seção 4.5/4.6 — gap real encontrado: `entregar()`
   * só fazia entrega TUDO-OU-NADA. A spec pede atendimento
   * parcial de verdade ("reserva de 100, atende 60, resta 40,
   * nunca perde histórico"). Reescrito pra suportar os dois casos
   * com a MESMA função (não criei uma segunda rota com lógica
   * duplicada) — `reserva.atenderParcial` é só um ALIAS de rota
   * pro mesmo handler (ver `API_Reservas.gs`).
   *
   * RETROCOMPATIBILIDADE: quem chama sem `quantidade` no payload
   * continua entregando o total restante de uma vez — exatamente
   * o comportamento antigo, incluindo pra reserva de ferramenta
   * (que nunca é parcial — ferramenta é uma unidade indivisível,
   * `quantidade` é sempre ignorada nesse caso, documentado).
   */
  function entregar(ctx) {
    const reserva = DB_Query.get('RESERVAS', ctx.payload.id);
    if (!reserva) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Reserva não encontrada.', {}, ctx.requestId);
    if (!['PRONTA', 'ATENDIMENTO_PARCIAL'].includes(reserva.status)) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'Reserva precisa estar pronta pra retirada (status atual: ' + reserva.status + ').', {}, ctx.requestId);
    }

    if (reserva.ferramentaId) {
      // MÓDULO 06 — ferramenta não tem "saída de estoque" nem
      // atendimento parcial (bem indivisível); o que muda é o
      // estado do bem e quem é o responsável atual.
      DB_Update.byId('FERRAMENTAS', reserva.ferramentaId, { estado: 'EM_USO', responsavelAtual: reserva.solicitante });
      Event_Bus.emit(EVENT_TYPES.FERRAMENTA_RETIRADA, { ferramentaId: reserva.ferramentaId, reservaId: reserva.ID, userId: reserva.solicitante }, ctx);
      DB_Update.byId('RESERVAS', reserva.ID, { status: 'ENTREGUE', entregadorId: ctx.userId, dataEntrega: new Date(), quantidadeAtendida: reserva.quantidade });
      Event_Bus.emit(EVENT_TYPES.RESERVA_ENTREGUE, { reservaId: reserva.ID }, ctx);
      Audit_Service.record(ctx, 'RESERVA_ENTREGUE', { entidade: 'RESERVAS', entidadeId: reserva.ID }, { status: reserva.status }, { status: 'ENTREGUE' });
      return Core_Response.ok(DB_Query.get('RESERVAS', reserva.ID), 'Reserva entregue.', 'SUCCESS', {}, ctx.requestId);
    }

    const jaAtendido = Number(reserva.quantidadeAtendida || 0);
    const restante = Number(reserva.quantidade) - jaAtendido;
    const pedida = Number((ctx.payload || {}).quantidade);
    const quantidadeDessaEntrega = (pedida > 0 && pedida < restante) ? pedida : restante; // sem quantidade válida informada → entrega tudo que resta (comportamento antigo)

    if (quantidadeDessaEntrega <= 0) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'Esta reserva já foi totalmente atendida.', {}, ctx.requestId);
    }

    try {
      Service_Estoque._registrarSaidaInterna(
        reserva.produtoId, reserva.localizacao, quantidadeDessaEntrega,
        { motivo: 'Entrega de reserva #' + reserva.ID, documentoId: reserva.ID, obraId: reserva.obraId }, ctx, quantidadeDessaEntrega
      );
    } catch (e) {
      return Core_Response.error(e.code || CORE_CONSTANTS.RESPONSE_CODES.INTERNAL_ERROR, 'Falha ao efetivar a saída: ' + e.message, {}, ctx.requestId);
    }

    const novoAtendido = jaAtendido + quantidadeDessaEntrega;
    const restanteAposEntrega = Number(reserva.quantidade) - novoAtendido;
    const entregaCompleta = restanteAposEntrega <= 0;

    // Histórico de cada entrega parcial — "nunca perder o histórico" (seção 4.6), tabela própria, nunca sobrescreve a anterior.
    DB_Insert.insert('RESERVA_ATENDIMENTOS', {
      reservaId: reserva.ID, quantidadeAtendida: quantidadeDessaEntrega, responsavel: ctx.userId, data: new Date(), localizacao: reserva.localizacao
    });

    const alteracoes = { quantidadeAtendida: novoAtendido, entregadorId: ctx.userId };
    if (entregaCompleta) {
      alteracoes.status = 'ENTREGUE';
      alteracoes.dataEntrega = new Date();
    } else {
      alteracoes.status = 'ATENDIMENTO_PARCIAL';
    }
    DB_Update.byId('RESERVAS', reserva.ID, alteracoes);

    if (entregaCompleta) {
      Event_Bus.emit(EVENT_TYPES.RESERVA_ENTREGUE, { reservaId: reserva.ID }, ctx);
      Audit_Service.record(ctx, 'RESERVA_ENTREGUE', { entidade: 'RESERVAS', entidadeId: reserva.ID }, { status: reserva.status }, { status: 'ENTREGUE', quantidadeAtendida: novoAtendido });
      return Core_Response.ok(DB_Query.get('RESERVAS', reserva.ID), 'Reserva entregue.', 'SUCCESS', {}, ctx.requestId);
    }

    Event_Bus.emit(EVENT_TYPES.RESERVA_ATENDIMENTO_PARCIAL, { reservaId: reserva.ID, quantidadeAtendida: quantidadeDessaEntrega, restante: restanteAposEntrega }, ctx);
    Audit_Service.record(ctx, 'RESERVA_ATENDIMENTO_PARCIAL', { entidade: 'RESERVAS', entidadeId: reserva.ID }, { status: reserva.status }, { status: 'ATENDIMENTO_PARCIAL', quantidadeAtendida: novoAtendido, restante: restanteAposEntrega });
    return Core_Response.ok(Object.assign({}, DB_Query.get('RESERVAS', reserva.ID), { restante: restanteAposEntrega }),
      'Atendimento parcial registrado — ' + quantidadeDessaEntrega + ' entregue(s), ' + restanteAposEntrega + ' restante(s).', 'SUCCESS', {}, ctx.requestId);
  }

  /** NOVA — fechamento formal (seção 3 do contrato lista "Concluída" separada de "Entregue"). */
  function concluir(ctx) {
    const reserva = DB_Query.get('RESERVAS', ctx.payload.id);
    if (!reserva) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Reserva não encontrada.', {}, ctx.requestId);
    if (reserva.status !== 'ENTREGUE') {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'Reserva precisa estar entregue antes de concluir (status atual: ' + reserva.status + ').', {}, ctx.requestId);
    }
    const podeConcluir = _podeVerReserva(reserva, ctx); // dono confirma recebimento OU gestão fecha administrativamente
    if (!podeConcluir) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.PERMISSION_DENIED, 'Você não pode concluir esta reserva.', {}, ctx.requestId);

    DB_Update.byId('RESERVAS', reserva.ID, { status: 'CONCLUIDA', dataConclusao: new Date() });
    Event_Bus.emit(EVENT_TYPES.RESERVA_CONCLUIDA, { reservaId: reserva.ID }, ctx);
    Audit_Service.record(ctx, 'RESERVA_CONCLUIDA', { entidade: 'RESERVAS', entidadeId: reserva.ID }, { status: 'ENTREGUE' }, { status: 'CONCLUIDA' });
    return Core_Response.ok(DB_Query.get('RESERVAS', reserva.ID), 'Reserva concluída.', 'SUCCESS', {}, ctx.requestId);
  }

  function calendar(ctx) {
    const f = ctx.payload || {};
    const podeVerTodas = PERFIS_GESTAO.includes(ctx.perfil);
    const rows = DB_Query.find('RESERVAS', r => {
      if (!podeVerTodas && String(r.solicitante) !== String(ctx.userId)) return false;
      if (f.obraId && r.obraId !== f.obraId) return false;
      if (f.dataInicio && new Date(r.validade) < new Date(f.dataInicio)) return false;
      if (f.dataFim && new Date(r.validade) > new Date(f.dataFim)) return false;
      return true;
    }).map(r => _expirarSeVencida(r, ctx))
      .sort((a, b) => new Date(a.validade) - new Date(b.validade));
    return Core_Response.ok(rows, '', 'SUCCESS', {}, ctx.requestId);
  }

  function schedule(ctx) {
    const { id, novaValidade } = ctx.payload || {};
    const reserva = DB_Query.get('RESERVAS', id);
    if (!reserva) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Reserva não encontrada.', {}, ctx.requestId);
    if (!['PENDENTE', 'APROVADA'].includes(reserva.status)) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'Só é possível reagendar reserva pendente/aprovada.', {}, ctx.requestId);
    }
    DB_Update.byId('RESERVAS', id, { validade: novaValidade });
    Audit_Service.record(ctx, 'RESERVA_REAGENDADA', { entidade: 'RESERVAS', entidadeId: id }, { validade: reserva.validade }, { validade: novaValidade });
    return Core_Response.ok(DB_Query.get('RESERVAS', id), 'Reserva reagendada.', 'SUCCESS', {}, ctx.requestId);
  }

  return {
    create, disponibilidade, get, historico, approve, reject, cancel,
    separar, marcarPronta, entregar, concluir, calendar, schedule,
    _expirarSeVencida, _podeVerReserva
  };
})();
