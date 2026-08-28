/**
 * ============================================================
 * ALMOXA PRO — DB_Errors.gs
 * BLOCO 02, seção 24 — erros estruturados pra Data/Import Layer.
 *
 * Equivalente ao "DataErrors.gs" do contrato — nomeado com o
 * prefixo DB_ pra seguir a convenção que este repositório JÁ usa
 * desde a Fase 1 (DB_Core, DB_Query, DB_Insert...), em vez de
 * introduzir um prefixo novo (Data*) só pra bater literalmente
 * com o nome do documento. Mesma responsabilidade, nome
 * consistente com o resto do sistema.
 *
 * NÃO substitui Core_Response.error (contrato de resposta de
 * API, usado em toda rota) — este é o formato de erro INTERNO
 * usado por Schema/Migração/Importação pra apontar exatamente
 * campo/linha/origem, que Core_Response.error não carrega.
 * ============================================================
 */

const DB_Errors = (function () {

  function build(opts) {
    const o = opts || {};
    return {
      code: o.code || CORE_CONSTANTS.RESPONSE_CODES.INTERNAL_ERROR,
      message: o.message || 'Erro não especificado.',
      module: o.module || '',
      operation: o.operation || '',
      field: o.field || null,
      row: o.row !== undefined ? o.row : null,
      timestamp: new Date().toISOString()
    };
  }

  function format(erro) {
    return 'IMPORTAÇÃO REJEITADA\nMotivo: ' + erro.message +
      (erro.field ? '\nCampo: ' + erro.field : '') +
      (erro.row !== null ? '\nLinha: ' + erro.row : '') +
      (erro.module ? '\nOrigem: ' + erro.module : '');
  }

  return { build: build, format: format };
})();
