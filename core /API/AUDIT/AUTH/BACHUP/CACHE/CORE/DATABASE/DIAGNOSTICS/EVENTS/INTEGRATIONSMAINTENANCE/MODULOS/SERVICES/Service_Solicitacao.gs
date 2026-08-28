/**
 * ============================================================
 * ALMOXA PRO — Service_Solicitacao.gs
 * FASE 6 DO FRONT MOBILE — NOVO módulo de backend.
 *
 * É a peça que fecha o ciclo da Lojinha: desde a Fase 2 o
 * carrinho terminava em "envio da solicitação chega numa próxima
 * fase" — esta é essa fase.
 *
 * Fluxo real (seção 28 do doc de telas):
 * PENDENTE → APROVADA/REPROVADA → EM_SEPARACAO → CONCLUIDA
 *          (GESTOR/ADMIN)      (ALMOXARIFE+)   (ALMOXARIFE+,
 *                                               baixa real no
 *                                               estoque aqui)
 *
 * Separação de papéis real (não é o mesmo perfil aprovando e
 * separando, seguindo o princípio do doc de telas seção 17 da
 * V3 — solicitante ≠ aprovador ≠ separador):
 * - aprovar/reprovar exige APPROVE (GESTOR/ADMIN têm; ALMOXARIFE
 *   não tem, por design da matriz de RBAC desde a Fase 1).
 * - separar/concluir exige EDIT (ALMOXARIFE tem; OPERADOR não).
 * ============================================================
 */

const Service_Solicitacao = (function () {

  function criar(ctx) {
    const { itens, obraId, observacao } = ctx.payload || {};
    if (!Array.isArray(itens) || !itens.length) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'A solicitação precisa de ao menos um item.', {}, ctx.requestId);
    }

    // Revalida contra o estoque real — nunca confia no que o
    // Front acumulou no carrinho ao longo da navegação (mesma
    // lógica de loja.validarCarrinho, reutilizada sem duplicar).
    const validacao = Service_Loja._validarItensContraEstoque(itens);
    const invalidos = validacao.filter(v => !v.valido);
    if (invalidos.length) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR,
        'Alguns itens não estão mais disponíveis como antes — volte ao carrinho pra ajustar.', { itens: validacao }, ctx.requestId);
    }

    const sequencial = DB_Query.count('SOLICITACOES', () => true) + 1;
    const numero = Utils_ID.tokenComAno('SOL', sequencial);

    const solicitacao = DB_Insert.insert('SOLICITACOES', {
      numero, solicitanteId: ctx.userId, obraId: obraId || '',
      status: 'PENDENTE', observacao: observacao || '',
      data: new Date(), dataAprovacao: '', aprovadorId: '', motivoReprovacao: '', dataConclusao: ''
    });

    const itensRegistrados = itens.map(item => {
      const produto = DB_Query.get('PRODUTOS', item.produtoId);
      return DB_Insert.insert('SOLICITACAO_ITENS', {
        solicitacaoId: solicitacao.ID, produtoId: item.produtoId,
        descricaoProduto: produto ? produto.descricaoOriginal : '',
        codigoProduto: produto ? produto.codigo : '',
        quantidade: item.quantidade, unidade: produto ? produto.unidade : '',
        statusItem: 'PENDENTE'
      });
    });

    Event_Bus.emit(EVENT_TYPES.SOLICITACAO_CRIADA, { solicitacaoId: solicitacao.ID, numero }, ctx);
    Audit_Service.record(ctx, 'SOLICITACAO_CRIADA', { entidade: 'SOLICITACOES', entidadeId: solicitacao.ID });

    return Core_Response.ok({ solicitacao, itens: itensRegistrados }, 'Solicitação ' + numero + ' enviada.', 'SUCCESS', {}, ctx.requestId);
  }

  function list(ctx) {
    const p = ctx.payload || {};
    const perfisGestao = [CORE_CONSTANTS.PERFIS.ALMOXARIFE, CORE_CONSTANTS.PERFIS.GESTOR, CORE_CONSTANTS.PERFIS.ADMIN];
    const podeVerTodas = perfisGestao.includes(ctx.perfil);

    const rows = DB_Query.find('SOLICITACOES', s => {
      if (!podeVerTodas && String(s.solicitanteId) !== String(ctx.userId)) return false;
      if (p.status && s.status !== p.status) return false;
      return true;
    }).sort((a, b) => new Date(b.data) - new Date(a.data));

    return Core_Response.ok(rows, '', 'SUCCESS', {}, ctx.requestId);
  }

  function _podeVerDetalhe(solicitacao, ctx) {
    const perfisGestao = [CORE_CONSTANTS.PERFIS.ALMOXARIFE, CORE_CONSTANTS.PERFIS.GESTOR, CORE_CONSTANTS.PERFIS.ADMIN];
    return perfisGestao.includes(ctx.perfil) || String(solicitacao.solicitanteId) === String(ctx.userId);
  }

  function get(ctx) {
    const solicitacao = DB_Query.get('SOLICITACOES', ctx.payload.id);
    if (!solicitacao) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Solicitação não encontrada.', {}, ctx.requestId);
    if (!_podeVerDetalhe(solicitacao, ctx)) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.PERMISSION_DENIED, 'Esta solicitação não é sua.', {}, ctx.requestId);
    }
    const itens = DB_Query.find('SOLICITACAO_ITENS', i => String(i.solicitacaoId) === String(solicitacao.ID));
    return Core_Response.ok({ solicitacao, itens }, '', 'SUCCESS', {}, ctx.requestId);
  }

  function aprovar(ctx) {
    const solicitacao = DB_Query.get('SOLICITACOES', ctx.payload.id);
    if (!solicitacao) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Solicitação não encontrada.', {}, ctx.requestId);
    if (solicitacao.status !== 'PENDENTE') {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'Solicitação não está pendente (status atual: ' + solicitacao.status + ').', {}, ctx.requestId);
    }
    DB_Update.byId('SOLICITACOES', solicitacao.ID, { status: 'APROVADA', dataAprovacao: new Date(), aprovadorId: ctx.userId });
    Event_Bus.emit(EVENT_TYPES.SOLICITACAO_APROVADA, { solicitacaoId: solicitacao.ID, numero: solicitacao.numero }, ctx);
    Audit_Service.record(ctx, 'SOLICITACAO_APROVADA', { entidade: 'SOLICITACOES', entidadeId: solicitacao.ID }, { status: 'PENDENTE' }, { status: 'APROVADA' });
    return Core_Response.ok(DB_Query.get('SOLICITACOES', solicitacao.ID), 'Solicitação aprovada.', 'SUCCESS', {}, ctx.requestId);
  }

  function reprovar(ctx) {
    const { id, motivo } = ctx.payload || {};
    const solicitacao = DB_Query.get('SOLICITACOES', id);
    if (!solicitacao) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Solicitação não encontrada.', {}, ctx.requestId);
    if (solicitacao.status !== 'PENDENTE') {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'Solicitação não está pendente.', {}, ctx.requestId);
    }
    DB_Update.byId('SOLICITACOES', id, { status: 'REPROVADA', motivoReprovacao: motivo || '' });
    Event_Bus.emit(EVENT_TYPES.SOLICITACAO_REPROVADA, { solicitacaoId: id, numero: solicitacao.numero }, ctx);
    Audit_Service.record(ctx, 'SOLICITACAO_REPROVADA', { entidade: 'SOLICITACOES', entidadeId: id }, { status: 'PENDENTE' }, { status: 'REPROVADA', motivo });
    return Core_Response.ok(DB_Query.get('SOLICITACOES', id), 'Solicitação reprovada.', 'SUCCESS', {}, ctx.requestId);
  }

  function separar(ctx) {
    const solicitacao = DB_Query.get('SOLICITACOES', ctx.payload.id);
    if (!solicitacao) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Solicitação não encontrada.', {}, ctx.requestId);
    if (solicitacao.status !== 'APROVADA') {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'Solicitação precisa estar aprovada antes de separar.', {}, ctx.requestId);
    }
    const itens = DB_Query.find('SOLICITACAO_ITENS', i => String(i.solicitacaoId) === String(solicitacao.ID));
    itens.forEach(i => DB_Update.byRowIndex('SOLICITACAO_ITENS', i._rowIndex, { statusItem: 'SEPARADO' }));
    DB_Update.byId('SOLICITACOES', solicitacao.ID, { status: 'EM_SEPARACAO' });
    Audit_Service.record(ctx, 'SOLICITACAO_SEPARADA', { entidade: 'SOLICITACOES', entidadeId: solicitacao.ID });
    return Core_Response.ok(DB_Query.get('SOLICITACOES', solicitacao.ID), 'Itens separados.', 'SUCCESS', {}, ctx.requestId);
  }

  /**
   * Única função deste módulo que mexe em ESTOQUE de verdade —
   * a baixa real só acontece na conclusão, nunca antes (mesma
   * cautela usada em Service_Saida desde a Fase 5).
   */
  function concluir(ctx) {
    const { id, localizacaoSaida } = ctx.payload || {};
    const solicitacao = DB_Query.get('SOLICITACOES', id);
    if (!solicitacao) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Solicitação não encontrada.', {}, ctx.requestId);
    if (solicitacao.status !== 'EM_SEPARACAO') {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'Solicitação precisa estar em separação antes de concluir.', {}, ctx.requestId);
    }
    if (!localizacaoSaida) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'localizacaoSaida é obrigatória.', {}, ctx.requestId);
    }

    const itens = DB_Query.find('SOLICITACAO_ITENS', i => String(i.solicitacaoId) === String(solicitacao.ID));
    const entregues = [], indisponiveis = [];

    itens.forEach(item => {
      try {
        Service_Estoque._registrarSaidaInterna(
          item.produtoId, localizacaoSaida, item.quantidade,
          { motivo: 'Solicitação ' + solicitacao.numero, documentoId: solicitacao.ID, obraId: solicitacao.obraId }, ctx, 0
        );
        DB_Update.byRowIndex('SOLICITACAO_ITENS', item._rowIndex, { statusItem: 'ENTREGUE' });
        entregues.push(item.produtoId);
      } catch (e) {
        // Estoque mudou entre a separação e a conclusão — não
        // trava a solicitação inteira, marca só o item afetado.
        DB_Update.byRowIndex('SOLICITACAO_ITENS', item._rowIndex, { statusItem: 'INDISPONIVEL' });
        indisponiveis.push({ produtoId: item.produtoId, erro: e.message });
      }
    });

    const statusFinal = indisponiveis.length ? 'CONCLUIDA_COM_PENDENCIA' : 'CONCLUIDA';
    DB_Update.byId('SOLICITACOES', solicitacao.ID, { status: statusFinal, dataConclusao: new Date() });
    Event_Bus.emit(EVENT_TYPES.SOLICITACAO_CONCLUIDA, { solicitacaoId: solicitacao.ID, numero: solicitacao.numero, pendencias: indisponiveis.length }, ctx);
    Audit_Service.record(ctx, 'SOLICITACAO_CONCLUIDA', { entidade: 'SOLICITACOES', entidadeId: solicitacao.ID }, null, { entregues: entregues.length, indisponiveis: indisponiveis.length });

    return Core_Response.ok({
      status: statusFinal, entregues: entregues.length, indisponiveis
    }, statusFinal === 'CONCLUIDA' ? 'Solicitação concluída — estoque baixado.' : 'Concluída com pendência em ' + indisponiveis.length + ' item(ns).',
      'SUCCESS', {}, ctx.requestId);
  }

  function cancelar(ctx) {
    const { id, motivo } = ctx.payload || {};
    const solicitacao = DB_Query.get('SOLICITACOES', id);
    if (!solicitacao) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Solicitação não encontrada.', {}, ctx.requestId);

    const ehDona = String(solicitacao.solicitanteId) === String(ctx.userId);
    if (!ehDona && ctx.perfil !== CORE_CONSTANTS.PERFIS.ADMIN) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.PERMISSION_DENIED, 'Você só pode cancelar sua própria solicitação.', {}, ctx.requestId);
    }
    if (solicitacao.status !== 'PENDENTE') {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'Só é possível cancelar enquanto está pendente.', {}, ctx.requestId);
    }
    DB_Update.byId('SOLICITACOES', id, { status: 'CANCELADA', motivoReprovacao: motivo || 'Cancelada pelo solicitante' });
    Audit_Service.record(ctx, 'SOLICITACAO_CANCELADA', { entidade: 'SOLICITACOES', entidadeId: id });
    return Core_Response.ok(DB_Query.get('SOLICITACOES', id), 'Solicitação cancelada.', 'SUCCESS', {}, ctx.requestId);
  }

  function getRoutes() {
    return {
      'solicitacao.criar': criar,
      'solicitacao.list': list,
      'solicitacao.get': get,
      'solicitacao.aprovar': aprovar,
      'solicitacao.reprovar': reprovar,
      'solicitacao.separar': separar,
      'solicitacao.concluir': concluir,
      'solicitacao.cancelar': cancelar
    };
  }
  function getServices() { return { Service_Solicitacao }; }
  function getEvents() { return [EVENT_TYPES.SOLICITACAO_CRIADA, EVENT_TYPES.SOLICITACAO_APROVADA, EVENT_TYPES.SOLICITACAO_REPROVADA, EVENT_TYPES.SOLICITACAO_CONCLUIDA]; }
  function getVersion() { return '1.0.0'; }
  function init() {
    Auth_RBAC.registerActionPermission('solicitacao.criar', 'SOLICITACAO.CREATE');
    Auth_RBAC.registerActionPermission('solicitacao.list', 'SOLICITACAO.VIEW');
    Auth_RBAC.registerActionPermission('solicitacao.get', 'SOLICITACAO.VIEW');
    Auth_RBAC.registerActionPermission('solicitacao.aprovar', 'SOLICITACAO.APPROVE');
    Auth_RBAC.registerActionPermission('solicitacao.reprovar', 'SOLICITACAO.REJECT');
    Auth_RBAC.registerActionPermission('solicitacao.separar', 'SOLICITACAO.EDIT');
    Auth_RBAC.registerActionPermission('solicitacao.concluir', 'SOLICITACAO.EDIT');
    // cancelar fica sem permissão de papel registrada de propósito
    // (self-scope — mesmo padrão de usuario.salvarFoto): a
    // segurança real é o ownership check dentro da função.
  }
  function healthCheck() { return { status: CORE_CONSTANTS.DOCTOR_STATUS.OK }; }

  return { criar, list, get, aprovar, reprovar, separar, concluir, cancelar, getRoutes, getServices, getEvents, getVersion, init, healthCheck, id: 'SOLICITACAO' };
})();
