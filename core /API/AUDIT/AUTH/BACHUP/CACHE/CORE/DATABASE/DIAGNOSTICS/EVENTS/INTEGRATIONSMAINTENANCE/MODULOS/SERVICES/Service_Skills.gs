/**
 * ============================================================
 * ALMOXA PRO — Service_Skills.gs
 * MÓDULO 16 — CÉREBRO DE DADOS, BUSCA INTELIGENTE E SKILLS
 *
 * AUDITORIA CONFIRMOU (seção "não recriar módulo anterior"):
 * - "Cérebro de dados"/rastreabilidade (seção 1/5) → JÁ EXISTE:
 *   `Service_Rastreabilidade` (Módulo 10) une produto→pré-compra→
 *   movimentos→estoque→reservas→solicitações por ID real.
 * - "Busca inteligente" (seção 2) → JÁ EXISTE:
 *   `Service_CentralDados` (Módulo 11) já pesquisa cross-módulo.
 * - Segurança da IA (seção 4/7) → JÁ EXISTE: `Service_AIEngine`
 *   (Módulo 09) nunca grava dado de negócio, testado.
 * - Abstração de banco (seção 6) → JÁ EXISTE desde a Fase 1:
 *   `DB_Query`/`DB_Insert`/`DB_Core` — nenhum módulo de negócio
 *   acessa a planilha direto, todos passam por essa camada.
 *
 * O QUE GENUINAMENTE NÃO EXISTIA: a estrutura de "Skills" (seção
 * 3) — capacidades especializadas com VOCABULÁRIO E CONTEXTO
 * PRÓPRIOS que a IA consulta. Isso é o que este arquivo entrega.
 *
 * Skills NÃO são módulos novos (o próprio contrato diz isso) —
 * cada Skill é só uma função que SABE COMO perguntar pros módulos
 * que já existem, com o vocabulário certo. Nenhuma Skill acessa
 * tabela diretamente além de leitura pontual já auditada; a
 * maioria delega 100% pra Service_X.função() já testada.
 * ============================================================
 */

const Service_Skills = (function () {

  /**
   * Cada skill tem: `vocabulario` (palavras que a identificam —
   * usado por `identificarSkill`, roteador por palavra-chave,
   * NÃO NLP real, mesma honestidade já documentada no Módulo 09)
   * e `consultar(ctx, termo)` — sempre delega pra função real já
   * existente, nunca reimplementa cálculo.
   */
  const SKILLS = {

    ESTOQUE: {
      vocabulario: ['estoque', 'saldo', 'disponivel', 'reservado', 'minimo', 'maximo', 'localizacao', 'onde esta', 'quanto temos'],
      contexto: 'estoque atual, reservado, disponível, mínimo, máximo, localização, movimentações, entradas, saídas, pedidos, inventário',
      consultar: (ctx, termo) => Service_Estoque.buscar(Object.assign({}, ctx, { payload: { busca: termo } }))
    },

    INVENTARIO: {
      vocabulario: ['inventario', 'contagem', 'divergencia de inventario'],
      contexto: 'planejamento, contagem, divergência, aprovação, relatório de inventário',
      consultar: (ctx, termo) => Service_Inventario.listar(Object.assign({}, ctx, { payload: {} }))
    },

    RESERVA: {
      vocabulario: ['reserva', 'reservado para', 'quem retirou', 'retirada'],
      contexto: 'criador, itens, quantidade solicitada, aprovada, retirada, restante, aprovação, situação, centro de custo, projeto, histórico',
      consultar: (ctx, termo) => {
        const r = Service_Reserva.calendar(ctx);
        if (r.success && termo) r.data = r.data.filter(row => Utils_String.normalize(JSON.stringify(row)).includes(Utils_String.normalize(termo)));
        return r;
      }
    },

    ENTRADA: {
      vocabulario: ['entrada', 'entrou', 'quanto entrou', 'recebimento'],
      contexto: 'entradas de estoque por produto/localização/período',
      consultar: (ctx, termo) => {
        const produto = termo ? DB_Query.findOne('PRODUTOS', p => Utils_String.normalize(p.descricaoOriginal).includes(Utils_String.normalize(termo)) || p.codigo === termo) : null;
        const filtro = produto
          ? (m => m.tipo === 'ENTRADA' && String(m.produtoId) === String(produto.ID))
          : (m => m.tipo === 'ENTRADA');
        return Core_Response.ok(DB_Query.find('MOVIMENTOS', filtro).slice(-50), '', 'SUCCESS', {}, ctx.requestId); // teto de 50 — nunca carrega tudo (seção 8 do contrato)
      }
    },

    SAIDA: {
      vocabulario: ['saida', 'saiu', 'retirado do estoque', 'quem retirou esse material'],
      contexto: 'saídas de estoque por produto/localização/período, responsável',
      consultar: (ctx, termo) => {
        const produto = termo ? DB_Query.findOne('PRODUTOS', p => Utils_String.normalize(p.descricaoOriginal).includes(Utils_String.normalize(termo)) || p.codigo === termo) : null;
        const filtro = produto
          ? (m => m.tipo === 'SAIDA' && String(m.produtoId) === String(produto.ID))
          : (m => m.tipo === 'SAIDA');
        return Core_Response.ok(DB_Query.find('MOVIMENTOS', filtro).slice(-50), '', 'SUCCESS', {}, ctx.requestId);
      }
    },

    NOTA_FISCAL: {
      vocabulario: ['nota fiscal', 'nota ', 'nf ', 'fornecedor'],
      contexto: 'número, fornecedor, valor, status, itens, divergência',
      consultar: (ctx, termo) => Service_NF.search(Object.assign({}, ctx, { payload: { numero: termo } }))
    },

    PROJETOS: {
      vocabulario: ['projeto', 'obra', 'atividade'],
      contexto: 'atividades e obras vinculadas a movimentações/reservas',
      // HONESTO: não existe um módulo formal de "Projetos" com
      // cadastro próprio no sistema hoje — o que existe é o campo
      // `obraId`/`atividadeId` em várias tabelas (Reserva, NF,
      // Movimentos). A skill devolve isso, não inventa um módulo.
      consultar: (ctx, termo) => Core_Response.ok(
        DB_Query.find('ATIVIDADES', a => !termo || Utils_String.normalize(a.nome || '').includes(Utils_String.normalize(termo))),
        'Não existe módulo de Projetos dedicado ainda — mostrando Atividades, a entidade mais próxima hoje.', 'SUCCESS', {}, ctx.requestId
      )
    },

    COMPRAS: {
      vocabulario: ['compra', 'pre-compra', 'precompra', 'fornecedor sugerido', 'preco'],
      contexto: 'status, itens, fornecedor sugerido, preço de referência',
      consultar: (ctx, termo) => {
        const r = Service_PreCompra.listar(Object.assign({}, ctx, { payload: {} }));
        if (r.success && termo) r.data = r.data.filter(pc => Utils_String.normalize(pc.numero + ' ' + (pc.justificativa || '')).includes(Utils_String.normalize(termo)));
        return r;
      }
    },

    APROVACAO: {
      vocabulario: ['aprovacao', 'aprovar', 'pendente de aprovacao', 'aguardando aprovacao'],
      contexto: 'itens aguardando decisão em Solicitação/Reserva/Pré-Compra/Inventário',
      consultar: (ctx) => Service_AIEngine.alertasInteligentes(ctx) // reaproveita — já agrega aprovações pendentes de 3 módulos
    },

    AUDITORIA: {
      vocabulario: ['auditoria', 'quem fez', 'quem alterou', 'log de'],
      contexto: 'usuário, ação, módulo, data, estado antes/depois',
      consultar: (ctx, termo) => Service_Rastreabilidade.consultarHistorico(Object.assign({}, ctx, { payload: { modulo: termo, limite: 20 } }))
    },

    DIAGNOSTICO: {
      vocabulario: ['diagnostico', 'saude do sistema', 'sistema esta bem', 'doutor'],
      contexto: 'saúde de módulos, permissões, backup, banco',
      consultar: (ctx) => {
        if (ctx.perfil !== CORE_CONSTANTS.PERFIS.ADMIN) {
          return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.PERMISSION_DENIED, 'Diagnóstico do sistema é restrito a ADMIN.', {}, ctx.requestId);
        }
        return Core_Response.ok(Doctor_Modules.check(), '', 'SUCCESS', {}, ctx.requestId);
      }
    },

    RASTREABILIDADE: {
      vocabulario: ['de onde veio', 'trajetoria', 'rastrear', 'origem desse item'],
      contexto: 'trajetória completa de um produto: cadastro → compra → movimentos → estoque → reserva',
      consultar: (ctx, termo) => {
        const produto = termo ? DB_Query.findOne('PRODUTOS', p => Utils_String.normalize(p.descricaoOriginal).includes(Utils_String.normalize(termo)) || p.codigo === termo) : null;
        if (!produto) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Não identifiquei o produto pra rastrear.', {}, ctx.requestId);
        return Service_Rastreabilidade.consultarRastreabilidade(Object.assign({}, ctx, { payload: { produtoId: produto.ID } }));
      }
    }
  };

  /** Roteador por palavra-chave — MESMA honestidade do Módulo 09: não é NLP, é vocabulário conhecido. */
  function identificarSkill(pergunta) {
    const norm = Utils_String.normalize(pergunta || '');
    for (const nomeSkill of Object.keys(SKILLS)) {
      if (SKILLS[nomeSkill].vocabulario.some(palavra => norm.includes(Utils_String.normalize(palavra)))) {
        return nomeSkill;
      }
    }
    return null;
  }

  /**
   * ITEM 4 do contrato ("IA não possui autoridade automática") —
   * `consultar()` é SOMENTE LEITURA por construção: toda entrada
   * em `SKILLS` chama uma função `get`/`search`/`buscar`/`listar`/
   * `calendar` já existente — nenhuma delega pra `create`/
   * `approve`/`aprovar`/`baixar`/`delete`. Auditável lendo este
   * arquivo: procure por `DB_Insert`/`DB_Update`/`DB_Delete` —
   * não existe nenhuma chamada dessas aqui.
   */
  function consultar(ctx) {
    const p = ctx.payload || {};
    const nomeSkill = p.skill && SKILLS[p.skill] ? p.skill : identificarSkill(p.pergunta);
    if (!nomeSkill) {
      return Core_Response.ok({
        skillIdentificada: null,
        skillsDisponiveis: Object.keys(SKILLS),
        mensagem: 'Não identifiquei uma skill pra essa pergunta. Skills disponíveis: ' + Object.keys(SKILLS).join(', ') + '.'
      }, '', 'SUCCESS', {}, ctx.requestId);
    }

    let resultado;
    try {
      resultado = SKILLS[nomeSkill].consultar(ctx, p.termo || p.pergunta);
    } catch (e) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.INTERNAL_ERROR, 'Falha ao consultar a skill ' + nomeSkill + ': ' + e.message, {}, ctx.requestId);
    }
    if (!resultado.success) return resultado;

    return Core_Response.ok({
      skillIdentificada: nomeSkill, contexto: SKILLS[nomeSkill].contexto, resultado: resultado.data
    }, '', 'SUCCESS', {}, ctx.requestId);
  }

  function listarSkills(ctx) {
    return Core_Response.ok(Object.keys(SKILLS).map(nome => ({ nome, vocabulario: SKILLS[nome].vocabulario, contexto: SKILLS[nome].contexto })), '', 'SUCCESS', {}, ctx.requestId);
  }

  /**
   * MÓDULO 15 (contrato "IA do ALMOXA PRO"), seção 4 — códigos
   * classificadores internos (PEP-HID, PEP-MAN, etc.). NENHUM
   * módulo ainda popula `MOVIMENTOS.classificadorPEP` — o campo
   * existe (aditivo, Módulo 15) mas está vazio em todo o
   * histórico existente. Por isso esta função é HONESTA: analisa
   * o que houver, e se não houver nada classificado, diz isso
   * explicitamente em vez de inventar uma distribuição.
   *
   * NUNCA trata isso como PEP financeiro do SAP (regra explícita
   * do contrato) — é só um rótulo interno de finalidade.
   */
  function analisarClassificadoresPEP(ctx) {
    const p = ctx.payload || {};
    const desde = p.dataInicio ? new Date(p.dataInicio) : new Date(Date.now() - 90 * 86400000);
    const movimentos = DB_Query.find('MOVIMENTOS', m => new Date(m.data) >= desde);
    const classificados = movimentos.filter(m => m.classificadorPEP);

    if (!classificados.length) {
      return Core_Response.ok({
        totalMovimentosNoPeriodo: movimentos.length, totalClassificados: 0, porClassificador: {},
        aviso: 'Nenhuma movimentação no período tem classificador PEP preenchido — o campo existe no schema, mas nenhum módulo o popula ainda. Isto não é um erro, é o estado real dos dados.'
      }, '', 'SUCCESS', {}, ctx.requestId);
    }

    const porClassificador = {};
    classificados.forEach(m => {
      porClassificador[m.classificadorPEP] = porClassificador[m.classificadorPEP] || { total: 0, quantidadeTotal: 0 };
      porClassificador[m.classificadorPEP].total++;
      porClassificador[m.classificadorPEP].quantidadeTotal += Number(m.quantidade || 0);
    });

    return Core_Response.ok({ totalMovimentosNoPeriodo: movimentos.length, totalClassificados: classificados.length, porClassificador }, '', 'SUCCESS', {}, ctx.requestId);
  }

  /**
   * MÓDULO 15, seção 9 — "QR da prateleira → localização → itens
   * → estoque → reservas → movimentações → inventário →
   * histórico". Reaproveita `Service_Etiqueta`'s formato real de
   * QR (`TIPO:referenciaId`) e delega pro dispatcher que já existe
   * de cada tipo — não reimplementa nenhuma consulta.
   */
  function consultarPorQRCode(ctx) {
    const { conteudoQR } = ctx.payload || {};
    if (!conteudoQR || conteudoQR.indexOf(':') === -1) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'conteudoQR inválido — formato esperado TIPO:referenciaId.', {}, ctx.requestId);
    }
    const [tipo, referenciaId] = conteudoQR.split(':');

    if (tipo === 'PRODUTO') {
      return Service_Rastreabilidade.consultarRastreabilidade(Object.assign({}, ctx, { payload: { produtoId: referenciaId } }));
    }
    if (tipo === 'FERRAMENTA') {
      return Service_Ferramenta.historico(Object.assign({}, ctx, { payload: { id: referenciaId } }));
    }
    if (tipo === 'LOCALIZACAO' || tipo === 'PRATELEIRA') {
      return Service_Estoque.buscar(Object.assign({}, ctx, { payload: { busca: referenciaId } }));
    }
    // BLOCO 08 (Etiquetas/QR Code) — tipo que faltava: QR de
    // inventário levando pro relatório real daquele inventário
    // (itens/divergência), reaproveitando o Módulo 04.
    if (tipo === 'INVENTARIO') {
      return Service_Inventario.relatorio(Object.assign({}, ctx, { payload: { id: referenciaId } }));
    }
    return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR,
      'QR do tipo "' + tipo + '" ainda não tem navegação de contexto definida — disponível hoje pra PRODUTO, FERRAMENTA, LOCALIZACAO/PRATELEIRA e INVENTARIO.', {}, ctx.requestId);
  }

  function getRoutes() {
    return { 'skills.consultar': consultar, 'skills.listar': listarSkills, 'skills.analisarClassificadoresPEP': analisarClassificadoresPEP, 'skills.consultarPorQRCode': consultarPorQRCode };
  }
  function getServices() { return { Service_Skills }; }
  function getEvents() { return []; }
  function getVersion() { return '1.1.0'; }
  function init() {
    Auth_RBAC.registerActionPermission('skills.consultar', 'SKILLS.VIEW');
    Auth_RBAC.registerActionPermission('skills.listar', 'SKILLS.VIEW');
    Auth_RBAC.registerActionPermission('skills.analisarClassificadoresPEP', 'SKILLS.VIEW');
    Auth_RBAC.registerActionPermission('skills.consultarPorQRCode', 'SKILLS.VIEW');
  }
  function healthCheck() { return { status: CORE_CONSTANTS.DOCTOR_STATUS.OK }; }

  return {
    consultar, listarSkills, identificarSkill, analisarClassificadoresPEP, consultarPorQRCode,
    getRoutes, getServices, getEvents, getVersion, init, healthCheck, id: 'SKILLS'
  };
})();
