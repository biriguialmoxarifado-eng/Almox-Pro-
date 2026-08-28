/**
 * ============================================================
 * ALMOXA PRO — Doctor_History.gs
 * MÓDULO 08 — guarda um retrato compacto de cada diagnóstico
 * (não o relatório inteiro, só o essencial pra comparar) em
 * DOCTOR_HISTORICO, e permite comparar o diagnóstico atual com
 * o último salvo — problema novo, recorrente, resolvido, ou
 * piorando (seção 10 do contrato).
 * ============================================================
 */

const Doctor_History = (function () {

  function salvarSnapshot(relatorio) {
    const problemasAtuais = _extrairProblemas(relatorio);
    return DB_Insert.insert('DOCTOR_HISTORICO', {
      data: new Date(),
      statusGeral: relatorio.core && relatorio.database && relatorio.api
        ? _piorStatus([relatorio.database.status, relatorio.api.status])
        : CORE_CONSTANTS.DOCTOR_STATUS.OK,
      totalErros: problemasAtuais.filter(p => p.status === CORE_CONSTANTS.DOCTOR_STATUS.ERROR).length,
      totalAvisos: problemasAtuais.filter(p => p.status === CORE_CONSTANTS.DOCTOR_STATUS.WARNING).length,
      resumoJson: JSON.stringify(problemasAtuais)
    });
  }

  function _piorStatus(statusList) {
    if (statusList.includes(CORE_CONSTANTS.DOCTOR_STATUS.ERROR)) return CORE_CONSTANTS.DOCTOR_STATUS.ERROR;
    if (statusList.includes(CORE_CONSTANTS.DOCTOR_STATUS.WARNING)) return CORE_CONSTANTS.DOCTOR_STATUS.WARNING;
    return CORE_CONSTANTS.DOCTOR_STATUS.OK;
  }

  function _extrairProblemas(relatorio) {
    const secoes = ['database', 'api', 'permissions', 'dependencies', 'backup', 'errorAudit'];
    return secoes
      .filter(s => relatorio[s] && relatorio[s].status)
      .map(s => ({ secao: s, status: relatorio[s].status }));
  }

  function comparar(relatorioAtual) {
    const historico = DB_Query.find('DOCTOR_HISTORICO', () => true).sort((a, b) => new Date(b.data) - new Date(a.data));
    const anterior = historico[0];
    if (!anterior) return { temHistorico: false, mensagem: 'Primeira execução registrada — sem histórico anterior pra comparar.' };

    let problemasAnteriores;
    try { problemasAnteriores = JSON.parse(anterior.resumoJson); } catch (e) { problemasAnteriores = []; }
    const problemasAtuais = _extrairProblemas(relatorioAtual);

    const porSecaoAnterior = {};
    problemasAnteriores.forEach(p => porSecaoAnterior[p.secao] = p.status);

    const comparacao = problemasAtuais.map(atual => {
      const statusAnterior = porSecaoAnterior[atual.secao];
      let situacao;
      if (!statusAnterior) situacao = 'NOVO';
      else if (statusAnterior === CORE_CONSTANTS.DOCTOR_STATUS.OK && atual.status !== CORE_CONSTANTS.DOCTOR_STATUS.OK) situacao = 'PIORANDO';
      else if (statusAnterior !== CORE_CONSTANTS.DOCTOR_STATUS.OK && atual.status === CORE_CONSTANTS.DOCTOR_STATUS.OK) situacao = 'RESOLVIDO';
      else if (statusAnterior !== CORE_CONSTANTS.DOCTOR_STATUS.OK && atual.status === statusAnterior) situacao = 'RECORRENTE';
      else situacao = 'ESTAVEL';
      return { secao: atual.secao, statusAnterior: statusAnterior || null, statusAtual: atual.status, situacao };
    });

    return { temHistorico: true, dataUltimaExecucao: anterior.data, comparacao };
  }

  return { salvarSnapshot, comparar };
})();
