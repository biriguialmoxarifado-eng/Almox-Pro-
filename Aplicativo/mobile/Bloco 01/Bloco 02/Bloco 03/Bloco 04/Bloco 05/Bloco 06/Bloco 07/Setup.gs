/**
 * ============================================================
 * ALMOXA PRO — Setup.gs
 * Instalador. Roda UMA VEZ manualmente pelo editor do Apps
 * Script: seleciona setup_instalar() no menu de funções e clica
 * em Executar. Cria todas as tabelas do DB_Mapping que ainda
 * não existirem, mais a tabela de suporte a eventos/experimentos
 * (EVENTOS_LOG, EXPERIMENTOS_LOG, LOG_SYNC) que não fazem parte
 * do mapa de negócio mas são exigidas pela infraestrutura.
 * ============================================================
 */

function setup_instalar() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Core_Config.set('SPREADSHEET_ID', ss.getId());
  Core_Config.ensureBootstrap();

  const tabelasNegocio = DB_Mapping.TABLES;
  const tabelasInfra = {
    EVENTOS_LOG: ['ID','tipo','payload','correlationId','data'],
    EXPERIMENTOS_LOG: ['ID','experimentoId','nome','dryRun','status','erro','resultadoJson','duracaoMs','data'],
    LOG_SYNC: ['ID','data','modulo','operacao','status','erro','usuario']
  };

  const todas = Object.assign({}, tabelasNegocio, tabelasInfra);

  let criadas = 0, existentes = 0;
  Object.keys(todas).forEach(nome => {
    let sh = ss.getSheetByName(nome);
    if (!sh) {
      sh = ss.insertSheet(nome);
      sh.getRange(1, 1, 1, todas[nome].length).setValues([todas[nome]]);
      sh.setFrozenRows(1);
      criadas++;
    } else {
      existentes++;
    }
  });

  // Usuário ADMIN inicial, se ainda não existir nenhum.
  const admins = DB_Query.find('USUARIOS', u => u.perfil === CORE_CONSTANTS.PERFIS.ADMIN);
  let senhaInfo = '';
  if (admins.length === 0) {
    const senha = 'almoxa123';
    DB_Insert.insert('USUARIOS', {
      nome: 'Administrador', email: 'admin@almoxapro.local', matricula: 'admin',
      senha_hash: Auth_Tokens.hash(senha), perfil: CORE_CONSTANTS.PERFIS.ADMIN,
      status: 'ATIVO', dataCadastro: new Date()
    });
    senhaInfo = '\\nUsuário admin criado — login: admin / senha provisória: ' + senha;
  }

  SpreadsheetApp.getUi().alert(
    'ALMOXA PRO — Esqueleto instalado.\\n\\n' +
    'Tabelas criadas agora: ' + criadas + '\\n' +
    'Tabelas que já existiam: ' + existentes + '\\n' +
    'Total no mapa: ' + Object.keys(todas).length +
    senhaInfo
  );
}

function setup_rodarDiagnostico() {
  Core_API.bootstrap();
  const report = Doctor_Report.generate();
  Logger.log(JSON.stringify(report, null, 2));
  SpreadsheetApp.getUi().alert('Diagnóstico rodado — veja o resultado em Ver → Registros de execução (Logs).');
}

/**
 * FASE 11 — rode uma vez se você já tinha o sistema instalado
 * antes desta fase (instalações novas já vêm com
 * BIOMETRIC_PROVIDER=DEVICE_SECRET por padrão).
 */
function setup_ativarBiometriaDeviceSecret() {
  Core_Config.set('BIOMETRIC_PROVIDER', 'DEVICE_SECRET');
  SpreadsheetApp.getUi().alert('Provider biométrico DEVICE_SECRET ativado.');
}
