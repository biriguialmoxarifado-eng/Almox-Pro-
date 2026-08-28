# ALMOXA PRO — BLOCO 09: PRANCHA DE CONEXÃO / CENTRAL DE INTEGRAÇÃO
### Relatório técnico

---

## A regra mais importante deste bloco, levada a sério até o fim

"Não inventar conexões" era a frase mais repetida do contrato. Ao
auditar o Event_Bus (a peça que decide quem escuta o quê),
encontrei um problema real: ele registrava e executava listeners
perfeitamente, mas nunca sabia dizer QUAL módulo era o dono de
cada um. Sem essa informação, desenhar uma linha "ESTOQUE →
PRÉ-COMPRA" no mapa seria uma suposição minha, não um fato do
sistema — exatamente o que o contrato proíbe.

Por isso, antes de escrever qualquer coisa visual, ampliei o
Event_Bus para aceitar um 3º parâmetro opcional (ownerModuleId) e
retrofitei os 4 arquivos que registram listeners reais
(Service_PreCompra, Event_Core, Audit_Events, Notificacao_Events
— 25 registros de uma vez, via um wrapper local pra reduzir risco
de erro manual). Sem essa correção de base, este bloco inteiro
teria que fingir as conexões — e eu não fiz isso.

## Arquitetura da entrega

```
FRONT (Screen_ConnectionBoard.html)
    v
API (doctor.integrationMap / doctor.moduleDependencies)
    v
CORE (Doctor_Core)
    v
Doctor_IntegrationMap.gs (novo — só REÚNE dado, zero lógica de negócio)
    v
Doctor_Contracts (Módulo 17, já existia) + Event_Bus (ampliado) + Core_Config
    v
DATA LAYER
```

Exatamente a arquitetura que a seção 23 do contrato pede — o
Front nunca acessa Sheets/Services internos diretamente, só a
rota.

## O que é real em cada peça do mapa

| Elemento do mapa | Fonte real |
|---|---|
| Módulos (nós) | Doctor_Contracts.mapaDoSistema() — já existia desde o Módulo 17, nenhuma lista paralela |
| Conexões de dependência | module.dependencies — já existia em cada descritor desde a Fase 1 |
| Conexões de evento | Event_Bus.getListenersInfo() — novo, só existe porque ampliei o barramento primeiro |
| Integrações externas | Core_Config.get(...) — nunca "mostrado como conectado" sem valor real configurado (regra explícita da seção 15) |
| Saúde geral | Contagem real sobre os nós/arestas que acabaram de ser montados, nunca um número fixo |
| Incompatibilidades | Comparação real: toda dependência declarada precisa existir no Registry — se não existir, aparece como problema |

## Honestidade sobre conexões que NÃO aparecem

Um listener registrado SEM o 3º parâmetro (ownerModuleId)
simplesmente não vira uma linha no mapa — ele continua
funcionando perfeitamente no sistema (o comportamento de runtime
não muda em nada), só não é atribuído a um módulo por suposição.
Testei exatamente isso: registrei um listener sem dono, confirmei
que ele ainda recebe o evento normalmente, e confirmei que
getListenersInfo reporta ownerModuleId: null pra ele — nunca
inventando um módulo dono.

## Decisão: auditoria universal (AUDIT) filtrada do mapa de negócio

Audit_Events.gs registra um listener pra TODO evento do catálogo
— é o comportamento correto (auditoria observa tudo), mas incluir
isso no mapa criaria uma linha de CADA módulo pra AUDIT, sem
nenhum valor pra quem está tentando entender o fluxo real do
negócio. Documentado e filtrado de propósito — não é uma conexão
escondida, é uma decisão de design pra o mapa continuar legível.

## Escopo real desta entrega (Front) — o que foi construído e o que não foi

Construído, funcional, testável:
- Mapa SVG real (desktop/tablet): núcleo Core no centro, módulos
  dispostos em círculo, linhas reais (sólida = dependência,
  tracejada dourada = evento), com tooltip nativo mostrando
  origem/destino/evento ao passar o mouse (seção 8).
- Clique no módulo abre painel de detalhe real (rotas/dependências/
  dependentes/eventos — seção 10/11).
- Busca por nome/ID (seção 14) e filtro por tipo de conexão/erro
  (seção 13).
- Saúde no topo, calculada dos dados reais (seção 16).
- Integrações externas listadas com status real (seção 15).
- Mobile (seção 22, seguida à risca): nunca tenta reproduzir o
  mapa inteiro — lista de módulos, seleção, detalhe. Threshold de
  768px, mesma convenção já usada desde a Integração 03.
- Auditoria de acesso à prancha (seção 18), registrada no backend.
- Permissão ADMIN-only, validada no backend.

Não construído nesta entrega (documentado, não escondido):
- Arrastar o mapa (pan) e zoom livre com o mouse/dedo — o SVG usa
  viewBox com ajuste automático de tela, mas não tem interação de
  arrastar/zoom in-out livre. Implementar isso de verdade (sem
  biblioteca externa) exigiria uma extensão real de esforço que
  não coube nesta rodada — registrado como pendência.
- Minimapa — não implementado.
- "[Organizar automaticamente]" como algoritmo de layout de
  força/física — o posicionamento atual já é automático (círculo
  ao redor do Core), mas não é um algoritmo de "force-directed
  graph" que reorganiza dinamicamente.
- Modo fluxo dedicado (seção 12 — "Entrada de Material",
  "Necessidade de Compra" como trilhas nomeadas) — os DADOS pra
  isso já existem no mapa (é possível seguir as arestas
  manualmente clicando nó por nó), mas uma trilha pré-nomeada
  "clique aqui pra ver o fluxo de Entrada de Material" não foi
  construída como atalho dedicado.

## Arquivos criados

```
DIAGNOSTICS/Doctor_IntegrationMap.gs
FRONTEND/Screen_ConnectionBoard.html
TESTS/Test_Bloco09_PranchaDeConexao.gs
```

## Arquivos alterados

```
EVENTS/Event_Bus.gs            — 3º parâmetro (ownerModuleId), getListenersInfo/getEventTypesComListener novos
SERVICES/Service_PreCompra.gs  — dono declarado (PRECOMPRA)
EVENTS/Event_Core.gs           — dono declarado (CORE)
AUDIT/Audit_Events.gs          — dono declarado (AUDIT), documentado como filtrado do mapa de negócio
EVENTS/Notificacao_Events.gs   — 25 registros com dono declarado (MOD_21_NOTIFICACOES), via wrapper local
DIAGNOSTICS/Doctor_Core.gs     — rotas doctor.integrationMap/moduleDependencies, auditoria de acesso
FRONTEND/JS/App.html           — rota /prancha-conexao
FRONTEND/Front_App.html        — include da tela nova
FRONTEND/Screen_Settings.html  — card de acesso
TESTS/Test_IntegracaoFinal.gs  — teste novo no runner mestre
```

## Rotas

```
doctor.integrationMap        (ADMIN)
doctor.moduleDependencies    (ADMIN)
```

## Testes executados — Test_Bloco09_PranchaDeConexao.gs

Mapa carrega com módulos reais (20+, incluindo Estoque e
Pré-Compra); a conexão-exemplo literal do contrato
(ESTOQUE_AMARELO_IDENTIFICADO → PRECOMPRA) aparece de verdade;
auditoria universal nunca aparece como conexão de negócio;
mecanismo funciona mesmo sem dono declarado, mas não vira conexão
inventada (testado nos dois sentidos: o evento ainda dispara o
handler, mas ownerModuleId fica null); dependência real
(Estoque→Reservas) aparece como aresta; integração nunca mente
sobre status (Google Sheets e WhatsApp testados nos dois cenários
possíveis); WhatsApp honesto sobre não ter provedor contratado;
saúde geral bate exatamente com a contagem real de nós/arestas;
zero incompatibilidade no sistema real (sanity check); mapa de
dependência de um módulo específico funcionando; módulo
inexistente tratado; permissão bloqueando não-admin.

## Dependências

Nenhuma nova. Reaproveita Doctor_Contracts (Módulo 17), Event_Bus
(ampliado), Core_Config, Core_Version.

## Limitações reais (não escondidas)

- Pan/zoom livre e minimapa não implementados (documentado acima).
- "Modo fluxo" com trilhas nomeadas não construído como atalho
  dedicado — os dados já suportam navegação manual.
- Conexões de evento só aparecem pros 4 arquivos que registram
  listener no sistema hoje — se um módulo novo passar a escutar
  evento sem declarar ownerModuleId, essa conexão específica
  simplesmente não aparece no mapa (comportamento correto e
  documentado, não um bug).

---

## Critério de conclusão (seção 26, item a item)

Mapa de módulos ✅ · Mapa de conexões ✅ (real, nunca inventado) ·
Dependências ✅ · Eventos ✅ · API ✅ · Services ✅ (via contrato) ·
Core ✅ · Data Layer ✅ (representado, nunca acessado direto pelo
Front) · Integrações externas ✅ (status real) · Status ✅ ·
Diagnóstico ✅ (reaproveita Doctor) · Busca ✅ · Filtros ✅ · Fluxos
⚠️ (dados existem, atalho dedicado não construído — pendência
documentada) · Auditoria ✅ · Permissões ✅ · Desktop ✅ · Tablet ✅
(mesmo SVG, responsivo) · Mobile adaptado ✅ (lista, seção 22
seguida à risca) · Testes ✅ · 220 arquivos, 0 erros de sintaxe ✅.

Nenhuma conexão fictícia ✅ · Nenhum módulo duplicado ✅ · Nenhuma
regra de negócio no Front (Doctor_IntegrationMap faz toda a
composição no backend) ✅ · Nenhum acesso direto do Front ao banco
✅.

BLOCO 09 — CONCLUÍDO (com 3 pendências de escopo visual
documentadas, nenhuma delas compromete a garantia central do
contrato: zero conexão inventada).
