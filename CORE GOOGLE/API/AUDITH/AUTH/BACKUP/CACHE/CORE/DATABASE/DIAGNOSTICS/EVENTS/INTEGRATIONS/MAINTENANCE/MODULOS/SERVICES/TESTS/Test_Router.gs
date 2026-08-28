/**
 * ============================================================
 * ALMOXA PRO — Test_Router.gs
 * ============================================================
 */
function Test_Router_rotaInexistente() {
  Core_API.bootstrap();
  const result = Core_API.call({ action: 'inexistente.acao', payload: {} });
  const ok = result.success === false && result.code === CORE_CONSTANTS.RESPONSE_CODES.ROUTE_NOT_FOUND;
  Logger.log('Test_Router_rotaInexistente: ' + (ok ? 'PASSOU' : 'FALHOU'));
  return ok;
}

function Test_Router_semSessao() {
  Core_API.bootstrap();
  const result = Core_API.call({ action: 'estoque.get', payload: {} }); // sem sessionId
  const ok = result.success === false && result.code === CORE_CONSTANTS.RESPONSE_CODES.SESSION_EXPIRED;
  Logger.log('Test_Router_semSessao: ' + (ok ? 'PASSOU' : 'FALHOU') + ' — ' + JSON.stringify(result));
  return ok;
}

/** Roda todos os testes de smoke de uma vez. */
function Test_RunAll() {
  const resultados = {
    core_bootstrap: Test_Core_bootstrap(),
    database_conexao: Test_Database_conexao(),
    database_diagnostico: Test_Database_diagnostico(),
    auth_hash: Test_Auth_hashConsistente(),
    auth_login_invalido: Test_Auth_loginInvalido(),
    router_rota_inexistente: Test_Router_rotaInexistente(),
    router_sem_sessao: Test_Router_semSessao()
  };
  const total = Object.keys(resultados).length;
  const passou = Object.values(resultados).filter(Boolean).length;
  Logger.log('=== RESULTADO: ' + passou + '/' + total + ' testes passaram ===');
  Logger.log(JSON.stringify(resultados, null, 2));
  SpreadsheetApp.getUi().alert('Testes: ' + passou + '/' + total + ' passaram. Veja detalhes em Ver → Registros de execução.');
  return resultados;
}
