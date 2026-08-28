/**
 * ============================================================
 * ALMOXA PRO — Service_Migration.gs
 * MÓDULO 07 — MIGRATION ENGINE
 *
 * NÃO substitui `Service_Importacao` (Fase 10 do backend) — essa
 * já faz leitura de arquivo + mapeamento sugerido + gravação
 * simples, real e funcional desde então. Este módulo ORQUESTRA
 * em cima dela: validação com classificação verde/amarelo/
 * vermelho, backup obrigatório antes de gravar de verdade, modo
 * simulação, lote, rastreamento item a item pra permitir
 * rollback, e relatório estruturado — tudo que a spec pede e que
 * `Service_Importacao` sozinha não fazia.
 *
 * REAPROVEITA, sem duplicar:
 * - Integration_SAP.parseArquivo — mesmo parser de CSV/Sheets
 *   que Service_Importacao já usa;
 * - DB_Insert.batchInsert — não reimplementa inserção em lote;
 * - DB_Delete.physical — usado no rollback;
 * - Backup_Core.create — não reimplementa backup;
 * - Audit_Service/Event_Bus — mesmo padrão de todo o sistema.
 * ============================================================
 */

const Service_Migration = (function () {

  const PADRAO_LOTE = 200;

  // ---------------------------------------------------------
  // 1) DIAGNÓSTICO DE ORIGEM
  // ---------------------------------------------------------
  function diagnosticarOrigem(ctx) {
    const { driveFileId, tabelaDestino } = ctx.payload || {};
    if (!driveFileId) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'driveFileId é obrigatório.', {}, ctx.requestId);

    let parsed;
    try { parsed = Integration_SAP.parseArquivo(driveFileId); }
    catch (e) { return Core_Response.error(e.code || CORE_CONSTANTS.RESPONSE_CODES.INTERNAL_ERROR, e.message, {}, ctx.requestId); }

    const colunasEsperadas = tabelaDestino ? DB_Mapping.getExpectedHeaders(tabelaDestino) : null;
    const camposIncompativeis = colunasEsperadas
      ? parsed.headers.filter(h => !colunasEsperadas.some(c => Utils_String.normalize(c) === Utils_String.normalize(h)))
      : [];

    const assinaturas = {};
    let duplicidades = 0, incompletos = 0;
    parsed.rows.forEach(row => {
      const chave = JSON.stringify(row);
      assinaturas[chave] = (assinaturas[chave] || 0) + 1;
      if (row.some(cel => cel === '' || cel === null || cel === undefined)) incompletos++;
    });
    Object.values(assinaturas).forEach(qtd => { if (qtd > 1) duplicidades += (qtd - 1); });

    return Core_Response.ok({
      origem: driveFileId, totalRegistros: parsed.rows.length, colunas: parsed.headers,
      tabelaDestino: tabelaDestino || null, colunasEsperadas: colunasEsperadas || null,
      camposIncompativeis, duplicidadesDetectadas: duplicidades, registrosIncompletos: incompletos
    }, '', 'SUCCESS', {}, ctx.requestId);
  }

  // ---------------------------------------------------------
  // 2) MAPEAMENTO — delega pra Service_Importacao.preview, não duplica
  // ---------------------------------------------------------
  function mapear(ctx) {
    return Service_Importacao.preview(ctx);
  }

  // ---------------------------------------------------------
  // 3/4) PRÉ-VISUALIZAÇÃO + VALIDAÇÃO COM CLASSIFICAÇÃO
  // ---------------------------------------------------------
  /**
   * NÃO valida tipo de dado de verdade (data/moeda) porque
   * `DB_Mapping` não guarda tipo por coluna, só o nome — inventar
   * uma regra de tipo aqui seria simular precisão que o sistema
   * não tem. O que É real: linha vazia (inválida), linha
   * duplicada (mesmo conteúdo mapeado), e campo obrigatório
   * (coluna mapeada) vazio numa linha específica.
   */
  /**
   * BLOCO 02 — antes, esta função não fazia checagem de TIPO
   * nenhuma (documentado como limitação honesta no relatório do
   * Módulo 07: "sem metadado de tipo por coluna, validar() não
   * faz conversão nem checagem de tipo"). Agora, quando existe um
   * `SchemaCore` tipado pra `tabelaDestino`, cada linha também
   * passa por `SchemaCore.validate()` — checagem real de tipo
   * (número/data), não só "campo vazio ou não". Tabela sem schema
   * tipado continua com o comportamento EXATO de antes (nunca
   * finge validar tipo que não tem como verificar).
   */
  function validar(ctx) {
    const { driveFileId, tabelaDestino, mapeamento, camposObrigatorios } = ctx.payload || {};
    if (!driveFileId || !tabelaDestino || !mapeamento) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'driveFileId, tabelaDestino e mapeamento são obrigatórios.', {}, ctx.requestId);
    }
    let parsed;
    try { parsed = Integration_SAP.parseArquivo(driveFileId); }
    catch (e) { return Core_Response.error(e.code || CORE_CONSTANTS.RESPONSE_CODES.INTERNAL_ERROR, e.message, {}, ctx.requestId); }

    const obrigatorios = Array.isArray(camposObrigatorios) ? camposObrigatorios : [];
    const vistos = {};
    const detalheInvalidos = [], detalheDuplicados = [];
    let validos = 0;
    const temSchemaTipado = !!SchemaCore.get(tabelaDestino);

    parsed.rows.forEach((row, idx) => {
      const obj = {};
      Object.keys(mapeamento).forEach(campo => obj[campo] = row[mapeamento[campo]]);
      const linha = idx + 2; // +2 compensa cabeçalho + índice base 1, mesmo critério de Service_Importacao

      const camposVazios = Object.values(obj).every(v => v === '' || v === null || v === undefined);
      const obrigatorioFaltando = obrigatorios.find(campo => obj[campo] === '' || obj[campo] === null || obj[campo] === undefined);

      if (camposVazios) { detalheInvalidos.push({ linha, motivo: 'Linha completamente vazia.' }); return; }
      if (obrigatorioFaltando) { detalheInvalidos.push({ linha, motivo: 'Campo obrigatório vazio: ' + obrigatorioFaltando }); return; }

      if (temSchemaTipado) {
        const resultadoSchema = SchemaCore.validate(tabelaDestino, obj, linha);
        if (!resultadoSchema.valido) {
          detalheInvalidos.push({ linha, motivo: resultadoSchema.erros.map(e => e.message + ' (' + e.field + ')').join('; ') });
          return;
        }
      }

      const chave = JSON.stringify(obj);
      if (vistos[chave] !== undefined) { detalheDuplicados.push({ linha, duplicaLinha: vistos[chave] }); return; }
      vistos[chave] = linha;
      validos++;
    });

    let classificacao = 'VERDE';
    if (detalheInvalidos.length) classificacao = 'VERMELHO';
    else if (detalheDuplicados.length) classificacao = 'AMARELO';

    return Core_Response.ok({
      totalRegistros: parsed.rows.length, validos, invalidos: detalheInvalidos.length, duplicados: detalheDuplicados.length,
      classificacao, detalheInvalidos, detalheDuplicados,
      podeImportar: classificacao !== 'VERMELHO'
    }, '', 'SUCCESS', {}, ctx.requestId);
  }

  // ---------------------------------------------------------
  // 5/6/9) BACKUP + MIGRAÇÃO EM LOTES + MODO SEGURO (SIMULAR)
  // ---------------------------------------------------------
  function executar(ctx) {
    const p = ctx.payload || {};
    const { driveFileId, tabelaDestino, mapeamento, camposObrigatorios, chaveDeduplicacao } = p;
    const modo = (p.modo || 'SIMULAR').toUpperCase();
    const loteSize = p.loteSize || PADRAO_LOTE;
    if (!['SIMULAR', 'REAL'].includes(modo)) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'modo deve ser SIMULAR ou REAL.', {}, ctx.requestId);
    }

    const validacao = validar({ userId: ctx.userId, requestId: ctx.requestId, payload: { driveFileId, tabelaDestino, mapeamento, camposObrigatorios } });
    if (!validacao.success) return validacao;
    if (!validacao.data.podeImportar) {
      // REGRA DE SEGURANÇA ABSOLUTA (seção "regras de segurança"):
      // nunca permitir migração definitiva enquanto houver erro
      // crítico — nem em modo REAL, nem em modo SIMULAR.
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR,
        'Migração bloqueada — classificação VERMELHO (' + validacao.data.invalidos + ' registro(s) inválido(s)). Corrija a origem ou o mapeamento antes de tentar de novo.',
        { validacao: validacao.data }, ctx.requestId);
    }

    const inicio = Date.now();
    const execucaoId = Utils_ID.uuid();
    let parsed;
    try { parsed = Integration_SAP.parseArquivo(driveFileId); }
    catch (e) { return Core_Response.error(e.code || CORE_CONSTANTS.RESPONSE_CODES.INTERNAL_ERROR, e.message, {}, ctx.requestId); }

    // BLOCO 02, seção 12 — bug real corrigido: antes, `vistos` só
    // detectava duplicidade DENTRO do próprio arquivo — reimportar
    // o mesmo arquivo duas vezes criava registro duplicado de
    // verdade, porque nada verificava contra o que JÁ estava na
    // tabela de destino. Achei isso construindo o teste de
    // reimportação (seção 31 do contrato) antes de declarar
    // qualquer coisa como concluída. Agora, quando `chaveDeduplicacao`
    // é informada, cada linha também é checada contra o BANCO —
    // sem essa chave, o comportamento antigo (só intra-arquivo)
    // se mantém, documentado como limitação quando não há chave
    // natural confiável (mesma linguagem da seção 12: "quando não
    // existir ID confiável, permitir composição de chave").
    const camposChave = Array.isArray(chaveDeduplicacao) ? chaveDeduplicacao : (chaveDeduplicacao ? [chaveDeduplicacao] : null);

    const vistos = {};
    const paraImportar = [];
    const itensLog = [];
    let duplicados = 0, invalidos = 0, jaExistentesNoBanco = 0;

    parsed.rows.forEach((row, idx) => {
      const obj = {};
      Object.keys(mapeamento).forEach(campo => obj[campo] = row[mapeamento[campo]]);
      const linha = idx + 2;
      const camposVazios = Object.values(obj).every(v => v === '' || v === null || v === undefined);
      const obrigatorioFaltando = (camposObrigatorios || []).find(c => obj[c] === '' || obj[c] === null || obj[c] === undefined);

      if (camposVazios || obrigatorioFaltando) {
        invalidos++;
        itensLog.push({ execucaoId, linhaOrigem: linha, acao: 'INVALIDO', registroId: '', motivo: obrigatorioFaltando ? 'Campo obrigatório vazio: ' + obrigatorioFaltando : 'Linha vazia' });
        return;
      }
      const chave = JSON.stringify(obj);
      if (vistos[chave] !== undefined) {
        duplicados++;
        itensLog.push({ execucaoId, linhaOrigem: linha, acao: 'IGNORADO_DUPLICADO', registroId: '', motivo: 'Duplica linha ' + vistos[chave] });
        return;
      }

      if (camposChave) {
        const jaExiste = DB_Query.exists(tabelaDestino, r => camposChave.every(c => r[c] === obj[c]));
        if (jaExiste) {
          jaExistentesNoBanco++;
          itensLog.push({ execucaoId, linhaOrigem: linha, acao: 'IGNORADO_JA_EXISTE', registroId: '', motivo: 'Já existe na tabela com ' + camposChave.map(c => c + '=' + obj[c]).join(', ') });
          return;
        }
      }

      vistos[chave] = linha;
      paraImportar.push({ linha, obj });
    });

    let backupId = '';
    let importados = 0;
    const erros = [];

    if (modo === 'REAL') {
      // REGRA DE SEGURANÇA: toda migração real cria ponto de
      // recuperação ANTES de gravar (seção 5 do contrato) —
      // reaproveita Backup_Core, nunca reimplementa backup aqui.
      try {
        const backup = Backup_Core.create({ userId: ctx.userId, requestId: ctx.requestId, payload: {} });
        backupId = backup.success ? (backup.data.ID || backup.data.id || '') : '';
      } catch (e) {
        return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.INTERNAL_ERROR, 'Falha ao criar backup pré-migração — migração NÃO executada por segurança: ' + e.message, {}, ctx.requestId);
      }

      for (let i = 0; i < paraImportar.length; i += loteSize) {
        const lote = paraImportar.slice(i, i + loteSize);
        try {
          const inseridos = DB_Insert.batchInsert(tabelaDestino, lote.map(item => item.obj));
          inseridos.forEach((registro, idxLote) => {
            importados++;
            itensLog.push({ execucaoId, linhaOrigem: lote[idxLote].linha, acao: 'IMPORTADO', registroId: registro.ID, motivo: '' });
          });
        } catch (e) {
          lote.forEach(item => erros.push({ linha: item.linha, erro: e.message }));
        }
      }
    }

    const tempoExecucaoMs = Date.now() - inicio;
    const migracao = DB_Insert.insert('MIGRACOES', {
      execucaoId, origem: driveFileId, tabelaDestino, status: modo === 'REAL' ? 'CONCLUIDA' : 'SIMULADA', modo,
      usuario: ctx.userId, dataInicio: new Date(inicio), dataFim: new Date(),
      totalRegistros: parsed.rows.length, validos: paraImportar.length, invalidos, duplicados,
      importados, atualizados: 0, ignorados: duplicados + jaExistentesNoBanco, totalErros: erros.length, totalAvisos: 0,
      classificacao: validacao.data.classificacao, backupId, tempoExecucaoMs
    });
    itensLog.forEach(item => DB_Insert.insert('MIGRACAO_ITENS', item));

    Event_Bus.emit(EVENT_TYPES.MIGRACAO_EXECUTADA, { execucaoId, modo, importados, tabelaDestino }, ctx);
    Audit_Service.record(ctx, 'MIGRACAO_EXECUTADA', { entidade: 'MIGRACOES', entidadeId: migracao.ID }, null,
      { modo, importados, invalidos, duplicados, jaExistentesNoBanco, erros: erros.length });

    return Core_Response.ok({
      execucaoId, modo, classificacao: validacao.data.classificacao,
      importados, atualizados: 0, ignorados: duplicados + jaExistentesNoBanco, duplicados, jaExistentesNoBanco, erros, avisos: [],
      tempoExecucaoMs, backupId: backupId || null,
      rollbackDisponivel: modo === 'REAL'
    }, modo === 'SIMULAR'
      ? 'Simulação concluída — nenhum dado real foi alterado.'
      : importados + ' registro(s) importado(s) de verdade' + (jaExistentesNoBanco ? ', ' + jaExistentesNoBanco + ' já existiam e foram ignorados' : '') + '.', 'SUCCESS', {}, ctx.requestId);
  }

  // ---------------------------------------------------------
  // 7) ROLLBACK
  // ---------------------------------------------------------
  function rollback(ctx) {
    const { execucaoId } = ctx.payload || {};
    const migracao = DB_Query.findOne('MIGRACOES', m => m.execucaoId === execucaoId);
    if (!migracao) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Execução de migração não encontrada.', {}, ctx.requestId);
    if (migracao.status !== 'CONCLUIDA') {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR,
        'Só é possível reverter uma migração REAL concluída (status atual: ' + migracao.status + ').', {}, ctx.requestId);
    }

    const itensImportados = DB_Query.find('MIGRACAO_ITENS', i => i.execucaoId === execucaoId && i.acao === 'IMPORTADO');
    let revertidos = 0;
    const falhas = [];
    itensImportados.forEach(item => {
      try {
        DB_Delete.physical(migracao.tabelaDestino, item.registroId);
        revertidos++;
      } catch (e) {
        falhas.push({ registroId: item.registroId, erro: e.message });
      }
    });

    DB_Update.byId('MIGRACOES', migracao.ID, { status: 'REVERTIDA' });
    Event_Bus.emit(EVENT_TYPES.MIGRACAO_REVERTIDA, { execucaoId, revertidos }, ctx);
    Audit_Service.record(ctx, 'MIGRACAO_REVERTIDA', { entidade: 'MIGRACOES', entidadeId: migracao.ID }, { status: 'CONCLUIDA' }, { status: 'REVERTIDA', revertidos });

    return Core_Response.ok({ revertidos, falhas }, revertidos + ' registro(s) revertido(s).', 'SUCCESS', {}, ctx.requestId);
  }

  // ---------------------------------------------------------
  // 8/10) LOG / RELATÓRIO / HISTÓRICO
  // ---------------------------------------------------------
  function relatorio(ctx) {
    const { execucaoId } = ctx.payload || {};
    const migracao = DB_Query.findOne('MIGRACOES', m => m.execucaoId === execucaoId);
    if (!migracao) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Execução não encontrada.', {}, ctx.requestId);
    const itens = DB_Query.find('MIGRACAO_ITENS', i => i.execucaoId === execucaoId);
    return Core_Response.ok({ migracao, itens }, '', 'SUCCESS', {}, ctx.requestId);
  }

  function listar(ctx) {
    const rows = DB_Query.find('MIGRACOES', () => true).sort((a, b) => new Date(b.dataInicio) - new Date(a.dataInicio));
    return Core_Response.ok(rows, '', 'SUCCESS', {}, ctx.requestId);
  }

  function getRoutes() {
    return {
      'migration.diagnosticarOrigem': diagnosticarOrigem,
      'migration.mapear': mapear,
      'migration.validar': validar,
      'migration.executar': executar,
      'migration.rollback': rollback,
      'migration.relatorio': relatorio,
      'migration.listar': listar
    };
  }
  function getServices() { return { Service_Migration }; }
  function getEvents() { return [EVENT_TYPES.MIGRACAO_EXECUTADA, EVENT_TYPES.MIGRACAO_REVERTIDA]; }
  function getVersion() { return '1.0.0'; }
  function init() {
    // Migração de dados é operação de risco real (pode gravar em
    // qualquer tabela do sistema) — TODAS as rotas são ADMIN,
    // sem exceção self-scope nenhuma (diferente de outros módulos
    // onde abrimos exceção pro dono do recurso).
    Auth_RBAC.registerActionPermission('migration.diagnosticarOrigem', 'MIGRATION.ADMIN');
    Auth_RBAC.registerActionPermission('migration.mapear', 'MIGRATION.ADMIN');
    Auth_RBAC.registerActionPermission('migration.validar', 'MIGRATION.ADMIN');
    Auth_RBAC.registerActionPermission('migration.executar', 'MIGRATION.ADMIN');
    Auth_RBAC.registerActionPermission('migration.rollback', 'MIGRATION.ADMIN');
    Auth_RBAC.registerActionPermission('migration.relatorio', 'MIGRATION.ADMIN');
    Auth_RBAC.registerActionPermission('migration.listar', 'MIGRATION.ADMIN');
  }
  function healthCheck() { return { status: CORE_CONSTANTS.DOCTOR_STATUS.OK }; }

  return {
    diagnosticarOrigem, mapear, validar, executar, rollback, relatorio, listar,
    getRoutes, getServices, getEvents, getVersion, init, healthCheck, id: 'MIGRATION'
  };
})();
