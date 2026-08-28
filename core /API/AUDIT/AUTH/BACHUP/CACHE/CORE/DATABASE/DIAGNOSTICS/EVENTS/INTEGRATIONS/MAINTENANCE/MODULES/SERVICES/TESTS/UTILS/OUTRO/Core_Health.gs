/**
 * ============================================================
 * ALMOXA PRO — Core_Health.gs  (CAMADA 5)
 * Agrega a saúde de todas as camadas num único relatório.
 * Consumido por Doctor_Core e por Core_API.healthCheck().
 * ============================================================
 */

const Core_Health = (function () {

  function fullReport() {
    return {
      timestamp: new Date().toISOString(),
      version: Core_Version.getAll(),
      environment: Core_Config.get('ENVIRONMENT'),
      maintenanceMode: Core_Config.isMaintenance(),
      core: { status: CORE_CONSTANTS.DOCTOR_STATUS.OK },
      database: Doctor_Database.check(),
      modules: Core_ModuleManager.healthCheckAll(),
      integrations: {
        ocr: Core_Config.get('OCR_PROVIDER') !== 'NONE' ? CORE_CONSTANTS.DOCTOR_STATUS.OK : CORE_CONSTANTS.DOCTOR_STATUS.NOT_CONFIGURED,
        biometria: Core_Config.get('BIOMETRIC_PROVIDER') !== 'NONE' ? CORE_CONSTANTS.DOCTOR_STATUS.OK : CORE_CONSTANTS.DOCTOR_STATUS.NOT_CONFIGURED,
        sap: Core_Config.get('SAP_IMPORT_FOLDER_ID') ? CORE_CONSTANTS.DOCTOR_STATUS.OK : CORE_CONSTANTS.DOCTOR_STATUS.NOT_CONFIGURED
      }
    };
  }

  return { fullReport };
})();
