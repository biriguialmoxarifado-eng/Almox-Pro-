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
        correlationId: (ctx && ctx.correlationId) || ''
      });
    } catch (e) {
      // Auditoria nunca pode derrubar a operação principal, mas
      // isso é logado para o Doutor detectar falha estrutural.
      console.error('[Audit_Service] Falha ao gravar auditoria: ' + e.message);
    }
  }

  function search(filters) {
    return DB_Query.find('AUDITORIA', row => {
      if (filters.usuario && row.usuario !== filters.usuario) return false;
      if (filters.modulo && row.modulo !== filters.modulo) return false;
      if (filters.acao && row.acao !== filters.acao) return false;
      return true;
    });
  }

  return { record, search };
})();
