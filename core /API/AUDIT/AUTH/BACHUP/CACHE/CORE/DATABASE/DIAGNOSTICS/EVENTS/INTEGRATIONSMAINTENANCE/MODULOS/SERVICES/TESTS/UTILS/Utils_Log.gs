/**
 * ============================================================
 * ALMOXA PRO — Utils_Log.gs
 * Log estruturado (seção 54). Cada requisição gera uma linha
 * com requestId, correlationId, módulo, ação, duração e status.
 * ============================================================
 */

const Utils_Log = (function () {

  function record(ctx) {
    const line = {
      requestId: ctx.requestId,
      correlationId: ctx.correlationId,
      module: ctx.module,
      action: ctx.action,
      userId: ctx.userId,
      startTime: ctx.startTime ? ctx.startTime.toISOString() : null,
      endTime: ctx.endTime ? ctx.endTime.toISOString() : null,
      duration: ctx.duration,
      status: ctx.status,
      error: ctx.error ? ctx.error.message : null
    };
    console.log(JSON.stringify(line));

    if (ctx.status === 'ERROR' || Core_Config.get('LOG_LEVEL') === 'DEBUG') {
      try {
        DB_Insert.insert('LOG_SYNC', {
          data: new Date(),
          modulo: ctx.module || '',
          operacao: ctx.action || '',
          status: ctx.status || '',
          erro: ctx.error ? ctx.error.message : '',
          usuario: ctx.userId || ''
        });
      } catch (e) { /* best-effort */ }
    }
  }

  return { record };
})();
