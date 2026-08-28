/**
 * ============================================================
 * ALMOXA PRO — Test_Core.gs
 * ============================================================
 */
function Test_Core_bootstrap() {
  const result = Core_API.bootstrap();
  const ok = !!result.appName && Array.isArray(result.modules);
  Logger.log('Test_Core_bootstrap: ' + (ok ? 'PASSOU' : 'FALHOU') + ' — ' + JSON.stringify(result.modules.map(m => m.id + ':' + m.status)));
  return ok;
}
