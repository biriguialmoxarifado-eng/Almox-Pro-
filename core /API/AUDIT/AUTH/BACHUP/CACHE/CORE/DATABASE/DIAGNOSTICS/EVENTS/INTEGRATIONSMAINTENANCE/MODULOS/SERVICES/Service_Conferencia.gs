/**
 * ============================================================
 * ALMOXA PRO — Service_Conferencia.gs
 * FASE 3 — IMPLEMENTADO DE VERDADE.
 *
 * Fluxo (seção 19):
 * NF → itens esperados → bipagem/manual → comparação → resultado
 *
 * Regras seguidas à risca:
 * - seção 20: impede que uma leitura seja contabilizada duas
 *   vezes por acidente (debounce de 2s por item, via Cache).
 * - seção 21: ao finalizar, gera DIVERGENCIAS reais para todo
 *   item fora de OK, com tipo certo (FALTA/EXCESSO/
 *   PRODUTO_NAO_CADASTRADO/SEM_CODIGO).
 * - seção 22: aprovação de divergência exige perfil com
 *   permissão CONFERENCIA.APPROVE (checado no Router, igual
 *   qualquer outra rota).
 * ============================================================
 */

const Service_Conferencia = (function () {

  const SCAN_DEBOUNCE_SEC = 2;

  // ---- start: cria a conferência a partir dos itens da NF ----
  function start(ctx) {
    const notaId = ctx.payload && ctx.payload.notaId;
    if (!notaId) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'notaId é obrigatório.', {}, ctx.requestId);

    const nota = DB_Query.get('NOTAS_FISCAIS', notaId);
    if (!nota) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Nota não encontrada.', {}, ctx.requestId);

    const jaExiste = DB_Query.find('CONFERENCIAS', c => String(c.notaId) === String(notaId));
    if (jaExiste.length) {
      return Core_Response.ok({ nota, conferencias: jaExiste, jaIniciada: true }, 'Conferência já estava iniciada para esta nota.', 'SUCCESS', {}, ctx.requestId);
    }

    const itensNota = DB_Query.find('NOTAS_ITENS', i => String(i.notaId) === String(notaId));
    if (!itensNota.length) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'Nota não tem itens lançados.', {}, ctx.requestId);
    }

    const conferencias = itensNota.map(item => DB_Insert.insert('CONFERENCIAS', {
      notaId: notaId,
      itemId: item.itemId,
      esperado: item.quantidade,
      recebido: 0,
      diferenca: -Number(item.quantidade || 0),
      status: 'PENDENTE'
    }));

    DB_Update.byId('NOTAS_FISCAIS', notaId, { status: 'EM_CONFERENCIA' });
    Audit_Service.record(ctx, 'CONFERENCIA_INICIADA', { entidade: 'NOTAS_FISCAIS', entidadeId: notaId });

    return Core_Response.ok({ nota, conferencias, jaIniciada: false }, 'Conferência iniciada com ' + conferencias.length + ' item(ns).', 'SUCCESS', {}, ctx.requestId);
  }

  // ---- scan: bipagem de código de barras/QR (seção 20) ----
  function scan(ctx) {
    const { notaId, codigo, quantidade } = ctx.payload || {};
    if (!notaId || !codigo) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'notaId e codigo são obrigatórios.', {}, ctx.requestId);
    }

    const itemNota = DB_Query.findOne('NOTAS_ITENS', i =>
      String(i.notaId) === String(notaId) && (i.codigoBarras === codigo || i.codigoProduto === codigo)
    );
    if (!itemNota) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Código não corresponde a nenhum item desta nota.', {}, ctx.requestId);
    }

    // Debounce — impede contagem duplicada por bip acidental repetido.
    const debounceKey = 'SCAN_DEBOUNCE_' + notaId + '_' + itemNota.itemId;
    if (Cache_Core.get(debounceKey)) {
      return Core_Response.ok({ ignorado: true }, 'Leitura ignorada — mesmo item bipado há menos de ' + SCAN_DEBOUNCE_SEC + 's.', 'SUCCESS', {}, ctx.requestId);
    }
    Cache_Core.set(debounceKey, true, SCAN_DEBOUNCE_SEC);

    const conf = DB_Query.findOne('CONFERENCIAS', c => String(c.notaId) === String(notaId) && String(c.itemId) === String(itemNota.itemId));
    if (!conf) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'Conferência não foi iniciada para esta nota (chame conferencia.start primeiro).', {}, ctx.requestId);
    }

    const incremento = Number(quantidade) || 1;
    const novoRecebido = Number(conf.recebido || 0) + incremento;
    DB_Update.byRowIndex('CONFERENCIAS', conf._rowIndex, {
      recebido: novoRecebido,
      diferenca: novoRecebido - Number(conf.esperado || 0)
    });

    Audit_Service.record(ctx, 'CONFERENCIA_BIPAGEM', { entidade: 'CONFERENCIAS', entidadeId: conf.ID }, { recebido: conf.recebido }, { recebido: novoRecebido });

    return Core_Response.ok({
      item: itemNota, recebidoAtual: novoRecebido, esperado: conf.esperado
    }, 'Bipagem registrada.', 'SUCCESS', {}, ctx.requestId);
  }

  // ---- manual: contagem manual (granel, seção 23 — sem código) ----
  function manual(ctx) {
    const { notaId, itemId, quantidadeRecebida, observacao } = ctx.payload || {};
    if (!notaId || !itemId || quantidadeRecebida === undefined) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'notaId, itemId e quantidadeRecebida são obrigatórios.', {}, ctx.requestId);
    }
    const conf = DB_Query.findOne('CONFERENCIAS', c => String(c.notaId) === String(notaId) && String(c.itemId) === String(itemId));
    if (!conf) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Conferência do item não encontrada.', {}, ctx.requestId);
    }
    DB_Update.byRowIndex('CONFERENCIAS', conf._rowIndex, {
      recebido: quantidadeRecebida,
      diferenca: Number(quantidadeRecebida) - Number(conf.esperado || 0)
    });
    Audit_Service.record(ctx, 'CONFERENCIA_MANUAL', { entidade: 'CONFERENCIAS', entidadeId: conf.ID }, { recebido: conf.recebido }, { recebido: quantidadeRecebida, observacao: observacao || '' });
    return Core_Response.ok({ conf: DB_Query.get('CONFERENCIAS', conf.ID) }, 'Contagem manual registrada.', 'SUCCESS', {}, ctx.requestId);
  }

  // ---- finish: fecha a conferência, calcula status e gera divergências ----
  function finish(ctx) {
    const notaId = ctx.payload && ctx.payload.notaId;
    if (!notaId) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'notaId é obrigatório.', {}, ctx.requestId);

    const conferencias = DB_Query.find('CONFERENCIAS', c => String(c.notaId) === String(notaId));
    if (!conferencias.length) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'Conferência não foi iniciada para esta nota.', {}, ctx.requestId);
    }
    const itensNota = DB_Query.find('NOTAS_ITENS', i => String(i.notaId) === String(notaId));
    const itensPorId = {};
    itensNota.forEach(i => itensPorId[i.itemId] = i);

    const divergenciasGeradas = [];

    conferencias.forEach(conf => {
      const itemNota = itensPorId[conf.itemId];
      let status = 'OK';
      let tipoDivergencia = null;

      if (!itemNota.produtoId) {
        status = 'NAO_CADASTRADO'; tipoDivergencia = 'PRODUTO_NAO_CADASTRADO';
      } else if (!itemNota.codigoProduto && !itemNota.codigoBarras) {
        status = conf.recebido > 0 ? 'OK' : 'SEM_CODIGO';
        if (status === 'SEM_CODIGO') tipoDivergencia = 'SEM_CODIGO';
      } else if (Number(conf.recebido) < Number(conf.esperado)) {
        status = 'FALTANTE'; tipoDivergencia = 'FALTA';
      } else if (Number(conf.recebido) > Number(conf.esperado)) {
        status = 'EXCEDENTE'; tipoDivergencia = 'EXCESSO';
      }

      DB_Update.byRowIndex('CONFERENCIAS', conf._rowIndex, { status: status });

      if (tipoDivergencia) {
        const divergencia = DB_Insert.insert('DIVERGENCIAS', {
          documento: notaId,
          item: conf.itemId,
          tipo: tipoDivergencia,
          esperado: conf.esperado,
          recebido: conf.recebido,
          diferenca: Number(conf.recebido || 0) - Number(conf.esperado || 0),
          motivo: '',
          observacao: '',
          responsavel: ctx.userId,
          status: 'PENDENTE',
          aprovador: '',
          data: new Date()
        });
        divergenciasGeradas.push(divergencia);
      }
    });

    const notaStatus = divergenciasGeradas.length ? 'DIVERGENTE' : 'CONFERIDA';
    DB_Update.byId('NOTAS_FISCAIS', notaId, { status: notaStatus });

    Event_Bus.emit(
      divergenciasGeradas.length ? EVENT_TYPES.NF_DIVERGENCIA : EVENT_TYPES.NF_CONFERIDA,
      { notaId: notaId, totalDivergencias: divergenciasGeradas.length }, ctx
    );
    Audit_Service.record(ctx, 'CONFERENCIA_FINALIZADA', { entidade: 'NOTAS_FISCAIS', entidadeId: notaId }, null, { status: notaStatus, divergencias: divergenciasGeradas.length });

    return Core_Response.ok({
      notaStatus: notaStatus,
      conferencias: DB_Query.find('CONFERENCIAS', c => String(c.notaId) === String(notaId)),
      divergencias: divergenciasGeradas
    }, divergenciasGeradas.length
      ? divergenciasGeradas.length + ' divergência(s) encontrada(s) — aguardando aprovação.'
      : 'Conferência concluída sem divergências.',
      'SUCCESS', {}, ctx.requestId);
  }

  // ---- divergence: lista OU resolve (aprova/reprova) uma divergência ----
  function divergence(ctx) {
    const p = ctx.payload || {};

    if (p.resolver && p.divergenciaId) {
      // A rota conferencia.divergence é VIEW por padrão (é rota
      // de listagem) — mas resolver uma divergência é uma AÇÃO de
      // aprovação, checada explicitamente aqui (permissão
      // registrada em MOD_05_CONFERENCIA.init()).
      if (!Auth_RBAC.can(ctx.perfil, '__divergencia_resolver__')) {
        return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.PERMISSION_DENIED, 'Sem permissão para aprovar/reprovar divergência.', {}, ctx.requestId);
      }

      const div = DB_Query.get('DIVERGENCIAS', p.divergenciaId);
      if (!div) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Divergência não encontrada.', {}, ctx.requestId);

      const novoStatus = p.resolver === 'aprovar' ? 'APROVADA' : 'REJEITADA';
      DB_Update.byId('DIVERGENCIAS', div.ID, {
        status: novoStatus, aprovador: ctx.userId, motivo: p.motivo || ''
      });
      Audit_Service.record(ctx, 'DIVERGENCIA_' + novoStatus, { entidade: 'DIVERGENCIAS', entidadeId: div.ID }, { status: div.status }, { status: novoStatus });

      return Core_Response.ok(DB_Query.get('DIVERGENCIAS', div.ID), 'Divergência ' + novoStatus.toLowerCase() + '.', 'SUCCESS', {}, ctx.requestId);
    }

    // Sem "resolver" → apenas lista divergências (filtro opcional por notaId/status)
    const rows = DB_Query.find('DIVERGENCIAS', d => {
      if (p.notaId && String(d.documento) !== String(p.notaId)) return false;
      if (p.status && d.status !== p.status) return false;
      return true;
    });
    return Core_Response.ok(rows, '', 'SUCCESS', {}, ctx.requestId);
  }

  return { start, scan, manual, finish, divergence };
})();
