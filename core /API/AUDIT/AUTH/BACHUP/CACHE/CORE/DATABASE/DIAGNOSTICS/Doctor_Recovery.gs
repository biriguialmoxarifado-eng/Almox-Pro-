/**
 * ============================================================
 * ALMOXA PRO — Doctor_Recovery.gs
 * Ações de recuperação assistida (seção 64) — NUNCA automáticas
 * sem confirmação explícita, para não mascarar um problema real.
 *
 * MÓDULO 08 — ampliado com consulta REAL de backup disponível
 * (antes só devolvia texto estático). Continua NUNCA fazendo
 * rollback destrutivo sozinho — só sugere e mostra o que existe;
 * quem decide restaurar é sempre uma pessoa, chamando
 * `backup.restore` explicitamente.
 * ============================================================
 */
const Doctor_Recovery = (function () {
  function suggestFor(problema) {
    const sugestoes = {
      TABELA_FALTANDO: 'Rode Setup_Completo para recriar as tabelas ausentes.',
      COLUNA_FALTANDO: 'Uma migração (Migration_XXX) é necessária antes de usar essa tabela.',
      MODULO_ERRO: 'Verifique o log de inicialização do módulo em Core_ModuleManager.getReport().',
      INTEGRACAO_NAO_CONFIGURADA: 'Configure a chave/ID correspondente em Core_Config antes de usar esta integração.'
    };
    return sugestoes[problema] || 'Sem sugestão automática — encaminhar para análise manual.';
  }

  /** Real — consulta BACKUPS de verdade, nunca inventa uma versão "recuperável" que não existe. */
  function backupsDisponiveis() {
    return DB_Query.find('BACKUPS', b => b.status === 'CONCLUIDO').sort((a, b) => new Date(b.data) - new Date(a.data));
  }

  function ultimaVersaoFuncional() {
    const disponiveis = backupsDisponiveis();
    return disponiveis.length ? disponiveis[0] : null;
  }

  return { suggestFor, backupsDisponiveis, ultimaVersaoFuncional };
})();
