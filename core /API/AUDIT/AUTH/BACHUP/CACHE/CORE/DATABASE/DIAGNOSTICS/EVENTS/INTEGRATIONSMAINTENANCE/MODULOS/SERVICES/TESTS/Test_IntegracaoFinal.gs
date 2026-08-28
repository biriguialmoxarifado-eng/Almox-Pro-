/**
 * ============================================================
 * ALMOXA PRO — Test_IntegracaoFinal.gs
 * FASE 13 — Testes completos + integração final.
 *
 * Roda TODOS os testes de fase (2 a 12) em sequência, mais uma
 * bateria de não-regressão do Core (seção 57 — nenhuma nova
 * implementação pode quebrar Core/API/Router/Auth/Database/
 * Cache/Locks/Events/Audit/Diagnostics), e fecha com o
 * diagnóstico completo do Doutor do Sistema.
 *
 * AVISO: isso demora vários minutos de verdade (as Fases 3, 4 e
 * 6 têm debounce de bipagem de propósito). Rode com calma, não
 * feche o editor enquanto executa.
 *
 * Se algum arquivo de teste de fase não foi colado no seu
 * projeto, esta função PULA aquele teste (não trava o resto) e
 * avisa no relatório final — não finge que rodou.
 * ============================================================
 */

function Test_NaoRegressao_Core() {
  const checagens = {};

  // Core
  const bootstrap = Core_API.bootstrap();
  checagens.core_bootstrap = !!bootstrap.appName;

  // Registry / Router — número mínimo de rotas esperado (cresce a
  // cada fase; se cair muito abaixo disso, algo quebrou)
  const totalRotas = Object.keys(Core_Registry.getAllRoutes()).length;
  checagens.registry_rotas_suficientes = totalRotas >= 60;
  checagens.registry_total_rotas = totalRotas;

  // Auth / RBAC
  checagens.auth_hash_consistente = Auth_Tokens.hash('x') === Auth_Tokens.hash('x');
  checagens.rbac_admin_acesso_total = Auth_RBAC.can(CORE_CONSTANTS.PERFIS.ADMIN, 'qualquer.coisa');
  checagens.rbac_nega_sem_perfil = !Auth_RBAC.can(null, 'qualquer.coisa');

  // Database
  const dbCheck = Doctor_Database.check();
  checagens.database_sem_tabela_faltando = dbCheck.tabelasFaltando.length === 0;
  checagens.database_status = dbCheck.status;

  // Cache
  Cache_Core.set('TESTE_REGRESSAO', { ok: true }, 30);
  checagens.cache_funciona = Cache_Core.get('TESTE_REGRESSAO') !== null;
  Cache_Core.remove('TESTE_REGRESSAO');

  // Locks
  try {
    DB_Lock.withLock(() => true);
    checagens.lock_funciona = true;
  } catch (e) {
    checagens.lock_funciona = false;
  }

  // Events
  checagens.event_types_intacto = Object.keys(EVENT_TYPES).length >= 16;

  // Audit
  const antesAuditoria = DB_Query.count('AUDITORIA', () => true);
  Audit_Service.record({ userId: 'teste_regressao', module: 'TESTE' }, 'TESTE_REGRESSAO', {});
  checagens.audit_grava = DB_Query.count('AUDITORIA', () => true) > antesAuditoria;

  // Diagnostics
  const apiCheck = Doctor_API.check();
  checagens.doctor_api_sem_rota_invalida = apiCheck.rotasInvalidas.length === 0;

  const todasPassaram = Object.keys(checagens).filter(k => typeof checagens[k] === 'boolean').every(k => checagens[k] === true);
  return Object.assign({ passou: todasPassaram }, checagens);
}

function Test_RunTudo() {
  Core_API.bootstrap();
  const inicio = new Date();
  const resultados = {};

  function rodar(nome, fnRef) {
    if (typeof fnRef !== 'function') {
      resultados[nome] = { status: 'PULADO', motivo: 'Arquivo de teste desta fase não está no projeto.' };
      Logger.log(nome + ': PULADO (arquivo não encontrado)');
      return;
    }
    try {
      const r = fnRef();
      const passou = !!(r && (r.passou === true || r.success === true));
      resultados[nome] = { status: passou ? 'PASSOU' : 'FALHOU', detalhe: r };
      Logger.log(nome + ': ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌'));
    } catch (e) {
      resultados[nome] = { status: 'ERRO', erro: e.message };
      Logger.log(nome + ': ERRO — ' + e.message);
    }
  }

  Logger.log('=== INICIANDO INTEGRAÇÃO FINAL (Fase 13) ===');

  rodar('NaoRegressao_Core', Test_NaoRegressao_Core);
  rodar('SmokeTests_Basicos', typeof Test_RunAll === 'function' ? Test_RunAll : undefined);
  rodar('Fase02_NotaFiscal', typeof Test_Fase2_fluxoCompleto === 'function' ? Test_Fase2_fluxoCompleto : undefined);
  rodar('Fase03_Conferencia', typeof Test_Fase3_fluxoCompleto === 'function' ? Test_Fase3_fluxoCompleto : undefined);
  rodar('Fase04_Estoque', typeof Test_Fase4_fluxoCompleto === 'function' ? Test_Fase4_fluxoCompleto : undefined);
  rodar('Fase05_ReservaSaida', typeof Test_Fase5_fluxoCompleto === 'function' ? Test_Fase5_fluxoCompleto : undefined);
  rodar('Fase06_Inventario', typeof Test_Fase6_fluxoCompleto === 'function' ? Test_Fase6_fluxoCompleto : undefined);
  rodar('Fase07_ProjetosObras', typeof Test_Fase7_fluxoCompleto === 'function' ? Test_Fase7_fluxoCompleto : undefined);
  rodar('Fase08_OcorrenciaNotificacao', typeof Test_Fase8_fluxoCompleto === 'function' ? Test_Fase8_fluxoCompleto : undefined);
  rodar('Fase09_Relatorios', typeof Test_Fase9_fluxoCompleto === 'function' ? Test_Fase9_fluxoCompleto : undefined);
  rodar('Fase10_SAP_ImportExport', typeof Test_Fase10_fluxoCompleto === 'function' ? Test_Fase10_fluxoCompleto : undefined);
  rodar('Fase11_Biometria', typeof Test_Fase11_fluxoCompleto === 'function' ? Test_Fase11_fluxoCompleto : undefined);
  rodar('Fase12_EtiquetasIAConfig', typeof Test_Fase12_fluxoCompleto === 'function' ? Test_Fase12_fluxoCompleto : undefined);

  // MÓDULO 17 (seção 10 — "teste final" antes da integração
  // geral): os 12 módulos de negócio (01-12) não estavam
  // cobertos aqui, só as 13 fases originais do backend. Mesmo
  // padrão "PULADO se arquivo não colado" dos demais.
  rodar('Modulo01_Usuarios', typeof Test_Modulo01_Usuarios_fluxoCompleto === 'function' ? Test_Modulo01_Usuarios_fluxoCompleto : undefined);
  rodar('Modulo02_Estoque', typeof Test_Modulo02_Estoque_fluxoCompleto === 'function' ? Test_Modulo02_Estoque_fluxoCompleto : undefined);
  rodar('Modulo03_PreCompra', typeof Test_Modulo03_PreCompra_fluxoCompleto === 'function' ? Test_Modulo03_PreCompra_fluxoCompleto : undefined);
  rodar('Modulo04_Inventario', typeof Test_Modulo04_Inventario_fluxoCompleto === 'function' ? Test_Modulo04_Inventario_fluxoCompleto : undefined);
  rodar('Modulo05_Reservas', typeof Test_Modulo05_Reservas_fluxoCompleto === 'function' ? Test_Modulo05_Reservas_fluxoCompleto : undefined);
  rodar('Modulo06_Ferramentas', typeof Test_Modulo06_Ferramentas_fluxoCompleto === 'function' ? Test_Modulo06_Ferramentas_fluxoCompleto : undefined);
  rodar('Modulo07_Migration', typeof Test_Modulo07_Migration_fluxoCompleto === 'function' ? Test_Modulo07_Migration_fluxoCompleto : undefined);
  rodar('Modulo08_Doctor', typeof Test_Modulo08_Doctor_fluxoCompleto === 'function' ? Test_Modulo08_Doctor_fluxoCompleto : undefined);
  rodar('Modulo09_AIEngine', typeof Test_Modulo09_AIEngine_fluxoCompleto === 'function' ? Test_Modulo09_AIEngine_fluxoCompleto : undefined);
  rodar('Modulo10_Rastreabilidade', typeof Test_Modulo10_Rastreabilidade_fluxoCompleto === 'function' ? Test_Modulo10_Rastreabilidade_fluxoCompleto : undefined);
  rodar('Modulo11_CentralDados', typeof Test_Modulo11_CentralDados_fluxoCompleto === 'function' ? Test_Modulo11_CentralDados_fluxoCompleto : undefined);
  rodar('Modulo12_Notificacoes', typeof Test_Modulo12_Notificacoes_fluxoCompleto === 'function' ? Test_Modulo12_Notificacoes_fluxoCompleto : undefined);
  rodar('Modulo13_14_15_BackupDoutorIA', typeof Test_Modulo13_14_15_fluxoCompleto === 'function' ? Test_Modulo13_14_15_fluxoCompleto : undefined);
  rodar('Modulo16_17_ArquiteturaFinal', typeof Test_Modulo16_17_ArquiteturaFinal_fluxoCompleto === 'function' ? Test_Modulo16_17_ArquiteturaFinal_fluxoCompleto : undefined);
  rodar('Integracao01_CoreModulos', typeof Test_Integracao01_CoreModulos_fluxoCompleto === 'function' ? Test_Integracao01_CoreModulos_fluxoCompleto : undefined);
  rodar('Integracao02_DataLayer', typeof Test_Integracao02_DataLayer_fluxoCompleto === 'function' ? Test_Integracao02_DataLayer_fluxoCompleto : undefined);
  rodar('Integracao03_FrontendComunicacao', typeof Test_Integracao03_FrontendComunicacao_fluxoCompleto === 'function' ? Test_Integracao03_FrontendComunicacao_fluxoCompleto : undefined);
  rodar('FrontB01_PainelEConfig', typeof Test_FrontB01_PainelEConfig_fluxoCompleto === 'function' ? Test_FrontB01_PainelEConfig_fluxoCompleto : undefined);
  rodar('Bloco02_DataCoreImportacao', typeof Test_Bloco02_DataCoreImportacao_fluxoCompleto === 'function' ? Test_Bloco02_DataCoreImportacao_fluxoCompleto : undefined);
  rodar('Bloco03_APIInterna', typeof Test_Bloco03_APIInterna_fluxoCompleto === 'function' ? Test_Bloco03_APIInterna_fluxoCompleto : undefined);
  rodar('Bloco04_Inventario', typeof Test_Bloco04_Inventario_fluxoCompleto === 'function' ? Test_Bloco04_Inventario_fluxoCompleto : undefined);
  rodar('Bloco05_Reservas', typeof Test_Bloco05_Reservas_fluxoCompleto === 'function' ? Test_Bloco05_Reservas_fluxoCompleto : undefined);
  rodar('Bloco06_Ferramentas', typeof Test_Bloco06_Ferramentas_fluxoCompleto === 'function' ? Test_Bloco06_Ferramentas_fluxoCompleto : undefined);
  rodar('Bloco07_Relatorios', typeof Test_Bloco07_Relatorios_fluxoCompleto === 'function' ? Test_Bloco07_Relatorios_fluxoCompleto : undefined);
  rodar('Bloco08_Etiquetas', typeof Test_Bloco08_Etiquetas_fluxoCompleto === 'function' ? Test_Bloco08_Etiquetas_fluxoCompleto : undefined);

  const diagnosticoFinal = Doctor_Report.generate();
  const modulosComErro = diagnosticoFinal.modules.filter(m => m.status === CORE_CONSTANTS.DOCTOR_STATUS.ERROR);

  const totais = {
    passou: Object.values(resultados).filter(r => r.status === 'PASSOU').length,
    falhou: Object.values(resultados).filter(r => r.status === 'FALHOU').length,
    erro: Object.values(resultados).filter(r => r.status === 'ERRO').length,
    pulado: Object.values(resultados).filter(r => r.status === 'PULADO').length,
    total: Object.keys(resultados).length
  };

  const duracaoSegundos = Math.round((new Date() - inicio) / 1000);
  const aprovado = totais.falhou === 0 && totais.erro === 0 && modulosComErro.length === 0;

  Logger.log('=== RESULTADO FINAL ===');
  Logger.log(JSON.stringify({ totais, duracaoSegundos, aprovado, modulosComErro }, null, 2));
  Logger.log('Diagnóstico completo do Doutor: ' + JSON.stringify(diagnosticoFinal, null, 2));

  SpreadsheetApp.getUi().alert(
    'INTEGRAÇÃO FINAL — ' + (aprovado ? 'APROVADO ✅' : 'REPROVADO ❌') + '\n\n' +
    'Passou: ' + totais.passou + '\n' +
    'Falhou: ' + totais.falhou + '\n' +
    'Erro: ' + totais.erro + '\n' +
    'Pulado (arquivo não colado): ' + totais.pulado + '\n' +
    'Duração: ' + duracaoSegundos + 's\n\n' +
    (modulosComErro.length ? 'Módulos com erro: ' + modulosComErro.map(m => m.id).join(', ') + '\n\n' : '') +
    'Log completo em Ver → Registros de execução.'
  );

  return { resultados, totais, duracaoSegundos, aprovado, modulosComErro, diagnosticoFinal };
}
