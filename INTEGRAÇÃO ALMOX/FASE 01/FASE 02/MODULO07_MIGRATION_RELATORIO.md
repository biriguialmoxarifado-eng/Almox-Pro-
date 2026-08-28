# ALMOXA PRO — MÓDULO 07: MIGRATION ENGINE
### Relatório técnico de implementação

---

## Auditoria antes de codificar

Encontrei 3 peças reais e reaproveitáveis, exatamente o que o
contrato pede pra checar antes de criar algo novo:

| Peça | Estado encontrado |
|---|---|
| MOD_00_MIGRATION.gs | Placeholder vazio desde a Fase 1 — getRoutes() sempre devolveu {}, nunca teve rota nenhuma |
| Service_Importacao.gs (Fase 10) | preview/commit reais — leitura de arquivo, mapeamento sugerido por nome de coluna, gravação simples |
| Backup_Core.gs (Fase 1) | create/verify/restore reais |
| DB_Insert.batchInsert / DB_Delete.physical | Já existiam, nunca usados por nenhum módulo de migração |

Decisão: não recriar leitura de arquivo nem inserção — o
Service_Migration novo orquestra essas peças, adicionando só o
que realmente faltava: classificação de risco, backup obrigatório
antes de gravar, modo simulação, rastreamento pra rollback, e
relatório estruturado. Substitui o placeholder MOD_00_MIGRATION
(que nunca fez nada) na lista de módulos — o arquivo continua no
pacote, só não é mais chamado, não apago código que não é meu
pra apagar.

## Reaproveitamentos (nada duplicado)

- Leitura de arquivo: Integration_SAP.parseArquivo — mesma função que Service_Importacao já usava.
- Mapeamento: migration.mapear é um repasse direto pra Service_Importacao.preview() — não reescrevi a lógica de sugestão de coluna.
- Inserção em lote: DB_Insert.batchInsert — não reimplementei loop de insert.
- Backup: Backup_Core.create() chamado diretamente — não reimplementei backup.
- Remoção pro rollback: DB_Delete.physical — já existia, nunca tinha sido usado por nenhum módulo.

## O que foi implementado

- diagnosticarOrigem: quantidade de registros, colunas, campos incompatíveis (quando tabelaDestino é informada), duplicidade (linhas idênticas) e registros incompletos (alguma célula vazia).
- mapear: repasse pra Service_Importacao.preview.
- validar: classifica VERDE/AMARELO/VERMELHO — vermelho se houver linha vazia ou campo obrigatório vazio; amarelo se só houver duplicado; verde caso contrário. podeImportar:false sempre que vermelho.
- executar: aceita modo SIMULAR|REAL. Bloqueia SEMPRE que a validação der vermelho, inclusive em modo simulação — regra de segurança absoluta do contrato, testada. Em modo REAL, cria backup antes de gravar (se o backup falhar, a migração inteira é abortada, nada é gravado), processa em lotes (loteSize, padrão 200), grava cada linha convertida em IMPORTADO/IGNORADO_DUPLICADO/INVALIDO na tabela MIGRACAO_ITENS — isso é o que permite o rollback.
- rollback: usa MIGRACAO_ITENS pra saber exatamente quais registros foram inseridos por aquela execução e os remove um a um. Bloqueia reverter simulação (nunca gravou nada) e bloqueia reverter duas vezes.
- relatorio/listar: consulta o log estruturado (MIGRACOES), nunca recalcula.

## Honestidade sobre o que NÃO dá pra validar de verdade

DB_Mapping guarda só o nome das colunas de cada tabela, não o
tipo (não existe um registro de "este campo é data", "este é
moeda"). Por isso validar() não faz conversão nem checagem de
tipo de dado — faria isso de mentira, inventando uma precisão que
o sistema não tem. O que É real: linha vazia, duplicidade, e
campo específico vazio quando você diz quais campos são
obrigatórios no payload (camposObrigatorios). Isso está
documentado no próprio código, não escondido.

## Arquivos criados

- SERVICES/Service_Migration.gs
- TESTS/Test_Modulo07_Migration.gs

## Arquivos alterados

- DATABASE/DB_Mapping.gs — tabelas MIGRACOES/MIGRACAO_ITENS novas (aditivo)
- EVENTS/Event_Types.gs — MIGRACAO_EXECUTADA/MIGRACAO_REVERTIDA novos
- MODULES/_ModuleList.gs — substitui o placeholder vazio pelo módulo real

## Rotas (todas ADMIN — nenhuma exceção self-scope; migração é sempre operação de risco)

```
migration.diagnosticarOrigem
migration.mapear
migration.validar
migration.executar
migration.rollback
migration.relatorio
migration.listar
```

## Testes executados — Test_Modulo07_Migration.gs

Cria um CSV real no Drive (2 linhas válidas, 1 duplicada, 1 com
campo obrigatório vazio) e testa: usuário sem permissão bloqueado,
diagnóstico correto (4 registros, 1 duplicidade, 1 incompleto),
classificação VERMELHO com o inválido presente, execução
bloqueada mesmo em modo simulação enquanto for vermelho,
classificação AMARELO quando só sobra duplicado, modo SIMULAR não
grava nada de verdade (contei fornecedores antes/depois), modo
REAL grava de verdade e cria backup, rollback desfaz de verdade
(contei de novo), bloqueio de reverter duas vezes, e relatório
refletindo o estado final.

## 🟢 Concluído

Diagnóstico de origem, mapeamento (reaproveitado), pré-visualização
+ validação com classificação real, backup obrigatório antes de
gravar, migração em lotes, rollback funcional, log estruturado,
modo seguro (simulação), relatório final com todos os campos
pedidos.

## 🟡 Pendente (documentado, não escondido)

- Conversão de tipo (data/moeda/normalização de código): sem
  metadado de tipo por coluna no sistema, essas conversões
  ficariam adivinhadas — não implementei pra não fingir precisão.
  Se/quando DB_Mapping ganhar um registro formal de tipo por
  coluna, esta é a extensão natural.
- "Atualizados": o relatório sempre reporta 0 — esta versão só
  faz INSERT, nunca UPDATE de registro existente (não existe hoje
  uma chave natural formalizada por tabela pra decidir "isso já
  existe, é upsert"). Documentado em vez de fingir suporte a
  atualização.
- Preservação de ID de origem: o sistema sempre gera ID novo via
  DB_Insert (mesma regra de todo o resto do sistema) — não criei
  uma exceção pra migração aceitar ID vindo de fora, porque isso
  arriscaria colidir com sequência interna do banco.

## 🔴 Bloqueado

Nenhum item bloqueado.

## Riscos encontrados

- rollback() faz DELETE físico — se algo mais no sistema já tiver
  criado uma referência (FK) pro registro importado entre a
  importação e o rollback (ex: um fornecedor importado e depois
  usado numa nota fiscal), o DELETE vai remover o fornecedor mesmo
  assim, deixando a nota fiscal com uma referência órfã. Não
  implementei checagem de dependência antes do rollback nesta
  versão — documentado aqui como risco real, não escondido.
  Recomendação prática: reverter migração o quanto antes, antes de
  qualquer outro uso do dado importado.

---

## Critério de conclusão

Backend existe e protegido (ADMIN-only, sem exceção) ✅ ·
Reaproveita Importação/Backup/DB_Insert/DB_Delete sem duplicar ✅ ·
Classificação real (não decorativa) ✅ · Simulação genuinamente
não grava nada ✅ · Rollback funcional testado ✅ · Log estruturado
✅ · Testes passam ✅ · Pendências documentadas ✅ · Módulos 01-06
e Front Mobile intocados (186 arquivos, 0 erros de sintaxe) ✅.

MÓDULO 07 — CONCLUÍDO (com pendências 🟡 registradas, nenhuma
bloqueante).

---

Próximos, na ordem que o próprio documento descreve (07→08→09,
com o fluxo "Migration → Dados → Doctor → Diagnóstico → AI
Engine"): Módulo 08 (Doctor Engine, ampliação do Doutor que já
existe) e Módulo 09 (AI Engine, novo).
