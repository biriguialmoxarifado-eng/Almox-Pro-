/**
 * ============================================================
 * ALMOXA PRO — Integration_Email.gs
 * Adapter de envio de e-mail (usado por Service_Notificacao).
 * ============================================================
 */
const Integration_Email = (function () {
  function send(destinatario, assunto, htmlBody) {
    if (!Core_Config.get('EMAIL_NOTIFICATIONS_ENABLED')) {
      return { status: 'DESABILITADO' };
    }
    GmailApp.sendEmail(destinatario, assunto, '', { htmlBody: htmlBody });
    return { status: 'ENVIADO' };
  }
  function healthCheck() {
    return { status: Core_Config.get('EMAIL_NOTIFICATIONS_ENABLED') ? CORE_CONSTANTS.DOCTOR_STATUS.OK : CORE_CONSTANTS.DOCTOR_STATUS.NOT_CONFIGURED };
  }
  return { send, healthCheck };
})();
