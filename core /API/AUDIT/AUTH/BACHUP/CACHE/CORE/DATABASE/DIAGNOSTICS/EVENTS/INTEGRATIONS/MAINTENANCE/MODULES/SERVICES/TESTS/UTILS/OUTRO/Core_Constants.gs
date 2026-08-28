/**
 * ============================================================
 * ALMOXA PRO — Core_Constants.gs
 * Constantes fixas do sistema. Nada de "número mágico" ou
 * string solta espalhada pelos módulos — tudo referencia daqui.
 * ============================================================
 */

const CORE_CONSTANTS = Object.freeze({
  ENVIRONMENTS: Object.freeze({ DEV: 'DEV', TEST: 'TEST', PROD: 'PROD' }),

  MODULE_STATUS: Object.freeze({
    ACTIVE: 'ACTIVE',
    PENDING: 'PENDING',       // registrado, aguardando implementação da fase
    DISABLED: 'DISABLED',
    ERROR: 'ERROR'
  }),

  PERFIS: Object.freeze({
    ADMIN: 'ADMIN',
    GESTOR: 'GESTOR',
    ALMOXARIFE: 'ALMOXARIFE',
    OPERADOR: 'OPERADOR',
    MESTRE_OBRA: 'MESTRE_OBRA',
    COMPRAS: 'COMPRAS',
    AUDITOR: 'AUDITOR',
    CONSULTA: 'CONSULTA'
  }),

  PERMISSOES: Object.freeze({
    VIEW: 'VIEW', CREATE: 'CREATE', EDIT: 'EDIT', DELETE: 'DELETE',
    APPROVE: 'APPROVE', REJECT: 'REJECT', EXPORT: 'EXPORT',
    IMPORT: 'IMPORT', AUDIT: 'AUDIT', CONFIG: 'CONFIG', ADMIN: 'ADMIN'
  }),

  RESPONSE_CODES: Object.freeze({
    SUCCESS: 'SUCCESS',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    AUTH_REQUIRED: 'AUTH_REQUIRED',
    AUTH_INVALID: 'AUTH_INVALID',
    SESSION_EXPIRED: 'SESSION_EXPIRED',
    PERMISSION_DENIED: 'PERMISSION_DENIED',
    ROUTE_NOT_FOUND: 'ROUTE_NOT_FOUND',
    MODULE_NOT_IMPLEMENTED: 'MODULE_NOT_IMPLEMENTED',
    MODULE_DISABLED: 'MODULE_DISABLED',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    EXTERNAL_INTEGRATION_NOT_CONFIGURED: 'EXTERNAL_INTEGRATION_NOT_CONFIGURED',
    LOCK_TIMEOUT: 'LOCK_TIMEOUT',
    NOT_FOUND: 'NOT_FOUND',
    ESTOQUE_INSUFICIENTE: 'ESTOQUE_INSUFICIENTE'
  }),

  DOCTOR_STATUS: Object.freeze({
    OK: 'OK', WARNING: 'WARNING', ERROR: 'ERROR', NOT_CONFIGURED: 'NOT_CONFIGURED',
    // MÓDULO 14 — os 2 estados que faltavam do mapa de saúde
    // (seção 1 do contrato: 🟢🟡🔴⚪🔵). Aditivo — nenhum status
    // existente foi renomeado, só ganhou vizinhos novos.
    NAO_TESTADO: 'NAO_TESTADO', EM_SINCRONIZACAO: 'EM_SINCRONIZACAO'
  }),

  DIVERGENCIA_TIPOS: Object.freeze([
    'FALTA','EXCESSO','ITEM_DIFERENTE','QUANTIDADE_DIFERENTE',
    'PRODUTO_NAO_CADASTRADO','SEM_CODIGO','AVARIA','UNIDADE_DIVERGENTE',
    'VALOR_DIVERGENTE','FORNECEDOR_DIVERGENTE'
  ]),

  CONFERENCIA_STATUS: Object.freeze([
    'OK','FALTANTE','EXCEDENTE','DIVERGENTE','SEM_CODIGO','NAO_CADASTRADO','PENDENTE'
  ]),

  INVENTARIO_ESTADOS: Object.freeze([
    'CRIADO','LIBERADO','ABERTO','EM_CONTAGEM','EM_RECONTAGEM','PENDENTE_APROVACAO',
    'APROVADO','REPROVADO','FINALIZADO','CANCELADO'
  ]),

  // MÓDULO 05 (Reservas) — os status já usados como string solta
  // desde a Fase 5 (PENDENTE/APROVADA/REPROVADA/CANCELADA/EXPIRADA)
  // viram enum formal aqui, sem renomear nenhum (evitaria quebrar
  // tudo que já depende desses nomes) — só ganham os elos que
  // faltavam pro ciclo completo até a saída física real.
  RESERVA_ESTADOS: Object.freeze([
    'PENDENTE','APROVADA','REPROVADA','EM_SEPARACAO','PRONTA',
    'ATENDIMENTO_PARCIAL','ENTREGUE','CONCLUIDA','CANCELADA','EXPIRADA'
  ]),

  // MÓDULO 06 (Ferramentas) — ciclo de vida operacional de um
  // bem individual/serializado (bem diferente do saldo fungível
  // do Estoque — por isso não é o mesmo enum de RESERVA_ESTADOS).
  FERRAMENTA_ESTADOS: Object.freeze([
    'DISPONIVEL','RESERVADA','EM_USO','EM_MANUTENCAO',
    'AGUARDANDO_VISTORIA','COM_PROBLEMA','BLOQUEADA','EXTRAVIADA','BAIXADA'
  ]),

  // MÓDULO 12 (Notificações) — os valores soltos usados desde a
  // Fase 8 ('APP'/'SISTEMA' em `tipo`) continuam válidos; estes
  // enums formalizam a classificação que o contrato pede, sem
  // invalidar nada que já existe.
  NOTIFICACAO_TIPOS: Object.freeze(['INFORMACAO','AVISO','ATENCAO','APROVACAO','PENDENCIA','ERRO','URGENCIA']),
  NOTIFICACAO_STATUS: Object.freeze(['CRIADA','ENVIADA','RECEBIDA','VISUALIZADA','PROCESSADA','FALHOU']),
  NOTIFICACAO_PRIORIDADES: Object.freeze(['BAIXA','NORMAL','ALTA','URGENTE']),

  BIOMETRIC_TYPES: Object.freeze({ FACIAL: 'FACIAL', DIGITAL: 'DIGITAL', WEBAUTHN: 'WEBAUTHN', OUTRO: 'OUTRO' }),

  LOCK_TIMEOUT_MS: 10000
});
