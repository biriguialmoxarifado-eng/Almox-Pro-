/**
 * ============================================================
 * ALMOXA PRO — Test_Doctor_Seguranca.gs
 * FASE 8 DO FRONT MOBILE — confirma que doctor.diagnostics
 * agora exige ADMIN (bug real corrigido).
 * ============================================================
 */

function Test_Doctor_Seguranca_fluxoCompleto() {
  Core_API.bootstrap();

  const admin = Core_API.call({ action: 'auth.login', payload: { identificacao: 'admin', senha: 'almoxa123' } });
  const operador = Core_API.call({ action: 'loja.cadastro', payload: { nome: 'Doutor Op', matricula: 'DOC-' + Date.now(), senha: '1234' } });

  const diagAdmin = Core_API.call({ action: 'doctor.diagnostics', sessionId: admin.data.sessionId, payload: {} });
  Logger.log('ADMIN CONSULTANDO DIAGNÓSTICO (deve funcionar): ' + JSON.stringify(diagAdmin).slice(0, 200));

  const diagOperador = Core_API.call({ action: 'doctor.diagnostics', sessionId: operador.data.sessionId, payload: {} });
  Logger.log('OPERADOR CONSULTANDO DIAGNÓSTICO (deve falhar agora): ' + JSON.stringify(diagOperador));

  const passou =
    diagAdmin.success &&
    !diagOperador.success && diagOperador.code === CORE_CONSTANTS.RESPONSE_CODES.PERMISSION_DENIED;

  Logger.log('=== RESULTADO SEGURANÇA DOUTOR: ' + (passou ? 'PASSOU' : 'FALHOU') + ' ===');
  SpreadsheetApp.getUi().alert('Teste Segurança Doutor (Fase 8 Front): ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌'));
  return { diagAdmin, diagOperador, passou };
}
