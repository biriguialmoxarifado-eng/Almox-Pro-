/**
 * ============================================================
 * ALMOXA PRO — Notificacao_Events.gs
 * FASE 8 — GATILHOS AUTOMÁTICOS DE NOTIFICAÇÃO.
 *
 * Liga eventos de domínio já emitidos por outros módulos
 * (Ocorrências, Reservas, NF) a notificações reais — sem que
 * esses módulos precisem conhecer Service_Notificacao.
 *
 * IMPORTANTE (limitação documentada em Event_Bus.gs): estes
 * handlers só disparam DENTRO DA MESMA EXECUÇÃO do evento. Como
 * bootstrap() roda no início de toda chamada via Core_API, e os
 * eventos são emitidos depois, na prática funciona normalmente
 * para toda ação feita através da API — o que cobre o uso real.
 * ============================================================
 */

const Notificacao_Events = (function () {

  function bootstrap() {
    // Ocorrência de prioridade alta/urgente → avisa GESTOR/ADMIN
    Event_Bus.on(EVENT_TYPES.OCORRENCIA_CRIADA, Event_Handler.safe('Notificacao_Events', function (payload, ctx) {
      if (!['ALTA', 'URGENTE'].includes(payload.prioridade)) return;
      const ocorrencia = DB_Query.get('OCORRENCIAS', payload.ocorrenciaId);
      Service_Notificacao.notificarPerfis(
        [CORE_CONSTANTS.PERFIS.GESTOR, CORE_CONSTANTS.PERFIS.ADMIN],
        'Ocorrência ' + payload.prioridade + ': ' + payload.tipo,
        (ocorrencia ? ocorrencia.descricao : 'Nova ocorrência registrada.'),
        ctx, true
      );
    }));

    // Reserva expirada → avisa quem pediu
    Event_Bus.on(EVENT_TYPES.RESERVA_EXPIRADA, Event_Handler.safe('Notificacao_Events', function (payload, ctx) {
      const reserva = DB_Query.get('RESERVAS', payload.reservaId);
      if (!reserva) return;
      Service_Notificacao._criarNotificacaoInterna(
        reserva.solicitante, 'Reserva expirada',
        'Sua reserva #' + reserva.ID + ' expirou e o saldo foi liberado.',
        'SISTEMA', true, ctx
      );
    }));

    // MÓDULO 05 (Reservas) — ciclo completo agora tem
    // notificação real em cada etapa (antes só existia pra
    // expiração). "avisarSolicitanteReserva" é reaproveitado de
    // propósito em vários pontos, pra não duplicar a mesma
    // chamada 5 vezes.
    function _avisarSolicitanteReserva(reservaId, titulo, mensagem, ctx) {
      const reserva = DB_Query.get('RESERVAS', reservaId);
      if (!reserva) return;
      Service_Notificacao._criarNotificacaoInterna(reserva.solicitante, titulo, mensagem, 'SISTEMA', false, ctx);
    }

    Event_Bus.on(EVENT_TYPES.RESERVA_APROVACAO_SOLICITADA, Event_Handler.safe('Notificacao_Events', function (payload, ctx) {
      Service_Notificacao.notificarPerfis(
        [CORE_CONSTANTS.PERFIS.GESTOR, CORE_CONSTANTS.PERFIS.ADMIN],
        'Reserva aguardando aprovação',
        'A reserva #' + payload.reservaId + ' está pendente de aprovação.',
        ctx, false
      );
    }));
    Event_Bus.on(EVENT_TYPES.RESERVA_REPROVADA, Event_Handler.safe('Notificacao_Events', function (payload, ctx) {
      _avisarSolicitanteReserva(payload.reservaId, 'Reserva reprovada', 'Sua reserva #' + payload.reservaId + ' foi reprovada.' + (payload.motivo ? ' Motivo: ' + payload.motivo : ''), ctx);
    }));
    Event_Bus.on(EVENT_TYPES.RESERVA_SEPARACAO, Event_Handler.safe('Notificacao_Events', function (payload, ctx) {
      _avisarSolicitanteReserva(payload.reservaId, 'Reserva em separação', 'Sua reserva #' + payload.reservaId + ' está sendo separada.', ctx);
    }));
    Event_Bus.on(EVENT_TYPES.RESERVA_PRONTA, Event_Handler.safe('Notificacao_Events', function (payload, ctx) {
      _avisarSolicitanteReserva(payload.reservaId, 'Reserva pronta para retirada', 'Sua reserva #' + payload.reservaId + ' está pronta — pode retirar.', ctx);
    }));
    Event_Bus.on(EVENT_TYPES.RESERVA_ENTREGUE, Event_Handler.safe('Notificacao_Events', function (payload, ctx) {
      _avisarSolicitanteReserva(payload.reservaId, 'Reserva entregue', 'Sua reserva #' + payload.reservaId + ' foi entregue.', ctx);
    }));
    // BLOCO 05 — atendimento parcial nunca existia antes, então
    // nunca precisou de notificação própria.
    Event_Bus.on(EVENT_TYPES.RESERVA_ATENDIMENTO_PARCIAL, Event_Handler.safe('Notificacao_Events', function (payload, ctx) {
      _avisarSolicitanteReserva(payload.reservaId, 'Reserva parcialmente atendida',
        'Sua reserva #' + payload.reservaId + ' recebeu ' + payload.quantidadeAtendida + ' unidade(s) — ainda restam ' + payload.restante + '.', ctx);
    }));
    Event_Bus.on(EVENT_TYPES.RESERVA_CANCELADA, Event_Handler.safe('Notificacao_Events', function (payload, ctx) {
      _avisarSolicitanteReserva(payload.reservaId, 'Reserva cancelada', 'Sua reserva #' + payload.reservaId + ' foi cancelada.', ctx);
    }));

    // MÓDULO 06 (Ferramentas)
    Event_Bus.on(EVENT_TYPES.FERRAMENTA_NAO_CONFORME, Event_Handler.safe('Notificacao_Events', function (payload, ctx) {
      Service_Notificacao.notificarPerfis(
        [CORE_CONSTANTS.PERFIS.ALMOXARIFE, CORE_CONSTANTS.PERFIS.GESTOR, CORE_CONSTANTS.PERFIS.ADMIN],
        'Ferramenta com não conformidade',
        'A ferramenta #' + payload.ferramentaId + ' teve não conformidade registrada (gravidade ' + payload.gravidade + ').',
        ctx, payload.gravidade === 'ALTA' || payload.gravidade === 'CRITICA'
      );
    }));
    Event_Bus.on(EVENT_TYPES.FERRAMENTA_EXTRAVIADA, Event_Handler.safe('Notificacao_Events', function (payload, ctx) {
      Service_Notificacao.notificarPerfis(
        [CORE_CONSTANTS.PERFIS.GESTOR, CORE_CONSTANTS.PERFIS.ADMIN],
        'Ferramenta extraviada',
        'A ferramenta #' + payload.ferramentaId + ' foi reportada como extraviada: ' + payload.motivo,
        ctx, true
      );
    }));
    Event_Bus.on(EVENT_TYPES.FERRAMENTA_VISTORIA_PENDENTE, Event_Handler.safe('Notificacao_Events', function (payload, ctx) {
      Service_Notificacao.notificarPerfis(
        [CORE_CONSTANTS.PERFIS.ALMOXARIFE, CORE_CONSTANTS.PERFIS.GESTOR, CORE_CONSTANTS.PERFIS.ADMIN],
        'Vistoria de ferramenta pendente',
        'A ferramenta ' + payload.codigo + ' está com vistoria vencida.',
        ctx, false
      );
    }));
    // BLOCO 06 — 3 eventos novos: atraso de devolução, conclusão
    // de manutenção e troca, nenhum deles tinha notificação antes
    // (nem os dois últimos tinham o EVENTO em si — ver relatório).
    Event_Bus.on(EVENT_TYPES.FERRAMENTA_ATRASADA, Event_Handler.safe('Notificacao_Events', function (payload, ctx) {
      Service_Notificacao.notificarPerfis(
        [CORE_CONSTANTS.PERFIS.ALMOXARIFE, CORE_CONSTANTS.PERFIS.GESTOR],
        'Ferramenta com devolução atrasada',
        'A ferramenta ' + payload.codigo + ' está atrasada — prazo previsto era ' + payload.prazoPrevisto + '.',
        ctx, true
      );
    }));
    Event_Bus.on(EVENT_TYPES.FERRAMENTA_MANUTENCAO_CONCLUIDA, Event_Handler.safe('Notificacao_Events', function (payload, ctx) {
      Service_Notificacao.notificarPerfis(
        [CORE_CONSTANTS.PERFIS.ALMOXARIFE],
        'Manutenção de ferramenta concluída',
        'A ferramenta #' + payload.ferramentaId + ' voltou a ficar disponível após manutenção.',
        ctx, false
      );
    }));
    Event_Bus.on(EVENT_TYPES.FERRAMENTA_TROCADA, Event_Handler.safe('Notificacao_Events', function (payload, ctx) {
      Service_Notificacao.notificarPerfis(
        [CORE_CONSTANTS.PERFIS.ALMOXARIFE, CORE_CONSTANTS.PERFIS.GESTOR],
        'Ferramenta trocada',
        'Ferramenta #' + payload.ferramentaAnteriorId + ' trocada pela #' + payload.ferramentaNovaId + ' (' + payload.motivo + ').',
        ctx, false
      );
    }));
    Event_Bus.on(EVENT_TYPES.FERRAMENTA_MANUTENCAO, Event_Handler.safe('Notificacao_Events', function (payload, ctx) {
      Service_Notificacao.notificarPerfis(
        [CORE_CONSTANTS.PERFIS.ALMOXARIFE, CORE_CONSTANTS.PERFIS.GESTOR],
        'Ferramenta em manutenção',
        'A ferramenta #' + payload.ferramentaId + ' entrou em manutenção.',
        ctx, false
      );
    }));

    // Divergência de NF → avisa quem aprova
    Event_Bus.on(EVENT_TYPES.NF_DIVERGENCIA, Event_Handler.safe('Notificacao_Events', function (payload, ctx) {
      Service_Notificacao.notificarPerfis(
        [CORE_CONSTANTS.PERFIS.GESTOR, CORE_CONSTANTS.PERFIS.ADMIN],
        'Nota Fiscal com divergência',
        'A nota #' + payload.notaId + ' teve ' + payload.totalDivergencias + ' divergência(s) e aguarda aprovação.',
        ctx, true
      );
    }));

    // FASE 6 — Solicitação nova → avisa quem aprova (GESTOR/ADMIN)
    Event_Bus.on(EVENT_TYPES.SOLICITACAO_CRIADA, Event_Handler.safe('Notificacao_Events', function (payload, ctx) {
      Service_Notificacao.notificarPerfis(
        [CORE_CONSTANTS.PERFIS.GESTOR, CORE_CONSTANTS.PERFIS.ADMIN],
        'Nova solicitação aguardando aprovação',
        'A solicitação ' + payload.numero + ' está pendente de aprovação.',
        ctx, false
      );
    }));

    // Solicitação aprovada → avisa quem separa (ALMOXARIFE/GESTOR/ADMIN)
    Event_Bus.on(EVENT_TYPES.SOLICITACAO_APROVADA, Event_Handler.safe('Notificacao_Events', function (payload, ctx) {
      Service_Notificacao.notificarPerfis(
        [CORE_CONSTANTS.PERFIS.ALMOXARIFE, CORE_CONSTANTS.PERFIS.GESTOR, CORE_CONSTANTS.PERFIS.ADMIN],
        'Solicitação aprovada — separar itens',
        'A solicitação ' + payload.numero + ' foi aprovada e está pronta pra separação.',
        ctx, false
      );
      _avisarSolicitanteDaSolicitacao(payload.solicitacaoId, 'Solicitação aprovada', 'Sua solicitação ' + payload.numero + ' foi aprovada.', ctx);
    }));

    // Solicitação reprovada/concluída → avisa quem pediu
    Event_Bus.on(EVENT_TYPES.SOLICITACAO_REPROVADA, Event_Handler.safe('Notificacao_Events', function (payload, ctx) {
      _avisarSolicitanteDaSolicitacao(payload.solicitacaoId, 'Solicitação reprovada', 'Sua solicitação ' + payload.numero + ' foi reprovada.', ctx);
    }));
    Event_Bus.on(EVENT_TYPES.SOLICITACAO_CONCLUIDA, Event_Handler.safe('Notificacao_Events', function (payload, ctx) {
      _avisarSolicitanteDaSolicitacao(payload.solicitacaoId, 'Solicitação concluída',
        'Sua solicitação ' + payload.numero + ' foi entregue' + (payload.pendencias ? (' (' + payload.pendencias + ' item(ns) com pendência)') : '') + '.', ctx);
    }));

    // Estoque crítico já é ESTOQUE_ENTRADA-independente (verificação
    // é sob demanda, via Gatilhos.gs, e não por evento de movimento
    // — evitaria disparo repetido a cada entrada/saída pequena).

    // MÓDULO 03 — pré-compra nova ou enviada pra análise → avisa
    // quem decide (COMPRAS/GESTOR/ADMIN).
    Event_Bus.on(EVENT_TYPES.PRE_COMPRA_CRIADA, Event_Handler.safe('Notificacao_Events', function (payload, ctx) {
      if (payload.origem === 'GATILHO_AMARELO') {
        Service_Notificacao.notificarPerfis(
          [CORE_CONSTANTS.PERFIS.COMPRAS, CORE_CONSTANTS.PERFIS.GESTOR, CORE_CONSTANTS.PERFIS.ADMIN],
          'Sugestão automática de pré-compra',
          'O sistema identificou estoque em alerta e criou o rascunho ' + payload.numero + ' pra sua análise.',
          ctx, false
        );
      }
    }));
    Event_Bus.on(EVENT_TYPES.PRE_COMPRA_ENVIADA_APROVACAO, Event_Handler.safe('Notificacao_Events', function (payload, ctx) {
      Service_Notificacao.notificarPerfis(
        [CORE_CONSTANTS.PERFIS.COMPRAS, CORE_CONSTANTS.PERFIS.GESTOR, CORE_CONSTANTS.PERFIS.ADMIN],
        'Pré-compra aguardando decisão',
        'A pré-compra ' + payload.numero + ' está em análise.',
        ctx, false
      );
    }));

    // MÓDULO 04 (Inventário) — divergência avisa quem aprova;
    // fechamento avisa o responsável e a gestão.
    Event_Bus.on(EVENT_TYPES.INVENTARIO_DIVERGENCIA, Event_Handler.safe('Notificacao_Events', function (payload, ctx) {
      Service_Notificacao.notificarPerfis(
        [CORE_CONSTANTS.PERFIS.GESTOR, CORE_CONSTANTS.PERFIS.ADMIN],
        'Inventário com divergência',
        'O inventário ' + payload.token + ' teve ' + payload.total + ' item(ns) com divergência e aguarda aprovação.',
        ctx, true
      );
    }));
    Event_Bus.on(EVENT_TYPES.INVENTARIO_FECHADO, Event_Handler.safe('Notificacao_Events', function (payload, ctx) {
      const inventario = DB_Query.get('INVENTARIOS', payload.inventarioId);
      if (inventario && inventario.responsavel) {
        Service_Notificacao._criarNotificacaoInterna(inventario.responsavel, 'Inventário encerrado',
          'O inventário ' + payload.token + ' foi encerrado' + (payload.decisao ? ' (' + payload.decisao.toLowerCase() + ')' : '') + '.', 'SISTEMA', false, ctx);
      }
    }));
  }

  function _avisarSolicitanteDaSolicitacao(solicitacaoId, titulo, mensagem, ctx) {
    const solicitacao = DB_Query.get('SOLICITACOES', solicitacaoId);
    if (!solicitacao) return;
    Service_Notificacao._criarNotificacaoInterna(solicitacao.solicitanteId, titulo, mensagem, 'SISTEMA', false, ctx);
  }

  return { bootstrap };
})();
