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

    // Divergência de NF → avisa quem aprova
    Event_Bus.on(EVENT_TYPES.NF_DIVERGENCIA, Event_Handler.safe('Notificacao_Events', function (payload, ctx) {
      Service_Notificacao.notificarPerfis(
        [CORE_CONSTANTS.PERFIS.GESTOR, CORE_CONSTANTS.PERFIS.ADMIN],
        'Nota Fiscal com divergência',
        'A nota #' + payload.notaId + ' teve ' + payload.totalDivergencias + ' divergência(s) e aguarda aprovação.',
        ctx, true
      );
    }));

    // Estoque crítico já é ESTOQUE_ENTRADA-independente (verificação
    // é sob demanda, via Gatilhos.gs, e não por evento de movimento
    // — evitaria disparo repetido a cada entrada/saída pequena).
  }

  return { bootstrap };
})();
