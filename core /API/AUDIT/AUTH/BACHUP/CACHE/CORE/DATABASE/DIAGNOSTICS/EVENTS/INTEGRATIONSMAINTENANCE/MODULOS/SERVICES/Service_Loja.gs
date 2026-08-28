/**
 * ============================================================
 * ALMOXA PRO — Service_Loja.gs
 * FASE 2 DO FRONT MOBILE — NOVO módulo de backend.
 *
 * Isolado de propósito: expõe SÓ o que a lojinha pública precisa
 * (config visual, categorias, catálogo com saldo agregado) sem
 * abrir as rotas internas de Estoque/Produto na íntegra pra
 * quem não está logado. Nenhuma dessas rotas devolve dado
 * sensível (reservado, bloqueado, localização física, custo).
 *
 * Todas as rotas aqui são PÚBLICAS (Core_Registry.registerPublicRoute
 * — ver init()) porque a spec do front exige que a pessoa navegue
 * a loja e monte o carrinho ANTES de precisar se identificar
 * (seção 1/72/73 do doc de telas).
 * ============================================================
 */

const Service_Loja = (function () {

  function config(ctx) {
    return Core_Response.ok({
      appName: Core_Config.get('APP_NAME'),
      bannerUrl: Core_Config.get('STORE_BANNER_URL'),
      welcomeTitle: Core_Config.get('STORE_WELCOME_TITLE'),
      welcomeSubtitle: Core_Config.get('STORE_WELCOME_SUBTITLE')
    }, '', 'SUCCESS', {}, ctx.requestId);
  }

  // ---- Categorias reais (nunca inventadas — seção 8 da spec) ----
  function categorias(ctx) {
    const produtos = DB_Query.find('PRODUTOS', p => p.status === 'ATIVO');
    const grupos = Utils_Array.groupBy(produtos, p => p.categoria || 'SEM CATEGORIA');

    const lista = Object.keys(grupos).map(nome => ({
      categoria: nome,
      totalItens: grupos[nome].length
    })).sort((a, b) => a.categoria.localeCompare(b.categoria));

    return Core_Response.ok(lista, '', 'SUCCESS', {}, ctx.requestId);
  }

  // ---- Catálogo: produto + saldo agregado (sem detalhe interno de localização) ----
  function catalogo(ctx) {
    const { categoria, busca, limite, offset } = ctx.payload || {};
    const buscaNorm = busca ? Utils_String.normalize(busca) : null;

    const produtos = DB_Query.find('PRODUTOS', p => {
      if (p.status !== 'ATIVO') return false;
      if (categoria && p.categoria !== categoria) return false;
      if (buscaNorm) {
        const alvo = Utils_String.normalize(p.descricaoOriginal + ' ' + (p.codigo || ''));
        if (!alvo.includes(buscaNorm)) return false;
      }
      return true;
    });

    // Paginação preparada (seção 9 da revisão): se o Front não
    // mandar limite, devolve tudo — contrato atual (array puro)
    // continua idêntico. Quando o catálogo crescer e o Front
    // quiser paginar, é só mandar limite/offset — nada muda aqui.
    const inicio = Number(offset) || 0;
    const fim = limite ? inicio + Number(limite) : produtos.length;
    const pagina = produtos.slice(inicio, fim);

    const itens = pagina.map(p => {
      const saldos = DB_Query.find('ESTOQUE', e => String(e.produtoId) === String(p.ID));
      const disponivel = Utils_Array.sum(saldos, e => Math.max(0, Number(e.saldo || 0) - Number(e.reservado || 0) - Number(e.bloqueado || 0)));
      return {
        produtoId: p.ID,
        codigo: p.codigo,
        descricao: p.descricaoOriginal,
        categoria: p.categoria,
        unidade: p.unidade,
        imagemUrl: p.imagemUrl || '', // seção 7: front usa placeholder elegante quando vazio, nunca quebra o card
        estoqueDisponivel: disponivel,
        totalNaCategoria: produtos.length // permite o Front saber que ainda há mais itens, sem mudar o formato da resposta
        // Campo reservado pro futuro módulo de EPI/Fichas (não
        // implementado ainda nas 13 fases do backend): quando
        // existir, entra aqui algo como `bloqueadoParaUsuario` +
        // `motivoBloqueio`. Sem esse módulo, NENHUM produto é
        // marcado como bloqueado — não invento essa regra no Front.
      };
    });

    return Core_Response.ok(itens, '', 'SUCCESS', {}, ctx.requestId);
  }

  /**
   * FASE 2 (revisão) — seção 10/11: o Front nunca deve confiar
   * só no saldo que buscou uma vez. Esta rota revalida cada item
   * do carrinho contra o saldo REAL agora, antes de avançar pra
   * Identificação. Não é a validação final de fechamento (isso
   * é responsabilidade da Fase de Solicitações) — é uma
   * checagem honesta de "isso ainda existe e ainda está
   * disponível", pública como o resto da loja.
   */
  /**
   * FASE 6 — extraída pra ser reutilizável também por
   * Service_Solicitacao (não duplicar a mesma checagem de
   * estoque em dois lugares). Retorna o array cru, sem
   * envelopar em Core_Response — quem chama decide o formato.
   */
  function _validarItensContraEstoque(itens) {
    return itens.map(item => {
      const produto = DB_Query.get('PRODUTOS', item.produtoId);
      if (!produto || produto.status !== 'ATIVO') {
        return { produtoId: item.produtoId, valido: false, motivo: 'Este item não está mais disponível no catálogo.', disponivelAtual: 0 };
      }
      const saldos = DB_Query.find('ESTOQUE', e => String(e.produtoId) === String(produto.ID));
      const disponivel = Utils_Array.sum(saldos, e => Math.max(0, Number(e.saldo || 0) - Number(e.reservado || 0) - Number(e.bloqueado || 0)));

      if (disponivel < Number(item.quantidade)) {
        return {
          produtoId: item.produtoId, valido: false, disponivelAtual: disponivel,
          motivo: disponivel === 0 ? 'Item ficou indisponível.' : 'Só há ' + disponivel + ' disponível agora (você pediu ' + item.quantidade + ').'
        };
      }
      return { produtoId: item.produtoId, valido: true, disponivelAtual: disponivel, motivo: null };
    });
  }

  function validarCarrinho(ctx) {
    const itens = (ctx.payload && ctx.payload.itens) || [];
    if (!Array.isArray(itens) || !itens.length) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'Carrinho vazio.', {}, ctx.requestId);
    }

    const resultado = _validarItensContraEstoque(itens);

    return Core_Response.ok({
      todosValidos: resultado.every(r => r.valido),
      itens: resultado
    }, '', 'SUCCESS', {}, ctx.requestId);
  }

  // ---- Obras ativas, pro dropdown de cadastro (seção 12 do doc de telas) ----
  function obras(ctx) {
    const lista = DB_Query.find('OBRAS', o => o.status === 'ATIVA').map(o => ({ ID: o.ID, nome: o.nome }));
    return Core_Response.ok(lista, '', 'SUCCESS', {}, ctx.requestId);
  }

  /**
   * Autocadastro público (seção 12/16 do doc de telas — "Novo
   * Cadastro"). Diferente de `usuario.create` (que é
   * administrativo, exige ADMIN): aqui é a PESSOA se cadastrando
   * sozinha pela loja, então:
   *   - perfil é SEMPRE forçado pra OPERADOR — nunca escolhido
   *     pelo usuário (regra explícita da spec: "não permitir que
   *     o usuário escolha livremente um perfil administrativo");
   *   - retorna sessão já criada (mesmo formato de auth.login),
   *     pra pessoa não precisar logar de novo logo em seguida.
   */
  function cadastro(ctx) {
    const { nome, matricula, cargo, obraId, senha } = ctx.payload || {};
    try {
      DB_Validation.requireFields(ctx.payload || {}, ['nome', 'matricula', 'senha']);
    } catch (e) {
      return Core_Response.error(e.code || CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, e.message, {}, ctx.requestId);
    }
    if (String(senha).length < 4) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'Senha muito curta (mínimo 4 caracteres).', {}, ctx.requestId);
    }
    if (DB_Query.exists('USUARIOS', u => u.matricula === matricula)) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'Já existe um cadastro com essa matrícula.', {}, ctx.requestId);
    }
    if (obraId && !DB_Query.get('OBRAS', obraId)) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'Obra inválida.', {}, ctx.requestId);
    }

    const usuario = DB_Insert.insert('USUARIOS', {
      matricula: matricula, nome: nome, email: '', telefone: '',
      cargo: cargo || '', funcao: '',
      perfil: CORE_CONSTANTS.PERFIS.OPERADOR, // forçado — nunca vem do payload
      status: 'ATIVO', obraAtual: obraId || '', ambiente: '', permissoes: '',
      dataCadastro: new Date(), ultimoAcesso: new Date(), sessaoAtual: '',
      biometricId: '', faceCredentialId: '', statusBiometria: 'INATIVO',
      consentimentoBiometrico: false, dataConsentimento: '', dataAtualizacao: new Date(),
      senha_hash: Auth_Tokens.hash(senha), fotoUrl: ''
    });

    const session = Auth_Session.create({
      userId: usuario.ID, email: usuario.email, nome: usuario.nome,
      perfil: usuario.perfil, obraAtual: usuario.obraAtual
    });

    Audit_Service.record(ctx, 'AUTOCADASTRO_LOJA', { entidade: 'USUARIOS', entidadeId: usuario.ID });

    return Core_Response.ok(session, 'Cadastro realizado com sucesso.', 'SUCCESS', {}, ctx.requestId);
  }

  function getRoutes() {
    return {
      'loja.config': config,
      'loja.categorias': categorias,
      'loja.catalogo': catalogo,
      'loja.validarCarrinho': validarCarrinho,
      'loja.obras': obras,
      'loja.cadastro': cadastro
    };
  }
  function getServices() { return { Service_Loja }; }
  function getEvents() { return []; }
  function getVersion() { return '1.2.0'; }
  function init() {
    Core_Registry.registerPublicRoute('loja.config');
    Core_Registry.registerPublicRoute('loja.categorias');
    Core_Registry.registerPublicRoute('loja.catalogo');
    Core_Registry.registerPublicRoute('loja.validarCarrinho');
    Core_Registry.registerPublicRoute('loja.obras');
    Core_Registry.registerPublicRoute('loja.cadastro');
  }
  function healthCheck() { return { status: CORE_CONSTANTS.DOCTOR_STATUS.OK }; }

  return { config, categorias, catalogo, validarCarrinho, obras, cadastro, _validarItensContraEstoque, getRoutes, getServices, getEvents, getVersion, init, healthCheck, id: 'LOJA' };
})();
