/**
 * ============================================================
 * ALMOXA PRO — Doctor_Communication.gs
 * MÓDULO 14 (contrato "Doutor do Sistema") — seção 2: "verificar
 * se Frontend comunica com Core; Core comunica com API; API
 * comunica com Data Layer; Data Layer comunica com banco".
 *
 * AUDITORIA: quase todo o Módulo 14 já é o Doctor Engine do
 * Módulo 08 (Doctor_Health, Doctor_Modules, Doctor_API,
 * Doctor_Database, Doctor_Permissions, Doctor_Dependencies,
 * Doctor_Backup, Doctor_ErrorAudit, Doctor_History,
 * Doctor_Contracts, Doctor_Report, Doctor_Recovery) — não
 * recriado aqui. O que faltava de verdade era um teste EM CADEIA
 * (não "cada camada isolada respondeu"), e os 2 status do mapa
 * de saúde (⚪🔵) que não existiam no enum.
 *
 * HONESTIDADE sobre o elo "Frontend → Core": não dá pra testar
 * isso de dentro do backend — não existe um navegador aqui. Essa
 * perna só é confirmada quando o PRÓPRIO Front chama esta rota
 * com sucesso (o sucesso da chamada JÁ é a prova do elo).
 * Documentado como tal, não fingido como testado aqui.
 * ============================================================
 */

const Doctor_Communication = (function () {

  function testarCadeia() {
    const etapas = [];

    try {
      const boot = Core_API.bootstrap();
      etapas.push({ etapa: 'CORE', status: boot && boot.appName ? CORE_CONSTANTS.DOCTOR_STATUS.OK : CORE_CONSTANTS.DOCTOR_STATUS.ERROR, detalhe: boot ? boot.appName : 'bootstrap não retornou appName' });
    } catch (e) {
      etapas.push({ etapa: 'CORE', status: CORE_CONSTANTS.DOCTOR_STATUS.ERROR, detalhe: e.message });
    }

    try {
      const resposta = Core_API.call({ action: 'auth.login', payload: { identificacao: '__doctor_ping__', senha: '__doctor_ping__' } });
      const respondeuDeVerdade = resposta && typeof resposta.success === 'boolean';
      etapas.push({ etapa: 'API', status: respondeuDeVerdade ? CORE_CONSTANTS.DOCTOR_STATUS.OK : CORE_CONSTANTS.DOCTOR_STATUS.ERROR, detalhe: 'Round-trip real via Core_API.call' });
    } catch (e) {
      etapas.push({ etapa: 'API', status: CORE_CONSTANTS.DOCTOR_STATUS.ERROR, detalhe: e.message });
    }

    try {
      const linhas = DB_Query.find('USUARIOS', () => true);
      etapas.push({ etapa: 'DATA_LAYER_BANCO', status: Array.isArray(linhas) ? CORE_CONSTANTS.DOCTOR_STATUS.OK : CORE_CONSTANTS.DOCTOR_STATUS.ERROR, detalhe: linhas.length + ' registro(s) lido(s) de verdade' });
    } catch (e) {
      etapas.push({ etapa: 'DATA_LAYER_BANCO', status: CORE_CONSTANTS.DOCTOR_STATUS.ERROR, detalhe: e.message });
    }

    etapas.push({ etapa: 'FRONTEND_CORE', status: CORE_CONSTANTS.DOCTOR_STATUS.NAO_TESTADO, detalhe: 'Só é confirmável quando o próprio Front chama esta rota com sucesso — o backend não tem como simular um navegador.' });

    try {
      let recebeu = false;
      const handlerTeste = () => { recebeu = true; };
      Event_Bus.on('DOCTOR_PING_EVENTO_TESTE', handlerTeste);
      Event_Bus.emit('DOCTOR_PING_EVENTO_TESTE', {}, {});
      etapas.push({ etapa: 'EVENTOS', status: recebeu ? CORE_CONSTANTS.DOCTOR_STATUS.OK : CORE_CONSTANTS.DOCTOR_STATUS.ERROR, detalhe: 'Emissão e recepção testadas na mesma execução' });
    } catch (e) {
      etapas.push({ etapa: 'EVENTOS', status: CORE_CONSTANTS.DOCTOR_STATUS.ERROR, detalhe: e.message });
    }

    const piorStatus = etapas.some(e => e.status === CORE_CONSTANTS.DOCTOR_STATUS.ERROR) ? CORE_CONSTANTS.DOCTOR_STATUS.ERROR
      : etapas.some(e => e.status === CORE_CONSTANTS.DOCTOR_STATUS.NAO_TESTADO) ? CORE_CONSTANTS.DOCTOR_STATUS.WARNING
      : CORE_CONSTANTS.DOCTOR_STATUS.OK;

    return { status: piorStatus, etapas, timestamp: new Date().toISOString() };
  }

  return { testarCadeia };
})();
