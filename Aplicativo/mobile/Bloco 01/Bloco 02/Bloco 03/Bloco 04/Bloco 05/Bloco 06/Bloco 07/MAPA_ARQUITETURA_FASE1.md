# ALMOXA PRO v2 — ENTREGA DA FASE 1 (Arquitetura e Contratos)

Conforme exigido na seção 73 da especificação. Sem HTML, sem telas —
só o esqueleto real do backend.

---

## 1) Árvore de arquivos (143 arquivos .gs)

```
/CORE (11)          Core_Config, Core_Constants, Core_Response, Core_API,
                     Core_Router, Core_Registry, Core_ModuleManager,
                     Core_Version, Core_State, Core_Context, Core_Health

/AUTH (7)           Auth_Service, Auth_Session, Auth_Permissions, Auth_RBAC,
                     Auth_Tokens, Auth_Biometric, Auth_Audit

/DATABASE (9)       DB_Core, DB_Query, DB_Insert, DB_Update, DB_Delete,
                     DB_Transaction, DB_Mapping, DB_Validation, DB_Lock

/CACHE (2)          Cache_Core, Cache_Manager

/EVENTS (4)         Event_Core, Event_Bus, Event_Types, Event_Handler

/AUDIT (3)          Audit_Core, Audit_Service, Audit_Events

/DIAGNOSTICS (7)    Doctor_Core, Doctor_Modules, Doctor_API, Doctor_Database,
                     Doctor_Health, Doctor_Recovery, Doctor_Report

/BACKUP (6)         Backup_Core, Backup_Sheets, Backup_Files, Backup_Config,
                     Backup_Restore, Backup_Verification

/API (19 arquivos, 20 grupos de rota — Cadastros cobre produto+fornecedor)
                     API_Dashboard, API_NF (+ ocr.*), API_Cadastros
                     (produto.*, fornecedor.*), API_Conferencia, API_Estoque,
                     API_Reservas, API_Saidas, API_Inventario, API_Projetos,
                     API_Obras, API_Atividades, API_Equipe, API_Ocorrencias,
                     API_Relatorios, API_Notificacoes, API_Usuarios,
                     API_Configuracoes, API_SAP, API_Etiquetas
                     (Auth, Auditoria, Backup, Doutor e Biometria não têm
                     arquivo API_* próprio — expõem getRoutes() direto no
                     Service/Core correspondente, evitando arquivo vazio)

/SERVICES (25)      Service_Dashboard, Service_NF, Service_Fornecedor,
                     Service_Produto, Service_Conferencia, Service_Estoque,
                     Service_Reserva, Service_Saida, Service_Inventario,
                     Service_Projeto, Service_Obra, Service_Atividade,
                     Service_Equipe, Service_Ocorrencia, Service_Relatorio,
                     Service_Notificacao, Service_Usuario, Service_Config,
                     Service_Auditoria, Service_Backup, Service_SAP,
                     Service_Biometria, Service_OCR, Service_Etiqueta,
                     Service_IA

/MODULES (22)       MOD_00 a MOD_25 (exceto os 5 já implementados como
                     objeto real) + _ModuleList.gs (registro mestre)

/INTEGRATIONS (8)   Integration_GoogleDrive, Integration_GoogleSheets,
                     Integration_SAP, Integration_OCR, Integration_Biometric,
                     Integration_Email, Integration_PDF,
                     Integration_ExternalAPI

/UTILS (11)         Utils_Date, Utils_Currency, Utils_String, Utils_Array,
                     Utils_Object, Utils_ID, Utils_JSON, Utils_Security,
                     Utils_Validation, Utils_File, Utils_Log

/TESTS (5)          Test_Core, Test_Database, Test_Auth, Test_Router
                     (com Test_RunAll), Test_RouterAPI

/MAINTENANCE (2) — NOVO, fora da spec original, pedido por você
                     Maintenance_Core, Maintenance_Sandbox

Code.gs             doGet (health-check JSON) + doPost (Core_API.call) —
                     SEM HTML, conforme exigido nesta fase.
Setup.gs            Instalador: cria as ~33 tabelas do DB_Mapping +
                     usuário ADMIN inicial.
```

---

## 2) Mapa de dependências (entre camadas)

```
Code.gs → Core_API → Core_Router → { Auth_Session, Auth_RBAC, Core_Registry }
                                  → handler do módulo (API_* / Service_*)
                                  → Audit_Service (best-effort)
                                  → Utils_Log

Todo Service/API → DB_Query / DB_Insert / DB_Update / DB_Delete
                    (nunca SpreadsheetApp direto)

DB_Insert/DB_Update → DB_Lock (concorrência) → DB_Core (acesso base)

Core_ModuleManager → MODULES/_ModuleList.gs → cada descriptor de módulo
                      → Core_Registry.registerModule() → absorve getRoutes()

Doctor_* → Core_Registry, Core_ModuleManager, DB_Mapping, Core_Config
Backup_* → Integration_GoogleDrive, DB_Insert
Auth_Biometric → BiometricProvider (contrato) → Integration_Biometric
                  (chamada real só quando BIOMETRIC_PROVIDER ≠ NONE)
```

Nenhum módulo de negócio importa outro diretamente — tudo passa por
Service → DB, exatamente como a seção 62 exige.

---

## 3) Mapa dos módulos (27 — 26 da spec + Manutenção)

| ID | Nome | Depende de | Status nesta fase |
|---|---|---|---|
| MOD_00_MIGRATION | Migração | — | PENDING |
| MOD_01_CORE | Core | — | implícito (Core_* sempre ativo) |
| MOD_02_IMPORTACAO | Importação | Core | PENDING |
| MOD_03_CADASTROS | Cadastros | Core | PENDING (rotas registradas) |
| MOD_04_NOTA_FISCAL | Nota Fiscal | Cadastros | PENDING (rotas registradas) |
| MOD_05_CONFERENCIA | Conferência | Nota Fiscal | PENDING (rotas registradas) |
| MOD_06_ESTOQUE | Estoque | Conferência | PENDING (rotas registradas) |
| MOD_07_RESERVAS | Reservas | Estoque | PENDING (rotas registradas) |
| MOD_08_AUDITORIA | Auditoria | Core | **ATIVO** (Audit_Core real) |
| MOD_09_SAIDAS | Saídas | Estoque, Reservas | PENDING (rotas registradas) |
| MOD_10_INVENTARIO | Inventário | Estoque | PENDING (rotas registradas) |
| MOD_11_EXPORTACAO | Exportação | Core | PENDING |
| MOD_12_RELATORIOS | Relatórios | Estoque | PENDING (rotas registradas) |
| MOD_13_BACKUP | Backup | Core | **ATIVO** (Backup_Core real) |
| MOD_14_DOUTOR | Doutor | Core | **ATIVO** (Doctor_Core real) |
| MOD_15_IA | IA | Estoque | PENDING |
| MOD_16_PROJETOS | Projetos | Core | PENDING (rotas registradas) |
| MOD_17_OBRAS | Obras | Projetos | PENDING (rotas registradas) |
| MOD_18_ATIVIDADES | Atividades | Obras | PENDING (rotas registradas) |
| MOD_19_EQUIPE | Equipe | Obras | PENDING (rotas registradas) |
| MOD_20_OCORRENCIAS | Ocorrências | Obras | PENDING (rotas registradas) |
| MOD_21_NOTIFICACOES | Notificações | Core | PENDING (rotas registradas) |
| MOD_22_BIOMETRIA | Biometria | Core | **ATIVO** (Auth_Biometric real, provider NONE até configurar) |
| MOD_23_ETIQUETAS | Etiquetas | Estoque | PENDING (rotas registradas) |
| MOD_24_SAP | SAP | Core | PENDING (rotas registradas) |
| MOD_25_CONFIGURACOES | Configurações | Core | PENDING (rotas registradas) |
| MOD_26_MANUTENCAO | Manutenção (NOVO) | Core | **ATIVO** (Maintenance_Core real, restrito a ADMIN) |

"Rotas registradas" = a rota existe, passa por sessão/permissão de
verdade, mas o Service por trás devolve `MODULE_NOT_IMPLEMENTED` até a
fase de negócio entrar.

---

## 4) Mapa das APIs (rotas ativas hoje — todas retornam erro
    honesto "não implementado" até a fase de negócio, exceto Auth/
    Auditoria/Backup/Doutor/Biometria, que já funcionam de verdade)

Total de rotas registradas: **auth (4) + dashboard (1) + nf (11) +
ocr (2) + produto (4) + fornecedor (4) + conferencia (5) + estoque
(7) + reserva (7) + saida (3) + inventario (7) + projeto (3) + obra
(3) + atividade (4) + equipe (2) + ocorrencia (3) + relatorio (2) +
notificacao (3) + usuario (4) + config (2) + sap (3) + etiqueta (2) +
auditoria (2) + backup (3) + doctor (4) + biometria (4) + manutencao
(3) = 101 rotas.**

(A spec previa ~90 no mapa da seção 50; a diferença são as rotas de
`manutencao.*`, que não estavam na spec original, e o desdobramento
de `usuario.*`, que a spec citava na permissão `USUARIO.ADMIN` mas
não listava na seção 50 — preenchi a lacuna de forma consistente com
o resto.)

---

## 5) Mapa do banco (DB_Mapping.gs — 30 tabelas de negócio + 3 de
    infraestrutura)

Negócio: USUARIOS, BIOMETRIA, PERMISSOES_CUSTOM, FORNECEDORES,
PRODUTOS, NOTAS_FISCAIS, NOTAS_ITENS, CONFERENCIAS, DIVERGENCIAS,
ESTOQUE, MOVIMENTOS, RESERVAS, SAIDAS, INVENTARIOS, CONTAGENS,
PROJETOS, OBRAS, ATIVIDADES, EQUIPE, OCORRENCIAS, NOTIFICACOES,
AUDITORIA, BACKUPS, CONFIGURACOES + as 15 tabelas legadas da seção 8
(CADASTRO_EMPRESAS, REGISTRO, ENTRADA, DETALHES_CHEGADA,
RELATORIO_GERAL, RELATORIO_MES, CONSULTA, ETIQUETA, IMPRESSAO,
BANCO_DE_DADOS, RASTREIO_PEDIDO, SISTEMA_SAP, RADIER, PLANTA_BAIXA,
LIBERACAO_SERVICO, KIT_RESERVA, CADASTRO_PRODUTO, ARQUIVO_MORTO,
DIGITALIZACAO, CONTROLE_R6, TRIAGEM_ATIVIDADES, PROJETO_DE_OBRA).

Infraestrutura (fora do DB_Mapping de negócio, criadas pelo Setup):
EVENTOS_LOG, EXPERIMENTOS_LOG, LOG_SYNC.

---

## 6) Mapa de eventos (Event_Types.gs)

`NF_RECEBIDA, NF_CONFERIDA, NF_DIVERGENCIA, NF_APROVADA,
ESTOQUE_ENTRADA, ESTOQUE_SAIDA, RESERVA_CRIADA, RESERVA_APROVADA,
INVENTARIO_ABERTO, INVENTARIO_FINALIZADO, OCORRENCIA_CRIADA,
USUARIO_LOGIN, USUARIO_LOGOUT, BIOMETRIA_VALIDADA, BACKUP_REALIZADO,
ERRO_SISTEMA`

Limitação documentada: como cada execução do Apps Script é isolada,
handlers só reagem dentro da mesma execução do evento (sem fila
persistente nesta fase). Todo evento é gravado em EVENTOS_LOG para
auditoria/replay manual.

---

## 7) Mapa de autenticação e permissões

- Sessão: `Auth_Session` via `CacheService` (TTL configurável,
  máx. 6h por limite da própria plataforma).
- RBAC: `Auth_RBAC` — matriz base por perfil (ADMIN, GESTOR,
  ALMOXARIFE, OPERADOR, MESTRE_OBRA, COMPRAS, AUDITOR, CONSULTA) +
  override granular por `MODULO.AÇÃO` via aba `PERMISSOES_CUSTOM`
  (sem precisar mexer em código).
- Verificação: sempre no `Core_Router`, nunca só confiando no
  módulo ou no frontend (seção 10).

---

## 8) Mapa de biometria

`BiometricProvider` (contrato: register/verify/identify/delete/
status/healthCheck) + `Auth_Biometric` (orquestração, exige
consentimento explícito antes de registrar) + `Integration_Biometric`
(onde entraria o SDK/WebAuthn real). Nenhum provider está conectado
nesta fase (`BIOMETRIC_PROVIDER=NONE`) — o Doctor reporta
`NOT_CONFIGURED`, nunca finge que está ativo.

---

## 9) Mapa de OCR

`Integration_OCR` + `OCR_Provider` — usa Google Cloud Vision
(`DOCUMENT_TEXT_DETECTION`) SE `OCR_API_KEY` estiver configurada;
caso contrário, erro honesto `EXTERNAL_INTEGRATION_NOT_CONFIGURED`.

---

## 10) Mapa de integração SAP

`Integration_SAP.lerArquivoExportado()` — **não conecta em API SAP
nenhuma**. Só lê arquivo já exportado (ME80FN, ME5K, ME23N, ME2N,
ME5A, MB51, M24) do Drive. O parsing real entra na Fase 16.

---

## 11) Mapa de backup

`Backup_Sheets` (cópia da planilha), `Backup_Files` (cópia de pasta
de documentos), `Backup_Config` (snapshot de configurações),
`Backup_Verification` (confere integridade antes de restaurar),
`Backup_Restore` (nunca automático — exige `confirm:true` e ainda
assim marca `PENDENTE_REVISAO_MANUAL`, por ser operação destrutiva).

---

## 12) Mapa do Doutor

`Doctor_Database` (tabelas/cabeçalhos faltando), `Doctor_API` (rota
"fantasma"), `Doctor_Modules` (health de cada módulo),
`Doctor_Health`/`Core_Health` (relatório agregado), `Doctor_Recovery`
(sugestão textual, nunca ação automática), `Doctor_Report` (relatório
final consumido pela rota `doctor.diagnostics`).

---

## 13) Testes criados e executados

Criados: `Test_Core_bootstrap`, `Test_Database_conexao`,
`Test_Database_diagnostico`, `Test_Auth_hashConsistente`,
`Test_Auth_loginInvalido`, `Test_Router_rotaInexistente`,
`Test_Router_semSessao`, `Test_RunAll` (roda todos),
`Test_RouterAPI_simulate` / `Test_RouterAPI_fluxoCompleto`
(simulação de request completo sem precisar publicar Web App).

Execução: **pendente de você rodar** — não tenho como executar
Apps Script real a partir daqui. Depois de instalar (`setup_instalar`),
rode `Test_RunAll` e `Test_RouterAPI_fluxoCompleto` no editor e me
mande o log se algo falhar.

---

## 14) Pendências / dependências externas / riscos técnicos

**Pendências:**
- Lógica de negócio real de cada módulo (fases 2 em diante).
- `DB_Transaction` é "melhor esforço" — Sheets não tem transação
  atômica nativa; documentado como limitação, não escondido.
- `Event_Bus` não tem fila persistente entre execuções — só reage
  dentro da mesma execução.

**Dependências externas a configurar quando for usar:**
- `OCR_API_KEY` (Google Cloud Vision) — para NF por foto.
- `BIOMETRIC_PROVIDER` + credenciais do fornecedor escolhido.
- `SAP_IMPORT_FOLDER_ID` — pasta do Drive onde cairão as
  exportações do SAP.
- `DRIVE_FOLDER_BACKUP`, `DRIVE_FOLDER_NF`, `DRIVE_FOLDER_DOCS`.

**Riscos técnicos conhecidos:**
- `LockService` com timeout de 10s pode gerar `LOCK_TIMEOUT` em
  picos de uso simultâneo — ajustável via `Core_Config`.
- CacheService tem teto de 6h de sessão — sessões mais longas
  exigem revisão (ex: refresh token) antes de produção real.
- Nenhuma tabela tem paginação ainda — leitura de abas muito
  grandes (milhares de linhas) pode ficar lenta; otimização
  (índices auxiliares, cache de leitura) fica para quando o
  volume de dados justificar.

---

## O que vem a seguir

Instala (`setup_instalar` → `Test_RunAll` → `Test_RouterAPI_fluxoCompleto`),
me confirma que passou, e a gente entra na Fase 2 real de negócio —
o próprio documento sugere Nota Fiscal (Fase 7) como primeiro módulo
de negócio, mas como Estoque é o núcleo mais usado no dia a dia,
também topamos começar por ele se você preferir.
