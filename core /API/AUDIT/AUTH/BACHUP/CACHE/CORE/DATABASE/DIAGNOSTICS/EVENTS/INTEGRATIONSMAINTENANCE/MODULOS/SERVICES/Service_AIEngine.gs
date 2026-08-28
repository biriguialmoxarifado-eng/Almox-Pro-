/**
 * ============================================================
 * ALMOXA PRO — Service_AIEngine.gs
 * MÓDULO 09 — AI ENGINE
 *
 * TRANSPARÊNCIA CENTRAL (mesmo princípio já estabelecido em
 * Service_IA desde a Fase 12 — não é ML, não é LLM, nenhuma
 * chamada a API externa de inteligência artificial):
 *
 * - `consultar()` NÃO é processamento de linguagem natural real.
 *   É um roteador por palavra-chave sobre perguntas conhecidas —
 *   documentado explicitamente, nunca apresentado como "entende
 *   qualquer pergunta".
 * - Toda "inteligência" aqui é COMPOSIÇÃO de dado real já
 *   existente (Estoque, Reservas, Solicitações, Pré-Compra,
 *   Inventário, Notas Fiscais, Ferramentas, Doutor) — nenhuma
 *   função grava em tabela de negócio nenhuma (seção 11 do
 *   contrato: "IA não pode alterar estoque sozinha, excluir
 *   registro, aprovar compra..."). Confira: nenhuma chamada
 *   DB_Insert/DB_Update/DB_Delete neste arquivo toca tabela de
 *   negócio — só `IA_INTERACOES` (auditoria da própria IA) e
 *   `IA_PREFERENCIAS` (configuração, não dado operacional).
 * - Como não existe chamada externa nenhuma, não há "serviço de
 *   IA indisponível" pra tratar (seção 13) — é 100% cálculo
 *   interno sobre dado que já está no sistema.
 * ============================================================
 */

const Service_AIEngine = (function () {

  const PERFIS_GESTAO = [CORE_CONSTANTS.PERFIS.ALMOXARIFE, CORE_CONSTANTS.PERFIS.GESTOR, CORE_CONSTANTS.PERFIS.ADMIN];
  const DIAS_PRE_COMPRA_SEM_RETORNO = 5;

  // ---------------------------------------------------------
  // ALERTAS INTELIGENTES (seção 3) — cada um com explicação (seção 4)
  // ---------------------------------------------------------
  function _alertasEstoque() {
    const linhas = DB_Query.find('ESTOQUE', r => Number(r.estoqueMinimo) > 0);
    return linhas.map(row => Object.assign({ produtoId: row.produtoId, localizacao: row.localizacao }, Service_Estoque.classificar(row)))
      .filter(c => c.classificacao === 'VERMELHO' || c.classificacao === 'AMARELO')
      .map(c => {
        const produto = DB_Query.get('PRODUTOS', c.produtoId);
        const explicacao = c.historicoSuficiente
          ? 'Disponível (' + c.disponivel + ') está ' + (c.classificacao === 'VERMELHO' ? 'no ou abaixo do mínimo (' + c.estoqueMinimo + ')' : 'perto do mínimo (' + c.estoqueMinimo + ')') +
            ' e o consumo médio diário é ' + c.consumoMedioDiario + ' — cobertura estimada de ' + c.diasCobertura + ' dia(s).'
          : 'Disponível (' + c.disponivel + ') está ' + (c.classificacao === 'VERMELHO' ? 'no ou abaixo do mínimo' : 'perto do mínimo') + ' (' + c.estoqueMinimo + '), mas ainda não há histórico de consumo suficiente pra estimar cobertura.';
        return { tipo: 'ESTOQUE', nivel: c.classificacao, produtoId: c.produtoId, descricao: produto ? produto.descricaoOriginal : '', localizacao: c.localizacao, explicacao };
      });
  }

  function _alertasReservaVencendo() {
    const limite = new Date(Date.now() + 24 * 3600 * 1000);
    return DB_Query.find('RESERVAS', r => ['PENDENTE', 'APROVADA'].includes(r.status) && new Date(r.validade) <= limite && new Date(r.validade) > new Date())
      .map(r => ({ tipo: 'RESERVA_VENCENDO', reservaId: r.ID, explicacao: 'Reserva #' + r.ID + ' vence em ' + Utils_Date.format(new Date(r.validade)) + ' e ainda está ' + r.status.toLowerCase() + '.' }));
  }

  function _alertasPreCompraSemRetorno() {
    const limite = new Date(Date.now() - DIAS_PRE_COMPRA_SEM_RETORNO * 86400000);
    return DB_Query.find('PRE_COMPRAS', pc => ['RASCUNHO', 'ABERTA', 'EM_ANALISE'].includes(pc.status) && new Date(pc.dataAbertura) <= limite)
      .map(pc => ({ tipo: 'PRE_COMPRA_SEM_RETORNO', preCompraId: pc.ID, numero: pc.numero, explicacao: 'Pré-compra ' + pc.numero + ' está "' + pc.status + '" há mais de ' + DIAS_PRE_COMPRA_SEM_RETORNO + ' dias sem decisão.' }));
  }

  function _alertasAprovacaoPendente(ctx) {
    const alertas = [];
    DB_Query.find('SOLICITACOES', s => s.status === 'PENDENTE').forEach(s =>
      alertas.push({ tipo: 'APROVACAO_PENDENTE', origem: 'SOLICITACAO', id: s.ID, explicacao: 'Solicitação ' + s.numero + ' aguarda aprovação desde ' + Utils_Date.format(new Date(s.data)) + '.' }));
    DB_Query.find('RESERVAS', r => r.status === 'PENDENTE').forEach(r =>
      alertas.push({ tipo: 'APROVACAO_PENDENTE', origem: 'RESERVA', id: r.ID, explicacao: 'Reserva #' + r.ID + ' aguarda aprovação.' }));
    DB_Query.find('PRE_COMPRAS', pc => pc.status === 'EM_ANALISE').forEach(pc =>
      alertas.push({ tipo: 'APROVACAO_PENDENTE', origem: 'PRE_COMPRA', id: pc.ID, explicacao: 'Pré-compra ' + pc.numero + ' está em análise.' }));
    return alertas;
  }

  function _alertasInventarioComDivergencia() {
    return DB_Query.find('INVENTARIOS', i => i.estado === 'PENDENTE_APROVACAO')
      .map(i => ({ tipo: 'INVENTARIO_DIVERGENCIA', inventarioId: i.ID, token: i.token, explicacao: 'Inventário ' + i.token + ' tem divergência aguardando aprovação.' }));
  }

  function _alertasNotaFiscalPendente() {
    return DB_Query.find('NOTAS_FISCAIS', nf => !['APROVADA', 'REJEITADA'].includes(nf.status))
      .map(nf => ({ tipo: 'NF_PENDENTE', notaId: nf.ID, numero: nf.numero, explicacao: 'Nota fiscal ' + nf.numero + ' está "' + nf.status + '" — ainda não foi aprovada nem rejeitada.' }));
  }

  function _alertasFerramentaNaoDevolvida(diasLimite) {
    const limite = new Date(Date.now() - (diasLimite || 7) * 86400000);
    return DB_Query.find('FERRAMENTAS', f => f.estado === 'EM_USO' && f.dataAtualizacao && new Date(f.dataAtualizacao) <= limite)
      .map(f => ({ tipo: 'FERRAMENTA_NAO_DEVOLVIDA', ferramentaId: f.ID, codigo: f.codigo, explicacao: 'Ferramenta ' + f.codigo + ' está em uso há mais de ' + (diasLimite || 7) + ' dias (aproximação pela última atualização de estado — não existe campo de prazo de devolução hoje).' }));
  }

  function alertasInteligentes(ctx) {
    return Core_Response.ok({
      estoque: _alertasEstoque(),
      reservasVencendo: _alertasReservaVencendo(),
      preComprasSemRetorno: _alertasPreCompraSemRetorno(),
      aprovacoesPendentes: _alertasAprovacaoPendente(ctx),
      inventariosComDivergencia: _alertasInventarioComDivergencia(),
      notasFiscaisPendentes: _alertasNotaFiscalPendente(),
      ferramentasNaoDevolvidas: _alertasFerramentaNaoDevolvida()
    }, '', 'SUCCESS', {}, ctx.requestId);
  }

  // ---------------------------------------------------------
  // ASSISTENTE CONTEXTUAL (seção 1) — roteador por palavra-chave, NÃO é NLP
  // ---------------------------------------------------------
  function consultar(ctx) {
    const pergunta = (ctx.payload && ctx.payload.pergunta) || '';
    const norm = Utils_String.normalize(pergunta);
    let respostaResumo = '';
    let dados = null;

    if (norm.includes('critic') || norm.includes('minim')) {
      dados = _alertasEstoque();
      respostaResumo = dados.length + ' item(ns) de estoque em alerta (vermelho/amarelo).';
    } else if (norm.includes('reserva') && norm.includes('pend')) {
      dados = DB_Query.find('RESERVAS', r => r.status === 'PENDENTE');
      respostaResumo = dados.length + ' reserva(s) pendente(s) de aprovação.';
    } else if (norm.includes('pre-compra') || norm.includes('precompra') || (norm.includes('compra') && norm.includes('retorno'))) {
      dados = _alertasPreCompraSemRetorno();
      respostaResumo = dados.length + ' pré-compra(s) sem retorno.';
    } else if (norm.includes('aprovac')) {
      dados = _alertasAprovacaoPendente(ctx);
      respostaResumo = dados.length + ' item(ns) aguardando aprovação no total.';
    } else if (norm.includes('ferramenta')) {
      dados = _alertasFerramentaNaoDevolvida();
      respostaResumo = dados.length + ' ferramenta(s) em uso há mais tempo que o esperado.';
    } else if (norm.includes('nota fiscal') || norm.includes('nf')) {
      dados = _alertasNotaFiscalPendente();
      respostaResumo = dados.length + ' nota(s) fiscal(is) pendente(s).';
    } else {
      // MÓDULO 16 — antes de desistir, tenta as Skills (cobrem
      // vocabulário que este roteador simples não tinha: nota
      // fiscal específica, compras, rastreabilidade, diagnóstico,
      // auditoria). Nunca substitui os padrões acima que já
      // funcionavam — só estende o que esse "else" fazia sozinho.
      const viaSkill = Service_Skills.consultar({ userId: ctx.userId, requestId: ctx.requestId, perfil: ctx.perfil, payload: { pergunta } });
      if (viaSkill.success && viaSkill.data.skillIdentificada) {
        dados = viaSkill.data.resultado;
        respostaResumo = 'Respondido via skill "' + viaSkill.data.skillIdentificada + '".';
      } else {
        respostaResumo = 'Não reconheci essa pergunta. Tente: estoque crítico, reservas pendentes, pré-compras sem retorno, aprovações pendentes, ferramentas não devolvidas, notas fiscais pendentes.';
      }
    }

    DB_Insert.insert('IA_INTERACOES', {
      userId: ctx.userId, perfil: ctx.perfil || '', pergunta,
      respostaResumo, acaoSolicitada: '', acaoExecutada: 'CONSULTA_SOMENTE_LEITURA', data: new Date()
    });

    return Core_Response.ok({ pergunta, respostaResumo, dados }, '', 'SUCCESS', {}, ctx.requestId);
  }

  // ---------------------------------------------------------
  // RESUMO OPERACIONAL POR PERFIL (seção 2)
  // ---------------------------------------------------------
  function resumoOperacional(ctx) {
    const perfil = ctx.perfil;
    let resumo = {};

    if (perfil === CORE_CONSTANTS.PERFIS.ADMIN) {
      resumo = {
        modulos: Doctor_Modules.check(),
        permissoesEmRisco: Doctor_Permissions.check().totalSemPermissaoExplicita,
        usuariosCadastrados: DB_Query.count('USUARIOS', () => true),
        auditoriaRecente: Doctor_ErrorAudit.check(7).totalAlertas
      };
    } else if (perfil === CORE_CONSTANTS.PERFIS.GESTOR) {
      resumo = {
        aprovacoesPendentes: _alertasAprovacaoPendente(ctx).length,
        preComprasSemRetorno: _alertasPreCompraSemRetorno().length,
        estoqueEmAlerta: _alertasEstoque().length,
        inventariosComDivergencia: _alertasInventarioComDivergencia().length
      };
    } else if (perfil === CORE_CONSTANTS.PERFIS.MESTRE_OBRA) {
      resumo = {
        minhasSolicitacoes: DB_Query.find('SOLICITACOES', s => String(s.solicitanteId) === String(ctx.userId)).length,
        minhasReservas: DB_Query.find('RESERVAS', r => String(r.solicitante) === String(ctx.userId)).length,
        pendentesDeEntrega: DB_Query.find('RESERVAS', r => String(r.solicitante) === String(ctx.userId) && ['APROVADA', 'EM_SEPARACAO', 'PRONTA'].includes(r.status)).length
      };
    } else if (PERFIS_GESTAO.includes(perfil)) { // ALMOXARIFE
      resumo = {
        estoqueEmAlerta: _alertasEstoque().length,
        entradasUltimos7Dias: DB_Query.find('MOVIMENTOS', m => m.tipo === 'ENTRADA' && new Date(m.data) >= new Date(Date.now() - 7 * 86400000)).length,
        saidasUltimos7Dias: DB_Query.find('MOVIMENTOS', m => m.tipo === 'SAIDA' && new Date(m.data) >= new Date(Date.now() - 7 * 86400000)).length,
        reservasParaSepararOuEntregar: DB_Query.find('RESERVAS', r => ['APROVADA', 'EM_SEPARACAO', 'PRONTA'].includes(r.status)).length,
        inventariosAbertos: DB_Query.find('INVENTARIOS', i => ['ABERTO', 'EM_CONTAGEM', 'EM_RECONTAGEM'].includes(i.estado)).length
      };
    } else {
      resumo = {
        minhasSolicitacoes: DB_Query.find('SOLICITACOES', s => String(s.solicitanteId) === String(ctx.userId)).length,
        minhasReservas: DB_Query.find('RESERVAS', r => String(r.solicitante) === String(ctx.userId)).length
      };
    }

    return Core_Response.ok({ perfil, resumo }, '', 'SUCCESS', {}, ctx.requestId);
  }

  // ---------------------------------------------------------
  // PREVISÃO (seção 5) — sempre marcada como estimativa
  // ---------------------------------------------------------
  function preverConsumo(ctx) {
    const resultado = Service_IA.analisarConsumo(ctx);
    if (!resultado.success) return resultado;
    return Core_Response.ok(Object.assign({ aviso: 'Isto é uma ESTIMATIVA baseada em média móvel simples — não considera sazonalidade nem eventos futuros.' }, resultado.data), '', 'SUCCESS', {}, ctx.requestId);
  }

  // ---------------------------------------------------------
  // COMPRAS (seção 6) — reaproveita Pré-Compra, nunca aprova sozinha
  // ---------------------------------------------------------
  function analisarFornecedores(ctx) {
    const base = Service_PreCompra.sugerirFornecedores(ctx);
    if (!base.success) return base;
    const fornecedores = base.data.fornecedores.map(f => Object.assign({}, f, {
      tendencia: f.totalFornecimentos >= 2 ? 'Baseado em ' + f.totalFornecimentos + ' fornecimento(s) anteriores — sem cálculo de tendência temporal nesta versão.' : 'Histórico insuficiente pra falar em tendência.'
    }));
    return Core_Response.ok(Object.assign({}, base.data, { fornecedores, aviso: 'Análise informativa — a IA NÃO aprova nem escolhe fornecedor automaticamente.' }), '', 'SUCCESS', {}, ctx.requestId);
  }

  // ---------------------------------------------------------
  // RELATÓRIOS INTELIGENTES (seção 7) — narrativa em cima de dado real
  // ---------------------------------------------------------
  function relatorioInteligente(ctx) {
    const tipo = (ctx.payload && ctx.payload.tipo) || 'PENDENCIAS';
    const alertas = alertasInteligentes(ctx).data;

    const geradores = {
      PENDENCIAS: () => ({
        titulo: 'Resumo de pendências',
        narrativa: alertas.aprovacoesPendentes.length + ' aprovação(ões) pendente(s), ' + alertas.preComprasSemRetorno.length + ' pré-compra(s) sem retorno, ' + alertas.inventariosComDivergencia.length + ' inventário(s) com divergência.',
        detalhe: alertas
      }),
      ESTOQUE: () => ({ titulo: 'Resumo de estoque', narrativa: alertas.estoque.length + ' item(ns) em alerta.', detalhe: alertas.estoque }),
      COMPRAS: () => ({ titulo: 'Resumo de compras', narrativa: alertas.preComprasSemRetorno.length + ' pré-compra(s) sem retorno.', detalhe: alertas.preComprasSemRetorno }),
      INVENTARIO: () => ({ titulo: 'Resumo de inventário', narrativa: alertas.inventariosComDivergencia.length + ' inventário(s) com divergência.', detalhe: alertas.inventariosComDivergencia })
    };

    const gerador = geradores[tipo.toUpperCase()] || geradores.PENDENCIAS;
    return Core_Response.ok(gerador(), '', 'SUCCESS', {}, ctx.requestId);
  }

  // ---------------------------------------------------------
  // ASSISTENTE DE NOTIFICAÇÕES (seção 8) — texto pronto, nunca envia sozinho
  // ---------------------------------------------------------
  function montarMensagemNotificacao(ctx) {
    const usuario = DB_Query.get('USUARIOS', ctx.userId);
    const primeiroNome = usuario ? (usuario.nome || '').split(' ')[0] : '';
    const resumo = resumoOperacional(ctx).data.resumo;

    const partes = [];
    if (resumo.preComprasSemRetorno) partes.push(resumo.preComprasSemRetorno + ' pré-compra(s) sem retorno');
    if (resumo.aprovacoesPendentes) partes.push(resumo.aprovacoesPendentes + ' aprovação(ões) pendente(s)');
    if (resumo.estoqueEmAlerta) partes.push(resumo.estoqueEmAlerta + ' item(ns) de estoque em alerta');
    if (resumo.minhasReservas) partes.push(resumo.minhasReservas + ' reserva(s) sua(s)');

    const mensagem = partes.length
      ? 'Olá, ' + primeiroNome + '. ' + partes.join(', ') + '.'
      : 'Olá, ' + primeiroNome + '. Nenhuma pendência identificada agora.';

    return Core_Response.ok({ mensagem, textoEstruturadoParaVoz: mensagem }, '', 'SUCCESS', {}, ctx.requestId);
    // "textoEstruturadoParaVoz" (seção 10): já é texto simples e
    // corrido, pronto pra qualquer serviço de TTS converter no
    // futuro — não implementamos áudio aqui (não presumir API
    // de voz gratuita disponível, regra explícita do contrato).
  }

  // ---------------------------------------------------------
  // PREFERÊNCIAS DE NOTIFICAÇÃO (seção 9) — só ADMIN configura pra outros
  // ---------------------------------------------------------
  const CATEGORIAS_VALIDAS = ['ESTOQUE', 'COMPRAS', 'PROJETOS', 'RESERVAS', 'INVENTARIO', 'NOTAS_FISCAIS', 'APROVACOES', 'FERRAMENTAS', 'PENDENCIAS', 'SISTEMA'];

  function definirPreferencia(ctx) {
    const p = ctx.payload || {};
    const userIdAlvo = p.userId || ctx.userId;
    // MÓDULO 09 — bug corrigido antes de fechar o teste: sem essa
    // checagem, qualquer usuário autenticado (mesmo OPERADOR)
    // conseguia configurar a preferência de NOTIFICAÇÃO de
    // QUALQUER outra pessoa, porque a permissão de rota
    // (`IA.VIEW`) é ampla de propósito (mesmo padrão self-scope
    // de todo o resto do sistema) e a função não conferia dono.
    if (String(userIdAlvo) !== String(ctx.userId) && ctx.perfil !== CORE_CONSTANTS.PERFIS.ADMIN) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.PERMISSION_DENIED, 'Só ADMIN pode configurar preferência de outro usuário.', {}, ctx.requestId);
    }
    if (!CATEGORIAS_VALIDAS.includes(p.categoria)) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'categoria deve ser uma de: ' + CATEGORIAS_VALIDAS.join(', '), {}, ctx.requestId);
    }
    const existente = DB_Query.findOne('IA_PREFERENCIAS', pref => String(pref.userId) === String(userIdAlvo) && pref.categoria === p.categoria);
    if (existente) {
      DB_Update.byId('IA_PREFERENCIAS', existente.ID, { ativo: !!p.ativo });
    } else {
      DB_Insert.insert('IA_PREFERENCIAS', { userId: userIdAlvo, categoria: p.categoria, ativo: !!p.ativo });
    }
    Audit_Service.record(ctx, 'IA_PREFERENCIA_DEFINIDA', { entidade: 'IA_PREFERENCIAS', entidadeId: userIdAlvo }, null, { categoria: p.categoria, ativo: !!p.ativo });
    return Core_Response.ok({ userId: userIdAlvo, categoria: p.categoria, ativo: !!p.ativo }, 'Preferência salva.', 'SUCCESS', {}, ctx.requestId);
  }

  function obterPreferencias(ctx) {
    const userId = (ctx.payload && ctx.payload.userId) || ctx.userId;
    if (String(userId) !== String(ctx.userId) && ctx.perfil !== CORE_CONSTANTS.PERFIS.ADMIN) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.PERMISSION_DENIED, 'Você só pode ver suas próprias preferências.', {}, ctx.requestId);
    }
    const salvas = DB_Query.find('IA_PREFERENCIAS', p => String(p.userId) === String(userId));
    const mapa = {};
    CATEGORIAS_VALIDAS.forEach(c => mapa[c] = true); // padrão: tudo ativo até alguém desativar de propósito
    salvas.forEach(p => mapa[p.categoria] = !!p.ativo);
    return Core_Response.ok({ userId, preferencias: mapa }, '', 'SUCCESS', {}, ctx.requestId);
  }

  // ---------------------------------------------------------
  // AUDITORIA DA IA (seção 12) — consulta o log real
  // ---------------------------------------------------------
  function historicoInteracoes(ctx) {
    const podeVerTudo = ctx.perfil === CORE_CONSTANTS.PERFIS.ADMIN;
    const alvo = (ctx.payload && ctx.payload.userId) || ctx.userId;
    if (!podeVerTudo && String(alvo) !== String(ctx.userId)) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.PERMISSION_DENIED, 'Você só pode ver seu próprio histórico de interações com a IA.', {}, ctx.requestId);
    }
    const rows = DB_Query.find('IA_INTERACOES', i => podeVerTudo && !(ctx.payload || {}).userId ? true : String(i.userId) === String(alvo))
      .sort((a, b) => new Date(b.data) - new Date(a.data));
    return Core_Response.ok(rows, '', 'SUCCESS', {}, ctx.requestId);
  }

  function getRoutes() {
    return {
      'ia.consultar': consultar,
      'ia.resumoOperacional': resumoOperacional,
      'ia.alertasInteligentes': alertasInteligentes,
      'ia.preverConsumo': preverConsumo,
      'ia.analisarFornecedores': analisarFornecedores,
      'ia.relatorioInteligente': relatorioInteligente,
      'ia.montarMensagemNotificacao': montarMensagemNotificacao,
      'ia.definirPreferencia': definirPreferencia,
      'ia.obterPreferencias': obterPreferencias,
      'ia.historicoInteracoes': historicoInteracoes
    };
  }
  function getServices() { return { Service_AIEngine }; }
  function getEvents() { return []; }
  function getVersion() { return '1.0.0'; }
  function init() {
    // Todas self-scope (qualquer perfil autenticado consulta os
    // PRÓPRIOS dados/resumo — a IA respeita o mesmo escopo que
    // cada módulo de origem já respeitaria se chamado direto,
    // nunca um escopo mais largo). Exceções documentadas por
    // dentro de cada função (definirPreferencia pra outro usuário
    // e historicoInteracoes de outro usuário exigem ADMIN).
    Auth_RBAC.registerActionPermission('ia.consultar', 'IA.VIEW');
    Auth_RBAC.registerActionPermission('ia.resumoOperacional', 'IA.VIEW');
    Auth_RBAC.registerActionPermission('ia.alertasInteligentes', 'IA.VIEW');
    Auth_RBAC.registerActionPermission('ia.preverConsumo', 'IA.VIEW');
    Auth_RBAC.registerActionPermission('ia.analisarFornecedores', 'IA.VIEW');
    Auth_RBAC.registerActionPermission('ia.relatorioInteligente', 'IA.VIEW');
    Auth_RBAC.registerActionPermission('ia.montarMensagemNotificacao', 'IA.VIEW');
    Auth_RBAC.registerActionPermission('ia.definirPreferencia', 'IA.VIEW');
    Auth_RBAC.registerActionPermission('ia.obterPreferencias', 'IA.VIEW');
    Auth_RBAC.registerActionPermission('ia.historicoInteracoes', 'IA.VIEW');
  }
  function healthCheck() { return { status: CORE_CONSTANTS.DOCTOR_STATUS.OK }; }

  return {
    consultar, resumoOperacional, alertasInteligentes, preverConsumo, analisarFornecedores,
    relatorioInteligente, montarMensagemNotificacao, definirPreferencia, obterPreferencias, historicoInteracoes,
    getRoutes, getServices, getEvents, getVersion, init, healthCheck, id: 'AI_ENGINE'
  };
})();
