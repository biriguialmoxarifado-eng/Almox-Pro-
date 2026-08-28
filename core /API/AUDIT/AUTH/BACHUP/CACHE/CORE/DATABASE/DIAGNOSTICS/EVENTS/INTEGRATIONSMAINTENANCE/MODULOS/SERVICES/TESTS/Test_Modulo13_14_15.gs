/**
 * ============================================================
 * ALMOXA PRO — Test_Modulo13_14_15.gs
 * MÓDULO 13: bug de permissão de backup corrigido, tipo automático
 * vs manual, auditoria de restauração, backup automático via gatilho.
 * MÓDULO 14: teste de comunicação em cadeia, novos status ⚪🔵.
 * MÓDULO 15: PEP honesto sobre dado vazio, QR Code com contexto.
 * ============================================================
 */

function Test_Modulo13_14_15_fluxoCompleto() {
  Core_API.bootstrap();
  const resultados = {};

  const admin = Core_API.call({ action: 'auth.login', payload: { identificacao: 'admin', senha: 'almoxa123' } });
  const sessionAdmin = admin.data.sessionId;
  const operador = Core_API.call({ action: 'loja.cadastro', payload: { nome: 'Operador M13', matricula: 'M13-OP-' + Date.now(), senha: '1234' } });

  const restoreSemPermissao = Core_API.call({ action: 'backup.restore', sessionId: operador.data.sessionId, payload: { fileId: 'x', confirm: true } });
  resultados.bugDePermissaoDeBackupCorrigido = !restoreSemPermissao.success && restoreSemPermissao.code === CORE_CONSTANTS.RESPONSE_CODES.PERMISSION_DENIED;

  const createSemPermissao = Core_API.call({ action: 'backup.create', sessionId: operador.data.sessionId, payload: {} });
  resultados.createTambemBloqueadoParaNaoAdmin = !createSemPermissao.success && createSemPermissao.code === CORE_CONSTANTS.RESPONSE_CODES.PERMISSION_DENIED;

  const backupManual = Core_API.call({ action: 'backup.create', sessionId: sessionAdmin, payload: {} });
  resultados.backupManualComTipoCorreto = backupManual.success && backupManual.data.tipo === 'MANUAL' && !!backupManual.data.ID;

  const backupAutomatico = Gatilho_BackupAutomatico();
  resultados.backupAutomaticoFunciona = backupAutomatico.success && backupAutomatico.data.tipo === 'AUTOMATICO';

  const totalAuditoriaAntes = DB_Query.find('AUDITORIA', a => a.acao === 'BACKUP_RESTAURACAO_FALHOU').length;
  const restoreSemConfirmacao = Core_API.call({ action: 'backup.restore', sessionId: sessionAdmin, payload: { fileId: 'algum-id', confirm: false } });
  const totalAuditoriaDepois = DB_Query.find('AUDITORIA', a => a.acao === 'BACKUP_RESTAURACAO_FALHOU').length;
  resultados.restauracaoSemConfirmacaoBloqueadaEAuditada = !restoreSemConfirmacao.success && totalAuditoriaDepois === totalAuditoriaAntes + 1;

  const cadeia = Core_API.call({ action: 'doctor.communication', sessionId: sessionAdmin, payload: {} });
  const etapaCore = cadeia.success ? cadeia.data.etapas.find(e => e.etapa === 'CORE') : null;
  const etapaFrontend = cadeia.success ? cadeia.data.etapas.find(e => e.etapa === 'FRONTEND_CORE') : null;
  resultados.testeDeComunicacaoEmCadeiaFunciona = cadeia.success && etapaCore && etapaCore.status === 'OK';
  resultados.honestoSobreFrontendNaoTestavel = etapaFrontend && etapaFrontend.status === CORE_CONSTANTS.DOCTOR_STATUS.NAO_TESTADO;

  const cadeiaSemPermissao = Core_API.call({ action: 'doctor.communication', sessionId: operador.data.sessionId, payload: {} });
  resultados.bloqueiaComunicacaoParaNaoAdmin = !cadeiaSemPermissao.success && cadeiaSemPermissao.code === CORE_CONSTANTS.RESPONSE_CODES.PERMISSION_DENIED;

  resultados.novosStatusExistemNoEnum = CORE_CONSTANTS.DOCTOR_STATUS.NAO_TESTADO === 'NAO_TESTADO' && CORE_CONSTANTS.DOCTOR_STATUS.EM_SINCRONIZACAO === 'EM_SINCRONIZACAO';

  const pep = Core_API.call({ action: 'skills.analisarClassificadoresPEP', sessionId: sessionAdmin, payload: {} });
  resultados.pepHonestoSemDado = pep.success && pep.data.totalClassificados === 0 && pep.data.aviso.includes('nenhum módulo o popula');

  const produto = Core_API.call({ action: 'produto.create', sessionId: sessionAdmin, payload: { descricaoOriginal: 'Item QR M15', codigo: 'M15-QR' } });
  const qrProduto = Core_API.call({ action: 'skills.consultarPorQRCode', sessionId: sessionAdmin, payload: { conteudoQR: 'PRODUTO:' + produto.data.ID } });
  resultados.qrCodeDeProdutoLevaAoContexto = qrProduto.success && qrProduto.data.trajetoria[0].etapa === 'CADASTRO';

  const qrSemSuporte = Core_API.call({ action: 'skills.consultarPorQRCode', sessionId: sessionAdmin, payload: { conteudoQR: 'CAIXA:1' } });
  resultados.qrSemSuporteNaoInventaContexto = !qrSemSuporte.success;

  const qrMalformado = Core_API.call({ action: 'skills.consultarPorQRCode', sessionId: sessionAdmin, payload: { conteudoQR: 'sem-dois-pontos' } });
  resultados.qrMalformadoTratado = !qrMalformado.success && qrMalformado.code === CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR;

  const passou = Object.values(resultados).every(Boolean);

  Logger.log('=== RESULTADOS MÓDULOS 13+14+15 ===');
  Logger.log(JSON.stringify(resultados, null, 2));
  Logger.log('=== ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌') + ' ===');
  SpreadsheetApp.getUi().alert('Teste Módulos 13+14+15: ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌ — veja o Logger.'));

  return resultados;
}
