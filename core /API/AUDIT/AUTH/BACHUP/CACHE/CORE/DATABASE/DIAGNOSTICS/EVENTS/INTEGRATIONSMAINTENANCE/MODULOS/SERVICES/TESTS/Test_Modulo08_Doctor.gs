/**
 * ============================================================
 * ALMOXA PRO — Test_Modulo08_Doctor.gs
 * Testa a peça mais importante do módulo: detecção real de rota
 * sem permissão explícita (a mesma classe de bug corrigida
 * manualmente 4 vezes ao longo do projeto). Também testa
 * dependências, backup, histórico/comparação e permissão de
 * acesso ao próprio Doutor.
 * ============================================================
 */

function Test_Modulo08_Doctor_fluxoCompleto() {
  Core_API.bootstrap();
  const resultados = {};

  const admin = Core_API.call({ action: 'auth.login', payload: { identificacao: 'admin', senha: 'almoxa123' } });
  const sessionAdmin = admin.data.sessionId;
  const operador = Core_API.call({ action: 'loja.cadastro', payload: { nome: 'Operador M8', matricula: 'M8-OP-' + Date.now(), senha: '1234' } });

  const negado = Core_API.call({ action: 'doctor.diagnostics', sessionId: operador.data.sessionId, payload: {} });
  resultados.bloqueiaNaoAdmin = !negado.success && negado.code === CORE_CONSTANTS.RESPONSE_CODES.PERMISSION_DENIED;

  const permissoes = Core_API.call({ action: 'doctor.permissions', sessionId: sessionAdmin, payload: {} });
  resultados.diagnosticaPermissoes = permissoes.success && typeof permissoes.data.totalSemPermissaoExplicita === 'number';
  resultados.rotaPublicaNaoContaComoRisco = permissoes.success && !permissoes.data.rotasSemPermissaoExplicita.includes('loja.cadastro') && permissoes.data.rotasPublicas.includes('loja.cadastro');
  resultados.rotaComPermissaoRealNaoAparece = permissoes.success && !permissoes.data.rotasSemPermissaoExplicita.includes('usuario.create');

  const dependencias = Core_API.call({ action: 'doctor.dependencies', sessionId: sessionAdmin, payload: {} });
  resultados.diagnosticaDependencias = dependencias.success && dependencias.data.status === CORE_CONSTANTS.DOCTOR_STATUS.OK;

  const backupAntes = Core_API.call({ action: 'doctor.backup', sessionId: sessionAdmin, payload: {} });
  const totalBackupsAntes = backupAntes.data.totalBackupsRegistrados;
  Core_API.call({ action: 'backup.create', sessionId: sessionAdmin, payload: {} });
  const backupDepois = Core_API.call({ action: 'doctor.backup', sessionId: sessionAdmin, payload: {} });
  resultados.backupReflete = backupDepois.success && backupDepois.data.totalBackupsRegistrados === totalBackupsAntes + 1 && backupDepois.data.diasDesdeUltimoBackup === 0;

  const recovery = Core_API.call({ action: 'doctor.recovery', sessionId: sessionAdmin, payload: { problema: 'TABELA_FALTANDO' } });
  resultados.recoveryMostraBackupReal = recovery.success && recovery.data.ultimaVersaoFuncional !== null && !!recovery.data.sugestao;

  const errorAudit = Core_API.call({ action: 'doctor.errorAudit', sessionId: sessionAdmin, payload: { janelaDias: 365 } });
  resultados.errorAuditFunciona = errorAudit.success && typeof errorAudit.data.totalAlertas === 'number';

  const relatorio = Core_API.call({ action: 'doctor.diagnostics', sessionId: sessionAdmin, payload: {} });
  resultados.relatorioCompleto = relatorio.success &&
    !!relatorio.data.permissions && !!relatorio.data.dependencies && !!relatorio.data.backup && !!relatorio.data.errorAudit &&
    Array.isArray(relatorio.data.recomendacoes);

  resultados.primeiraComparacaoParcial = relatorio.data.comparacaoComExecucaoAnterior.temHistorico !== undefined;
  const relatorio2 = Core_API.call({ action: 'doctor.diagnostics', sessionId: sessionAdmin, payload: {} });
  resultados.segundaExecucaoComparaComPrimeira = relatorio2.success && relatorio2.data.comparacaoComExecucaoAnterior.temHistorico === true;

  const passou = Object.values(resultados).every(Boolean);

  Logger.log('=== RESULTADOS MÓDULO 08 (Doctor Engine) ===');
  Logger.log(JSON.stringify(resultados, null, 2));
  Logger.log('=== ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌') + ' ===');
  SpreadsheetApp.getUi().alert('Teste Módulo 08 (Doctor Engine): ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌ — veja o Logger.'));

  return resultados;
}
