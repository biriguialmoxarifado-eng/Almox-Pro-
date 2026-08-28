# ALMOXA PRO v2 — Esqueleto (Fase 1) — Como instalar

## O que é isso
143 arquivos `.gs`. Sem HTML nenhum — é só o motor (Core, Auth,
Database, Cache, Events, Audit, Diagnostics, Backup, API, Services,
Modules, Integrations, Utils, Tests, e o módulo novo de Manutenção
que você pediu).

Comece lendo `MAPA_ARQUITETURA_FASE1.md` — é a entrega obrigatória
com todos os mapas (árvore de arquivos, dependências, módulos, APIs,
banco, eventos, auth, biometria, OCR, SAP, backup, doutor, testes,
pendências e riscos).

## Passo a passo de instalação

1. Planilha nova no Google Sheets → Extensões → Apps Script.
2. Apague o `Code.gs` padrão.
3. Copie cada arquivo deste pacote para o editor, **mantendo o
   nome exato** (sem a extensão `.gs`, o próprio editor adiciona).
   A ordem de criação não importa — o Apps Script carrega tudo
   antes de rodar qualquer função.
4. Salve tudo.
5. No menu de funções do editor, selecione `setup_instalar` e
   clique em Executar. Autorize as permissões pedidas. Isso cria
   as ~33 tabelas e o usuário `admin` (senha provisória `almoxa123`).
6. Selecione `Test_RunAll` e execute — deve mostrar 7/7 testes
   passando. Se algum falhar, me manda o log (Ver → Registros de
   execução).
7. Rode também `Test_RouterAPI_fluxoCompleto` — simula login real
   → chamada ao dashboard → logout, tudo via `Core_API`, sem
   precisar publicar Web App ainda.
8. (Opcional, só quando quiser testar via HTTP) Implantar → Nova
   implantação → App da Web. `doGet` nessa URL devolve um
   health-check em JSON — nada de tela, como combinado.

## O que fazer com o módulo de Manutenção

Ele já vem com 2 experimentos de exemplo (`ping_core` e
`exemplo_escrita_segura`) em `Maintenance_Sandbox.gs`. Para testar
uma ideia nova:

1. Abra `Maintenance_Sandbox.gs`.
2. Copie o padrão de `Maintenance_Core.registerExperiment(...)` e
   escreva sua ideia dentro da função.
3. Rode `Test_RouterAPI_simulate('manutencao.runExperiment', { id: 'seu_id', dryRun: true }, sessionIdDoAdmin)`
   — ou, mais simples, chame `Maintenance_Core.runExperiment('seu_id')`
   direto no editor.
4. O resultado fica registrado em `EXPERIMENTOS_LOG` — dá pra ver
   na planilha o histórico de tudo que você testou.

Só o perfil ADMIN acessa essas rotas, mesmo via API — é de
propósito, pra não vazar essa ferramenta pro time operacional.

## Próximo passo

Depois de confirmar que os testes passaram, seguimos pra
implementação de negócio de verdade do primeiro módulo — Nota
Fiscal (fase natural pela ordem da spec) ou Estoque (se preferir
começar pelo núcleo mais usado no dia a dia). O frontend (desktop e
mobile) só entra depois disso, como combinado.

---

## FASE 2 — Nota Fiscal (entrada manual) — JÁ INCLUÍDA NESTE PACOTE

O que passou a funcionar de verdade (arquivos substituídos:
`Service_Produto.gs`, `Service_Fornecedor.gs`, `Service_NF.gs`;
módulos `MOD_03_CADASTROS` e `MOD_04_NOTA_FISCAL` marcados como
`ACTIVE`):

- **Fornecedor**: cria/busca por CNPJ; se a NF trouxer um CNPJ já
  cadastrado, reaproveita — nunca duplica (seção 18).
- **Produto**: cadastro manual + a lógica exata da seção 17 ao
  processar item de NF — procura por código, código de barras,
  descrição exata, depois descrição aproximada (similaridade ≥
  60%); se nada bater, marca como pendência de cadastro em vez de
  criar sozinho.
- **Nota Fiscal**: `nf.create` (entrada manual), `nf.get`,
  `nf.search`, `nf.validate`, `nf.approve`, `nf.reject` — tudo
  gravando de verdade em `NOTAS_FISCAIS` e `NOTAS_ITENS`, com
  auditoria e eventos (`NF_RECEBIDA`, `NF_APROVADA`).

**O que ainda NÃO está nesta etapa** (documentado no próprio código,
retorna erro honesto se chamado):
- `nf.importXML` — parser de XML de NF-e.
- `nf.processOCR` / `nf.extract` — depende de `OCR_API_KEY`
  configurada (Google Cloud Vision).
- `nf.consultKey` — consulta de chave NF-e via SEFAZ.
- `nf.confer` — isso é a Fase 9 (Conferência), módulo separado.
- A baixa em **ESTOQUE** quando a nota é aprovada — isso é Fase 10.
  Por enquanto, aprovar a NF só muda o status dela para `APROVADA`.

### Como testar a Fase 2

1. Cole `Service_Produto.gs`, `Service_Fornecedor.gs`, `Service_NF.gs`
   por cima dos arquivos antigos (mesmo nome, o Apps Script
   sobrescreve).
2. Atualize `MOD_03_CADASTROS.gs` e `MOD_04_NOTA_FISCAL.gs` também.
3. Adicione `Test_Fase2_NotaFiscal.gs` em `/TESTS`.
4. Rode a função `Test_Fase2_fluxoCompleto` pelo editor — ela loga
   cada passo (login → cadastra produto de teste → lança NF com um
   item que já existe e outro que não existe → valida → aprova) e
   mostra um alerta PASSOU/FALHOU no final.

---

## FASE 3 — Conferência + Bipagem + Divergências — JÁ INCLUÍDA

Arquivos alterados: `Service_Conferencia.gs` (implementado de
verdade), `Core_Router.gs` (passa a anexar o perfil da sessão ao
contexto — necessário pra checagem fina de permissão dentro do
próprio Service), `MOD_05_CONFERENCIA.gs` (ativado).

O que passou a funcionar:
- **`conferencia.start`**: gera a conferência a partir dos itens
  já lançados na NF (esperado = quantidade da nota).
- **`conferencia.scan`**: bipagem por código de barras/QR — com
  proteção contra bip duplicado acidental (ignora releituras do
  mesmo item em menos de 2 segundos, seção 20 da spec).
- **`conferencia.manual`**: contagem manual, pra material a granel
  sem código (areia, brita — seção 23).
- **`conferencia.finish`**: fecha a conferência, calcula a
  diferença de cada item e **gera divergências de verdade** na
  tabela `DIVERGENCIAS`, com o tipo certo (`FALTA`, `EXCESSO`,
  `PRODUTO_NAO_CADASTRADO`, `SEM_CODIGO`) — e muda o status da NF
  para `CONFERIDA` ou `DIVERGENTE`.
- **`conferencia.divergence`**: lista divergências, ou resolve
  (aprova/reprova) uma específica — resolver exige permissão de
  aprovação de verdade, mesmo a rota sendo de leitura por padrão.

**Ainda não incluído** (fica para as próximas fases, como já era
esperado): a baixa em `ESTOQUE` a partir da conferência aprovada
(Fase 4/10) e evidência fotográfica de divergência (upload de foto
via Drive, que entra junto com o módulo de Documentos).

### Como testar a Fase 3

1. Cole `Service_Conferencia.gs`, `Core_Router.gs` e
   `MOD_05_CONFERENCIA.gs` por cima dos antigos.
2. Adicione `Test_Fase3_Conferencia.gs` em `/TESTS`.
3. Rode `Test_Fase3_fluxoCompleto` — ele cria uma NF de 10
   unidades, bipa só 7 (de propósito, pra forçar uma divergência
   de FALTA), fecha a conferência, confere que a divergência foi
   gerada certinho, e aprova ela. Demora uns 15 segundos (o teste
   respeita o debounce de 2s entre bips de propósito).

---

## FASE 4 — Estoque — JÁ INCLUÍDA

Arquivos alterados: `Service_Estoque.gs` (implementado de
verdade), `Service_NF.gs` (a função `approve()` agora fecha o
fluxo principal de verdade), `Core_Constants.gs` (novo código de
erro `ESTOQUE_INSUFICIENTE`), `MOD_06_ESTOQUE.gs` (ativado).

O que passou a funcionar:
- **`estoque.entry` / `estoque.exit` / `estoque.transfer` /
  `estoque.adjust`**: todos gravam saldo real na tabela `ESTOQUE`
  e geram rastro em `MOVIMENTOS` — nunca alteram saldo sem
  registrar o porquê (regra explícita da spec).
- **`estoque.exit` bloqueia saída maior que o disponível**
  (saldo − reservado − bloqueado), com erro
  `ESTOQUE_INSUFICIENTE` em vez de deixar saldo negativo.
- **`estoque.get` / `estoque.search`** já devolvem
  `saldoDisponivel` calculado, não só o saldo bruto.
- **`estoque.history`**: histórico completo por produto/local.
- **O fluxo principal fechou de verdade**: quando você chama
  `nf.approve`, ele agora:
  1. Marca a nota como aprovada.
  2. Se a conferência já rodou (Fase 3), usa a quantidade
     **efetivamente recebida** (não a nominal da NF) — se
     faltou, só entra o que faltou de fato.
  3. Se não houve conferência, usa a quantidade da NF mesmo
     (fluxo simplificado, continua válido).
  4. Chama `Service_Estoque` internamente e gera a entrada real,
     na localização que você passar em `payload.localizacao`
     (padrão: `'RECEBIMENTO'`).

**Ainda não incluído:** reservas puxando do estoque disponível
(Fase 5), curva ABC / estoque crítico (fica pros relatórios,
Fase 9), localização estruturada tipo Obra→Almoxarifado→Prateleira
(por enquanto é só uma string livre — funciona, mas sem hierarquia).

### Como testar a Fase 4

1. Cole `Service_Estoque.gs`, `Service_NF.gs`, `Core_Constants.gs`
   e `MOD_06_ESTOQUE.gs` por cima dos antigos.
2. Adicione `Test_Fase4_Estoque.gs` em `/TESTS`.
3. Rode `Test_Fase4_fluxoCompleto` — ele faz o ciclo inteiro (NF
   → bipa as 10 unidades → fecha sem divergência → aprova →
   confere que entrou 10 no estoque sozinho → transfere 4 →
   tira 2 de saída → tenta tirar 999 de propósito pra ver se
   bloqueia → ajusta pra 5 → confere o histórico). Demora uns
   25 segundos por causa do debounce de bipagem.

---

## FASE 5 — Reservas + Aprovações + Saídas — JÁ INCLUÍDA

Arquivos alterados: `Service_Estoque.gs` (ganhou funções internas
de reservar/liberar saldo e uma saída interna reaproveitável),
`Service_Reserva.gs` e `Service_Saida.gs` (implementados de
verdade), `DB_Mapping.gs` (campo `localizacao` adicionado em
`RESERVAS` e `SAIDAS` — necessário pra saber de onde reservar/
tirar), `Event_Types.gs` (novo evento `RESERVA_EXPIRADA`),
`MOD_07_RESERVAS.gs` e `MOD_09_SAIDAS.gs` (ativados).

O que passou a funcionar:
- **`reserva.create`**: trava o saldo (`ESTOQUE.reservado`) na
  hora da criação — dois operadores não conseguem reservar o
  mesmo material. Bloqueia reserva duplicada do mesmo solicitante
  pro mesmo produto/local (seção 26).
- **`reserva.approve` / `reserva.reject` / `reserva.cancel`**:
  reprovar ou cancelar **libera o saldo travado de volta**
  automaticamente.
- **Expiração automática**: toda leitura de reserva (`get`,
  `calendar`) confere se passou da validade e expira sozinha,
  liberando o saldo — sem precisar de um cron job separado.
- **`reserva.calendar` / `reserva.schedule`**: listagem por
  período e reagendamento de validade.
- **`saida.create`**: pode nascer de uma reserva aprovada (puxa
  produto/local/quantidade dela) ou ser direta/emergencial.
  Não mexe no saldo ainda — só registra a intenção.
- **`saida.confirm`**: é aqui que o saldo baixa de verdade — e se
  a saída veio de reserva, libera o `reservado` junto (senão ele
  ficaria travado pra sempre).
- **`saida.cancel`**: só cancela saída ainda não confirmada (nada
  a desfazer no estoque, porque nada tinha sido tocado ainda).

**Ainda não incluído:** notificação automática de "reserva
vencendo" (o envio de e-mail já existe desde a Fase 1 —
`Integration_Email` — falta só ligar o gatilho, que entra junto
com o módulo de Notificações).

### Como testar a Fase 5

1. Cole `Service_Estoque.gs`, `Service_Reserva.gs`,
   `Service_Saida.gs`, `DB_Mapping.gs`, `Event_Types.gs`,
   `MOD_07_RESERVAS.gs` e `MOD_09_SAIDAS.gs` por cima dos antigos.
2. **Importante**: como `DB_Mapping.gs` mudou (novas colunas em
   `RESERVAS` e `SAIDAS`), rode `setup_instalar` de novo — ele só
   cria o que falta, não apaga nada, mas se você já tinha essas
   abas criadas com o cabeçalho antigo, adicione manualmente as
   colunas `localizacao` nelas antes de testar.
3. Adicione `Test_Fase5_ReservaSaida.gs` em `/TESTS`.
4. Rode `Test_Fase5_fluxoCompleto` — ele entra com 20 unidades,
   reserva 15, confere que sobrou só 5 disponível, tenta reservar
   de novo (deve travar), aprova, gera a saída, confirma, e
   confere que o saldo final bate certinho.

---

## FASE 6 — Inventário + Contagem — JÁ INCLUÍDA

Arquivos alterados: `Service_Inventario.gs` (implementado de
verdade), `MOD_10_INVENTARIO.gs` (ativado). Nenhuma tabela mudou
de estrutura nesta fase.

O que passou a funcionar:
- **`inventario.create`**: gera token no formato exato da spec
  (`INV-2026-000001`), estado inicial `CRIADO`.
- **`inventario.open`**: **congela o saldo atual de cada produto**
  daquela localização como "esperado" — a partir daqui, qualquer
  entrada/saída normal de estoque não muda mais o que o
  inventário está comparando (snapshot real).
- **`inventario.scan`**: bipagem com a mesma proteção contra bip
  duplicado da Fase 3 (debounce de 2s). Item bipado que não tinha
  saldo esperado ali vira registro de sobra automaticamente.
- **`inventario.count`**: contagem manual (granel).
- **`inventario.recount`**: recontagem de um item específico,
  usado quando o time quer conferir de novo antes de decidir.
- **`inventario.finish`**: fecha a contagem. Sem divergência →
  vai direto pra `FINALIZADO`. Com divergência → vai pra
  `PENDENTE_APROVACAO` e não mexe no estoque ainda.
- **`inventario.approve`**: só aqui o estoque é alterado de
  verdade — chama `Service_Estoque.adjust` internamente pra cada
  item divergente, ajustando o saldo real pro valor contado.
  `decisao: 'reprovar'` descarta tudo sem tocar no estoque.

**Ainda não incluído:** fotos de evidência em divergência de
inventário (entra junto com o módulo de Documentos/Digitalização),
curva ABC e materiais críticos (Fase 9 — Relatórios).

### Como testar a Fase 6

1. Cole `Service_Inventario.gs` e `MOD_10_INVENTARIO.gs` por cima
   dos antigos.
2. Adicione `Test_Fase6_Inventario.gs` em `/TESTS`.
3. Rode `Test_Fase6_fluxoCompleto` — ele entra com 20 unidades,
   abre o inventário (congela esperado=20), bipa só 18 de
   propósito, fecha (deve pedir aprovação), aprova, e confere que
   o saldo real do estoque foi ajustado pra 18. Demora uns 40
   segundos (18 bips com debounce de 2s cada).

---

## FASE 7 — Projetos + Obras + Atividades + Equipe — JÁ INCLUÍDA

Arquivos alterados: `Service_Obra.gs`, `Service_Projeto.gs`,
`Service_Atividade.gs`, `Service_Equipe.gs` (implementados de
verdade), `DB_Mapping.gs` (colunas `obraId`/`projetoId`
adicionadas em `ATIVIDADES`), `Service_Estoque.gs` (entrada/saída
agora propagam `atividadeId`/`projetoId` pro `MOVIMENTOS`, pra
rastreabilidade de consumo por atividade), `MOD_16_PROJETOS.gs`,
`MOD_17_OBRAS.gs`, `MOD_18_ATIVIDADES.gs`, `MOD_19_EQUIPE.gs`
(ativados — **e corrigi um bug do esqueleto da Fase 1**: o grafo
de dependência tinha Obras dependendo de Projetos, ao contrário
do certo — Projeto que depende de Obra existir).

O que passou a funcionar:
- **`obra.create/get/update`**: cadastro simples de obra.
- **`projeto.create/get/update`**: **valida que a obra existe**
  antes de aceitar o projeto — não deixa criar projeto órfão.
- **`atividade.create/get/update`**: valida obra (obrigatória) e
  projeto (opcional). **`atividade.progress`**: atualiza 0-100%
  e muda o status sozinho (`PENDENTE` → `EM_ANDAMENTO` →
  `CONCLUIDA` em 100%).
- **`equipe.get/assign`**: atribuir colaborador a uma obra/equipe
  — se ele já estava alocado ali, atualiza (upsert) em vez de
  duplicar.
- **Rastreabilidade de consumo**: agora `estoque.entry` e as
  saídas aceitam `obraId`/`atividadeId` no payload e isso fica
  gravado em `MOVIMENTOS` — a base pra responder "qual atividade
  consumiu esse material" (seção 25) já está pronta.

**Ainda não incluído:** dashboard de progresso por obra
(Relatórios, Fase 9), controle de presença de equipe (a spec
menciona mas não é o foco do almoxarifado — baixa prioridade).

### Como testar a Fase 7

1. Cole os 4 Services, `DB_Mapping.gs`, `Service_Estoque.gs` e os
   4 arquivos `MOD_*` por cima dos antigos.
2. Rode `setup_instalar` de novo (só cria o que falta — mas se
   `ATIVIDADES` já existia, adicione as colunas `obraId` e
   `projetoId` nela manualmente).
3. Adicione `Test_Fase7_ProjetosObras.gs` em `/TESTS`.
4. Rode `Test_Fase7_fluxoCompleto`.

---

## FASE 8 — Ocorrências + Notificações — JÁ INCLUÍDA

Arquivos alterados/novos: `Service_Ocorrencia.gs`,
`Service_Notificacao.gs` (implementados de verdade),
`Notificacao_Events.gs` (novo — gatilhos automáticos plugados no
Event_Bus), `Gatilhos.gs` (novo — verificações por tempo,
instaláveis como trigger do Apps Script), `Service_Estoque.gs`
(ganhou `setMinimo`), `API_Estoque.gs` (rota nova
`estoque.setMinimo`), `DB_Mapping.gs` (`ESTOQUE` ganhou coluna
`estoqueMinimo`), `MOD_20_OCORRENCIAS.gs` e
`MOD_21_NOTIFICACOES.gs` (ativados).

O que passou a funcionar:
- **`ocorrencia.create/update/resolve`**: registro completo, e
  **ocorrência de prioridade ALTA/URGENTE já dispara notificação
  automática pra todo GESTOR/ADMIN** — sem precisar chamar nada
  a mais.
- **`notificacao.list/read/send`**: notificação in-app real
  (tabela `NOTIFICACOES`) + e-mail opcional via
  `Integration_Email` (que já existia desde a Fase 1 — só faltava
  o gatilho).
- **Gatilhos automáticos por evento** (`Notificacao_Events.gs`):
  reserva expirada avisa quem reservou; nota fiscal com
  divergência avisa quem aprova.
- **Gatilhos por tempo** (`Gatilhos.gs`): estoque crítico e
  reserva vencendo em breve **não são eventos, são checagens
  periódicas** — não dá pra saber "vai vencer daqui a 6h" só
  reagindo a um evento que ainda não aconteceu. Por isso ficaram
  em funções separadas, prontas pra virar um trigger de tempo
  de verdade no Apps Script (`setup_instalarGatilhosDeTempo`
  configura isso pra você em 1 clique).
- **`estoque.setMinimo`**: define o mínimo por produto/local —
  base pra detecção de estoque crítico.

**Sobre a limitação do Event_Bus** (documentada desde a Fase 1):
os gatilhos por evento só reagem dentro da mesma execução de
quem emitiu o evento. Na prática isso cobre 100% do uso real,
porque toda ação passa pelo `Core_API.bootstrap()` no início —
que já registra os handlers antes de qualquer rota rodar.

### Como testar a Fase 8

1. Cole `Service_Ocorrencia.gs`, `Service_Notificacao.gs`,
   `Service_Estoque.gs`, `API_Estoque.gs`, `DB_Mapping.gs`,
   `MOD_20_OCORRENCIAS.gs` e `MOD_21_NOTIFICACOES.gs` por cima
   dos antigos.
2. Adicione `Notificacao_Events.gs` em `/EVENTS` e `Gatilhos.gs`
   na raiz do projeto.
3. Rode `setup_instalar` de novo (cria a coluna `estoqueMinimo`
   que falta se a aba `ESTOQUE` for recriada do zero — se já
   existia, adicione a coluna manualmente).
4. Adicione `Test_Fase8_OcorrenciaNotificacao.gs` em `/TESTS`.
5. Rode `Test_Fase8_fluxoCompleto`.
6. Opcional: rode `setup_instalarGatilhosDeTempo` uma vez pra
   deixar as verificações de estoque crítico e reserva vencendo
   rodando sozinhas (6h e 1h, respectivamente).

---

## FASE 9 — Relatórios + PDF + Exportações — JÁ INCLUÍDA

Arquivos alterados: `Service_Relatorio.gs` (implementado de
verdade), `MOD_12_RELATORIOS.gs` (ativado). Nenhuma tabela mudou.

O que passou a funcionar:
- **`relatorio.generate`**: dados **reais** (não simulados) pra
  13 tipos de relatório: `ESTOQUE`, `ESTOQUE_CRITICO`,
  `CURVA_ABC`, `MOVIMENTACOES`, `ENTRADAS`, `SAIDAS`,
  `INVENTARIOS`, `DIVERGENCIAS`, `RESERVAS`, `OBRAS`,
  `FORNECEDORES`, `NOTAS_FISCAIS`, `AUDITORIA` — todos com
  filtros (período, obra, produto, status, fornecedor).
- **Curva ABC de verdade** (seção 48): como `PRODUTOS` ainda não
  guarda custo unitário fixo nesta fase, a classificação A/B/C
  usa **volume de saída movimentado** como proxy de relevância
  (a própria spec permite basear em "valor/movimentação conforme
  configuração") — classificação por Pareto (80%/95%).
- **`relatorio.export`**: gera o arquivo de verdade e salva no
  Google Drive:
  - **CSV**: arquivo `.csv` real.
  - **PDF**: tabela HTML convertida em PDF de verdade
    (`Integration_PDF`).
  - **JSON**: dump completo do dataset.
  - **EXCEL**: aqui fui transparente na limitação — o Apps
    Script não grava um binário `.xlsx` nativo sem biblioteca
    externa, então "Excel" nesta fase cria uma **Google Sheet de
    verdade** com os dados, que você baixa como `.xlsx` pelo
    próprio Drive quando quiser (Arquivo → Fazer download →
    Microsoft Excel). Funciona de verdade, só não é um arquivo
    binário gerado direto pelo servidor.
- Toda exportação fica registrada em `DOCUMENTOS`, com
  referência ao `driveFileId` — auditável e rastreável.

**Pré-requisito pra exportação real**: configure
`DRIVE_FOLDER_DOCS` (ou `DRIVE_FOLDER_ID`) em Configurações —
sem isso, `relatorio.export` responde com erro claro em vez de
fingir que salvou.

**Ainda não incluído:** relatórios que dependem de módulos que
ainda não existem (Compras, Custo de Obra, R6, PEP como entidade
própria) — ficam de fora até essas fases entrarem.

### Como testar a Fase 9

1. Cole `Service_Relatorio.gs` e `MOD_12_RELATORIOS.gs` por cima
   dos antigos.
2. Configure `DRIVE_FOLDER_DOCS` em Configurações (ID de uma
   pasta do seu Drive) se quiser testar a exportação real —
   sem isso o teste roda igual, só pula essa parte com aviso.
3. Adicione `Test_Fase9_Relatorios.gs` em `/TESTS`.
4. Rode `Test_Fase9_fluxoCompleto`.

---

## FASE 10 — SAP + Importação/Exportação Genérica — JÁ INCLUÍDA

Arquivos alterados/novos: `Integration_SAP.gs` (ganhou parser
real), `Service_SAP.gs` (implementado de verdade),
`Service_Importacao.gs` e `Service_Exportacao.gs` (**novos** —
os módulos `MOD_02_IMPORTACAO` e `MOD_11_EXPORTACAO` estavam
vazios desde a Fase 1), `API_Importacao.gs` e `API_Exportacao.gs`
(**novos** — a spec previa esses arquivos na árvore, seção 4, mas
não listava as rotas na seção 50; nomeei de forma consistente com
o resto: `importacao.preview/commit`, `exportacao.generic`),
`Utils_Export.gs` (**novo** — helper de CSV/JSON compartilhado),
`DB_Mapping.gs` (tabela `SISTEMA_SAP` ganhou as colunas reais pra
guardar pedido/item/produto/quantidade importados — antes era só
um placeholder), `MOD_02_IMPORTACAO.gs`, `MOD_11_EXPORTACAO.gs`
e `MOD_24_SAP.gs` (ativados).

O que passou a funcionar:
- **`sap.import`**: lê de verdade um arquivo exportado do SAP
  (CSV ou Google Sheets — **não .xlsx binário puro**, limitação
  real do Apps Script sem biblioteca externa, documentada e
  avisada no próprio erro). O mapeamento de coluna é
  **heurístico**: procura nomes parecidos com os campos-padrão
  do SAP (`EBELN`, `MATNR`, `MENGE`, etc.) — se sua exportação
  usa nomes diferentes, é só adicionar o alias em
  `Service_SAP.ALIASES`.
- Linha importada tenta casar `produtoCodigo` com um produto já
  cadastrado; se não achar, marca `PENDENTE_PRODUTO` em vez de
  inventar o vínculo.
- **`sap.validate`**: reprocessa pendências (útil depois de
  cadastrar o produto que faltava).
- **`sap.export`**: exporta os pedidos importados de volta pra
  CSV.
- **`importacao.preview` / `importacao.commit`**: importação
  genérica pra **qualquer tabela do sistema**, seguindo o fluxo
  exato da seção 38 — primeiro mostra o mapeamento sugerido e uma
  amostra, só grava depois que você confirma (nunca importa
  direto sem essa etapa).
- **`exportacao.generic`**: despejo bruto (CSV/JSON) de qualquer
  tabela, com filtros simples — diferente do `Relatorio`, que já
  processa/junta dado; aqui é exportação crua.

### Como testar a Fase 10

1. Cole `Integration_SAP.gs`, `Service_SAP.gs`,
   `Service_Importacao.gs`, `Service_Exportacao.gs`,
   `API_Importacao.gs`, `API_Exportacao.gs`, `Utils_Export.gs`,
   `DB_Mapping.gs`, `MOD_02_IMPORTACAO.gs`,
   `MOD_11_EXPORTACAO.gs` e `MOD_24_SAP.gs`.
2. Configure `SAP_IMPORT_FOLDER_ID` e `DRIVE_FOLDER_DOCS` em
   Configurações (IDs de pastas do seu Drive) — sem isso o teste
   avisa e para.
3. Rode `setup_instalar` de novo (recria `SISTEMA_SAP` com as
   colunas novas se a aba não existir ainda — se já existia,
   adicione as colunas manualmente).
4. Adicione `Test_Fase10_SAP_ImportExport.gs` em `/TESTS`.
5. Rode `Test_Fase10_fluxoCompleto` — ele cria dois CSVs de teste
   no seu Drive (simulando uma exportação SAP e um arquivo de
   fornecedores), importa os dois, confere que reconheceu o
   produto que já existia e deixou o outro pendente, exporta
   produtos, e limpa os arquivos de teste no final.

---

## FASE 11 — Biometria (provider real) — JÁ INCLUÍDA

Arquivos alterados: `Integration_Biometric.gs` (implementado de
verdade — provider `DEVICE_SECRET`), `Auth_Biometric.gs`
(registra o provider, corrige um **bug de segurança da Fase 1**,
adiciona rota `biometria.delete` que faltava), `Core_Config.gs`
(biometria ativada por padrão em instalações novas), `Setup.gs`
(helper pra ativar em instalações que já existiam).

**Sobre o "provider real"** — leia isso antes de testar: o Apps
Script roda no servidor, sem acesso a câmera/leitor biométrico
(isso só existe no celular da pessoa). Então nenhum provider
rodando em Apps Script "lê" biometria de verdade. O que É real:
o app no celular gera um segredo longo e aleatório, protegido
pelo Keystore/Secure Enclave do aparelho — o sistema operacional
só libera esse segredo depois de Face ID/digital/PIN nativo do
celular. O servidor nunca guarda esse segredo em texto puro, só o
hash (igual senha). Isso é, em segurança, equivalente a login por
senha — só que a "senha" é um segredo que o usuário nunca digita,
e fica trancado atrás da biometria do próprio aparelho. Documentei
isso com todas as letras no código — **não é verificação
biométrica assimétrica tipo WebAuthn** (isso exigiria criptografia
de assinatura que não cabe nesta fase sem biblioteca externa), mas
é uma implementação real, funcional, testável hoje, sem precisar
de SDK pago de terceiro. Trocar de provider no futuro (WebAuthn,
SDK de terceiro) não muda nada em `Auth_Biometric` nem nas rotas —
só troca o que tem dentro de `Integration_Biometric`.

**Bug de segurança corrigido** (existia desde a Fase 1): as rotas
`biometria.*` nunca tinham permissão registrada, então caíam no
padrão de leitura (`VIEW`) — **qualquer perfil de leitura
conseguia registrar ou identificar biometria de qualquer
usuário**. Agora: `register`/`delete` exigem `CREATE` e só
funcionam pra você mesmo (ou ADMIN gerenciando outra pessoa);
`identify` (1:N, tipo totem de ponto) exige `ADMIN`.

O que passou a funcionar:
- **`biometria.register`**: exige consentimento explícito e
  rejeita segredo curto (evita alguém "digitar uma senha" como
  se fosse biometria).
- **`biometria.verify`**: compara hash — nunca guarda o segredo
  original.
- **`biometria.identify`**: 1:N, varre credenciais ativas (aviso
  de escala documentado no código — ótimo pra dezenas/centenas de
  usuários, não pra milhares).
- **`biometria.delete`** (rota nova): revoga a biometria — a
  spec não tinha essa rota na lista original, adicionei porque
  sem ela não dava pra desativar biometria de alguém que perdeu o
  aparelho.
- **`biometria.status`**: mostra se está ativo e o último uso.

### Como testar a Fase 11

1. Cole `Integration_Biometric.gs`, `Auth_Biometric.gs`,
   `Core_Config.gs` e `Setup.gs` por cima dos antigos.
2. Se seu sistema já estava instalado antes desta fase, rode
   `setup_ativarBiometriaDeviceSecret` uma vez (instalação nova
   já vem ativado).
3. Adicione `Test_Fase11_Biometria.gs` em `/TESTS`.
4. Rode `Test_Fase11_fluxoCompleto`.

---

## FASE 12 — Etiquetas + IA + Configurações — JÁ INCLUÍDA

Arquivos alterados/novos: `Service_Etiqueta.gs`, `Service_IA.gs`,
`Service_Config.gs` (implementados de verdade), `API_IA.gs`
(**novo** — o módulo IA existia desde a Fase 1 mas nunca teve
arquivo de rotas, então `Service_IA` ficava sem ninguém pra
chamar), `DB_Mapping.gs` (`ETIQUETA` ganhou estrutura real —
antes era só placeholder), `MOD_23_ETIQUETAS.gs`, `MOD_15_IA.gs`
e `MOD_25_CONFIGURACOES.gs` (ativados).

**Sobre a "IA" — transparência total**: isto não é machine
learning, rede neural nem modelo preditivo treinado. São regras
estatísticas simples e auditáveis:
- **`ia.sugerirCompra`**: regra determinística sobre estoque
  mínimo (repor até 2x o mínimo, descontando reserva).
- **`ia.detectarAnomalias`**: desvio estatístico (z-score ≥ 2)
  sobre o histórico de movimentações — sinaliza uma entrada/saída
  muito fora do padrão do produto naquele local.
- **`ia.analisarConsumo`**: média móvel simples + projeção linear
  ("no ritmo atual, o saldo dura X dias").

Documentei isso com todas as letras no código — a spec permite
essas funções (seção 57) e também proíbe declarar integração
como algo que não é (seção 70). Chamar de "IA" no sentido de
"assistência baseada em regra" é honesto; chamar de "modelo
preditivo" seria mentira. E nenhuma das três grava nada sozinha
— só sugere (seção 57: "IA não poderá alterar dados críticos sem
controle").

O que mais passou a funcionar:
- **`etiqueta.generate`**: monta o conteúdo real do QR (formato
  `TIPO:ID`, decodificável pelo scanner) e salva o registro.
- **`etiqueta.print`**: gera **PDF de verdade**, com imagem do QR
  via um serviço público (api.qrserver.com, sem custo/chave) —
  se esse serviço estiver fora do ar, a etiqueta ainda sai em PDF,
  só com o código em texto grande em vez da imagem (não falha
  tudo por causa de uma dependência externa opcional).
- **`config.get`/`config.update`**: leitura e edição real das
  configurações do sistema, com chaves sensíveis (como
  `OCR_API_KEY`) mascaradas na leitura, e `SPREADSHEET_ID`
  bloqueado contra edição manual (é gerenciado só pelo setup).

### Como testar a Fase 12

1. Cole `Service_Etiqueta.gs`, `Service_IA.gs`,
   `Service_Config.gs`, `API_IA.gs`, `DB_Mapping.gs`,
   `MOD_23_ETIQUETAS.gs`, `MOD_15_IA.gs` e
   `MOD_25_CONFIGURACOES.gs`.
2. Rode `setup_instalar` de novo (recria `ETIQUETA` com as
   colunas novas se não existir — se já existia, ajuste
   manualmente).
3. Adicione `Test_Fase12_EtiquetasIAConfig.gs` em `/TESTS`.
4. Rode `Test_Fase12_fluxoCompleto`.

---

## FASE 13 — Testes Completos + Integração Final — JÁ INCLUÍDA

**Esta é a última fase do backend.** Arquivo novo:
`Test_IntegracaoFinal.gs`, e o documento
`FASE13_INTEGRACAO_FINAL.md` (relatório de aprovação da
arquitetura, seção 74 da spec — checklist de 20 critérios, todos
aprovados).

O que tem:
- **`Test_NaoRegressao_Core`**: confere que Core, Registry/Router,
  Auth/RBAC, Database, Cache, Locks, Events, Audit e Diagnostics
  continuam funcionando depois de 12 fases de mudança em cima
  deles (seção 57 — regra de não regressão).
- **`Test_RunTudo`**: roda TODOS os testes de fase (2 a 12) em
  sequência, mais a não-regressão do Core, mais o diagnóstico
  completo do Doutor — e no final fala **APROVADO** ou
  **REPROVADO**, com contagem de quantos passaram/falharam/foram
  pulados (pulado = você não colou o arquivo de teste daquela
  fase, não é falha).

### Como testar a Fase 13 (rodagem final)

1. Cole `Test_IntegracaoFinal.gs` em `/TESTS`.
2. Idealmente, garanta que todos os `Test_FaseX_*.gs` das Fases 2
   a 12 estão no projeto (se pulou algum, sem problema — o
   `Test_RunTudo` avisa e segue).
3. Rode `Test_RunTudo`. **Demora vários minutos de verdade** — as
   Fases 3, 4 e 6 têm debounce de bipagem de propósito. Não feche
   o editor enquanto roda.
4. Confira o alerta final e o log completo em Ver → Registros de
   execução.

---

## BACKEND COMPLETO — PRÓXIMO PASSO

As 13 fases do backend estão entregues. Leia
`FASE13_INTEGRACAO_FINAL.md` pra ver o resumo de tudo que está
100% real vs. o que ainda é esqueleto documentado (XML de NF-e,
OCR, módulos legados que não entraram na ordem de fases).

A partir daqui, só falta o **frontend** — Desktop primeiro, depois
Mobile, depois teste cruzado entre os dois — consumindo
exatamente as mesmas APIs que você acabou de testar.

---

# FRONT MOBILE — FASE 1 (Fundação) — JÁ INCLUÍDA

Pasta nova: `FRONTEND/` (16 arquivos) + `Code.gs` modificado (agora
serve HTML em vez de só JSON). Leia
`FRONTEND_FASE1_RELATORIO.md` pro relatório completo (é o
documento que a própria spec do front exige na entrega, seção 35).

**O que tem:** App Shell, Header (sino + avatar, sem duplicar
nada), Router (navegação sem reload, por hash), Session Manager,
camada API única (`API.call()` → `google.script.run` →
`Core_API.call()` → backend), e 8 componentes reutilizáveis (Card,
Button, Badge, Toast, Modal, Loading, EmptyState, ErrorState) — o
Design System usa a mesma identidade do desktop (azul marinho +
dourado).

**O que NÃO tem ainda, de propósito:** lojinha, login, cadastro,
biometria, menu completo, PWA — tudo isso são as próximas fases.
A única tela agora é uma área de teste que prova a comunicação
real com o backend (3 cenários: rota inexistente, sessão ausente,
login inválido).

## Como instalar e testar a Fase 1 do Front

1. Cole `Code.gs` por cima do antigo (só mudou `doGet` + 2 funções novas).
2. No editor do Apps Script, crie os 16 arquivos de `FRONTEND/`
   como tipo **HTML**, com o **mesmo caminho/nome** (o editor aceita
   `/` no nome pra organizar em pastas visuais — ex: crie um
   arquivo chamado exatamente `Components/Card`).
3. Nova implantação (Implantar → Gerenciar implantações → editar
   → Nova versão → Implantar).
4. Abra o link do Web App — deve aparecer o App Shell (cabeçalho
   ALMOXA PRO + tela "Fundação do Front — Fase 1").
5. Toque em **"Rodar teste de integração"** — deve mostrar 3 ✅
   confirmando que o Front realmente conversa com o backend.
6. Teste em celular de verdade se puder (a prioridade é mobile).

Se algum dos 3 testes vier ❌, me manda o print ou o texto do
resultado que eu corrijo antes de seguir pra Fase 2.

---

# FRONT MOBILE — FASE 2 (Lojinha) — JÁ INCLUÍDA

Leia `FRONTEND_FASE2_RELATORIO.md` pro relatório completo. Resumo:
fluxo Loja → Categorias → Catálogo (com busca) → Carrinho, tudo
com dado real. Precisei abrir 2 lacunas honestas no backend:
categoria de produto (não existia) e rotas públicas (antes só
`auth.login` não exigia sessão — agora qualquer módulo pode
declarar suas próprias rotas como públicas via
`Core_Registry.registerPublicRoute()`, usado pelo novo
`Service_Loja.gs`).

## Como instalar a Fase 2

1. Cole os arquivos de backend alterados: `DB_Mapping.gs`,
   `Service_Produto.gs`, `Core_Registry.gs`, `Core_Router.gs`,
   `Core_Config.gs`, `MODULES/_ModuleList.gs`.
2. Adicione o arquivo novo `Service_Loja.gs`.
3. Adicione `Test_Loja_RotasPublicas.gs` em `/TESTS` e rode
   `Test_Loja_fluxoCompleto` — confirma que as rotas da loja
   funcionam sem sessão e que o resto continua protegido.
4. No Front: substitua `Front_App.html`, `Front_Styles.html` e
   `JS/App.html` pelos novos, e adicione os 9 arquivos novos
   listados no relatório da Fase 2 (mesma regra de sempre: tipo
   HTML, nome exato com `/` pra organizar em pastas).
5. Nova implantação e testa no navegador: loja → categorias →
   catálogo → adiciona item → carrinho → continuar (deve mostrar
   o placeholder da Fase 3, com seu carrinho ainda intacto se você
   voltar).

**Dica pra testar de verdade**: cadastre 2-3 produtos com
categorias diferentes primeiro (via `Test_Loja_fluxoCompleto` ou
chamando `produto.create` você mesmo) — sem produto cadastrado, a
tela de categorias mostra o estado vazio (correto, não é bug).

---

# FRONT MOBILE — FASE 2: REVISÃO E BLINDAGEM — JÁ INCLUÍDA

Leia `FRONTEND_FASE2_REVISAO.md` pro relatório completo. Não é
fase nova — são correções pontuais em cima da Fase 2 já entregue:
erro de comunicação não se disfarça mais de "lista vazia",
carrinho revalida o estoque de verdade antes de deixar avançar
(ajusta ou remove sozinho o que mudou, avisando você), e o campo
de imagem do produto já existe (com fallback elegante se a URL
não carregar).

## Como instalar a revisão

1. Substitua: `DB_Mapping.gs`, `Service_Produto.gs`,
   `Service_Loja.gs`, `Test_Loja_RotasPublicas.gs`.
2. Substitua no Front: `JS/Store.html`, `Screen_Categories.html`,
   `Screen_Catalog.html`, `Components/ProductCard.html`,
   `Screen_Cart.html`.
3. Rode `setup_instalar` de novo (cria a coluna `imagemUrl` que
   falta, se a aba `PRODUTOS` for recriada — se já existia,
   adicione a coluna manualmente).
4. Rode `Test_Loja_fluxoCompleto` de novo — agora também testa a
   revalidação de carrinho.
5. No navegador: adicione um item ao carrinho, dê baixa manual
   nesse produto no Apps Script (`estoque.exit`) simulando outra
   pessoa levando o material, volte pro carrinho e toque
   "Continuar" — deve avisar que a quantidade mudou.

---

# FRONT MOBILE — FASE 3 (V3): Identidade Central — JÁ INCLUÍDA

Leia `FRONTEND_FASE3_RELATORIO.md` pro relatório completo. Resumo:
Login, Autocadastro, Foto (câmera real), Biometria (WebAuthn real
+ provider DEVICE_SECRET da Fase 11) e Confirmação — tudo
consumindo um `IdentityContext` central novo (`IdentityService.gs`)
que qualquer módulo futuro (Reservas, EPI, Ferramentas) vai usar
sem precisar remontar essa informação.

**Bug real corrigido**: as rotas `usuario.*` nunca estavam
registradas em nenhum módulo desde a Fase 1 — sempre devolveriam
`ROUTE_NOT_FOUND`. Corrigido com `Usuarios_Core.gs`.

## Como instalar a Fase 3

1. Cole os arquivos de backend novos/alterados: `IdentityService.gs`,
   `Usuarios_Core.gs`, `DB_Mapping.gs`, `Service_Loja.gs`,
   `Service_Usuario.gs`, `API_Usuarios.gs`, `Event_Types.gs`,
   `MODULES/_ModuleList.gs`.
2. Adicione `Test_IdentityService.gs` e `Test_Loja_CadastroFoto.gs`
   em `/TESTS`.
3. Rode `setup_instalar` de novo (cria a coluna `fotoUrl` que
   falta em `USUARIOS`, se a aba for recriada — se já existia,
   adicione a coluna manualmente).
4. Rode `Test_IdentityService_fluxoCompleto` e
   `Test_Loja_CadastroFoto_fluxoCompleto`.
5. No Front: substitua `Front_App.html`, `JS/App.html`,
   `JS/Session.html`; adicione os 7 arquivos novos de tela
   listados no relatório; **remova** `Screen_IdentificationPlaceholder.html`
   (foi substituído).
6. Nova implantação e testa no celular de verdade (câmera e
   biometria só funcionam de verdade em navegador mobile com
   HTTPS — o link do Apps Script já é HTTPS por padrão).
---

# FRONT MOBILE — FASE 4: Home, Notificações, Perfil — JÁ INCLUÍDA

Leia `FRONTEND_FASE4_RELATORIO.md` pro relatório completo. Achei
e corrigi 2 bugs de segurança reais em `notificacao.*` (vazamento
entre usuários) antes de construir a Central de Notificações em
cima. Home ganhou cards reais (não inventados), Perfil reaproveita
a câmera/biometria da Fase 3 sem duplicar código.

## Como instalar a Fase 4

1. Cole os arquivos de backend alterados: `Service_Notificacao.gs`,
   `API_Notificacoes.gs`.
2. Adicione `Test_Notificacao_Seguranca.gs` em `/TESTS` e rode
   `Test_Notificacao_Seguranca_fluxoCompleto`.
3. No Front: substitua `Header.html`, `JS/App.html`,
   `Front_App.html`, `Screen_RegisterPhoto.html`,
   `Screen_RegisterBiometric.html`; adicione `Screen_Home.html`,
   `Screen_Notifications.html`, `Screen_Profile.html`; **remova**
   `Screen_Home_Placeholder.html` (substituído).
4. Nova implantação. Testa: login → Home (cards) → toca no sino
   → notificações → volta → toca no avatar → perfil → atualiza
   foto → biometria → sair.
---

# FRONT MOBILE — FASE 5: Menu Central + Bottom Sheet — JÁ INCLUÍDA

Leia `FRONTEND_FASE5_RELATORIO.md` pro relatório completo. Achei
uma contradição real dentro da própria spec (diagrama da barra
inferior duplicava o avatar do Header e inventava um ícone de
"Solicitações" que não existe ainda) — resolvida seguindo a regra
textual obrigatória em vez do desenho. Sem mudança nenhuma de
backend nesta fase.

## Como instalar a Fase 5

1. No Front: substitua `Front_App.html`, `Front_Styles.html`,
   `JS/Router.html`, `JS/App.html`; adicione
   `Components/BottomBar.html` e `Components/MenuSheet.html`.
2. Nova implantação. Testa: logado → barra aparece embaixo →
   toca em ☰ MENU → sobe o sheet → toca em Loja → abre submenu
   (Categorias/Meu carrinho) → volta → toca fora do sheet →
   fecha. Desloga → barra some.
---

# FRONT MOBILE — FASE 6 (parte 1): Solicitações — JÁ INCLUÍDA

Leia `FRONTEND_FASE6_RELATORIO.md` pro relatório completo. A Fase
6 completa é enorme (Estoque, Inventário, Entradas, Saídas,
Rastreabilidade, EPI, Reservas, Relatórios) — comecei por
Solicitações, que é o módulo que faltava desde a Fase 2 (o
carrinho agora realmente vira uma solicitação, com aprovação,
separação e baixa de estoque de verdade).

## Como instalar

1. Cole os arquivos de backend novos/alterados:
   `Service_Solicitacao.gs` (novo), `Service_Loja.gs`,
   `DB_Mapping.gs`, `Event_Types.gs`, `Notificacao_Events.gs`,
   `MODULES/_ModuleList.gs`.
2. Adicione `Test_Solicitacao_fluxoCompleto.gs` em `/TESTS` e
   rode.
3. Rode `setup_instalar` de novo (cria as tabelas novas
   `SOLICITACOES`/`SOLICITACAO_ITENS`).
4. No Front: substitua `Screen_Confirmation.html`,
   `Screen_Home.html`, `Components/MenuSheet.html`; adicione
   `Screen_Solicitations.html` e `Screen_SolicitationDetail.html`.
5. Nova implantação. Testa: carrinho → identificação → login →
   confirmação → enviar solicitação → (logado como admin) menu →
   solicitações → aprovar → separar → concluir.

## Atualização: Fase 6 (parte 2) — Reservas

Achei e corrigi 3 bugs de segurança reais em `Service_Reserva.gs`
(da Fase 5 do backend) antes de construir a tela mobile em cima.
Veja `FRONTEND_FASE6_RELATORIO.md` (seção final) pros detalhes.

1. Cole `Service_Reserva.gs` e `API_Reservas.gs` atualizados.
2. Adicione `Test_Reserva_Seguranca.gs` em `/TESTS` e rode.
3. No Front: substitua `JS/App.html`, `Front_App.html`,
   `Components/MenuSheet.html`; adicione `Screen_Reservations.html`
   e `Screen_ReservationDetail.html`.
4. Nova implantação e testa: menu → Reservas → detalhe.

## Atualização: Fase 6 (parte 3) — Estoque + Relatórios

1. Cole `Service_Estoque.gs` e `API_Estoque.gs` atualizados
   (nova rota `estoque.buscar`, com escopo de dados por perfil).
2. Adicione `Test_Estoque_Buscar.gs` em `/TESTS` e rode.
3. No Front: substitua `JS/App.html`, `Front_App.html`,
   `Components/MenuSheet.html`; adicione `Screen_Stock.html` e
   `Screen_Reports.html`.
4. Nova implantação. Testa: menu → Consultar Estoque → busca →
   (logado como admin) toca no item → vê localizações + histórico.
   Menu → Relatórios → toca em um tipo → vê os dados inline.
---

# FRONT MOBILE — FASE 7: Configuração — JÁ INCLUÍDA

Leia `FRONTEND_FASE7_RELATORIO.md` pro relatório completo. Cards
da Home e Módulos do Menu, que eram fixos no código, agora vêm de
configuração editável pelo ADMIN — com fallback idêntico ao
comportamento anterior se nada for editado.

## Como instalar

1. Cole `Core_Config.gs` atualizado (novos defaults
   `HOME_CARDS_CONFIG`/`MENU_MODULES_CONFIG`).
2. Adicione `Test_Config_Fase7.gs` em `/TESTS` e rode.
3. No Front: substitua `Screen_Home.html`,
   `Components/MenuSheet.html`, `Screen_Profile.html`,
   `Front_App.html`, `JS/App.html`; adicione
   `Components/ConfigListEditor.html`, `Screen_Settings.html`,
   `Screen_ConfigStore.html`, `Screen_ConfigHomeCards.html`,
   `Screen_ConfigMenu.html`.
4. Nova implantação. Testa logado como `admin`: Perfil →
   Configurações → edita a identidade da loja → volta pra tela
   inicial (deve refletir) → Configurações → Cards da Home →
   oculta um card → salva → vai pra Home (deve sumir).
---

# FRONT MOBILE — FASE 8: Diagnóstico — JÁ INCLUÍDA

Leia `FRONTEND_FASE8_RELATORIO.md` pro relatório completo. Achei
e corrigi mais um bug real (rotas `doctor.*` sem permissão,
mesma classe dos anteriores). Detecção de conexão real (banner
some/aparece sozinho). Doutor do Sistema agora é tela de verdade,
não maquete.

## Como instalar

1. Cole `Doctor_Core.gs` atualizado (permissão ADMIN nas rotas
   `doctor.*`).
2. Adicione `Test_Doctor_Seguranca.gs` em `/TESTS` e rode.
3. No Front: substitua `Front_App.html`, `Front_Styles.html`,
   `JS/App.html`, `JS/API.html`; adicione `JS/Connectivity.html`
   e `Screen_Diagnostics.html`.
4. Nova implantação. Testa logado como `admin`: Menu →
   Diagnóstico do Sistema (deve mostrar status real). Desliga o
   Wi-Fi do celular no meio do uso — deve aparecer o banner
   vermelho; religa — deve sumir com um toast de confirmação.
---

# FRONT MOBILE — FASE 9 (FINAL): PWA — JÁ INCLUÍDA

Leia `FRONTEND_FASE9_RELATORIO.md` pro relatório completo —
**importante**: Service Worker não funciona nesta hospedagem
(confirmado, não é escolha nossa). Manifest e "adicionar à tela
inicial" funcionam de verdade, especialmente no iOS.

## Como instalar

1. Cole `Code.gs` atualizado (rota `?manifest=1` + ícone).
2. No Front: substitua `Front_App.html`.
3. **`service-worker.js`** fica na raiz do pacote — **NÃO cole
   isso no Apps Script**, ele não serve pra nada lá (é pra uma
   hospedagem futura fora do Apps Script, documentado no
   relatório).
4. Nova implantação. Testa no iPhone: Safari → compartilhar →
   "Adicionar à Tela de Início" → deve abrir em tela cheia com o
   ícone dourado.

---

# TODAS AS 9 FASES DO FRONT MOBILE ESTÃO COMPLETAS

Resumo de tudo: Fundação → Lojinha → Identificação → Área
Autenticada → Menu Central → Módulos (Solicitações/Reservas/
Estoque/Relatórios) → Configuração → Diagnóstico → PWA.

**9 bugs de segurança reais** foram encontrados e corrigidos ao
longo do caminho (a maioria vazamento de dado entre usuários ou
permissão mal configurada) — todos documentados nos relatórios de
cada fase, com teste dedicado confirmando a correção.

**Pendências conhecidas, documentadas, não escondidas**:
Inventário mobile com câmera, Entradas/Notas Fiscais com OCR,
EPI/Fichas (sem backend ainda).
---

# MÓDULO 01 (contrato "PROMPTS_MODULOS_01_02_03"): Usuários/Identidade — JÁ INCLUÍDO

Leia `MODULO01_USUARIOS_RELATORIO.md` pro relatório completo.
`Service_Usuario.gs` estava esqueleto (`get/search/create/update`
retornavam `MODULE_NOT_IMPLEMENTED`) — agora está completo, com
escopo real de campos por perfil (quem não é dono/ADMIN só vê
identificação básica de outro usuário) e validação real de perfil
contra o enum do RBAC.

## Como instalar

1. Cole `Service_Usuario.gs` e `Event_Types.gs` atualizados.
2. Adicione `Test_Modulo01_Usuarios.gs` em `/TESTS` e rode
   `Test_Modulo01_Usuarios_fluxoCompleto` — confirma os 9 cenários
   do contrato (login, sessão, escopo, criação/edição, foto,
   validação).
3. Nenhuma mudança no Front foi necessária — as rotas já existiam
   desde a Fase 3 do Front Mobile.

**Próximo módulo, quando você quiser**: 02 — Estoque (ampliar com
verde/amarelo/vermelho, consumo médio diário e gatilho de
pré-compra) ou 03 — Compras/Pré-Compra (construir do zero).
---

# MÓDULO 02 (Estoque, ampliação) e MÓDULO 03 (Compras/Pré-Compra) — JÁ INCLUÍDOS

Leia `MODULO02_ESTOQUE_RELATORIO.md` e `MODULO03_COMPRAS_RELATORIO.md`.

**Módulo 02**: classificação verde/amarelo/vermelho, consumo médio
diário e dias de cobertura, gatilho automático pra pré-compra —
tudo composto nas rotas `estoque.get`/`estoque.buscar` que já
existiam (nenhuma rota nova). O gatilho de estoque crítico da
Fase 8 continua intocado.

**Módulo 03**: módulo novo do zero. Usa a tabela `NOTAS_ITENS`
(que já existia, ninguém tinha usado pra isso ainda) como fonte
real de histórico de preço e fornecedor — nunca inventa preço ou
recomendação quando não há dado.

## Como instalar

1. Cole os arquivos de backend novos/alterados:
   `Service_Estoque.gs`, `Core_Config.gs`, `Event_Types.gs`,
   `Gatilhos.gs`, `DB_Mapping.gs`, `MODULES/_ModuleList.gs`,
   `EVENTS/Notificacao_Events.gs` (atualizados), e
   `Service_PreCompra.gs` (novo).
2. Adicione `Test_Modulo02_Estoque.gs` e
   `Test_Modulo03_PreCompra.gs` em `/TESTS` e rode os dois.
3. Rode `setup_instalar` de novo (cria as tabelas novas
   `PRE_COMPRAS`/`PRE_COMPRA_ITENS`).
4. Rode `setup_instalarGatilhosDeTempo` de novo (instala o
   terceiro gatilho, `Gatilho_VerificarNiveisEstoque`).

## Os 3 módulos do contrato "PROMPTS_MODULOS_01_02_03" estão completos
01 (Usuários/Identidade), 02 (Estoque) e 03 (Compras/Pré-Compra) —
todos com teste dedicado e relatório técnico registrando o que
ficou pendente sem fingir que está pronto.
---

# MÓDULO 04 (contrato "PROMPTS_MODULOS_04_05_06"): Inventário — JÁ INCLUÍDO

Leia `MODULO04_INVENTARIO_RELATORIO.md`. Ampliação real do
Inventário já existente (Fase 6 do backend): consulta/listagem
(não existiam), autorização real de equipe pra contar (antes
OPERADOR não conseguia contar nada), planejamento por categoria,
liberação programada, geração D-1, uso real da tabela DIVERGENCIAS
já existente, relatório discriminado, detecção de movimentação
durante a contagem.

**Atenção — mudança de comportamento de segurança**: inventários
sem equipe explícita definida agora só podem ser contados por
ALMOXARIFE/GESTOR/ADMIN. Documentado nos riscos do relatório.

## Como instalar

1. Cole os arquivos alterados: `Service_Inventario.gs`,
   `API_Inventario.gs`, `DB_Mapping.gs`, `Core_Constants.gs`,
   `Core_Config.gs`, `Event_Types.gs`, `Notificacao_Events.gs`,
   `Gatilhos.gs`.
2. Adicione `Test_Modulo04_Inventario.gs` em `/TESTS` e rode.
3. Rode `setup_instalar` de novo (adiciona as colunas novas em
   INVENTARIOS/CONTAGENS se as abas forem recriadas).
4. Rode `setup_instalarGatilhosDeTempo` de novo (instala o
   gatilho D-1).

**Próximos, na ordem que o contrato pede**: Módulo 05 (Reservas,
ampliação) e Módulo 06 (Ferramentas, do zero).
---

# MÓDULO 05 (contrato "PROMPTS_MODULOS_04_05_06"): Reservas — JÁ INCLUÍDO

Leia `MODULO05_RESERVAS_RELATORIO.md`. Achado central: nenhuma
reserva jamais completava o ciclo até a saída física — ficava
aprovada pra sempre sem nunca dar baixa real no estoque. Agora o
ciclo completo existe: Aprovada → Separação → Pronta → Entregue
(saída física real aqui) → Concluída.

## Como instalar

1. Cole os arquivos alterados: `Service_Reserva.gs`,
   `API_Reservas.gs`, `DB_Mapping.gs`, `Core_Constants.gs`,
   `Event_Types.gs`, `Notificacao_Events.gs`,
   `Service_Notificacao.gs`.
2. Adicione `Test_Modulo05_Reservas.gs` em `/TESTS` e rode.
3. Rode `setup_instalar` de novo (colunas novas em RESERVAS, se
   a aba for recriada).

**Próximo, na ordem que o contrato pede**: Módulo 06 (Ferramentas,
construído do zero).
---

# MÓDULO 06 (contrato "PROMPTS_MODULOS_04_05_06"): Ferramentas — JÁ INCLUÍDO

Leia `MODULO06_FERRAMENTAS_RELATORIO.md`. Módulo novo do zero.
Decisão central: em vez de criar um segundo mecanismo de reserva
pra ferramentas, ampliei o `Service_Reserva` do Módulo 05 (só 3
funções) pra aceitar `ferramentaId` — mesma tabela, mesmo ciclo
completo, sem duplicar nada. QR Code reaproveita `Service_Etiqueta`
que já existia; não conformidade reaproveita `OCORRENCIAS`
(generalizada com entidade/entidadeId).

## Como instalar

1. Cole os arquivos alterados: `Service_Reserva.gs`,
   `Service_Etiqueta.gs`, `DB_Mapping.gs`, `Core_Constants.gs`,
   `Event_Types.gs`, `Notificacao_Events.gs`, `Gatilhos.gs`,
   `MODULES/_ModuleList.gs`; e o arquivo novo
   `Service_Ferramenta.gs`.
2. Adicione `Test_Modulo06_Ferramentas.gs` em `/TESTS` e rode.
3. Rode `setup_instalar` de novo (cria as tabelas novas
   FERRAMENTAS/FERRAMENTA_VISTORIAS/FERRAMENTA_MANUTENCOES).
4. Rode `setup_instalarGatilhosDeTempo` de novo (instala o
   gatilho de vistorias pendentes).

---

# OS TRÊS MÓDULOS DO CONTRATO "04, 05, 06" ESTÃO COMPLETOS

04 (Inventário, ampliado), 05 (Reservas, ampliado — ciclo de
saída física completado), 06 (Ferramentas, construído do zero,
reaproveitando o máximo possível). Ao todo, com os 3 módulos
anteriores (01/02/03), são 6 módulos de negócio completos além
das 13 fases do backend e 9 fases do Front Mobile.
---

# MÓDULO 07 (contrato "PROMPTS_MODULOS_07_08_09"): Migration Engine — JÁ INCLUÍDO

Leia `MODULO07_MIGRATION_RELATORIO.md`. Orquestra o que já
existia (Service_Importacao, Backup_Core) em vez de recriar —
adiciona classificação verde/amarelo/vermelho, backup obrigatório
antes de gravar, modo simulação, e rollback funcional de verdade.
Substitui o placeholder `MOD_00_MIGRATION` (nunca teve rota
nenhuma desde a Fase 1).

## Como instalar

1. Cole `DB_Mapping.gs`, `Event_Types.gs`, `MODULES/_ModuleList.gs` atualizados; adicione `Service_Migration.gs` (novo).
2. Adicione `Test_Modulo07_Migration.gs` em `/TESTS` e rode — ele cria e apaga arquivos de teste no seu Drive automaticamente.
3. Rode `setup_instalar` de novo (cria as tabelas `MIGRACOES`/`MIGRACAO_ITENS`).

**Próximos, na ordem do documento**: Módulo 08 (Doctor Engine) e Módulo 09 (AI Engine).
---

# MÓDULOS 08 (Doctor Engine) e 09 (AI Engine) — JÁ INCLUÍDOS

Leia `MODULO08_DOCTOR_RELATORIO.md` e `MODULO09_AIENGINE_RELATORIO.md`.

**Módulo 08** — a peça mais valiosa: `doctor.permissions` agora
detecta AUTOMATICAMENTE toda rota sem permissão explícita (o tipo
de bug que precisou ser achado manualmente 4+ vezes ao longo
deste projeto). Também achei e corrigi um bug real em
`Backup_Core.create()` (nunca devolvia o ID da linha real).

**Módulo 09** — orquestra o `Service_IA` estatístico que já
existia (Fase 12), nunca grava em tabela de negócio (testado).
Achei e corrigi um bug de segurança real: `definirPreferencia`
deixava qualquer usuário configurar a preferência de outro.

## Como instalar os dois juntos

1. Cole os arquivos alterados: `Auth_RBAC.gs`, `Backup_Core.gs`,
   `Doctor_Report.gs`, `Doctor_Recovery.gs`, `Doctor_Core.gs`,
   `DB_Mapping.gs`, `Gatilhos.gs`, `MODULES/_ModuleList.gs`.
2. Adicione os arquivos novos: `Doctor_Permissions.gs`,
   `Doctor_Dependencies.gs`, `Doctor_Backup.gs`,
   `Doctor_ErrorAudit.gs`, `Doctor_History.gs`,
   `Service_AIEngine.gs`.
3. Adicione `Test_Modulo08_Doctor.gs` e `Test_Modulo09_AIEngine.gs`
   em `/TESTS` e rode os dois.
4. Rode `setup_instalar` de novo (cria `DOCTOR_HISTORICO`,
   `IA_INTERACOES`, `IA_PREFERENCIAS`).
5. Rode `setup_instalarGatilhosDeTempo` de novo (instala o
   diagnóstico automático diário).

---

# OS 9 MÓDULOS DO PROJETO (01 A 09) ESTÃO TODOS COMPLETOS

01 (Usuários), 02 (Estoque ampliado), 03 (Compras/Pré-Compra),
04 (Inventário ampliado), 05 (Reservas ampliado — ciclo de saída
física completo), 06 (Ferramentas), 07 (Migration Engine),
08 (Doctor Engine ampliado), 09 (AI Engine). Somados às 13 fases
do backend original e às 9 fases do Front Mobile.

Ao longo de tudo isso, foram encontrados e corrigidos **mais de
15 bugs de segurança/dados reais** — a maioria vazamento entre
usuários ou permissão mal configurada — cada um com teste
dedicado confirmando a correção. Nenhum foi escondido; todos estão
documentados nos relatórios técnicos de cada módulo/fase.
---

# MÓDULO 10 (contrato "Rastreabilidade e Histórico") — JÁ INCLUÍDO

Leia `MODULO10_RASTREABILIDADE_RELATORIO.md`. Descoberta central:
`AUDITORIA`/`Audit_Service` já eram, na prática, o histórico que
esse módulo precisava — não criei tabela nova, só ampliei
`Audit_Service` (2 colunas novas, filtros novos, retrocompatível)
e construí a orquestração (rastreabilidade por ID real, busca
universal, linha do tempo, paginação obrigatória) por cima.

## Como instalar

1. Cole os arquivos alterados: `Audit_Service.gs`, `DB_Mapping.gs`, `MODULES/_ModuleList.gs`.
2. Adicione o arquivo novo: `Service_Rastreabilidade.gs`.
3. Adicione `Test_Modulo10_Rastreabilidade.gs` em `/TESTS` e rode.
4. Rode `setup_instalar` de novo (adiciona as 2 colunas novas em `AUDITORIA` se a aba for recriada).

---

# 10 MÓDULOS DE NEGÓCIO COMPLETOS (01 A 10)

Somados às 13 fases do backend original e às 9 fases do Front
Mobile. Módulos 11 (Central de Dados/Consulta) e 12 (Notificações
e Comunicação) do mesmo prompt mestre ficam pra quando você mandar
o conteúdo completo de cada um (chegaram só com o título "[especificação completa]" faltando o corpo).
---

# MÓDULO 11 (contrato "Central de Dados e Consulta") — JÁ INCLUÍDO

Leia `MODULO11_CENTRALDADOS_RELATORIO.md`. É um REGISTRO que
delega pras funções de busca que cada módulo já tinha (Produto,
Fornecedor, Estoque, Ferramenta, NF, Usuário, Solicitação,
Reserva, Pré-Compra, Inventário) — herda a permissão de cada uma
automaticamente, sem reimplementar checagem nenhuma. Busca por ID
e busca relacionada reaproveitam o Módulo 10 direto, sem duplicar.

## Como instalar

1. Cole `MODULES/_ModuleList.gs` atualizado.
2. Adicione o arquivo novo: `Service_CentralDados.gs`.
3. Adicione `Test_Modulo11_CentralDados.gs` em `/TESTS` e rode.
4. Nenhuma tabela nova, nenhum `setup_instalar` necessário desta vez.

---

# 11 MÓDULOS DE NEGÓCIO COMPLETOS (01 A 11)

Somados às 13 fases do backend original e às 9 fases do Front
Mobile. Módulo 12 (Notificações e Comunicação) do mesmo prompt
mestre fica pra quando você mandar o conteúdo completo dele.
---

# MÓDULO 12 (contrato "Notificações e Comunicação") — JÁ INCLUÍDO

Leia `MODULO12_NOTIFICACOES_RELATORIO.md`. Este era o maior risco
de duplicação do projeto: `Service_Notificacao` já era o módulo
central de notificações desde a Fase 8, com 21 pontos de
integração já plugados. O código deste módulo (ampliação do
Service_Notificacao, API, WhatsApp preparado) já estava pronto;
esta entrega adicionou os testes e o relatório técnico.

## Como instalar

1. Todo o código de produção já está no zip desde a entrega
   anterior — não há arquivo novo além do teste.
2. Adicione `Test_Modulo12_Notificacoes.gs` em `/TESTS` e rode.
3. Rode `setup_instalar` de novo se a aba `NOTIFICACOES` for
   recriada (garante as colunas novas).

---

# OS 12 MÓDULOS DO PROJETO (01 A 12) ESTÃO COMPLETOS

Somados às 13 fases do backend original e às 9 fases do Front
Mobile. 200 arquivos de backend, zero erros de sintaxe.
---

# MÓDULOS 16 E 17 (contrato "Arquitetura Final") — JÁ INCLUÍDOS

Leia `MODULO16_17_ARQUITETURAFINAL_RELATORIO.md`. Módulos
majoritariamente arquiteturais — a maior parte já existia
(Rastreabilidade=Módulo 10, Busca=Módulo 11, IA segura=Módulo 09,
Doutor=Módulo 08, Eventos, contrato de módulo). O que era
genuinamente novo: **Skills** (12 capacidades especializadas que
a IA usa, todas delegando pra função real, nenhuma escreve dado)
e a **síntese de contrato de módulo** (reúne id/versão/rotas/
eventos/dependências que já existiam, sem pedir que nenhum dos 25
módulos mude). O runner de testes mestre (`Test_RunTudo`) agora
cobre os 12 módulos de negócio, que não estavam nele antes.

## Como instalar

1. Cole os arquivos alterados: `Service_AIEngine.gs`,
   `Doctor_Core.gs`, `MODULES/_ModuleList.gs`,
   `TESTS/Test_IntegracaoFinal.gs`.
2. Adicione os arquivos novos: `Service_Skills.gs`,
   `Doctor_Contracts.gs`.
3. Adicione `Test_Modulo16_17_ArquiteturaFinal.gs` em `/TESTS` e rode.
4. Nenhuma tabela nova — nenhum `setup_instalar` necessário.

---

# RESUMO GERAL DO PROJETO

13 fases de backend + 9 fases de Front Mobile + 12 módulos de
negócio (01-12) + 2 módulos de arquitetura final (16-17) = 203
arquivos de backend, zero erros de sintaxe. Dezenas de bugs de
segurança/dados reais encontrados e corrigidos ao longo do
caminho — todos documentados nos relatórios técnicos de cada
fase/módulo, nenhum escondido.
---

# MÓDULOS 13, 14 E 15 (Backup/Doutor/IA) — JÁ INCLUÍDOS

Leia `MODULO13_14_15_RELATORIO.md`. **Contém um bug de segurança
real corrigido**: `backup.create/verify/restore` nunca tiveram
permissão registrada — qualquer usuário autenticado conseguia
chamar `backup.restore`. Corrigido para ADMIN-only. A maior parte
destes 3 módulos já era o Módulo 08 (Doctor) e Módulo 09/16 (IA/
Skills) — só o backup automático, o teste de comunicação em
cadeia, a estrutura PEP e a busca por QR Code com contexto eram
genuinamente novos.

## Como instalar

1. Cole os arquivos alterados: `Backup_Core.gs`,
   `Core_Constants.gs`, `DB_Mapping.gs`, `Doctor_Core.gs`,
   `Gatilhos.gs`, `Service_Skills.gs`, `TESTS/Test_IntegracaoFinal.gs`.
2. Adicione os arquivos novos: `Doctor_Communication.gs`.
3. Adicione `Test_Modulo13_14_15.gs` em `/TESTS` e rode.
4. **Configure `DRIVE_FOLDER_BACKUP`** em `Core_Config` antes de
   testar backup (senão `backup.create` avisa que não está
   configurado — comportamento correto, não um bug).
5. Rode `setup_instalar` de novo (colunas novas em BACKUPS/MOVIMENTOS).
6. Rode `setup_instalarGatilhosDeTempo` de novo (instala o backup automático).

---

# RESUMO GERAL DO PROJETO

13 fases de backend + 9 fases de Front Mobile + 15 módulos de
negócio/arquitetura (01-17) = 205 arquivos de backend, zero erros
de sintaxe. Dezenas de bugs de segurança/dados reais encontrados
e corrigidos — todos documentados, nenhum escondido.
---

# INTEGRAÇÃO 01 (Core ↔ API ↔ Módulos 01-17) — JÁ INCLUÍDA

Leia `INTEGRACAO01_RELATORIO.md`. Auditoria + correção de dois
problemas estruturais reais no `Core_Router`: **"módulo
indisponível" nunca bloqueava rota nenhuma** (um módulo com falha
de inicialização continuava 100% funcional), e **resposta de
handler malformada nunca era detectada**. Nenhum módulo de
negócio foi alterado — só o Core que já orquestrava tudo.

## Como instalar

1. Cole os arquivos alterados: `Core_Router.gs`, `Core_ModuleManager.gs`, `TESTS/Test_IntegracaoFinal.gs`.
2. Adicione `Test_Integracao01_CoreModulos.gs` em `/TESTS` e rode.
3. Nenhuma tabela nova — nenhum `setup_instalar` necessário.

---

# RESUMO GERAL DO PROJETO

13 fases de backend + 9 fases de Front Mobile + 17 módulos de
negócio/arquitetura + 1 integração estrutural (Core↔API↔Módulos)
= 206 arquivos de backend, zero erros de sintaxe.
---

# INTEGRAÇÃO 02 (Camada Central de Dados) — JÁ INCLUÍDA

Leia `INTEGRACAO02_RELATORIO.md`. Auditoria + 4 gaps reais
preenchidos na Data Layer (`DATABASE/`), todos aditivos: retry
com backoff pra erro de conexão transitório (o mais importante —
risco estrutural real), paginação genérica, cache opcional de
leitura (opt-in, nunca aplicado a leitura crítica), e checagem
genérica de duplicidade. Nenhum módulo de negócio foi alterado —
só a camada de dados que todos já usam por baixo.

## Como instalar

1. Cole os arquivos alterados: `DB_Core.gs`, `DB_Query.gs`, `DB_Validation.gs`, `TESTS/Test_IntegracaoFinal.gs`.
2. Adicione `Test_Integracao02_DataLayer.gs` em `/TESTS` e rode.
3. Nenhuma tabela nova — nenhum `setup_instalar` necessário.

---

# RESUMO GERAL DO PROJETO

13 fases de backend + 9 fases de Front Mobile + 17 módulos de
negócio/arquitetura + 2 integrações estruturais (Core↔API↔Módulos,
Camada de Dados) = 207 arquivos de backend, zero erros de sintaxe.
---

# INTEGRAÇÃO 03 (Frontend ↔ Backend multi-dispositivo) — JÁ INCLUÍDA

Leia `INTEGRACAO03_RELATORIO.md`. Auditoria do Front Mobile
(9 fases) + isolamento de sessão testado explicitamente pela
primeira vez + breakpoints reais de tablet/desktop (aditivo) +
infraestrutura (rota/scaffold) pras 7 telas ainda pendentes
(painel, projetos, aprovações, QR Code, etiquetas, almoxarifado
3D, assistente de IA — este último genuinamente funcional).
**Bug real encontrado e corrigido**: uma tela gerada ficou com
aspas não escapadas quebrando a sintaxe JS — pego pela validação
automatizada antes da entrega.

## Como instalar

1. Cole os arquivos alterados: `FRONTEND/JS/App.html`, `FRONTEND/Front_App.html`, `FRONTEND/Front_Styles.html`, `TESTS/Test_IntegracaoFinal.gs`.
2. Adicione os arquivos novos: `FRONTEND/Components/ScreenScaffold.html`, `FRONTEND/Screen_Panel.html`, `FRONTEND/Screen_Projects.html`, `FRONTEND/Screen_Approvals.html`, `FRONTEND/Screen_QRCode.html`, `FRONTEND/Screen_Labels.html`, `FRONTEND/Screen_Warehouse3D.html`, `FRONTEND/Screen_AI.html`.
3. Adicione `Test_Integracao03_FrontendComunicacao.gs` em `/TESTS` e rode.
4. Nenhuma tabela nova — nenhum `setup_instalar` necessário.

---

# RESUMO GERAL DO PROJETO

13 fases de backend + 9 fases de Front Mobile (+ 7 rotas novas
nesta entrega) + 17 módulos de negócio/arquitetura + 3 integrações
estruturais (Core↔API↔Módulos, Camada de Dados,
Frontend↔Backend multi-dispositivo) = 208 arquivos `.gs` + Front
Mobile ampliado, zero erros de sintaxe encontrados na validação.
---

# FRONT-B01 (Entrada, Identidade, Autenticação, Perfil, Configuração) — JÁ INCLUÍDO

Leia `FRONT_B01_RELATORIO.md`. Maior parte já existia (Login,
Sessão, Perfil, Menu, Notificações — construídos nas 9 fases do
Front Mobile). Genuinamente novo: telas de **Usuários** e **Perfis
e Permissões** (esta última é consulta real, não edição — o RBAC
hoje é fixo em código, documentado com honestidade), **Painel
Digital com conteúdo configurável de verdade**, e o componente
**botão flutuante reutilizável** (radial/lista). Nenhuma cor nova
inventada — pendências de paleta registradas explicitamente.

## Como instalar

1. Cole os arquivos alterados: `Screen_Panel.html`, `Screen_Settings.html`, `FRONTEND/JS/App.html`, `Front_App.html`, `Core_Config.gs`, `TESTS/Test_IntegracaoFinal.gs`.
2. Adicione os arquivos novos: `Screen_Users.html`, `Screen_Permissions.html`, `Components/FloatingButton.html`.
3. Adicione `Test_FrontB01_PainelEConfig.gs` em `/TESTS` e rode.
4. Nenhuma tabela nova — nenhum `setup_instalar` necessário.

---

# RESUMO GERAL DO PROJETO

13 fases de backend + 9 fases de Front Mobile (ampliado com 9
rotas novas entre Integração 03 e FRONT-B01) + 17 módulos de
negócio/arquitetura + 3 integrações estruturais = 209 arquivos
`.gs`, zero erros de sintaxe.
---

# BLOCO 02 (Data Core / Importação / Banco Central de Dados) — JÁ INCLUÍDO

Leia `BLOCO02_RELATORIO.md`. Confirma que quase toda a Data Core
que este bloco pedia já existia desde a Fase 1 (`DB_Core`,
`DB_Query`, `DB_Insert`, etc.) — só faltavam `SchemaCore` (tipo/
obrigatoriedade por campo, algo que `DB_Mapping` nunca teve) e
`DB_Errors` (erro estruturado). **Contém um bug real corrigido**:
`Service_Migration.executar()` só detectava duplicidade dentro do
próprio arquivo, nunca contra o banco — reimportar o mesmo
arquivo duas vezes criava registro duplicado de verdade. Corrigido
com um parâmetro opcional (`chaveDeduplicacao`), retrocompatível.

## Como instalar

1. Cole os arquivos alterados: `DB_Validation.gs`, `Service_Migration.gs`, `TESTS/Test_IntegracaoFinal.gs`.
2. Adicione os arquivos novos: `SCHEMA/SchemaCore.gs`, `DATABASE/DB_Errors.gs`.
3. Adicione `Test_Bloco02_DataCoreImportacao.gs` em `/TESTS` e rode.
4. Nenhuma tabela nova — nenhum `setup_instalar` necessário.

**Este é o Bloco 02 de 8 blocos de Frontend** (conforme avisado
pelo usuário) — os próximos (03 a 08) virão em rodadas futuras.

---

# RESUMO GERAL DO PROJETO

13 fases de backend + 9 fases de Front Mobile + 17 módulos de
negócio/arquitetura + 3 integrações estruturais + FRONT-B01 +
BLOCO 02 = 212 arquivos `.gs`, zero erros de sintaxe.
---

# BLOCO 03 (API Interna + Comunicação Central) — JÁ INCLUÍDO

Leia `BLOCO03_RELATORIO.md`. A arquitetura Core→API→Data
Layer→Módulos já existia e já estava testada (Integração 01,
Módulo 17). Os 2 gaps reais preenchidos: resposta agora ecoa
`module`/`action` e traz `error` aninhado (seção 3 do contrato),
sem remover nenhum campo que ~200 pontos do sistema já usavam; e
eventos reais de ciclo de vida de módulo
(`MODULE_REGISTERED`/`STARTED`/`ERROR`, seção 7), que nunca
existiam antes.

## Como instalar

1. Cole os arquivos alterados: `Core_Router.gs`, `Core_ModuleManager.gs`, `Event_Types.gs`, `TESTS/Test_IntegracaoFinal.gs`.
2. Adicione `Test_Bloco03_APIInterna.gs` em `/TESTS` e rode.
3. Nenhuma tabela nova — nenhum `setup_instalar` necessário.

**Bloco 03 de 8** — próximos (04 a 08) em rodadas futuras.

---

# RESUMO GERAL DO PROJETO

13 fases de backend + 9 fases de Front Mobile + 17 módulos de
negócio/arquitetura + 3 integrações estruturais + FRONT-B01 +
BLOCO 02 + BLOCO 03 = 213 arquivos `.gs`, zero erros de sintaxe.
---

# BLOCO 04 (Módulo de Inventário) — JÁ INCLUÍDO

Leia `BLOCO04_RELATORIO.md`. O Inventário já tinha sido construído
extensivamente numa rodada anterior — este bloco preencheu 3 gaps
reais: **`cancelar()`** (o estado CANCELADO existia no enum desde
sempre, nunca alcançável por nenhuma função), **divergência
financeira real** (valor unitário reaproveitado do histórico real
de nota fiscal, nunca inventado — produto sem histórico fica
honestamente marcado como tal), e o campo **`tipo`** do inventário.

## Como instalar

1. Cole os arquivos alterados: `Service_Inventario.gs`, `Service_PreCompra.gs`, `API_Inventario.gs`, `DB_Mapping.gs`, `Event_Types.gs`, `TESTS/Test_IntegracaoFinal.gs`.
2. Adicione `Test_Bloco04_Inventario.gs` em `/TESTS` e rode.
3. Rode `setup_instalar` de novo (colunas financeiras novas em CONTAGENS, `tipo` em INVENTARIOS).

**Bloco 04 de 8** — próximos (05 a 08) em rodadas futuras.

---

# RESUMO GERAL DO PROJETO

13 fases de backend + 9 fases de Front Mobile + 17 módulos de
negócio/arquitetura + 3 integrações estruturais + FRONT-B01 +
BLOCO 02 + BLOCO 03 + BLOCO 04 = 214 arquivos `.gs`, zero erros
de sintaxe.
---

# BLOCO 05 (Módulo de Reservas) — JÁ INCLUÍDO

O relatório desta rodada foi ANEXADO ao
`MODULO05_RESERVAS_RELATORIO.md` já existente (mesmo nome que a
spec pediu, seção do topo é da entrega original, seção do final é
desta rodada) — nada foi apagado. Reservas já estava construído e
funcional; os 2 gaps reais preenchidos: **atendimento parcial**
(nunca existia — agora "reserva de 100, entrega 60, resta 40" real,
com histórico próprio) e **motivo de cancelamento** (coluna já
existia, nunca era gravada). Também corrigi a lista de eventos que
o módulo declarava emitir — estava desatualizada.

## Como instalar

1. Cole os arquivos alterados: `Service_Reserva.gs`, `API_Reservas.gs`, `MOD_07_RESERVAS.gs`, `Notificacao_Events.gs`, `DB_Mapping.gs`, `Core_Constants.gs`, `Event_Types.gs`, `TESTS/Test_IntegracaoFinal.gs`.
2. Adicione `Test_Bloco05_Reservas.gs` em `/TESTS` e rode.
3. Rode `setup_instalar` de novo (coluna nova em RESERVAS, tabela nova RESERVA_ATENDIMENTOS).

**Bloco 05 de 8** — próximos (06 a 08) em rodadas futuras.

---

# RESUMO GERAL DO PROJETO

13 fases de backend + 9 fases de Front Mobile + 17 módulos de
negócio/arquitetura + 3 integrações estruturais + FRONT-B01 +
BLOCO 02 + BLOCO 03 + BLOCO 04 + BLOCO 05 = 215 arquivos `.gs`,
zero erros de sintaxe.
