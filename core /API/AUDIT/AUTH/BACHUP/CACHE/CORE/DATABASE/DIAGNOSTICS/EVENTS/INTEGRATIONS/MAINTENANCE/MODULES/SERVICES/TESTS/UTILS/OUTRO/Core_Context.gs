/**
 * ============================================================
 * ALMOXA PRO — Core_Context.gs  (CAMADA 5)
 * Constrói o "contexto" de cada requisição — usado por Router,
 * Services, Audit e Observabilidade. Nenhum módulo deve montar
 * seu próprio objeto de contexto.
 * ============================================================
 */

const Core_Context = (function () {

  function build(request) {
    const requestId = (request && request.requestId) || Utilities.getUuid();
    const correlationId = (request && request.metadata && request.metadata.correlationId) || requestId;

    return {
      requestId: requestId,
      correlationId: correlationId,
      module: (request && request.module) || null,
      action: (request && request.action) || null,
      userId: (request && request.userId) || null,
      sessionId: (request && request.sessionId) || null,
      payload: (request && request.payload) || {},
      metadata: (request && request.metadata) || {},
      startTime: new Date(),
      environment: Core_Config.get('ENVIRONMENT')
    };
  }

  function finalize(ctx, status, errorInfo) {
    ctx.endTime = new Date();
    ctx.duration = ctx.endTime.getTime() - ctx.startTime.getTime();
    ctx.status = status;
    ctx.error = errorInfo || null;
    return ctx;
  }

  return { build, finalize };
})();
