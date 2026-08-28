/**
 * ============================================================
 * ALMOXA PRO — Doctor_Recovery.gs
 * Ações de recuperação assistida (seção 64) — NUNCA automáticas
 * sem confirmação explícita, para não mascarar um problema real.
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
  return { suggestFor };
})();
