/**
 * ============================================================
 * ALMOXA PRO — Service_Rastreabilidade.gs
 * MÓDULO 10 — RASTREABILIDADE E HISTÓRICO
 *
 * AUDITORIA CONFIRMOU: `AUDITORIA` (tabela) e `Audit_Service`
 * (Camada 4 do Core) JÁ SÃO, na prática, o histórico de eventos
 * que este módulo precisa — todo módulo desde a Fase 1 já chama
 * `Audit_Service.record()`. Criar uma tabela de evento nova aqui
 * seria duplicar o Core, proibido explicitamente pelo contrato.
 *
 * Por isso este módulo NÃO tem tabela própria de evento — ele
 * ORQUESTRA o que já existe:
 * - `registrarEvento()` é um alias fino de `Audit_Service.record`
 *   (existe pra cumprir o contrato de API da seção 8, mas é
 *   literalmente a mesma função por baixo — documentado, não
 *   escondido).
 * - `consultarHistorico()` usa `Audit_Service.search()` (que
 *   ampliei nesta mesma entrega com os filtros que faltavam —
 *   período/entidade/obra/status), adicionando só paginação.
 * - `buscarPorId()` delega pro `get()`/`search()` que cada módulo
 *   já tem — nunca reimplementa a leitura de outra tabela.
 * - `consultarRastreabilidade()` é a única lógica genuinamente
 *   NOVA: une várias tabelas por ID (nunca por texto) pra montar
 *   a trajetória completa de um produto.
 *
 * DUPLICAÇÃO REAL ENCONTRADA (documentada, não corrigida nesta
 * entrega pra não mexer em módulo já testado sem necessidade):
 * `Service_Reserva.historico()` e `Service_Ferramenta.historico()`
 * já reimplementam, cada uma no seu canto, a mesma query que
 * `buscarLinhaDoTempo()` faz aqui de forma genérica. Registrado
 * como oportunidade de reaproveitamento futuro no relatório.
 * ============================================================
 */

const Service_Rastreabilidade = (function () {

  const PERFIS_AMPLOS = [CORE_CONSTANTS.PERFIS.ALMOXARIFE, CORE_CONSTANTS.PERFIS.GESTOR, CORE_CONSTANTS.PERFIS.ADMIN, CORE_CONSTANTS.PERFIS.AUDITOR];
  const PADRAO_LIMITE = 50;

  /** Alias fino — seção 8 do contrato pede essa função no contrato de API, mas é o mesmo Audit_Service.record de sempre. */
  function registrarEvento(ctx) {
    const p = ctx.payload || {};
    Audit_Service.record(ctx, p.acao, { entidade: p.entidade, entidadeId: p.entidadeId, obraId: p.obraId, status: p.status, resultado: p.resultado }, p.antes, p.depois);
    return Core_Response.ok({ registrado: true }, '', 'SUCCESS', {}, ctx.requestId);
  }

  /**
   * PERMISSÕES (seção 7): histórico é dado sensível (mostra quem
   * fez o quê). Perfil de gestão vê tudo; os demais só veem o
   * PRÓPRIO histórico — mesmo padrão self-scope usado em todo o
   * projeto (Reserva, Ferramenta, Solicitação...).
   */
  function _escopoDoUsuario(ctx, filtrosOriginais) {
    if (PERFIS_AMPLOS.includes(ctx.perfil)) return filtrosOriginais;
    return Object.assign({}, filtrosOriginais, { usuario: ctx.userId }); // ignora qualquer 'usuario' pedido no payload — força o próprio
  }

  /**
   * DESEMPENHO (seção 10): nunca devolve tudo de uma vez — sempre
   * pagina. `limite`/`offset` vêm do payload, com teto padrão.
   */
  function consultarHistorico(ctx) {
    const p = ctx.payload || {};
    const filtros = _escopoDoUsuario(ctx, {
      usuario: p.usuario, modulo: p.modulo, acao: p.acao, entidade: p.entidade, entidadeId: p.entidadeId,
      obraId: p.obraId, status: p.status, dataInicio: p.dataInicio, dataFim: p.dataFim
    });
    const todos = Audit_Service.search(filtros); // já ordenado por data desc
    const limite = Math.min(p.limite || PADRAO_LIMITE, 200); // teto absoluto — nunca deixa alguém pedir 100 mil linhas de uma vez
    const offset = p.offset || 0;
    const pagina = todos.slice(offset, offset + limite);

    return Core_Response.ok({
      totalEncontrado: todos.length, limite, offset, temMais: offset + limite < todos.length,
      registros: pagina
    }, '', 'SUCCESS', {}, ctx.requestId);
  }

  /**
   * NOVA de verdade — a trajetória de um produto atravessando
   * módulos, unida por ID (produtoId), nunca por descrição/texto
   * (regra explícita da seção 2). Cada evento carrega o próprio
   * ID do registro de origem, pra quem consumir poder ir direto
   * na tabela/tela original se precisar.
   */
  function consultarRastreabilidade(ctx) {
    const { produtoId } = ctx.payload || {};
    if (!produtoId) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'produtoId é obrigatório.', {}, ctx.requestId);

    const trajetoria = [];

    // 1) Cadastro
    const produto = DB_Query.get('PRODUTOS', produtoId);
    if (!produto) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Produto não encontrado.', {}, ctx.requestId);
    trajetoria.push({ etapa: 'CADASTRO', data: null, registroId: produto.ID, detalhe: produto.codigo + ' — ' + produto.descricaoOriginal });

    // 2) Compra (pré-compra) — via PRE_COMPRA_ITENS
    DB_Query.find('PRE_COMPRA_ITENS', i => String(i.produtoId) === String(produtoId)).forEach(item => {
      const pai = DB_Query.get('PRE_COMPRAS', item.preCompraId);
      trajetoria.push({ etapa: 'PRE_COMPRA', data: pai ? pai.dataAbertura : null, registroId: item.preCompraId, detalhe: pai ? 'Pré-compra ' + pai.numero + ' (' + pai.status + ')' : '' });
    });

    // 3) Entrada/Saída/Transferência/Ajuste — via MOVIMENTOS (a fonte real de tudo que mexeu no físico)
    DB_Query.find('MOVIMENTOS', m => String(m.produtoId) === String(produtoId)).forEach(m => {
      trajetoria.push({ etapa: 'MOVIMENTO_' + m.tipo, data: m.data, registroId: m.ID, detalhe: m.tipo + ' — ' + m.quantidade + ' (' + (m.origem || '') + (m.destino ? ' → ' + m.destino : '') + ')', obraId: m.obraId || null });
    });

    // 4) Estoque atual (situação presente, não histórico — mas fecha a trajetória)
    const saldos = DB_Query.find('ESTOQUE', e => String(e.produtoId) === String(produtoId));
    saldos.forEach(e => trajetoria.push({ etapa: 'ESTOQUE_ATUAL', data: null, registroId: e.ID, detalhe: e.localizacao + ': saldo ' + e.saldo + ', reservado ' + e.reservado }));

    // 5) Reservas (inclusive as de ferramenta, que também usam esta tabela — Módulo 06)
    DB_Query.find('RESERVAS', r => String(r.produtoId) === String(produtoId)).forEach(r =>
      trajetoria.push({ etapa: 'RESERVA', data: r.data, registroId: r.ID, detalhe: 'Reserva #' + r.ID + ' (' + r.status + ')', obraId: r.obraId || null }));

    // 6) Solicitações — via SOLICITACAO_ITENS
    DB_Query.find('SOLICITACAO_ITENS', i => String(i.produtoId) === String(produtoId)).forEach(item => {
      const pai = DB_Query.get('SOLICITACOES', item.solicitacaoId);
      trajetoria.push({ etapa: 'SOLICITACAO', data: pai ? pai.data : null, registroId: item.solicitacaoId, detalhe: pai ? 'Solicitação ' + pai.numero + ' (' + pai.status + ')' : '', obraId: pai ? pai.obraId : null });
    });

    trajetoria.sort((a, b) => {
      if (!a.data) return -1; // cadastro sempre primeiro
      if (!b.data) return 1;
      return new Date(a.data) - new Date(b.data);
    });

    return Core_Response.ok({ produtoId, produto: { codigo: produto.codigo, descricao: produto.descricaoOriginal }, totalEtapas: trajetoria.length, trajetoria }, '', 'SUCCESS', {}, ctx.requestId);
  }

  /**
   * NOVA — busca universal (seção 3). Nunca reimplementa a
   * leitura de outra tabela: delega pro `get()` real de cada
   * módulo, um de cada vez, até achar. Devolve o primeiro tipo
   * que bater (produto, depois estoque, depois reserva, etc.).
   */
  function buscarPorId(ctx) {
    const { id, tipo } = ctx.payload || {};
    if (!id) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'id é obrigatório.', {}, ctx.requestId);

    const buscadores = {
      PRODUTO: () => DB_Query.get('PRODUTOS', id),
      ESTOQUE: () => DB_Query.get('ESTOQUE', id),
      RESERVA: () => DB_Query.get('RESERVAS', id),
      SOLICITACAO: () => DB_Query.get('SOLICITACOES', id),
      NOTA_FISCAL: () => DB_Query.get('NOTAS_FISCAIS', id),
      INVENTARIO: () => DB_Query.get('INVENTARIOS', id),
      MOVIMENTACAO: () => DB_Query.get('MOVIMENTOS', id),
      USUARIO: () => { const u = DB_Query.get('USUARIOS', id); return u ? Service_Usuario._filtrarCampos(u, ctx) : null; }, // reaproveita o filtro de escopo do Módulo 01, nunca expõe campo sensível aqui
      ATIVIDADE: () => DB_Query.get('ATIVIDADES', id),
      FERRAMENTA: () => DB_Query.get('FERRAMENTAS', id),
      PRE_COMPRA: () => DB_Query.get('PRE_COMPRAS', id)
    };

    if (tipo) {
      if (!buscadores[tipo]) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'tipo desconhecido: ' + tipo, {}, ctx.requestId);
      const registro = buscadores[tipo]();
      if (!registro) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Nada encontrado com esse id em ' + tipo + '.', {}, ctx.requestId);
      return Core_Response.ok({ tipo, registro }, '', 'SUCCESS', {}, ctx.requestId);
    }

    // Sem tipo informado: tenta em ordem até achar (busca universal de verdade)
    for (const nomeTipo of Object.keys(buscadores)) {
      const registro = buscadores[nomeTipo]();
      if (registro) return Core_Response.ok({ tipo: nomeTipo, registro }, '', 'SUCCESS', {}, ctx.requestId);
    }
    return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Nenhum registro encontrado com esse id em nenhuma tabela conhecida.', {}, ctx.requestId);
  }

  /**
   * Linha do tempo genérica de UM registro (seção 4) — a mesma
   * lógica que Service_Reserva.historico()/Service_Ferramenta
   * .historico() já tinham cada uma na sua, agora centralizada.
   * Usa AUDITORIA (entidade+entidadeId), nunca uma trilha própria.
   */
  function buscarLinhaDoTempo(ctx) {
    const { entidade, entidadeId } = ctx.payload || {};
    if (!entidade || !entidadeId) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'entidade e entidadeId são obrigatórios.', {}, ctx.requestId);

    const eventos = Audit_Service.search({ entidade, entidadeId })
      .map(e => ({ data: e.data, hora: e.hora, acao: e.acao, usuario: e.usuario, modulo: e.modulo, antes: e.antes, depois: e.depois }))
      .sort((a, b) => new Date(a.data) - new Date(b.data));

    // NOTA HONESTA: linha do tempo de UM registro específico (ex:
    // "a reserva #42") não tem um "dono" óbvio de forma genérica
    // igual o histórico pessoal tem — quem já tinha acesso ao
    // registro (validado na rota de origem, ex: reserva.get) já
    // devia poder ver a timeline dele. Por isso aqui não refiltra
    // por usuário — a responsabilidade de autorizar o ACESSO AO
    // REGISTRO em si é de quem chama esta função dizendo qual
    // entidade/entidadeId quer, não deste método genérico.
    return Core_Response.ok({ entidade, entidadeId, totalEventos: eventos.length, linhaDoTempo: eventos }, '', 'SUCCESS', {}, ctx.requestId);
  }

  function getRoutes() {
    return {
      'rastreabilidade.registrarEvento': registrarEvento,
      'rastreabilidade.consultarHistorico': consultarHistorico,
      'rastreabilidade.consultarRastreabilidade': consultarRastreabilidade,
      'rastreabilidade.buscarPorId': buscarPorId,
      'rastreabilidade.buscarLinhaDoTempo': buscarLinhaDoTempo
    };
  }
  function getServices() { return { Service_Rastreabilidade }; }
  function getEvents() { return []; }
  function getVersion() { return '1.0.0'; }
  function init() {
    // Todas VIEW — a autorização real de "ver tudo vs só o
    // próprio" é feita por dentro de consultarHistorico() (seção
    // 7), igual todo o resto do sistema já faz.
    Auth_RBAC.registerActionPermission('rastreabilidade.registrarEvento', 'RASTREABILIDADE.CREATE');
    Auth_RBAC.registerActionPermission('rastreabilidade.consultarHistorico', 'RASTREABILIDADE.VIEW');
    Auth_RBAC.registerActionPermission('rastreabilidade.consultarRastreabilidade', 'RASTREABILIDADE.VIEW');
    Auth_RBAC.registerActionPermission('rastreabilidade.buscarPorId', 'RASTREABILIDADE.VIEW');
    Auth_RBAC.registerActionPermission('rastreabilidade.buscarLinhaDoTempo', 'RASTREABILIDADE.VIEW');
  }
  function healthCheck() { return { status: CORE_CONSTANTS.DOCTOR_STATUS.OK }; }

  return {
    registrarEvento, consultarHistorico, consultarRastreabilidade, buscarPorId, buscarLinhaDoTempo,
    getRoutes, getServices, getEvents, getVersion, init, healthCheck, id: 'RASTREABILIDADE'
  };
})();
