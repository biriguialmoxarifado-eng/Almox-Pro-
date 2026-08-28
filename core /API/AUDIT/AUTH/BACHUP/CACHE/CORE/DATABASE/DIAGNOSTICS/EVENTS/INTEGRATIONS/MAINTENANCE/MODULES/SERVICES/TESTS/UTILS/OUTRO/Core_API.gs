/**
 * ============================================================
 * ALMOXA PRO — Core_API.gs  (CAMADA 5)
 * Fachada pública. É a ÚNICA porta de entrada usada por:
 * doPost() (Web App), pelo futuro frontend via google.script.run,
 * e pelos testes (Test_RouterAPI.gs).
 *
 * Formato de request aceito (seção 51):
 * { action, module, requestId, userId, sessionId, payload, metadata }
 * ============================================================
 */

const Core_API = (function () {

  function bootstrap() {
    Core_Config.ensureBootstrap();
    const report = Core_ModuleManager.initAll();
    return {
      appName: Core_Config.get('APP_NAME'),
      version: Core_Config.get('APP_VERSION'),
      environment: Core_Config.get('ENVIRONMENT'),
      modules: report
    };
  }

  function call(request) {
    if (!request || !request.action) {
      return Core_Response.error(
        CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR,
        'Requisição inválida: "action" é obrigatório.'
      );
    }
    // module é inferido do prefixo da action se não vier explícito
    if (!request.module && request.action.indexOf('.') > -1) {
      request.module = request.action.split('.')[0];
    }
    return Core_Router.dispatch(request);
  }

  function healthCheck() {
    return {
      status: CORE_CONSTANTS.DOCTOR_STATUS.OK,
      version: Core_Config.get('APP_VERSION'),
      environment: Core_Config.get('ENVIRONMENT'),
      database: Doctor_Database.check(),
      modules: Core_ModuleManager.healthCheckAll()
    };
  }

  return { bootstrap, call, healthCheck };
})();
