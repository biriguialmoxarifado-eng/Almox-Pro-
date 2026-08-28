/**
 * ============================================================
 * ALMOXA PRO — Maintenance_Core.gs   (/MAINTENANCE — NOVO)
 * ============================================================
 * Módulo pedido fora da spec original: uma ferramenta LOCAL de
 * sandbox onde você registra "experimentos" (ideias novas,
 * protótipos de função, testes de integração) e roda cada um
 * contra o Core/DB REAIS — sem que o experimento vire rota
 * pública nem apareça no frontend, e sem sujar dados de
 * produção por padrão.
 *
 * Uso pretendido:
 *   1. Você escreve uma função de teste (ex: "será que dá pra
 *      calcular a curva ABC assim?") direto num arquivo novo em
 *      /MAINTENANCE ou cola temporariamente aqui.
 *   2. Registra com Maintenance_Core.registerExperiment(...)
 *   3. Roda via Maintenance_Core.runExperiment(id) pelo editor
 *      do Apps Script OU pela rota manutencao.runExperiment
 *      (só ADMIN acessa — ver Auth_RBAC).
 *   4. O resultado, sucesso/erro e tempo de execução ficam
 *      registrados em EXPERIMENTOS_LOG — nada é aplicado ao
 *      banco de produção a menos que o próprio experimento
 *      grave (por isso todo experimento roda com
 *      DRY_RUN=true por padrão — ver runExperiment).
 *
 * Quando um experimento amadurece, ele "sobe de nível": vira um
 * módulo de verdade em /MODULES, com Service/API próprios — o
 * Maintenance nunca deve ser o lugar definitivo de uma feature.
 * ============================================================
 */

const Maintenance_Core = (function () {

  const MODULE_ID = 'MANUTENCAO';

  // Registro em memória (por execução) dos experimentos
  // disponíveis. Cada experimento é { id, nome, descricao, run(context) }.
  const _experiments = {};

  function registerExperiment(id, nome, descricao, runFn) {
    if (typeof runFn !== 'function') {
      throw new Error('Maintenance_Core.registerExperiment: "run" deve ser uma função.');
    }
    _experiments[id] = { id, nome, descricao, run: runFn };
  }

  function listExperiments() {
    return Object.values(_experiments).map(e => Utils_Object.omit(e, ['run']));
  }

  /**
   * Roda um experimento já registrado.
   * dryRun=true (padrão): o experimento roda, mas qualquer
   * chamada de escrita que ele faça ao DB_Insert/DB_Update deve
   * ser condicionada pelo próprio código do experimento a
   * checar `context.dryRun` — o Maintenance não intercepta
   * automaticamente escritas (isso exigiria um proxy no DB
   * Layer, fora do escopo desta fase; deixado documentado como
   * limitação conhecida em vez de fingir isolamento total).
   */
  function runExperiment(id, options) {
    const experiment = _experiments[id];
    if (!experiment) {
      throw Object.assign(new Error('Experimento não encontrado: ' + id), {
        code: CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND
      });
    }

    const dryRun = !options || options.dryRun !== false; // default true
    const context = {
      dryRun: dryRun,
      config: Core_Config.getAll(),
      log: (msg) => console.log('[Maintenance:' + id + '] ' + msg)
    };

    const startedAt = new Date();
    let resultado = null, status = 'SUCESSO', erro = null;

    try {
      resultado = experiment.run(context);
    } catch (e) {
      status = 'ERRO';
      erro = e.message;
    }

    const registro = {
      experimentoId: id,
      nome: experiment.nome,
      dryRun: dryRun,
      status: status,
      erro: erro || '',
      resultadoJson: Utils_JSON.safeStringify(resultado),
      duracaoMs: new Date() - startedAt,
      data: new Date()
    };

    try { DB_Insert.insert('EXPERIMENTOS_LOG', registro); } catch (e) { /* tabela pode não existir ainda */ }

    return registro;
  }

  function deleteExperiment(id) { delete _experiments[id]; }

  // ---- Rotas expostas (só ADMIN, ver Auth_RBAC) ----
  function routeList(ctx) { return Core_Response.ok(listExperiments(), '', 'SUCCESS', {}, ctx.requestId); }
  function routeRun(ctx) {
    const { id, dryRun } = ctx.payload || {};
    const registro = runExperiment(id, { dryRun: dryRun !== false });
    return Core_Response.ok(registro, '', 'SUCCESS', {}, ctx.requestId);
  }
  function routeStatus(ctx) {
    return Core_Response.ok({
      totalExperimentosRegistrados: Object.keys(_experiments).length,
      ambiente: Core_Config.get('ENVIRONMENT')
    }, '', 'SUCCESS', {}, ctx.requestId);
  }

  function getRoutes() {
    return {
      'manutencao.listExperiments': routeList,
      'manutencao.runExperiment': routeRun,
      'manutencao.status': routeStatus
    };
  }
  function getServices() { return { Maintenance_Core, Maintenance_Sandbox }; }
  function getEvents() { return []; }
  function getVersion() { return '1.0.0'; }
  function init() {
    Maintenance_Sandbox.registerBuiltInExamples();
    // Ferramenta sensível: só ADMIN acessa, mesmo que outro
    // perfil tenha permissão genérica de VIEW/CREATE.
    Auth_RBAC.registerActionPermission('manutencao.listExperiments', 'MANUTENCAO.ADMIN');
    Auth_RBAC.registerActionPermission('manutencao.runExperiment', 'MANUTENCAO.ADMIN');
    Auth_RBAC.registerActionPermission('manutencao.status', 'MANUTENCAO.ADMIN');
  }
  function healthCheck() { return { status: CORE_CONSTANTS.DOCTOR_STATUS.OK, experimentos: Object.keys(_experiments).length }; }

  return {
    registerExperiment, listExperiments, runExperiment, deleteExperiment,
    getRoutes, getServices, getEvents, getVersion, init, healthCheck, id: MODULE_ID
  };
})();
