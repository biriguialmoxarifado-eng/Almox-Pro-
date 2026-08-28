/**
 * ============================================================
 * ALMOXA PRO — Audit_Service.gs  (CAMADA 4)
 * Trilha de auditoria central (seção 43). Todo módulo que cria,
 * altera, aprova, movimenta, chama Audit_Service.record().
 * NUNCA duplicar auditoria dentro de um módulo específico.
 * ============================================================
 */

const Audit_Service = (function () {

  function record(ctx, acao, detalhes, antes, depois) {
    try {
      DB_Insert.insert('AUDITORIA', {
        usuario: (ctx && ctx.userId) || Auth_Session.currentUserEmailSafe(),
        acao: acao,
        modulo: (ctx && ctx.module) || '',
        entidade: (detalhes && detalhes.entidade) || '',
        entidadeId: (detalhes && detalhes.entidadeId) || '',
        antes: antes ? JSON.stringify(antes) : '',
        depois: depois ? JSON.stringify(depois) : '',
        data: new Date(),
        hora: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH:mm:ss'),
        ip: '',
        origem: 'APPS_SCRIPT',
        resultado: (detalhes && detalhes.resultado) || 'SUCESSO',
        correlationId: (ctx && ctx.correlationId) || '',
        // MÓDULO 10 (Rastreabilidade) — campos opcionais, aditivos.
        // Ninguém que já chama record() precisa mudar: sem
        // detalhes.obraId/status, ficam em branco como sempre
        // ficaram (essas colunas não existiam antes).
        obraId: (detalhes && detalhes.obraId) || '',
        status: (detalhes && detalhes.status) || ''
      });
    } catch (e) {
      // Auditoria nunca pode derrubar a operação principal, mas
      // isso é logado para o Doutor detectar falha estrutural.
      console.error('[Audit_Service] Falha ao gravar auditoria: ' + e.message);
    }
  }

  /**
   * MÓDULO 10 (Rastreabilidade) — ampliado com os filtros que
   * faltavam (período, entidade/registro, obra, status).
   * Retrocompatível: quem já chamava só com
   * {usuario, modulo, acao} continua funcionando idêntico.
   */
  function search(filters) {
    const f = filters || {};
    return DB_Query.find('AUDITORIA', row => {
      if (f.usuario && row.usuario !== f.usuario) return false;
      if (f.modulo && row.modulo !== f.modulo) return false;
      if (f.acao && row.acao !== f.acao) return false;
      if (f.entidade && row.entidade !== f.entidade) return false;
      if (f.entidadeId && String(row.entidadeId) !== String(f.entidadeId)) return false;
      if (f.obraId && row.obraId !== f.obraId) return false;
      if (f.status && row.status !== f.status) return false;
      if (f.dataInicio && new Date(row.data) < new Date(f.dataInicio)) return false;
      if (f.dataFim && new Date(row.data) > new Date(f.dataFim)) return false;
      return true;
    }).sort((a, b) => new Date(b.data) - new Date(a.data));
  }

  return { record, search };
})();
