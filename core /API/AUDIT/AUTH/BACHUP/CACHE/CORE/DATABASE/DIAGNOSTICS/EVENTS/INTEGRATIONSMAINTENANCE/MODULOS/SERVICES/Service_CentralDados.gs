/**
 * ============================================================
 * ALMOXA PRO — Service_CentralDados.gs
 * MÓDULO 11 — CENTRAL DE DADOS E CONSULTA
 *
 * AUDITORIA CONFIRMOU: quase todo módulo já tem sua própria
 * função de busca real e testada (Service_Produto.search,
 * Service_Fornecedor.search, Service_Estoque.buscar,
 * Service_Ferramenta.search, Service_NF.search, Service_Usuario
 * .search, Service_Solicitacao.list, Service_Reserva.calendar,
 * Service_PreCompra.listar, Service_Inventario.listar). Este
 * módulo NÃO reimplementa nenhuma dessas — é um REGISTRO que
 * delega pra cada uma. Isso é o que garante a seção 4 (permissão)
 * de graça: cada função real já valida escopo/permissão por
 * dentro (ex: Service_Usuario.search já filtra campo
 * administrativo pra quem não é dono nem ADMIN desde o Módulo 01)
 * — a Central de Dados herda essa autorização automaticamente,
 * nunca decide sozinha o que é visível.
 *
 * `buscarPorId()` e parte de `buscarRelacionados()` reaproveitam
 * literalmente `Service_Rastreabilidade` (Módulo 10) — nenhuma
 * duplicação da mesma lógica de dispatch por ID.
 * ============================================================
 */

const Service_CentralDados = (function () {

  const PADRAO_LIMITE = 20;

  /** Filtro genérico de texto — usado só como complemento pros módulos cuja função real não aceita busca livre (ex: Reserva/PréCompra/Inventário são filtrados por status/obra na origem, texto livre é aplicado por cima). */
  function _filtrarPorTextoLivre(registros, texto, camposTexto) {
    if (!texto) return registros;
    const alvo = Utils_String.normalize(texto);
    return registros.filter(row => {
      const campos = camposTexto && camposTexto.length ? camposTexto.map(c => row[c]) : Object.values(row);
      return campos.some(v => v !== null && v !== undefined && Utils_String.normalize(String(v)).includes(alvo));
    });
  }

  /**
   * Cada entrada traduz os filtros GENÉRICOS da Central (texto,
   * código, período, obra, status, categoria) pros parâmetros
   * REAIS que a função de origem já espera — nunca inventa um
   * campo que o módulo de origem não tem.
   */
  const REGISTRO_MODULOS = {
    PRODUTO: {
      buscar: (ctx, f) => Service_Produto.search(Object.assign({}, ctx, { payload: { codigo: f.codigo, descricao: f.texto, status: f.status } }))
    },
    FORNECEDOR: {
      buscar: (ctx, f) => Service_Fornecedor.search(Object.assign({}, ctx, { payload: { razaoSocial: f.texto, status: f.status } }))
    },
    ESTOQUE: {
      buscar: (ctx, f) => Service_Estoque.buscar(Object.assign({}, ctx, { payload: { busca: f.texto } }))
    },
    FERRAMENTA: {
      buscar: (ctx, f) => Service_Ferramenta.search(Object.assign({}, ctx, { payload: { busca: f.texto, categoria: f.categoria, estado: f.status } }))
    },
    NOTA_FISCAL: {
      buscar: (ctx, f) => Service_NF.search(Object.assign({}, ctx, { payload: { numero: f.codigo || f.texto, status: f.status } }))
    },
    USUARIO: {
      buscar: (ctx, f) => Service_Usuario.search(Object.assign({}, ctx, { payload: { query: f.texto } }))
    },
    SOLICITACAO: {
      buscar: (ctx, f) => {
        const r = Service_Solicitacao.list(Object.assign({}, ctx, { payload: { status: f.status } }));
        if (r.success) r.data = _filtrarPorTextoLivre(r.data, f.texto, ['numero']);
        return r;
      }
    },
    RESERVA: {
      buscar: (ctx, f) => {
        const r = Service_Reserva.calendar(Object.assign({}, ctx, { payload: { obraId: f.obra, dataInicio: f.periodoInicio, dataFim: f.periodoFim } }));
        if (r.success) r.data = _filtrarPorTextoLivre(r.data, f.texto, []);
        return r;
      }
    },
    PRE_COMPRA: {
      buscar: (ctx, f) => {
        const r = Service_PreCompra.listar(Object.assign({}, ctx, { payload: { status: f.status } }));
        if (r.success) r.data = _filtrarPorTextoLivre(r.data, f.texto, ['numero', 'justificativa']);
        return r;
      }
    },
    INVENTARIO: {
      buscar: (ctx, f) => {
        const r = Service_Inventario.listar(Object.assign({}, ctx, { payload: { estado: f.status, obraId: f.obra } }));
        if (r.success) r.data = _filtrarPorTextoLivre(r.data, f.texto, ['token']);
        return r;
      }
    }
  };

  /** PROTEÇÃO (seção 5): nunca deixa vazar objeto de erro técnico bruto — sempre uma mensagem curta e o nome do módulo. */
  function _chamarComSeguranca(chave, ctx, filtros) {
    try {
      const resultado = REGISTRO_MODULOS[chave].buscar(ctx, filtros);
      if (!resultado.success) return { modulo: chave, erro: resultado.message || 'Não foi possível consultar.', registros: [] };
      return { modulo: chave, erro: null, registros: resultado.data || [] };
    } catch (e) {
      // ITEM 15 do contrato: erro de UMA fonte não derruba as outras.
      return { modulo: chave, erro: 'Falha ao consultar esta fonte.', registros: [] };
    }
  }

  function _paginar(lista, limite, offset) {
    const lim = Math.min(limite || PADRAO_LIMITE, 100); // teto — nunca devolve volume descontrolado (seção 14)
    const off = offset || 0;
    return { pagina: lista.slice(off, off + lim), totalEncontrado: lista.length, limite: lim, offset: off, temMais: off + lim < lista.length };
  }

  /** PESQUISA GLOBAL (seção 1) — cross-módulo, com cache curto reaproveitando Cache_Core (seção 10 — nenhum cache paralelo). */
  function pesquisar(ctx) {
    const p = ctx.payload || {};
    if (!p.termo) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'termo é obrigatório.', {}, ctx.requestId);

    const chaves = Array.isArray(p.modulos) && p.modulos.length ? p.modulos.filter(m => REGISTRO_MODULOS[m]) : Object.keys(REGISTRO_MODULOS);
    const cacheKey = 'CENTRAL_DADOS_' + ctx.userId + '_' + Utils_String.normalize(p.termo) + '_' + chaves.join(',');

    let achatado;
    try {
      const cacheado = Cache_Core.get(cacheKey);
      achatado = cacheado ? JSON.parse(cacheado) : null;
    } catch (e) { achatado = null; }

    if (!achatado) {
      const fontesComErro = [];
      achatado = [];
      chaves.forEach(chave => {
        const resultado = _chamarComSeguranca(chave, ctx, { texto: p.termo });
        if (resultado.erro) fontesComErro.push({ modulo: chave, erro: resultado.erro });
        resultado.registros.forEach(registro => achatado.push({ modulo: chave, registro }));
      });
      achatado._fontesComErro = fontesComErro; // anexado só na memória, não vai pro cache serializado
      try { Cache_Core.set(cacheKey, JSON.stringify(achatado), 30); } catch (e) { /* cache indisponível não impede a busca */ }
    }

    const paginado = _paginar(achatado, p.limite, p.offset);
    return Core_Response.ok(Object.assign({ fontesConsultadas: chaves, fontesComErro: achatado._fontesComErro || [] }, paginado, { registros: paginado.pagina }), '', 'SUCCESS', {}, ctx.requestId);
  }

  /** PESQUISA POR MÓDULO (seção 2) — mesmo motor de filtrar(), só exige o módulo explícito. */
  function buscarPorModulo(ctx) {
    const p = ctx.payload || {};
    if (!p.modulo) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'modulo é obrigatório.', {}, ctx.requestId);
    return filtrar(ctx);
  }

  /** FILTROS (seção 7) — motor único; buscarPorModulo() só repassa pra cá. */
  function filtrar(ctx) {
    const p = ctx.payload || {};
    if (!p.modulo || !REGISTRO_MODULOS[p.modulo]) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'modulo inválido. Use um de: ' + Object.keys(REGISTRO_MODULOS).join(', '), {}, ctx.requestId);
    }
    const resultado = _chamarComSeguranca(p.modulo, ctx, {
      texto: p.texto, codigo: p.codigo, status: p.status, categoria: p.categoria,
      obra: p.obra, periodoInicio: p.periodoInicio, periodoFim: p.periodoFim
    });
    if (resultado.erro) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.INTERNAL_ERROR, resultado.erro, {}, ctx.requestId);

    const paginado = _paginar(resultado.registros, p.limite, p.offset);
    return Core_Response.ok(Object.assign({ modulo: p.modulo }, paginado, { registros: paginado.pagina }), '', 'SUCCESS', {}, ctx.requestId);
  }

  /** BUSCA POR ID (seção 8) — reaproveita o Módulo 10, não duplica o dispatcher por ID. */
  function buscarPorId(ctx) {
    return Service_Rastreabilidade.buscarPorId(ctx);
  }

  /**
   * BUSCA RELACIONADA (seção 9) — pra PRODUTO, reaproveita
   * integralmente `consultarRastreabilidade` do Módulo 10 (é
   * literalmente a mesma necessidade: "produto → estoque →
   * movimentações → reservas → compras"). Pra FERRAMENTA,
   * reaproveita `Service_Ferramenta.historico`. Pros demais tipos,
   * ainda não existe uma composição pronta — devolve isso de
   * forma honesta, não inventa relação que não foi construída.
   */
  function buscarRelacionados(ctx) {
    const { tipo, id } = ctx.payload || {};
    if (!tipo || !id) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'tipo e id são obrigatórios.', {}, ctx.requestId);

    if (tipo === 'PRODUTO') {
      return Service_Rastreabilidade.consultarRastreabilidade(Object.assign({}, ctx, { payload: { produtoId: id } }));
    }
    if (tipo === 'FERRAMENTA') {
      return Service_Ferramenta.historico(Object.assign({}, ctx, { payload: { id } }));
    }
    return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR,
      'Busca relacionada ainda não está definida pra "' + tipo + '" — disponível hoje pra PRODUTO e FERRAMENTA.', {}, ctx.requestId);
  }

  function getRoutes() {
    return {
      'centraldados.pesquisar': pesquisar,
      'centraldados.buscarPorModulo': buscarPorModulo,
      'centraldados.filtrar': filtrar,
      'centraldados.buscarPorId': buscarPorId,
      'centraldados.buscarRelacionados': buscarRelacionados
    };
  }
  function getServices() { return { Service_CentralDados }; }
  function getEvents() { return []; }
  function getVersion() { return '1.0.0'; }
  function init() {
    // Todas VIEW — a autorização real vive dentro de cada função
    // de origem reaproveitada (Service_Produto.search,
    // Service_Usuario.search, etc.), nunca reimplementada aqui.
    Auth_RBAC.registerActionPermission('centraldados.pesquisar', 'CENTRALDADOS.VIEW');
    Auth_RBAC.registerActionPermission('centraldados.buscarPorModulo', 'CENTRALDADOS.VIEW');
    Auth_RBAC.registerActionPermission('centraldados.filtrar', 'CENTRALDADOS.VIEW');
    Auth_RBAC.registerActionPermission('centraldados.buscarPorId', 'CENTRALDADOS.VIEW');
    Auth_RBAC.registerActionPermission('centraldados.buscarRelacionados', 'CENTRALDADOS.VIEW');
  }
  function healthCheck() { return { status: CORE_CONSTANTS.DOCTOR_STATUS.OK }; }

  return {
    pesquisar, buscarPorModulo, filtrar, buscarPorId, buscarRelacionados,
    getRoutes, getServices, getEvents, getVersion, init, healthCheck, id: 'CENTRAL_DADOS'
  };
})();
