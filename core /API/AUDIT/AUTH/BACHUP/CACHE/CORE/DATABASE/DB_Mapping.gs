/**
 * ============================================================
 * ALMOXA PRO — DB_Mapping.gs  (CAMADA 2)
 * Mapeamento centralizado das tabelas do sistema (seção 8 —
 * "criar mapeamento centralizado"). Usado por Setup, Doctor e
 * Migration para saber quais tabelas/cabeçalhos DEVEM existir.
 * ============================================================
 */

const DB_Mapping = (function () {

  // Cada entrada: nome da aba -> lista de colunas esperadas.
  // ATENÇÃO: nunca remover coluna existente daqui sem uma
  // Migration correspondente (seção 48).
  const TABLES = {
    USUARIOS: ['ID','matricula','nome','email','telefone','cargo','funcao','perfil','status','obraAtual','ambiente','permissoes','dataCadastro','ultimoAcesso','sessaoAtual','biometricId','faceCredentialId','statusBiometria','consentimentoBiometrico','dataConsentimento','dataAtualizacao','senha_hash','fotoUrl'],
    BIOMETRIA: ['ID','biometricId','userId','provider','credentialReference','status','consentimento','dataCadastro','dataAtualizacao','ultimoUso'],
    PERMISSOES_CUSTOM: ['ID','perfil','permissao','permitido'],
    FORNECEDORES: ['ID','cnpj','razaoSocial','nomeFantasia','endereco','telefone','email','dadosFiscais','status','avaliacao'],
    PRODUTOS: ['ID','codigo','codigoBarras','descricaoOriginal','descricaoNormalizada','categoria','imagemUrl','NCM','unidade','status'],
    NOTAS_FISCAIS: ['ID','chaveNFe','numero','serie','modelo','dataEmissao','dataEntrada','emitenteCNPJ','emitenteNome','destinatarioCNPJ','valorProdutos','valorFrete','valorSeguro','valorDesconto','valorIPI','valorICMS','valorICMSST','valorPIS','valorCOFINS','valorTotal','naturezaOperacao','CFOP','observacoes','xmlFileId','pdfFileId','ocrSource','status'],
    NOTAS_ITENS: ['ID','notaId','itemId','codigoProduto','codigoBarras','descricaoOriginal','descricaoNormalizada','produtoId','NCM','CFOP','unidade','quantidade','valorUnitario','valorTotal','desconto','lote','validade','observacoes'],
    CONFERENCIAS: ['ID','notaId','itemId','esperado','recebido','diferenca','status'],
    DIVERGENCIAS: ['ID','documento','item','tipo','esperado','recebido','diferenca','motivo','observacao','responsavel','status','aprovador','data'],
    ESTOQUE: ['ID','produtoId','localizacao','saldo','reservado','bloqueado','estoqueMinimo','ultimaMovimentacao'],
    MOVIMENTOS: ['ID','tipo','produtoId','quantidade','origem','destino','responsavel','documentoId','obraId','projetoId','atividadeId','data','classificadorPEP'],
    RESERVAS: ['ID','produtoId','localizacao','quantidade','quantidadeAtendida','solicitante','obraId','status','validade','aprovador','motivo','separadorId','dataSeparacao','entregadorId','dataEntrega','dataConclusao','ferramentaId','data'],
    RESERVA_ATENDIMENTOS: ['ID','reservaId','quantidadeAtendida','responsavel','data','localizacao'],

    // ---- MÓDULO 06 (Ferramentas) ----
    FERRAMENTAS: ['ID','codigo','descricao','categoria','marca','modelo','numeroSerie','patrimonio','localizacao','estado','responsavelAtual','dataAquisicao','situacao','dataUltimaVistoria','dataProximaVistoriaSugerida','dataCadastro','dataAtualizacao','dataRetirada','prazoPrevisto'],
    FERRAMENTA_TROCAS: ['ID','ferramentaAnteriorId','ferramentaNovaId','motivo','usuario','executadoPor','data'],
    FERRAMENTA_VISTORIAS: ['ID','ferramentaId','data','responsavel','condicao','desgaste','dano','faltaComponente','naoConformidade','recomendacao','fotos'],
    FERRAMENTA_MANUTENCOES: ['ID','ferramentaId','motivo','responsavel','status','dataAbertura','dataPrevisao','dataConclusao'],

    // ---- MÓDULO 07 (Migration Engine) ----
    MIGRACOES: ['ID','execucaoId','origem','tabelaDestino','status','modo','usuario','dataInicio','dataFim','totalRegistros','validos','invalidos','duplicados','importados','atualizados','ignorados','totalErros','totalAvisos','classificacao','backupId','tempoExecucaoMs'],
    MIGRACAO_ITENS: ['ID','execucaoId','linhaOrigem','acao','registroId','motivo'],

    // ---- MÓDULO 08 (Doctor Engine) ----
    DOCTOR_HISTORICO: ['ID','data','statusGeral','totalErros','totalAvisos','resumoJson'],

    // ---- MÓDULO 09 (AI Engine) ----
    IA_INTERACOES: ['ID','userId','perfil','pergunta','respostaResumo','acaoSolicitada','acaoExecutada','data'],
    IA_PREFERENCIAS: ['ID','userId','categoria','ativo'],
    SAIDAS: ['ID','tipo','produtoId','localizacao','quantidade','reservaId','responsavel','obraId','status','data'],
    INVENTARIOS: ['ID','token','obraId','localizacao','categoria','produtosEscopo','estado','responsavel','equipeAutorizada','dataLiberacao','origem','tipo','dataAbertura','dataFechamento'],
    CONTAGENS: ['ID','inventarioId','produtoId','esperado','contado','diferenca','operador','dispositivo','dataHora','valorUnitario','valorUnitarioDisponivel','valorSistemico','valorContado','diferencaFinanceira'],
    PROJETOS: ['ID','nome','obraId','pep','centroCusto','responsavel'],
    OBRAS: ['ID','nome','endereco','responsavel','status'],
    ATIVIDADES: ['ID','nome','obraId','projetoId','etapa','responsavel','equipe','inicio','fim','progresso','status','prioridade'],
    EQUIPE: ['ID','colaborador','funcao','cargo','equipe','obraId','status'],
    OCORRENCIAS: ['ID','tipo','prioridade','descricao','obraId','projetoId','atividadeId','responsavel','data','status','resolucao','entidade','entidadeId'],
    NOTIFICACOES: ['ID','tipo','destinatario','titulo','mensagem','lida','data','modulo','entidade','entidadeId','prioridade','status','canal','tentativas','ultimoErro','acaoRelacionada'],
    AUDITORIA: ['ID','usuario','acao','modulo','entidade','entidadeId','antes','depois','data','hora','ip','origem','resultado','correlationId','obraId','status'],
    BACKUPS: ['ID','data','versao','responsavel','arquivosJson','status','tipo'],
    SOLICITACOES: ['ID','numero','solicitanteId','obraId','status','observacao','data','dataAprovacao','aprovadorId','motivoReprovacao','dataConclusao'],
    SOLICITACAO_ITENS: ['ID','solicitacaoId','produtoId','descricaoProduto','codigoProduto','quantidade','unidade','statusItem'],

    // ---- MÓDULO 03 (Compras/Pré-Compra) ----
    PRE_COMPRAS: ['ID','numero','status','origem','solicitanteId','obraId','projetoId','atividadeId','justificativa','dataAbertura','dataAtualizacao','aprovadorId','dataAprovacao','motivoReprovacao'],
    PRE_COMPRA_ITENS: ['ID','preCompraId','produtoId','codigoProduto','descricaoProduto','quantidadeSugerida','unidade','saldoNoMomento','estoqueMinimoNoMomento','classificacaoNoMomento','consumoMedioDiarioNoMomento','diasCoberturaNoMomento','precoReferenciaMin','precoReferenciaMedio','precoReferenciaMax','historicoPrecoSuficiente','fornecedorSugeridoId'],
    CONFIGURACOES: ['chave','valor','descricao'],
    // Legado a preservar (seção 8)
    CADASTRO_EMPRESAS: ['ID','nome','cnpj'],
    REGISTRO: ['ID','tipo','dados'],
    ENTRADA: ['ID','fornecedorId','data'],
    DETALHES_CHEGADA: ['ID','entradaId','detalhes'],
    RELATORIO_GERAL: ['ID','tipo','geradoEm'],
    RELATORIO_MES: ['ID','mes','ano'],
    CONSULTA: ['ID','termo','modulo'],
    ETIQUETA: ['ID','tipo','referenciaId','conteudoQR','codigoBarras','tamanho','fonte','geradoEm','modeloId','camposExibidos'],
    ETIQUETA_MODELOS: ['ID','nome','tipo','largura','altura','margem','fonte','tamanhoFonte','negrito','alinhamento','espacamento','tamanhoQR','posicaoQR','orientacao','temCodigoBarras','camposExibidos','impressoraPadrao','padrao','situacao','criadoPor','dataCriacao','dataAtualizacao'],
    IMPRESSAO: ['ID','etiquetaId','formato'],
    BANCO_DE_DADOS: ['ID','chave','valor'],
    RASTREIO_PEDIDO: ['ID','pedidoId','status'],
    SISTEMA_SAP: ['ID','tipoRelatorio','arquivoId','numeroPedido','item','produtoCodigo','produtoId','quantidade','valorUnitario','dataEntrega','centroCusto','pep','fornecedorCNPJ','status','importadoEm'],
    RADIER: ['ID','item','status'],
    PLANTA_BAIXA: ['ID','obraId','imagemUrl'],
    LIBERACAO_SERVICO: ['ID','servico','status'],
    KIT_RESERVA: ['ID','nome','produtosJson'],
    CADASTRO_PRODUTO: ['ID','codigo','descricao'],
    ARQUIVO_MORTO: ['ID','referenciaModulo','referenciaId'],
    DIGITALIZACAO: ['ID','driveFileId','tipo'],
    CONTROLE_R6: ['ID','descricao','status'],
    TRIAGEM_ATIVIDADES: ['ID','atividadeId','coluna'],
    PROJETO_DE_OBRA: ['ID','projetoId','obraId']
  };

  function getExpectedHeaders(table) { return TABLES[table] || null; }
  function getAllTableNames() { return Object.keys(TABLES); }

  return { TABLES, getExpectedHeaders, getAllTableNames };
})();
