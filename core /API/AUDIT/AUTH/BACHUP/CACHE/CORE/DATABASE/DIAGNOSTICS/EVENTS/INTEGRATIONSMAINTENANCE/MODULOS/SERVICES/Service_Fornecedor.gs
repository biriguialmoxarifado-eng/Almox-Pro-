/**
 * ============================================================
 * ALMOXA PRO — Service_Fornecedor.gs
 * FASE 2 — IMPLEMENTADO DE VERDADE (era esqueleto na Fase 1).
 * CRUD real + busca por CNPJ usada pelo fluxo de Nota Fiscal
 * (seção 18: "procurar CNPJ → existe? usa cadastro. Não? cria").
 * ============================================================
 */

const Service_Fornecedor = (function () {

  function get(ctx) {
    const row = DB_Query.get('FORNECEDORES', ctx.payload.id);
    return row
      ? Core_Response.ok(row, '', 'SUCCESS', {}, ctx.requestId)
      : Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Fornecedor não encontrado.', {}, ctx.requestId);
  }

  function search(ctx) {
    const f = ctx.payload || {};
    const rows = DB_Query.find('FORNECEDORES', r => {
      if (f.cnpj && r.cnpj !== f.cnpj) return false;
      if (f.razaoSocial && !Utils_String.normalize(r.razaoSocial).includes(Utils_String.normalize(f.razaoSocial))) return false;
      if (f.status && r.status !== f.status) return false;
      return true;
    });
    return Core_Response.ok(rows, '', 'SUCCESS', {}, ctx.requestId);
  }

  function create(ctx) {
    const dados = ctx.payload || {};
    try {
      DB_Validation.requireFields(dados, ['cnpj', 'razaoSocial']);
    } catch (e) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, e.message, {}, ctx.requestId);
    }
    if (!DB_Validation.isValidCNPJ(dados.cnpj)) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'CNPJ inválido.', {}, ctx.requestId);
    }
    const existente = DB_Query.findOne('FORNECEDORES', r => r.cnpj === dados.cnpj);
    if (existente) {
      return Core_Response.ok(existente, 'Fornecedor já cadastrado — retornando existente.', 'SUCCESS', {}, ctx.requestId);
    }
    const registro = DB_Insert.insert('FORNECEDORES', {
      cnpj: dados.cnpj,
      razaoSocial: dados.razaoSocial,
      nomeFantasia: dados.nomeFantasia || '',
      endereco: dados.endereco || '',
      telefone: dados.telefone || '',
      email: dados.email || '',
      dadosFiscais: dados.dadosFiscais || '',
      status: 'ATIVO',
      avaliacao: ''
    });
    Audit_Service.record(ctx, 'FORNECEDOR_CRIADO', { entidade: 'FORNECEDORES', entidadeId: registro.ID });
    return Core_Response.ok(registro, 'Fornecedor cadastrado.', 'SUCCESS', {}, ctx.requestId);
  }

  function update(ctx) {
    const { id, ...patch } = ctx.payload || {};
    if (!id) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'id é obrigatório.', {}, ctx.requestId);
    DB_Update.byId('FORNECEDORES', id, patch);
    Audit_Service.record(ctx, 'FORNECEDOR_ATUALIZADO', { entidade: 'FORNECEDORES', entidadeId: id }, null, patch);
    return Core_Response.ok(DB_Query.get('FORNECEDORES', id), 'Fornecedor atualizado.', 'SUCCESS', {}, ctx.requestId);
  }

  /**
   * Usado internamente pelo fluxo de NF (seção 18). Não é uma
   * rota pública — é chamado por Service_NF.create().
   */
  function findOrCreateByCNPJ(dadosFornecedor) {
    if (!dadosFornecedor || !dadosFornecedor.cnpj) {
      throw Object.assign(new Error('CNPJ do fornecedor é obrigatório na NF.'), { code: CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR });
    }
    const existente = DB_Query.findOne('FORNECEDORES', r => r.cnpj === dadosFornecedor.cnpj);
    if (existente) return { fornecedor: existente, criado: false };

    const registro = DB_Insert.insert('FORNECEDORES', {
      cnpj: dadosFornecedor.cnpj,
      razaoSocial: dadosFornecedor.razaoSocial || '(pendente de complementação)',
      nomeFantasia: dadosFornecedor.nomeFantasia || '',
      endereco: dadosFornecedor.endereco || '',
      telefone: '', email: '', dadosFiscais: '',
      status: 'PENDENTE_COMPLEMENTACAO',
      avaliacao: ''
    });
    return { fornecedor: registro, criado: true };
  }

  return { get, search, create, update, findOrCreateByCNPJ };
})();
