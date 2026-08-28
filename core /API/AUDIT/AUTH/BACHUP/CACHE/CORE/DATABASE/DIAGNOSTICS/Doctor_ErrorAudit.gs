/**
 * ============================================================
 * ALMOXA PRO — Doctor_ErrorAudit.gs
 * MÓDULO 08 — centraliza erro a partir de AUDITORIA (mesma
 * tabela usada por Audit_Service.record em todo o sistema —
 * nenhuma trilha paralela). Não existe campo formal de
 * "severidade" na auditoria (conferido antes de escrever isso),
 * então a classificação aqui é uma HEURÍSTICA sobre o nome da
 * ação (contém REPROVAD/ERRO/FALHA/EXTRAVIAD/DIVERGENCIA) — não
 * é uma verdade absoluta, é um indicador honesto do que dá pra
 * inferir com o dado que realmente existe.
 * ============================================================
 */

const Doctor_ErrorAudit = (function () {

  const PALAVRAS_ALERTA = ['ERRO', 'FALHA', 'REPROVAD', 'EXTRAVIAD', 'DIVERGENCIA', 'CANCELAD'];

  function check(janelaDias) {
    const dias = janelaDias || 7;
    const desde = new Date(Date.now() - dias * 86400000);
    const recentes = DB_Query.find('AUDITORIA', a => new Date(a.data) >= desde);

    const alertas = recentes.filter(a => PALAVRAS_ALERTA.some(palavra => (a.acao || '').toUpperCase().includes(palavra)));

    return {
      status: alertas.length ? CORE_CONSTANTS.DOCTOR_STATUS.WARNING : CORE_CONSTANTS.DOCTOR_STATUS.OK,
      janelaDias: dias,
      totalEventosNaJanela: recentes.length,
      totalAlertas: alertas.length,
      ultimosAlertas: alertas.slice(-20).map(a => ({ acao: a.acao, usuario: a.usuario, entidade: a.entidade, data: a.data })),
      metodologia: 'Heurística por palavra-chave no nome da ação — não existe campo formal de severidade na auditoria hoje.'
    };
  }

  return { check };
})();
