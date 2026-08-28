/**
 * ============================================================
 * ALMOXA PRO — Usuarios_Core.gs
 *
 * CORREÇÃO DE BUG DA FASE 1: `API_Usuarios_getRoutes()` e
 * `API_Usuarios_registerPermissions()` existiam desde a Fase 1,
 * mas nenhum módulo em `ALL_MODULES` os chamava — o gerador da
 * época pulou `MOD_01_CORE` de propósito (Core não é módulo de
 * negócio) e ninguém assumiu a responsabilidade de registrar as
 * rotas `usuario.*`. Elas nunca foram alcançáveis via
 * `Core_Router` (sempre devolveriam `ROUTE_NOT_FOUND`).
 *
 * Descobri isso agora, construindo a Fase 3 do Front Mobile
 * (que precisa de `usuario.salvarFoto` funcionando de verdade).
 * Em vez de remendar isso em outro módulo, criei este objeto
 * dedicado — mesmo padrão de `Audit_Core`/`Backup_Core`/`Doctor_Core`.
 * ============================================================
 */

const Usuarios_Core = (function () {
  const MODULE_ID = 'USUARIOS';

  function getRoutes() {
    return API_Usuarios_getRoutes();
  }
  function getServices() { return { Service_Usuario }; }
  function getEvents() { return []; }
  function getVersion() { return '1.0.0'; }
  function init() {
    if (typeof API_Usuarios_registerPermissions === 'function') API_Usuarios_registerPermissions();
  }
  function healthCheck() { return { status: CORE_CONSTANTS.DOCTOR_STATUS.OK }; }

  return { getRoutes, getServices, getEvents, getVersion, init, healthCheck, id: MODULE_ID };
})();
