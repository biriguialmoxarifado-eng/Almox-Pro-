/**
 * ============================================================
 * ALMOXA PRO — SchemaCore.gs
 * BLOCO 02 (contrato "DATA CORE / IMPORTAÇÃO") — seção 21/22.
 *
 * AUDITORIA CONFIRMOU: DB_Mapping.TABLES já existe desde a Fase 1
 * e já cumpre boa parte do "mapeamento por cabeçalho" (seção 8)
 * — mas só guarda o NOME de cada coluna, nunca TIPO,
 * OBRIGATORIEDADE ou VERSÃO. Isso já tinha sido documentado como
 * limitação honesta no relatório do Módulo 07 ("sem metadado de
 * tipo, Service_Migration.validar() não faz conversão nem
 * checagem de tipo"). Este arquivo é essa peça que faltava — NÃO
 * substitui DB_Mapping (continua sendo a fonte de nomes de
 * coluna), só ACRESCENTA um schema tipado por cima, só pras
 * tabelas onde isso importa de verdade (as que passam por
 * importação/migração).
 *
 * Schema não coberto aqui pra uma tabela = comportamento honesto:
 * SchemaCore.get() devolve null, SchemaCore.validate() devolve
 * {valido: true, cobertura: 'SEM_SCHEMA_TIPADO'} — nunca finge
 * validar tipo que não tem como verificar.
 * ============================================================
 */

const SchemaCore = (function () {

  const TIPOS = Object.freeze({ TEXTO: 'TEXTO', NUMERO: 'NUMERO', DATA: 'DATA', BOOLEANO: 'BOOLEANO' });

  const SCHEMAS = {
    PRODUTOS: {
      versao: 1,
      campos: [
        { campo: 'codigo', tipo: TIPOS.TEXTO, obrigatorio: true },
        { campo: 'descricaoOriginal', tipo: TIPOS.TEXTO, obrigatorio: true },
        { campo: 'unidade', tipo: TIPOS.TEXTO, obrigatorio: false },
        { campo: 'categoria', tipo: TIPOS.TEXTO, obrigatorio: false }
      ]
    },
    ESTOQUE: {
      versao: 1,
      campos: [
        { campo: 'produtoId', tipo: TIPOS.NUMERO, obrigatorio: true },
        { campo: 'localizacao', tipo: TIPOS.TEXTO, obrigatorio: true },
        { campo: 'saldo', tipo: TIPOS.NUMERO, obrigatorio: true },
        { campo: 'estoqueMinimo', tipo: TIPOS.NUMERO, obrigatorio: false }
      ]
    },
    FORNECEDORES: {
      versao: 1,
      campos: [
        { campo: 'cnpj', tipo: TIPOS.TEXTO, obrigatorio: true },
        { campo: 'razaoSocial', tipo: TIPOS.TEXTO, obrigatorio: true },
        { campo: 'email', tipo: TIPOS.TEXTO, obrigatorio: false }
      ]
    },
    NOTAS_FISCAIS: {
      versao: 1,
      campos: [
        { campo: 'numero', tipo: TIPOS.TEXTO, obrigatorio: true },
        { campo: 'dataEmissao', tipo: TIPOS.DATA, obrigatorio: true },
        { campo: 'valorTotal', tipo: TIPOS.NUMERO, obrigatorio: false },
        { campo: 'emitenteCNPJ', tipo: TIPOS.TEXTO, obrigatorio: false }
      ]
    }
  };

  function get(table) {
    const schema = SCHEMAS[table];
    if (!schema) return null;
    const colunasReais = DB_Mapping.getExpectedHeaders(table) || [];
    return Object.assign({}, schema, { tabela: table, colunasReais: colunasReais });
  }

  function _tipoConfere(valor, tipo) {
    if (valor === '' || valor === null || valor === undefined) return true;
    switch (tipo) {
      case TIPOS.NUMERO: return !isNaN(Number(valor));
      case TIPOS.DATA: return !isNaN(new Date(valor).getTime());
      case TIPOS.BOOLEANO: return typeof valor === 'boolean' || valor === 'true' || valor === 'false';
      default: return true;
    }
  }

  function validate(table, registro, contextoLinha) {
    const schema = get(table);
    if (!schema) return { valido: true, cobertura: 'SEM_SCHEMA_TIPADO', erros: [] };

    const erros = [];
    schema.campos.forEach(function (def) {
      const valor = registro[def.campo];
      if (def.obrigatorio && (valor === '' || valor === null || valor === undefined)) {
        erros.push(DB_Errors.build({
          code: CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, message: 'Campo obrigatório ausente.',
          module: 'SCHEMA', operation: 'validate', field: def.campo, row: contextoLinha
        }));
        return;
      }
      if (!_tipoConfere(valor, def.tipo)) {
        erros.push(DB_Errors.build({
          code: CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, message: 'Tipo incompatível — esperado ' + def.tipo + '.',
          module: 'SCHEMA', operation: 'validate', field: def.campo, row: contextoLinha
        }));
      }
    });

    return { valido: erros.length === 0, cobertura: 'SCHEMA_TIPADO_V' + schema.versao, erros: erros };
  }

  function getVersion(table) {
    const schema = SCHEMAS[table];
    return schema ? schema.versao : null;
  }

  function getAllSchemaTableNames() {
    return Object.keys(SCHEMAS);
  }

  return { get: get, validate: validate, getVersion: getVersion, getAllSchemaTableNames: getAllSchemaTableNames, TIPOS: TIPOS };
})();
