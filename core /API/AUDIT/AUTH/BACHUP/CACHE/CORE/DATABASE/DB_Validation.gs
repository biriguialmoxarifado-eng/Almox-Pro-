/**
 * ============================================================
 * ALMOXA PRO — DB_Validation.gs  (CAMADA 2)
 * Validação genérica de dados antes de gravar. Validações
 * específicas de negócio ficam no Service do módulo — aqui só
 * o que é comum a qualquer tabela (campos obrigatórios, tipos).
 * ============================================================
 */

const DB_Validation = (function () {

  function requireFields(obj, fields) {
    const missing = fields.filter(f => obj[f] === undefined || obj[f] === null || obj[f] === '');
    if (missing.length) {
      throw Object.assign(new Error('Campos obrigatórios ausentes: ' + missing.join(', ')), {
        code: CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR
      });
    }
    return true;
  }

  function isValidEmail(str) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(str || '')); }
  function isValidCNPJ(str) { return /^\d{14}$/.test(String(str || '').replace(/\D/g, '')); }

  /**
   * NOVA (Integração 02, "evitar duplicidade") — vários Services
   * já faziam essa checagem manualmente, cada um escrevendo o
   * mesmo `DB_Query.exists(...)` (Service_Usuario com matrícula,
   * Service_Ferramenta com código, Service_Fornecedor com CNPJ).
   * Não reescrevi essas chamadas existentes (regra de "não alterar
   * módulo sem necessidade") — este helper fica disponível pra
   * quem for escrever checagem de duplicidade a partir de agora,
   * centralizando a MENSAGEM de erro também.
   */
  /**
   * MÓDULO 10 (Rastreabilidade)/BLOCO 02 seção 12 — checagem de
   * duplicidade genérica. Ampliada agora pra aceitar CHAVE
   * COMPOSTA (array de campos) — "quando não existir ID
   * confiável, permitir composição de chave conforme o schema".
   * Retrocompatível: quem já chama com `campo` como string única
   * continua funcionando idêntico.
   */
  function ensureUnique(table, campo, valor, excetoId) {
    const campos = Array.isArray(campo) ? campo : [campo];
    const valores = Array.isArray(valor) ? valor : [valor];

    const duplicado = DB_Query.exists(table, r => {
      const bateTodosOsCampos = campos.every((c, i) => r[c] === valores[i]);
      if (!bateTodosOsCampos) return false;
      return excetoId === undefined || String(r.ID) !== String(excetoId);
    });

    if (duplicado) {
      const descricao = campos.map((c, i) => c + ' = ' + valores[i]).join(', ');
      throw Object.assign(new Error('Já existe um registro em ' + table + ' com ' + descricao + '.'), {
        code: CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR
      });
    }
    return true;
  }

  return { requireFields, isValidEmail, isValidCNPJ, ensureUnique };
})();
