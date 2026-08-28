/**
 * ============================================================
 * ALMOXA PRO — Service_Ferramenta.gs
 * MÓDULO 06 — FERRAMENTAS
 *
 * Camada NOVA (auditoria confirmou: nada funcional existia, só
 * menções soltas de ícone/categoria no Front e 2 nomes de evento
 * reservados desde a Fase 3 V3 do Front Mobile).
 *
 * REAPROVEITA, sem duplicar:
 * - Service_Reserva (ampliado nesta mesma leva pra aceitar
 *   `ferramentaId` — ver seção 3.4 do contrato: "não criar um
 *   segundo mecanismo de reserva independente");
 * - Service_Etiqueta (QR — ganhou o tipo 'FERRAMENTA');
 * - Auth_Biometric (retirada com biometria — nunca reimplementado
 *   aqui, só consultado);
 * - OCORRENCIAS (agora genérica com entidade/entidadeId — usada
 *   pra não conformidade, em vez de criar tabela paralela);
 * - AUDITORIA (histórico, mesmo padrão de Reserva/Inventário).
 *
 * DECISÃO IMPORTANTE — reserva vs. estoque fungível: uma
 * ferramenta é um bem individual/serializado, não uma quantidade
 * fungível. Não existe "saldo disponível" de uma ferramenta —
 * ela está livre ou não está. Por isso a integração com
 * Service_Reserva é por ESTADO do bem (DISPONIVEL↔RESERVADA),
 * não por trava de quantidade — mesma tabela RESERVAS, mesmo
 * ciclo (aprovar/separar/entregar/concluir/cancelar/histórico),
 * mecânica de baixo nível adaptada ao tipo de recurso.
 * ============================================================
 */

const Service_Ferramenta = (function () {

  const PERFIS_GESTAO = [CORE_CONSTANTS.PERFIS.ALMOXARIFE, CORE_CONSTANTS.PERFIS.GESTOR, CORE_CONSTANTS.PERFIS.ADMIN];
  const PERFIS_AUTORIZACAO = [CORE_CONSTANTS.PERFIS.GESTOR, CORE_CONSTANTS.PERFIS.ADMIN];

  // ---------------------------------------------------------
  // CADASTRO (seção 3.1)
  // ---------------------------------------------------------
  function create(ctx) {
    const p = ctx.payload || {};
    try {
      DB_Validation.requireFields(p, ['codigo', 'descricao']);
    } catch (e) {
      return Core_Response.error(e.code || CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, e.message, {}, ctx.requestId);
    }
    if (DB_Query.exists('FERRAMENTAS', f => f.codigo === p.codigo)) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'Já existe ferramenta com esse código.', {}, ctx.requestId);
    }

    const ferramenta = DB_Insert.insert('FERRAMENTAS', {
      codigo: p.codigo, descricao: p.descricao, categoria: p.categoria || '',
      marca: p.marca || '', modelo: p.modelo || '', numeroSerie: p.numeroSerie || '', patrimonio: p.patrimonio || '',
      localizacao: p.localizacao || '', estado: 'DISPONIVEL', responsavelAtual: '',
      dataAquisicao: p.dataAquisicao || '', situacao: 'ATIVA',
      dataUltimaVistoria: '', dataProximaVistoriaSugerida: p.dataProximaVistoriaSugerida || '',
      dataCadastro: new Date(), dataAtualizacao: new Date()
    });

    Event_Bus.emit(EVENT_TYPES.FERRAMENTA_CADASTRADA, { ferramentaId: ferramenta.ID, codigo: ferramenta.codigo }, ctx);
    Audit_Service.record(ctx, 'FERRAMENTA_CADASTRADA', { entidade: 'FERRAMENTAS', entidadeId: ferramenta.ID });

    return Core_Response.ok(ferramenta, 'Ferramenta cadastrada.', 'SUCCESS', {}, ctx.requestId);
  }

  function get(ctx) {
    const f = DB_Query.get('FERRAMENTAS', ctx.payload.id);
    if (!f) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Ferramenta não encontrada.', {}, ctx.requestId);
    return Core_Response.ok(f, '', 'SUCCESS', {}, ctx.requestId);
  }

  function search(ctx) {
    const p = ctx.payload || {};
    const termoNorm = p.busca ? Utils_String.normalize(p.busca) : null;
    const rows = DB_Query.find('FERRAMENTAS', f => {
      if (f.situacao === 'BAIXADA_EXCLUIDA') return false; // nunca some do histórico — só filtra de listas ativas se marcado assim
      if (p.estado && f.estado !== p.estado) return false;
      if (p.categoria && f.categoria !== p.categoria) return false;
      if (!termoNorm) return true;
      return Utils_String.normalize(f.codigo + ' ' + f.descricao + ' ' + (f.numeroSerie || '') + ' ' + (f.patrimonio || '')).includes(termoNorm);
    });
    return Core_Response.ok(rows, '', 'SUCCESS', {}, ctx.requestId);
  }

  // ---------------------------------------------------------
  // IDENTIFICAÇÃO (seção 3.2) — código de barras, QR, série
  // ---------------------------------------------------------
  function identificar(ctx) {
    const { codigo } = ctx.payload || {};
    if (!codigo) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'codigo é obrigatório.', {}, ctx.requestId);
    const f = DB_Query.findOne('FERRAMENTAS', ferramenta =>
      ferramenta.codigo === codigo || ferramenta.numeroSerie === codigo || ferramenta.patrimonio === codigo
    );
    if (!f) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Nenhuma ferramenta corresponde a esse código.', {}, ctx.requestId);
    return Core_Response.ok(f, '', 'SUCCESS', {}, ctx.requestId);
  }

  /** QR aponta pra uma identificação única — a REGRA fica no backend, nunca dentro do próprio QR (seção 3.2 do contrato). */
  function gerarQR(ctx) {
    return Service_Etiqueta.generate({ userId: ctx.userId, requestId: ctx.requestId, payload: { tipo: 'FERRAMENTA', referenciaId: ctx.payload.id } });
  }

  // ---------------------------------------------------------
  // RETIRADA DIRETA (sem reserva prévia — seção 3.5)
  // ---------------------------------------------------------
  /**
   * BIOMETRIA é serviço compartilhado (seção 3.5/9 do contrato):
   * este módulo NUNCA reimplementa verificação biométrica — só
   * consulta `Auth_Biometric.verify` quando `confirmarBiometria`
   * vier true, e trata o resultado. Biometria nunca substitui a
   * autorização (seção 8) — mesmo com biometria confirmada, o
   * estado da ferramenta ainda precisa estar DISPONIVEL.
   */
  function retirar(ctx) {
    const p = ctx.payload || {};
    const ferramenta = p.codigo ? DB_Query.findOne('FERRAMENTAS', f => f.codigo === p.codigo || f.numeroSerie === p.codigo) : DB_Query.get('FERRAMENTAS', p.ferramentaId);
    if (!ferramenta) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Ferramenta não encontrada.', {}, ctx.requestId);
    if (ferramenta.estado !== 'DISPONIVEL') {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'Ferramenta não está disponível (estado atual: ' + ferramenta.estado + ').', {}, ctx.requestId);
    }

    const paraUserId = p.paraUserId || ctx.userId;
    if (String(paraUserId) !== String(ctx.userId) && !PERFIS_GESTAO.includes(ctx.perfil)) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.PERMISSION_DENIED, 'Só ALMOXARIFE+ pode retirar em nome de outra pessoa.', {}, ctx.requestId);
    }

    let biometriaConfirmada = false;
    if (p.confirmarBiometria) {
      const verificacao = Auth_Biometric.verify({ userId: ctx.userId, requestId: ctx.requestId, payload: { userId: paraUserId, deviceSecret: p.deviceSecret } });
      // O envelope Core_Response.ok(...) vem com success:true mesmo
      // quando a biometria NÃO bate — o resultado real do match
      // está em .data.verificado (achei isso conferindo
      // Integration_Biometric.gs antes de confiar na chamada).
      biometriaConfirmada = !!(verificacao.success && verificacao.data && verificacao.data.verificado);
      if (!biometriaConfirmada) {
        return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.PERMISSION_DENIED, 'Biometria não confirmada — retirada não realizada.', {}, ctx.requestId);
      }
    }

    // BLOCO 06, seção 8 — "prazo previsto" nunca era gravado.
    // Sem isso, "ferramenta atrasada" (seção 18) era impossível
    // de calcular — o evento já existia reservado no catálogo,
    // nunca tinha dado pra comparar.
    const prazoHoras = Number(p.prazoPrevistoHoras) > 0 ? Number(p.prazoPrevistoHoras) : (Core_Config.get('FERRAMENTA_PRAZO_PADRAO_HORAS') || 24);
    const agora = new Date();
    const prazoPrevisto = new Date(agora.getTime() + prazoHoras * 3600 * 1000);

    DB_Update.byId('FERRAMENTAS', ferramenta.ID, { estado: 'EM_USO', responsavelAtual: paraUserId, dataAtualizacao: agora, dataRetirada: agora, prazoPrevisto: prazoPrevisto });
    Event_Bus.emit(EVENT_TYPES.FERRAMENTA_RETIRADA, { ferramentaId: ferramenta.ID, userId: paraUserId, biometriaConfirmada, prazoPrevisto: prazoPrevisto.toISOString() }, ctx);
    Audit_Service.record(ctx, 'FERRAMENTA_RETIRADA', { entidade: 'FERRAMENTAS', entidadeId: ferramenta.ID }, { estado: 'DISPONIVEL' }, { estado: 'EM_USO', responsavelAtual: paraUserId, biometriaConfirmada, prazoPrevisto });

    return Core_Response.ok(DB_Query.get('FERRAMENTAS', ferramenta.ID), 'Retirada confirmada.', 'SUCCESS', {}, ctx.requestId);
  }

  // ---------------------------------------------------------
  // DEVOLUÇÃO (seção 3.6)
  // ---------------------------------------------------------
  function devolver(ctx) {
    const p = ctx.payload || {};
    const ferramenta = DB_Query.get('FERRAMENTAS', p.ferramentaId);
    if (!ferramenta) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Ferramenta não encontrada.', {}, ctx.requestId);
    if (ferramenta.estado !== 'EM_USO') {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'Ferramenta não está em uso (estado atual: ' + ferramenta.estado + ').', {}, ctx.requestId);
    }

    const houveProblema = !!p.condicaoProblema;
    const novoEstado = houveProblema ? 'AGUARDANDO_VISTORIA' : 'DISPONIVEL';
    DB_Update.byId('FERRAMENTAS', ferramenta.ID, { estado: novoEstado, responsavelAtual: '', dataAtualizacao: new Date() });
    Event_Bus.emit(EVENT_TYPES.FERRAMENTA_DEVOLVIDA, { ferramentaId: ferramenta.ID, condicaoProblema: houveProblema, evidenciaUrl: p.evidenciaUrl || '' }, ctx);
    Audit_Service.record(ctx, 'FERRAMENTA_DEVOLVIDA', { entidade: 'FERRAMENTAS', entidadeId: ferramenta.ID }, { estado: 'EM_USO' }, { estado: novoEstado, condicao: p.condicao || '' });

    return Core_Response.ok(DB_Query.get('FERRAMENTAS', ferramenta.ID), 'Devolução registrada' + (houveProblema ? ' — aguardando vistoria.' : '.'), 'SUCCESS', {}, ctx.requestId);
  }

  // ---------------------------------------------------------
  // VISTORIA (seção 3.7)
  // ---------------------------------------------------------
  function abrirVistoria(ctx) {
    const p = ctx.payload || {};
    const ferramenta = DB_Query.get('FERRAMENTAS', p.ferramentaId);
    if (!ferramenta) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Ferramenta não encontrada.', {}, ctx.requestId);

    const vistoria = DB_Insert.insert('FERRAMENTA_VISTORIAS', {
      ferramentaId: ferramenta.ID, data: new Date(), responsavel: ctx.userId,
      condicao: p.condicao || '', desgaste: p.desgaste || '', dano: p.dano || '',
      faltaComponente: p.faltaComponente || '', naoConformidade: !!p.naoConformidade,
      recomendacao: p.recomendacao || '', fotos: Array.isArray(p.fotos) ? p.fotos.join(',') : ''
    });

    const novoEstado = p.naoConformidade ? 'COM_PROBLEMA' : 'DISPONIVEL';
    DB_Update.byId('FERRAMENTAS', ferramenta.ID, { estado: novoEstado, dataUltimaVistoria: new Date(), dataAtualizacao: new Date() });

    if (p.naoConformidade) {
      registrarNaoConformidade({ userId: ctx.userId, requestId: ctx.requestId, perfil: ctx.perfil, payload: {
        ferramentaId: ferramenta.ID, descricao: p.recomendacao || 'Não conformidade identificada em vistoria.', gravidade: p.gravidade || 'MEDIA'
      } });
    }
    Audit_Service.record(ctx, 'FERRAMENTA_VISTORIADA', { entidade: 'FERRAMENTAS', entidadeId: ferramenta.ID }, null, { naoConformidade: !!p.naoConformidade });

    return Core_Response.ok({ vistoria, ferramenta: DB_Query.get('FERRAMENTAS', ferramenta.ID) }, 'Vistoria registrada.', 'SUCCESS', {}, ctx.requestId);
  }

  /** Pensada pra rodar num gatilho de tempo — avisa vistoria vencida sem esconder isso (seção 6). */
  function verificarVistoriasPendentes(ctx) {
    const hoje = new Date();
    const pendentes = DB_Query.find('FERRAMENTAS', f =>
      f.dataProximaVistoriaSugerida && new Date(f.dataProximaVistoriaSugerida) <= hoje &&
      !['BAIXADA', 'EXTRAVIADA'].includes(f.estado)
    );
    pendentes.forEach(f => Event_Bus.emit(EVENT_TYPES.FERRAMENTA_VISTORIA_PENDENTE, { ferramentaId: f.ID, codigo: f.codigo }, ctx || {}));
    return { total: pendentes.length };
  }

  // ---------------------------------------------------------
  // MANUTENÇÃO (seção 3.8)
  // ---------------------------------------------------------
  function abrirManutencao(ctx) {
    const p = ctx.payload || {};
    const ferramenta = DB_Query.get('FERRAMENTAS', p.ferramentaId);
    if (!ferramenta) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Ferramenta não encontrada.', {}, ctx.requestId);
    if (['EM_USO', 'RESERVADA', 'BAIXADA'].includes(ferramenta.estado)) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'Ferramenta precisa estar livre de uso/reserva pra entrar em manutenção (estado atual: ' + ferramenta.estado + ').', {}, ctx.requestId);
    }

    const manutencao = DB_Insert.insert('FERRAMENTA_MANUTENCOES', {
      ferramentaId: ferramenta.ID, motivo: p.motivo || '', responsavel: ctx.userId,
      status: 'ABERTA', dataAbertura: new Date(), dataPrevisao: p.dataPrevisao || '', dataConclusao: ''
    });
    DB_Update.byId('FERRAMENTAS', ferramenta.ID, { estado: 'EM_MANUTENCAO', dataAtualizacao: new Date() });
    Event_Bus.emit(EVENT_TYPES.FERRAMENTA_MANUTENCAO, { ferramentaId: ferramenta.ID, manutencaoId: manutencao.ID }, ctx);
    Audit_Service.record(ctx, 'FERRAMENTA_MANUTENCAO_ABERTA', { entidade: 'FERRAMENTA_MANUTENCOES', entidadeId: manutencao.ID });

    return Core_Response.ok(manutencao, 'Manutenção aberta.', 'SUCCESS', {}, ctx.requestId);
  }

  function concluirManutencao(ctx) {
    const { manutencaoId } = ctx.payload || {};
    const manutencao = DB_Query.get('FERRAMENTA_MANUTENCOES', manutencaoId);
    if (!manutencao) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Manutenção não encontrada.', {}, ctx.requestId);
    if (manutencao.status !== 'ABERTA') {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'Manutenção já foi concluída.', {}, ctx.requestId);
    }
    DB_Update.byId('FERRAMENTA_MANUTENCOES', manutencao.ID, { status: 'CONCLUIDA', dataConclusao: new Date() });
    DB_Update.byId('FERRAMENTAS', manutencao.ferramentaId, { estado: 'DISPONIVEL', dataAtualizacao: new Date() });
    // BLOCO 06 — gap corrigido: só auditava com a STRING
    // 'FERRAMENTA_MANUTENCAO_CONCLUIDA', nunca emitia o evento de
    // verdade (o evento nem existia no catálogo ainda).
    Event_Bus.emit(EVENT_TYPES.FERRAMENTA_MANUTENCAO_CONCLUIDA, { ferramentaId: manutencao.ferramentaId, manutencaoId: manutencao.ID }, ctx);
    Audit_Service.record(ctx, 'FERRAMENTA_MANUTENCAO_CONCLUIDA', { entidade: 'FERRAMENTA_MANUTENCOES', entidadeId: manutencao.ID });
    return Core_Response.ok(DB_Query.get('FERRAMENTA_MANUTENCOES', manutencao.ID), 'Manutenção concluída — ferramenta disponível novamente.', 'SUCCESS', {}, ctx.requestId);
  }

  // ---------------------------------------------------------
  // NÃO CONFORMIDADE (seção 3.9) — reaproveita OCORRENCIAS
  // ---------------------------------------------------------
  function registrarNaoConformidade(ctx) {
    const p = ctx.payload || {};
    const ferramenta = DB_Query.get('FERRAMENTAS', p.ferramentaId);
    if (!ferramenta) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Ferramenta não encontrada.', {}, ctx.requestId);

    const ocorrencia = DB_Insert.insert('OCORRENCIAS', {
      tipo: 'FERRAMENTA_NAO_CONFORME', prioridade: p.gravidade || 'MEDIA', descricao: p.descricao || '',
      obraId: '', projetoId: '', atividadeId: '', responsavel: ctx.userId, data: new Date(),
      status: 'ABERTA', resolucao: '', entidade: 'FERRAMENTAS', entidadeId: ferramenta.ID
    });

    // BLOCO 06, seção 13 — "a ferramenta PODE ficar BLOQUEADA até
    // solução" é linguagem mais forte que COM_PROBLEMA. Separei os
    // dois: ALTA continua indo pra COM_PROBLEMA (comportamento já
    // testado, preservado — regra "não remover funcionalidade
    // aprovada"), CRITICA agora vai pro estado novo e mais severo.
    const gravidade = (p.gravidade || '').toUpperCase();
    if (gravidade === 'CRITICA' && ferramenta.estado !== 'BLOQUEADA') {
      DB_Update.byId('FERRAMENTAS', ferramenta.ID, { estado: 'BLOQUEADA', dataAtualizacao: new Date() });
    } else if (gravidade === 'ALTA' && ferramenta.estado !== 'COM_PROBLEMA') {
      DB_Update.byId('FERRAMENTAS', ferramenta.ID, { estado: 'COM_PROBLEMA', dataAtualizacao: new Date() });
    }
    Event_Bus.emit(EVENT_TYPES.FERRAMENTA_NAO_CONFORME, { ferramentaId: ferramenta.ID, ocorrenciaId: ocorrencia.ID, gravidade: p.gravidade || 'MEDIA' }, ctx);
    Audit_Service.record(ctx, 'FERRAMENTA_NAO_CONFORME', { entidade: 'OCORRENCIAS', entidadeId: ocorrencia.ID });

    return Core_Response.ok(ocorrencia, 'Não conformidade registrada.', 'SUCCESS', {}, ctx.requestId);
  }

  // ---------------------------------------------------------
  // EXTRAVIO E BAIXA (seção 3.10)
  // ---------------------------------------------------------
  function reportarExtravio(ctx) {
    const p = ctx.payload || {};
    const ferramenta = DB_Query.get('FERRAMENTAS', p.ferramentaId);
    if (!ferramenta) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Ferramenta não encontrada.', {}, ctx.requestId);
    if (!p.motivo) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'motivo é obrigatório pra reportar extravio.', {}, ctx.requestId);

    DB_Update.byId('FERRAMENTAS', ferramenta.ID, { estado: 'EXTRAVIADA', dataAtualizacao: new Date() });
    Event_Bus.emit(EVENT_TYPES.FERRAMENTA_EXTRAVIADA, { ferramentaId: ferramenta.ID, motivo: p.motivo }, ctx);
    Audit_Service.record(ctx, 'FERRAMENTA_EXTRAVIADA', { entidade: 'FERRAMENTAS', entidadeId: ferramenta.ID }, { estado: ferramenta.estado }, { estado: 'EXTRAVIADA', motivo: p.motivo });

    return Core_Response.ok(DB_Query.get('FERRAMENTAS', ferramenta.ID), 'Extravio registrado.', 'SUCCESS', {}, ctx.requestId);
  }

  /** Baixa exige autorização real (GESTOR/ADMIN — seção 3.10/8 do contrato), nunca ALMOXARIFE sozinho. */
  function baixar(ctx) {
    const p = ctx.payload || {};
    const ferramenta = DB_Query.get('FERRAMENTAS', p.ferramentaId);
    if (!ferramenta) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Ferramenta não encontrada.', {}, ctx.requestId);
    if (!p.motivo) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'motivo é obrigatório pra dar baixa.', {}, ctx.requestId);
    if (!['perda', 'dano_irreparavel', 'administrativa'].includes(p.tipoBaixa)) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'tipoBaixa deve ser perda, dano_irreparavel ou administrativa.', {}, ctx.requestId);
    }
    if (ferramenta.estado === 'EM_USO' || ferramenta.estado === 'RESERVADA') {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'Ferramenta em uso/reservada não pode ser baixada diretamente — devolva ou cancele a reserva primeiro.', {}, ctx.requestId);
    }

    DB_Update.byId('FERRAMENTAS', ferramenta.ID, { estado: 'BAIXADA', situacao: 'INATIVA', dataAtualizacao: new Date() });
    Event_Bus.emit(EVENT_TYPES.FERRAMENTA_BAIXADA, { ferramentaId: ferramenta.ID, tipoBaixa: p.tipoBaixa, motivo: p.motivo }, ctx);
    Audit_Service.record(ctx, 'FERRAMENTA_BAIXADA', { entidade: 'FERRAMENTAS', entidadeId: ferramenta.ID }, { estado: ferramenta.estado }, { estado: 'BAIXADA', tipoBaixa: p.tipoBaixa, motivo: p.motivo });

    return Core_Response.ok(DB_Query.get('FERRAMENTAS', ferramenta.ID), 'Ferramenta baixada.', 'SUCCESS', {}, ctx.requestId);
  }

  // ---------------------------------------------------------
  // PAINEL VIRTUAL (seção 4) e HISTÓRICO (seção 5)
  // ---------------------------------------------------------
  function painel(ctx) {
    const todas = DB_Query.find('FERRAMENTAS', () => true);
    const contarPor = estado => todas.filter(f => f.estado === estado).length;
    const hoje = new Date();

    return Core_Response.ok({
      total: todas.length,
      disponiveis: contarPor('DISPONIVEL'), reservadas: contarPor('RESERVADA'), emUso: contarPor('EM_USO'),
      emManutencao: contarPor('EM_MANUTENCAO'), aguardandoVistoria: contarPor('AGUARDANDO_VISTORIA'),
      comProblema: contarPor('COM_PROBLEMA'), extraviadas: contarPor('EXTRAVIADA'), baixadas: contarPor('BAIXADA'),
      pendenciasNaoConformidade: DB_Query.find('OCORRENCIAS', o => o.entidade === 'FERRAMENTAS' && o.status === 'ABERTA').length,
      vistoriasProximas: todas.filter(f => f.dataProximaVistoriaSugerida && new Date(f.dataProximaVistoriaSugerida) > hoje && new Date(f.dataProximaVistoriaSugerida) <= new Date(hoje.getTime() + 7 * 86400000)).length,
      manutencoesAbertas: DB_Query.find('FERRAMENTA_MANUTENCOES', m => m.status === 'ABERTA').length
    }, '', 'SUCCESS', {}, ctx.requestId);
  }

  /** Linha do tempo completa (seção 5) — reaproveita AUDITORIA, nunca apaga evento (seção 8). */
  function historico(ctx) {
    const ferramenta = DB_Query.get('FERRAMENTAS', ctx.payload.id);
    if (!ferramenta) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Ferramenta não encontrada.', {}, ctx.requestId);
    const eventos = DB_Query.find('AUDITORIA', a => a.entidade === 'FERRAMENTAS' && String(a.entidadeId) === String(ferramenta.ID))
      .sort((a, b) => new Date(a.data) - new Date(b.data));
    const vistorias = DB_Query.find('FERRAMENTA_VISTORIAS', v => String(v.ferramentaId) === String(ferramenta.ID));
    const manutencoes = DB_Query.find('FERRAMENTA_MANUTENCOES', m => String(m.ferramentaId) === String(ferramenta.ID));
    const reservas = DB_Query.find('RESERVAS', r => String(r.ferramentaId) === String(ferramenta.ID));
    return Core_Response.ok({ eventos, vistorias, manutencoes, reservas }, '', 'SUCCESS', {}, ctx.requestId);
  }

  /**
   * BLOCO 06, seção 18 — "ferramenta não devolvida"/"devolução
   * atrasada" nunca existia porque `retirar()` nunca gravava
   * prazo nenhum. Mesmo padrão de `verificarVistoriasPendentes`
   * (já existente) — reaproveitado, não duplicado.
   */
  function verificarFerramentasAtrasadas(ctx) {
    const agora = new Date();
    const atrasadas = DB_Query.find('FERRAMENTAS', f =>
      f.estado === 'EM_USO' && f.prazoPrevisto && new Date(f.prazoPrevisto) < agora
    );
    atrasadas.forEach(f => Event_Bus.emit(EVENT_TYPES.FERRAMENTA_ATRASADA, { ferramentaId: f.ID, codigo: f.codigo, responsavelAtual: f.responsavelAtual, prazoPrevisto: f.prazoPrevisto }, ctx || {}));
    return { total: atrasadas.length };
  }

  /**
   * BLOCO 06, seção 6 — "permitir consultar: disponíveis;
   * reservadas; em posse; manutenção; indisponíveis". `search()`
   * já filtrava por um estado por vez; isso aqui é a contagem
   * agregada que a seção pede, sem duplicar a busca em si.
   */
  function disponibilidade(ctx) {
    const p = ctx.payload || {};
    const todas = DB_Query.find('FERRAMENTAS', f => !p.categoria || f.categoria === p.categoria);
    const contagem = {};
    CORE_CONSTANTS.FERRAMENTA_ESTADOS.forEach(estado => { contagem[estado] = 0; });
    todas.forEach(f => { if (contagem[f.estado] !== undefined) contagem[f.estado]++; });
    return Core_Response.ok({ total: todas.length, porEstado: contagem }, '', 'SUCCESS', {}, ctx.requestId);
  }

  /**
   * BLOCO 06, seção 15 — não existia antes. "FERRAMENTA A
   * apresenta defeito → FERRAMENTA B entregue ao usuário, mantendo
   * vínculo histórico entre usuário → ferramenta anterior → motivo
   * → nova ferramenta." A ferramenta antiga vai pro mesmo destino
   * de uma não conformidade normal (`COM_PROBLEMA`) — a troca É a
   * consequência de um defeito, não um caminho novo de estado.
   */
  function trocar(ctx) {
    const p = ctx.payload || {};
    const anterior = DB_Query.get('FERRAMENTAS', p.ferramentaAnteriorId);
    if (!anterior) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Ferramenta anterior não encontrada.', {}, ctx.requestId);
    if (anterior.estado !== 'EM_USO') {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'A ferramenta anterior precisa estar em uso pra ser trocada (estado atual: ' + anterior.estado + ').', {}, ctx.requestId);
    }
    const nova = DB_Query.get('FERRAMENTAS', p.ferramentaNovaId);
    if (!nova) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Ferramenta nova não encontrada.', {}, ctx.requestId);
    if (nova.estado !== 'DISPONIVEL') {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'A ferramenta nova precisa estar disponível (estado atual: ' + nova.estado + ').', {}, ctx.requestId);
    }
    if (!p.motivo) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'motivo é obrigatório pra trocar uma ferramenta.', {}, ctx.requestId);

    const usuario = anterior.responsavelAtual;
    const agora = new Date();

    DB_Update.byId('FERRAMENTAS', anterior.ID, { estado: 'COM_PROBLEMA', responsavelAtual: '', dataAtualizacao: agora });
    DB_Update.byId('FERRAMENTAS', nova.ID, { estado: 'EM_USO', responsavelAtual: usuario, dataAtualizacao: agora, dataRetirada: agora, prazoPrevisto: anterior.prazoPrevisto || '' });

    const troca = DB_Insert.insert('FERRAMENTA_TROCAS', {
      ferramentaAnteriorId: anterior.ID, ferramentaNovaId: nova.ID, motivo: p.motivo, usuario: usuario, executadoPor: ctx.userId, data: agora
    });

    // A ferramenta antiga também vira uma não conformidade de
    // verdade — reaproveita a função que já existe, não duplica
    // a lógica de abrir ocorrência.
    registrarNaoConformidade({ userId: ctx.userId, requestId: ctx.requestId, perfil: ctx.perfil, payload: {
      ferramentaId: anterior.ID, descricao: 'Troca: ' + p.motivo, gravidade: p.gravidade || 'MEDIA'
    }});

    Event_Bus.emit(EVENT_TYPES.FERRAMENTA_TROCADA, { ferramentaAnteriorId: anterior.ID, ferramentaNovaId: nova.ID, usuario, motivo: p.motivo }, ctx);
    Audit_Service.record(ctx, 'FERRAMENTA_TROCADA', { entidade: 'FERRAMENTA_TROCAS', entidadeId: troca.ID },
      { ferramentaAnteriorId: anterior.ID, estado: 'EM_USO' }, { ferramentaNovaId: nova.ID, estado: 'EM_USO', motivo: p.motivo });

    return Core_Response.ok({ troca, ferramentaAnterior: DB_Query.get('FERRAMENTAS', anterior.ID), ferramentaNova: DB_Query.get('FERRAMENTAS', nova.ID) },
      'Troca registrada.', 'SUCCESS', {}, ctx.requestId);
  }

  function getRoutes() {
    return {
      'ferramenta.create': create, 'ferramenta.get': get, 'ferramenta.search': search,
      'ferramenta.identificar': identificar, 'ferramenta.gerarQR': gerarQR,
      'ferramenta.retirar': retirar, 'ferramenta.devolver': devolver,
      'ferramenta.abrirVistoria': abrirVistoria, 'ferramenta.verificarVistoriasPendentes': verificarVistoriasPendentes,
      'ferramenta.abrirManutencao': abrirManutencao, 'ferramenta.concluirManutencao': concluirManutencao,
      'ferramenta.registrarNaoConformidade': registrarNaoConformidade,
      'ferramenta.reportarExtravio': reportarExtravio, 'ferramenta.baixar': baixar,
      'ferramenta.painel': painel, 'ferramenta.historico': historico,
      'ferramenta.disponibilidade': disponibilidade, 'ferramenta.trocar': trocar,
      'ferramenta.verificarFerramentasAtrasadas': verificarFerramentasAtrasadas
    };
  }
  function getServices() { return { Service_Ferramenta }; }
  function getEvents() {
    return [EVENT_TYPES.FERRAMENTA_CADASTRADA, EVENT_TYPES.FERRAMENTA_RESERVADA, EVENT_TYPES.FERRAMENTA_RETIRADA,
      EVENT_TYPES.FERRAMENTA_DEVOLVIDA, EVENT_TYPES.FERRAMENTA_NAO_CONFORME, EVENT_TYPES.FERRAMENTA_MANUTENCAO,
      EVENT_TYPES.FERRAMENTA_MANUTENCAO_CONCLUIDA, EVENT_TYPES.FERRAMENTA_TROCADA,
      EVENT_TYPES.FERRAMENTA_EXTRAVIADA, EVENT_TYPES.FERRAMENTA_VISTORIA_PENDENTE, EVENT_TYPES.FERRAMENTA_ATRASADA,
      EVENT_TYPES.FERRAMENTA_BAIXADA];
  }
  function getVersion() { return '1.1.0'; }
  function init() {
    Auth_RBAC.registerActionPermission('ferramenta.create', 'FERRAMENTA.CREATE');
    Auth_RBAC.registerActionPermission('ferramenta.get', 'FERRAMENTA.VIEW');
    Auth_RBAC.registerActionPermission('ferramenta.search', 'FERRAMENTA.VIEW');
    Auth_RBAC.registerActionPermission('ferramenta.identificar', 'FERRAMENTA.VIEW');
    Auth_RBAC.registerActionPermission('ferramenta.gerarQR', 'FERRAMENTA.EDIT');
    // retirar/devolver: self-service (operador retira/devolve a
    // própria ferramenta) — a checagem de "em nome de outro" fica
    // por dentro de retirar(), não na permissão de papel.
    Auth_RBAC.registerActionPermission('ferramenta.retirar', 'FERRAMENTA.VIEW');
    Auth_RBAC.registerActionPermission('ferramenta.devolver', 'FERRAMENTA.VIEW');
    Auth_RBAC.registerActionPermission('ferramenta.abrirVistoria', 'FERRAMENTA.EDIT');
    Auth_RBAC.registerActionPermission('ferramenta.verificarVistoriasPendentes', 'FERRAMENTA.ADMIN');
    Auth_RBAC.registerActionPermission('ferramenta.abrirManutencao', 'FERRAMENTA.EDIT');
    Auth_RBAC.registerActionPermission('ferramenta.concluirManutencao', 'FERRAMENTA.EDIT');
    Auth_RBAC.registerActionPermission('ferramenta.registrarNaoConformidade', 'FERRAMENTA.EDIT');
    Auth_RBAC.registerActionPermission('ferramenta.reportarExtravio', 'FERRAMENTA.EDIT');
    // baixa exige autorização de verdade — só GESTOR/ADMIN (nunca ALMOXARIFE sozinho).
    Auth_RBAC.registerActionPermission('ferramenta.baixar', 'FERRAMENTA.APPROVE');
    Auth_RBAC.registerActionPermission('ferramenta.painel', 'FERRAMENTA.VIEW');
    Auth_RBAC.registerActionPermission('ferramenta.historico', 'FERRAMENTA.VIEW');
    Auth_RBAC.registerActionPermission('ferramenta.disponibilidade', 'FERRAMENTA.VIEW');
    Auth_RBAC.registerActionPermission('ferramenta.trocar', 'FERRAMENTA.EDIT');
    Auth_RBAC.registerActionPermission('ferramenta.verificarFerramentasAtrasadas', 'FERRAMENTA.ADMIN');
  }
  function healthCheck() { return { status: CORE_CONSTANTS.DOCTOR_STATUS.OK }; }

  return {
    create, get, search, identificar, gerarQR, retirar, devolver,
    abrirVistoria, verificarVistoriasPendentes, abrirManutencao, concluirManutencao,
    registrarNaoConformidade, reportarExtravio, baixar, painel, historico,
    disponibilidade, trocar, verificarFerramentasAtrasadas,
    getRoutes, getServices, getEvents, getVersion, init, healthCheck, id: 'FERRAMENTA'
  };
})();
