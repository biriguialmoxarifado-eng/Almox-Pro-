/**
 * ============================================================
 * ALMOXA PRO — Core_ModuleManager.gs  (CAMADA 5)
 * Único ponto que sabe QUAIS módulos existem no sistema e os
 * inicializa em ordem de dependência. A lista ALL_MODULES é
 * preenchida em MODULES/_ModuleList.gs (gerado a partir do
 * mapa de módulos — ver documentação).
 * ============================================================
 */

const Core_ModuleManager = (function () {

  let _initialized = false;
  let _initReport = [];

  function _resolveOrder(modules) {
    // Ordenação topológica simples por dependências declaradas.
    const byId = {};
    modules.forEach(m => byId[m.id] = m);
    const visited = {};
    const order = [];

    function visit(m, trail) {
      if (visited[m.id]) return;
      if (trail.includes(m.id)) {
        throw new Error('Dependência circular detectada envolvendo o módulo ' + m.id);
      }
      (m.dependencies || []).forEach(depId => {
        const dep = byId[depId];
        if (dep) visit(dep, trail.concat(m.id));
      });
      visited[m.id] = true;
      order.push(m);
    }

    modules.forEach(m => visit(m, []));
    return order;
  }

  function initAll() {
    if (_initialized) return _initReport;

    const modules = (typeof ALL_MODULES !== 'undefined') ? ALL_MODULES : [];
    const ordered = _resolveOrder(modules);
    _initReport = [];

    ordered.forEach(descriptor => {
      const entry = { id: descriptor.id, name: descriptor.name, status: 'PENDING', error: null };
      try {
        Core_Registry.registerModule(descriptor);
        // BLOCO 03, seção 7 — evento real, nunca existia antes:
        // ninguém sabia "quando" um módulo tinha sido registrado
        // além de ler o relatório de boot manualmente.
        try { Event_Bus.emit(EVENT_TYPES.MODULE_REGISTERED, { moduleId: descriptor.id, version: descriptor.version }, {}); } catch (e0) {}

        if (typeof descriptor.init === 'function') {
          descriptor.init();
        }
        entry.status = descriptor.status || CORE_CONSTANTS.MODULE_STATUS.PENDING;
        try { Event_Bus.emit(EVENT_TYPES.MODULE_STARTED, { moduleId: descriptor.id, version: descriptor.version }, {}); } catch (e1) {}
      } catch (e) {
        // INTEGRAÇÃO 01 — bug corrigido: antes, uma falha aqui só
        // marcava o `entry` deste relatório local (`_initReport`),
        // que nada mais no sistema consultava. O `descriptor` real
        // — o mesmo objeto que `Core_Registry` guarda e que
        // `Core_Router` agora consulta antes de rodar qualquer rota
        // — continuava dizendo `status: ACTIVE` pra sempre. Mutar
        // o descriptor de verdade é o que faz "módulo indisponível"
        // funcionar de ponta a ponta, não só no relatório de boot.
        descriptor.status = CORE_CONSTANTS.MODULE_STATUS.ERROR;
        entry.status = CORE_CONSTANTS.MODULE_STATUS.ERROR;
        entry.error = e.message;
        // BLOCO 03, seção 7/8 — o Doutor consegue "identificar
        // módulo desconectado/erro de comunicação" de verdade
        // agora: o evento carrega módulo, erro e timestamp.
        try { Event_Bus.emit(EVENT_TYPES.MODULE_ERROR, { moduleId: descriptor.id, error: e.message, timestamp: new Date().toISOString() }, {}); } catch (e2) {}
      }
      _initReport.push(entry);
    });

    _initialized = true;
    return _initReport;
  }

  function getReport() { return _initReport; }

  function healthCheckAll() {
    const modules = Core_Registry.getAllModules();
    return modules.map(m => {
      let health = { status: CORE_CONSTANTS.DOCTOR_STATUS.NOT_CONFIGURED };
      try {
        if (typeof m.healthCheck === 'function') health = m.healthCheck();
      } catch (e) {
        health = { status: CORE_CONSTANTS.DOCTOR_STATUS.ERROR, error: e.message };
      }
      return Object.assign({ id: m.id, name: m.name, version: m.version }, health);
    });
  }

  return { initAll, getReport, healthCheckAll };
})();
