/**
 * ============================================================
 * ALMOXA PRO — Event_Types.gs  (CAMADA 4)
 * Catálogo fixo de eventos do sistema (seção 42). Módulos não
 * devem "inventar" nome de evento solto — usam esta lista.
 * ============================================================
 */

const EVENT_TYPES = Object.freeze({
  NF_RECEBIDA: 'NF_RECEBIDA',
  NF_CONFERIDA: 'NF_CONFERIDA',
  NF_DIVERGENCIA: 'NF_DIVERGENCIA',
  NF_APROVADA: 'NF_APROVADA',
  ESTOQUE_ENTRADA: 'ESTOQUE_ENTRADA',
  ESTOQUE_SAIDA: 'ESTOQUE_SAIDA',
  RESERVA_CRIADA: 'RESERVA_CRIADA',
  RESERVA_APROVADA: 'RESERVA_APROVADA',
  RESERVA_EXPIRADA: 'RESERVA_EXPIRADA',

  // ---- MÓDULO 05 (Reservas) — completam o catálogo (os 3 acima
  // já existiam e continuam do mesmo jeito). Implementados de
  // verdade em Service_Reserva.gs, não são só contrato.
  RESERVA_APROVACAO_SOLICITADA: 'RESERVA_APROVACAO_SOLICITADA',
  RESERVA_REPROVADA: 'RESERVA_REPROVADA',
  RESERVA_EXPIRANDO: 'RESERVA_EXPIRANDO',
  RESERVA_SEPARACAO: 'RESERVA_SEPARACAO',
  RESERVA_PRONTA: 'RESERVA_PRONTA',
  RESERVA_ENTREGUE: 'RESERVA_ENTREGUE',
  RESERVA_CONCLUIDA: 'RESERVA_CONCLUIDA',
  RESERVA_CANCELADA: 'RESERVA_CANCELADA',

  // ---- BLOCO 05 (Reservas) — atendimento parcial nunca existia
  // antes: reserva.entregar() só fazia tudo-ou-nada.
  RESERVA_ATENDIMENTO_PARCIAL: 'RESERVA_ATENDIMENTO_PARCIAL',

  INVENTARIO_ABERTO: 'INVENTARIO_ABERTO',
  INVENTARIO_FINALIZADO: 'INVENTARIO_FINALIZADO',

  // ---- MÓDULO 04 (Inventário) — implementados de verdade,
  // complementam (não substituem) os dois acima que já existiam.
  INVENTARIO_CRIADO: 'INVENTARIO_CRIADO',
  INVENTARIO_LIBERADO: 'INVENTARIO_LIBERADO',
  INVENTARIO_INICIADO: 'INVENTARIO_INICIADO',
  INVENTARIO_DIVERGENCIA: 'INVENTARIO_DIVERGENCIA',
  INVENTARIO_RECONTAGEM: 'INVENTARIO_RECONTAGEM',
  INVENTARIO_FECHADO: 'INVENTARIO_FECHADO',
  INVENTARIO_RELATORIO_PRONTO: 'INVENTARIO_RELATORIO_PRONTO',

  // ---- BLOCO 04 (Módulo de Inventário) — `CANCELADO` já existia
  // no enum `INVENTARIO_ESTADOS` desde o Módulo 04 original, mas
  // NENHUMA função jamais fazia essa transição (mesma classe de
  // "peça reservada, nunca ligada" já vista em `MODULE_DISABLED`
  // e `RESPONSE_CODES.MODULE_DISABLED`).
  INVENTARIO_CANCELADO: 'INVENTARIO_CANCELADO',
  OCORRENCIA_CRIADA: 'OCORRENCIA_CRIADA',
  USUARIO_LOGIN: 'USUARIO_LOGIN',
  USUARIO_LOGOUT: 'USUARIO_LOGOUT',
  BIOMETRIA_VALIDADA: 'BIOMETRIA_VALIDADA',
  BACKUP_REALIZADO: 'BACKUP_REALIZADO',
  ERRO_SISTEMA: 'ERRO_SISTEMA',

  // ---- FASE 3 V3 (Front Mobile) — contratos de evento pra
  // módulos futuros (Reservas de EPI, Ficha de EPI, Ferramentas).
  // Nenhum desses é emitido ainda — só o NOME existe, seção 23/32
  // da spec é explícita: infraestrutura, não implementação.
  RESERVA_ATENDIDA: 'RESERVA_ATENDIDA',
  EPI_SEPARADO: 'EPI_SEPARADO',
  EPI_ENTREGUE: 'EPI_ENTREGUE',
  EPI_DEVOLVIDO: 'EPI_DEVOLVIDO',
  FICHA_EPI_ATUALIZADA: 'FICHA_EPI_ATUALIZADA',
  FERRAMENTA_RETIRADA: 'FERRAMENTA_RETIRADA',
  FERRAMENTA_DEVOLVIDA: 'FERRAMENTA_DEVOLVIDA',

  // ---- MÓDULO 06 (Ferramentas) — completam o catálogo (os 2
  // acima já existiam como contrato reservado desde a Fase 3 V3
  // do Front Mobile; agora TODOS são implementados de verdade
  // em Service_Ferramenta.gs).
  FERRAMENTA_CADASTRADA: 'FERRAMENTA_CADASTRADA',
  FERRAMENTA_RESERVADA: 'FERRAMENTA_RESERVADA',
  FERRAMENTA_ATRASADA: 'FERRAMENTA_ATRASADA',
  FERRAMENTA_NAO_CONFORME: 'FERRAMENTA_NAO_CONFORME',
  FERRAMENTA_MANUTENCAO: 'FERRAMENTA_MANUTENCAO',
  // BLOCO 06 — gaps reais: `concluirManutencao()` já auditava a
  // string 'FERRAMENTA_MANUTENCAO_CONCLUIDA' mas nunca existia um
  // evento correspondente pra emitir de verdade; `trocar()` nunca
  // existia, então também nunca teve evento.
  FERRAMENTA_MANUTENCAO_CONCLUIDA: 'FERRAMENTA_MANUTENCAO_CONCLUIDA',
  FERRAMENTA_TROCADA: 'FERRAMENTA_TROCADA',
  FERRAMENTA_EXTRAVIADA: 'FERRAMENTA_EXTRAVIADA',
  FERRAMENTA_VISTORIA_PENDENTE: 'FERRAMENTA_VISTORIA_PENDENTE',
  FERRAMENTA_BAIXADA: 'FERRAMENTA_BAIXADA',

  // ---- MÓDULO 07 (Migration Engine)
  MIGRACAO_EXECUTADA: 'MIGRACAO_EXECUTADA',
  MIGRACAO_REVERTIDA: 'MIGRACAO_REVERTIDA',

  // ---- FASE 6 (Front Mobile) — estes já são emitidos de verdade
  // por Service_Solicitacao.gs, diferente dos contratos acima
  // (que ainda aguardam os módulos donos serem construídos).
  SOLICITACAO_CRIADA: 'SOLICITACAO_CRIADA',
  SOLICITACAO_APROVADA: 'SOLICITACAO_APROVADA',
  SOLICITACAO_REPROVADA: 'SOLICITACAO_REPROVADA',
  SOLICITACAO_CONCLUIDA: 'SOLICITACAO_CONCLUIDA',

  // ---- MÓDULO 01 (Usuários/Identidade) — implementados de
  // verdade em Service_Usuario.gs (create/update), não são só
  // contrato à espera de um módulo futuro.
  USER_CREATED: 'USER_CREATED',
  USER_UPDATED: 'USER_UPDATED',
  USER_PROFILE_CHANGED: 'USER_PROFILE_CHANGED',
  USER_STATUS_CHANGED: 'USER_STATUS_CHANGED',

  // ---- MÓDULO 02 (Estoque) — gatilho real pra pré-compra,
  // implementado de verdade em Service_Estoque.verificarNiveis().
  // O Estoque só EMITE o evento — quem decide o que fazer com
  // ele é o Módulo 03 (regra explícita do contrato: "sem criar
  // a compra dentro do Estoque").
  ESTOQUE_AMARELO_IDENTIFICADO: 'ESTOQUE_AMARELO_IDENTIFICADO',

  // ---- MÓDULO 03 (Compras/Pré-Compra) — implementados de
  // verdade em Service_PreCompra.gs.
  PRE_COMPRA_CRIADA: 'PRE_COMPRA_CRIADA',
  PRE_COMPRA_ENVIADA_APROVACAO: 'PRE_COMPRA_ENVIADA_APROVACAO',
  PRE_COMPRA_ATUALIZADA: 'PRE_COMPRA_ATUALIZADA',

  // ---- BLOCO 03 (API Interna + Comunicação Central) — ciclo de
  // vida de módulo, implementados de verdade em
  // Core_ModuleManager.initAll() (nunca existiam antes — cada
  // módulo já tinha `status` no descritor, mas ninguém EMITIA
  // evento nenhum quando esse status mudava durante o boot).
  MODULE_REGISTERED: 'MODULE_REGISTERED',
  MODULE_STARTED: 'MODULE_STARTED',
  MODULE_ERROR: 'MODULE_ERROR',

  // DATA_READ/DATA_WRITE: nomes formalizados no catálogo (seção 7
  // pede eventos padronizados), mas DELIBERADAMENTE NÃO
  // conectados a cada leitura/escrita individual do DB_Query/
  // DB_Insert — isso explodiria o volume de EVENTOS_LOG (toda
  // leitura de qualquer tela viraria uma linha) e adicionaria
  // custo em cada operação do sistema inteiro, pra um ganho de
  // rastreabilidade que os eventos já granulares por domínio
  // (ESTOQUE_ENTRADA/SAIDA, MIGRACAO_EXECUTADA, RESERVA_CRIADA...)
  // já cobrem melhor. Documentado no relatório do Bloco 03 —
  // decisão consciente, não esquecimento.
  DATA_READ: 'DATA_READ',
  DATA_WRITE: 'DATA_WRITE'
});
