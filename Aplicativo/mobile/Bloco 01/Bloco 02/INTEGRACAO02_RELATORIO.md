# ALMOXA PRO — INTEGRAÇÃO 02: CAMADA CENTRAL DE DADOS
### Relatório de integração estrutural + mapa de dados

---

## Natureza deste trabalho

Igual à Integração 01: a Data Layer (DATABASE/) já existe desde a
Fase 1 e já é robusta — DB_Core, DB_Query, DB_Insert, DB_Update,
DB_Delete, DB_Lock, DB_Transaction, DB_Validation, DB_Mapping. O
trabalho foi auditar essa camada item a item contra os requisitos
deste prompt, achar os gaps reais, e preencher só esses — sem
tocar em nenhuma função que os 206 arquivos do sistema já
dependem pra funcionar.

## Arquitetura confirmada (já existia, validada agora)

```
MÓDULOS
    v
API / SERVIÇOS        — cada Service_X chama DB_Query/DB_Insert/etc, nunca SpreadsheetApp direto
    v
DATA LAYER (DATABASE/) — DB_Core, DB_Query, DB_Insert, DB_Update, DB_Delete, DB_Lock, DB_Transaction, DB_Validation
    v
BANCO DE DADOS         — Google Sheets, acessado SÓ por DB_Core.ss()/sheet()
```

Nenhum módulo de negócio acessa SpreadsheetApp diretamente —
confirmado (regra da seção 7 do DB_Core.gs, já vigente desde a
Fase 1). Isso já é a abstração que o contrato pede: se um dia
Google Sheets for trocado por outro banco, só DATABASE/ precisa
mudar — nenhum dos 25 módulos.

## Checklist do contrato — o que já existia vs. o que faltava

| Requisito | Status antes | O que foi feito |
|---|---|---|
| Leitura | já existia: DB_Query.find/findOne/get | preservado |
| Gravação | já existia: DB_Insert.insert/batchInsert | preservado |
| Atualização | já existia: DB_Update.byId/byRowIndex/upsert/batchUpdate | preservado |
| Exclusão autorizada | já existia: DB_Delete.logical/physical (autorização é responsabilidade do RBAC no Router, corretamente fora da Data Layer) | preservado |
| Busca/filtros | já existia: find(table, filterFn) | preservado |
| Paginação | não existia — cada módulo reimplementava slice() manualmente (Rastreabilidade, Central de Dados) | DB_Query.paginate() novo — primitivo único, reaproveitável |
| Cache | só usado manualmente por serviço a serviço (Cache_Core direto), nunca uma opção na própria Data Layer | DB_Query.findCached() novo — opt-in, nunca aplicado ao find() original |
| Sincronização | N/A — fonte de dado única (uma planilha), não há múltiplas réplicas pra sincronizar | documentado, não se aplica |
| Histórico | já existia: AUDITORIA + Service_Rastreabilidade (Módulo 10) | preservado |
| Logs | já existia: Utils_Log/Audit_Service | preservado |
| IDs únicos | já existia: _nextId() protegido por DB_Lock | preservado |
| Evitar duplicidade | cada Service reimplementava a mesma checagem (DB_Query.exists(...)) | DB_Validation.ensureUnique() novo — helper genérico |
| Concorrência | já existia: DB_Lock.withLock em toda escrita | preservado, testado |
| Erro de conexão / recuperação | nenhum retry — qualquer falha transitória da API do Sheets derrubava a operação na hora | DB_Core._withRetry() novo — até 3 tentativas com espera curta, só pra erro que parece transitório |

## Os 4 gaps reais, e por que cada correção é segura

1. DB_Core._withRetry: só reage a mensagens de erro com cara de
   transitório (timeout, rate limit, "try again"). Erro de
   configuração real (aba inexistente, SPREADSHEET_ID ausente)
   continua falhando na primeira tentativa — tentar de novo não
   resolveria isso, e fingir que resolveria seria enganoso.
   Testado nos dois sentidos.
2. DB_Query.paginate: função nova, não mexe no find() que todo o
   sistema já usa.
3. DB_Query.findCached: função nova, opt-in — o find() original
   continua sempre lendo fresco. Documentei uma limitação real:
   como o cache serializa em JSON, campo de data volta como
   string, não Date — quem usar isso em campo de data precisa
   envolver com new Date().
4. DB_Validation.ensureUnique: função nova — não fui atrás de
   refatorar as checagens de duplicidade que já existiam em
   Service_Usuario/Service_Ferramenta/Service_Fornecedor (regra
   de "não alterar módulo sem necessidade"); fica disponível pra
   quem for escrever essa checagem dali pra frente.

## Mapa de dados (contrato pede documentação explícita)

DATABASE/DB_Mapping.gs já é o mapa de dados formal do sistema —
57 tabelas, cada uma com sua lista de colunas — usado por
DB_Core/DB_Query/DB_Insert pra saber a estrutura de cada aba sem
nenhum módulo precisar conhecer isso diretamente. Não recriei
esse mapa (seria a duplicação mais óbvia possível); esta seção só
formaliza que ele já cumpre esse papel:

- Dados atuais: PRODUTOS, ESTOQUE, RESERVAS, SOLICITACOES, FERRAMENTAS, etc.
- Histórico: MOVIMENTOS, AUDITORIA, DOCTOR_HISTORICO, IA_INTERACOES.
- Logs: AUDITORIA (ação/usuário/módulo/antes/depois).
- Arquivos/documentos: referenciados por ID/URL do Drive (fotoUrl, arquivosJson em BACKUPS), nunca binário na planilha — já separado fisicamente do dado estruturado, exatamente como o contrato pede ("separar arquivos/documentos dos dados estruturados").
- Backups: BACKUPS, tabela própria, separada de tudo o mais (Módulo 13).

## Arquivos alterados

```
DATABASE/DB_Core.gs        — retry com backoff pra erro transitório
DATABASE/DB_Query.gs       — paginate() e findCached() novos
DATABASE/DB_Validation.gs  — ensureUnique() novo
```

## Arquivo de teste criado

```
TESTS/Test_Integracao02_DataLayer.gs
```
Adicionado ao runner mestre (Test_RunTudo).

## Testes executados — os 8 cenários pedidos, literalmente

1. Leitura — DB_Query.get lê registro recém-criado corretamente.
2. Gravação — ID único gerado (typeof ID === 'number').
3. Atualização — DB_Update.byId reflete no registro.
4. Busca — find com filtro (7 registros achados exatos) + paginate() novo (páginas de 3 em 3, sem sobreposição).
5. Duplicidade — ensureUnique bloqueia código repetido, deixa passar código novo.
6. Concorrência — propriedades protegidas testadas honestamente (não paralelismo real, ver nota no cabeçalho do teste): 10 inserções em sequência rápida geram 10 IDs distintos; lock sempre libera mesmo quando a função lançada dentro dele falha.
7. Erro de conexão — heurística de "parece transitório" testada nos dois sentidos; retry de verdade testado (função que falha 2x com "rate limit" e na 3ª tentativa funciona — _withRetry insiste e consegue).
8. Recuperação de erro — erro real (não transitório) não fica tentando à toa (só 1 tentativa); DB_Transaction.run compensa a operação anterior quando um passo seguinte falha.

## Problemas encontrados (resumo)

| Problema | Gravidade | Status |
|---|---|---|
| Sem paginação genérica — cada módulo reimplementava | Nunca causou bug, mas duplicava lógica | Corrigido (primitivo novo, opcional) |
| Sem cache na Data Layer | Perf, não correção — leituras repetidas sempre releem a planilha inteira | Corrigido (opt-in, nunca força cache em leitura crítica) |
| Sem checagem de duplicidade genérica | Nunca causou bug (cada Service já verificava manualmente) | Corrigido (helper novo, não retroativo) |
| Sem retry para erro transitório de rede | Real risco — uma falha momentânea da API do Sheets derrubava qualquer operação na hora, sem segunda chance | Corrigido e testado |

Nenhum desses gaps já tinha causado um incidente registrado — mas
o de retry era um risco estrutural genuíno (qualquer operação de
escrita/leitura, em qualquer módulo, ficava vulnerável a um
timeout momentâneo do Google).

## Dependências externas

Nenhuma nova. Cache_Core (usado por findCached) já existia.

---

## Critério de conclusão

Leitura/gravação/atualização/exclusão/busca ✅ · Paginação
genérica ✅ · Cache opt-in sem risco pra dado crítico ✅ ·
Duplicidade evitável via helper ✅ · Concorrência protegida
(testada nas propriedades possíveis de testar) ✅ · Erro de
conexão com retry real ✅ · Recuperação de erro (transação
compensa, erro real não insiste à toa) ✅ · Mapa de dados
documentado (já existia, formalizado aqui) ✅ · Nenhum módulo de
negócio alterado ✅ · 207 arquivos, 0 erros de sintaxe ✅.

INTEGRAÇÃO 02 — CONCLUÍDA.
