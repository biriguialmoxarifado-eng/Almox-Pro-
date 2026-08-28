/**
 * ============================================================
 * ALMOXA PRO — Integration_WhatsApp.gs
 * MÓDULO 12 — contrato preparado, NÃO uma integração real.
 *
 * Não existe hoje nenhuma conta/API de WhatsApp Business
 * configurada neste projeto. Este arquivo existe pra:
 *   1. Deixar pronto o PONTO de integração (assinatura de função,
 *      onde o token entraria) sem fingir que funciona;
 *   2. Nunca colocar número/token/credencial direto no código —
 *      só lê de Core_Config, que é a mesma forma que toda outra
 *      integração do sistema (Email, SAP, OCR, Biometria) já usa.
 *
 * Quando uma integração real for contratada (ex: Twilio, Meta
 * Cloud API, 360dialog), só esta função precisa mudar — o resto
 * do sistema (Service_Notificacao) já está pronto pra chamar
 * send() e tratar sucesso/falha corretamente.
 * ============================================================
 */

const Integration_WhatsApp = (function () {

  function estaConfigurado() {
    return !!Core_Config.get('WHATSAPP_API_TOKEN') && !!Core_Config.get('WHATSAPP_API_URL');
  }

  /**
   * NÃO ENVIA NADA DE VERDADE hoje — sem token configurado, isso
   * sempre retorna enviado:false com o motivo explícito. Nunca
   * finge sucesso pra simular funcionamento (regra explícita do
   * contrato: "não implementar integrações externas inexistentes
   * apenas para simular funcionamento").
   */
  function send(numeroDestino, mensagem) {
    if (!estaConfigurado()) {
      return { enviado: false, motivo: 'WHATSAPP_API_TOKEN/WHATSAPP_API_URL não configurados — integração ainda não contratada.' };
    }
    // Quando configurado: chamada real ficaria aqui. Não escrevo
    // essa chamada agora porque não há provedor real definido
    // ainda (Meta Cloud API, Twilio e 360dialog têm formatos de
    // payload diferentes) — inventar uma delas seria simular
    // integração que não existe.
    return { enviado: false, motivo: 'Provedor de WhatsApp ainda não implementado (token existe, mas nenhum provedor foi codificado).' };
  }

  return { estaConfigurado, send };
})();
