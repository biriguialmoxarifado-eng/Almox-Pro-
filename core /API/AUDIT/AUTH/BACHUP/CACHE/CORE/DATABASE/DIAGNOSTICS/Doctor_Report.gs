/**
 * ============================================================
 * ALMOXA PRO — Doctor_Report.gs
 * Monta o relatório final consolidado (usado pela rota
 * doctor.diagnostics).
 *
 * MÓDULO 08 — ampliado com as seções que faltavam: permissões
 * (a mais importante), dependências, backup, auditoria de erro,
 * comparação histórica e recomendações — sem remover nada do
 * que já existia (database/api/modules/integrations continuam
 * exatamente iguais).
 * ============================================================
 */
const Doctor_Report = (function () {

  function _gerarRecomendacoes(relatorio) {
    const recomendacoes = [];
    if (relatorio.database.status !== CORE_CONSTANTS.DOCTOR_STATUS.OK) {
      recomendacoes.push('Banco de dados com pendência — rode setup_instalar() pra corrigir tabelas/colunas faltando.');
    }
    if (relatorio.permissions.totalSemPermissaoExplicita > 0) {
      recomendacoes.push(relatorio.permissions.totalSemPermissaoExplicita + ' rota(s) sem permissão explícita — revise se o padrão VIEW é aceitável pra cada uma.');
    }
    if (relatorio.dependencies.problemas.length) {
      recomendacoes.push('Existe(m) módulo(s) dependendo de módulo inexistente — veja doctor.dependencies.');
    }
    if (relatorio.backup.status !== CORE_CONSTANTS.DOCTOR_STATUS.OK) {
      recomendacoes.push(relatorio.backup.totalBackupsRegistrados === 0
        ? 'Nenhum backup foi realizado ainda — rode backup.create manualmente.'
        : 'Faz mais de ' + relatorio.backup.diasDesdeUltimoBackup + ' dias desde o último backup — considere rodar backup.create.');
    }
    if (relatorio.errorAudit.totalAlertas > 0) {
      recomendacoes.push(relatorio.errorAudit.totalAlertas + ' evento(s) de alerta na auditoria dos últimos ' + relatorio.errorAudit.janelaDias + ' dias — veja doctor.errorAudit.');
    }
    return recomendacoes;
  }

  function generate() {
    const relatorio = {
      timestamp: new Date().toISOString(),
      core: { status: CORE_CONSTANTS.DOCTOR_STATUS.OK },
      database: Doctor_Database.check(),
      api: Doctor_API.check(),
      modules: Doctor_Modules.check(),
      integrations: Core_Health.fullReport().integrations,
      permissions: Doctor_Permissions.check(),
      dependencies: Doctor_Dependencies.check(),
      backup: Doctor_Backup.check(),
      errorAudit: Doctor_ErrorAudit.check()
    };
    relatorio.recomendacoes = _gerarRecomendacoes(relatorio);
    relatorio.comparacaoComExecucaoAnterior = Doctor_History.comparar(relatorio);
    Doctor_History.salvarSnapshot(relatorio); // guarda o retrato ANTES de devolver, pra próxima comparação já contar com este

    return relatorio;
  }
  return { generate };
})();
