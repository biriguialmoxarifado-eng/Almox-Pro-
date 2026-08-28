# ALMOXA PRO — BLOCO 04: MÓDULO DE INVENTÁRIO
### Relatório técnico (formato da seção 21 do contrato)

---

## Aviso crítico sobre este bloco

Um "Módulo de Inventário" já tinha sido construído extensivamente
em uma rodada muito anterior desta mesma conversa (aquele "Módulo
04" original), com núcleo real: criar, liberar, abrir (congela
saldo esperado), bipar, contar, recontar, aprovar/reprovar,
consultar, listar, relatório, geração automática D-1, autorização
real de equipe, detecção de movimentação durante a contagem. A
auditoria confirmou que a imensa maioria deste Bloco 04 já existia
e já era real — não reconstruí nada disso. Encontrei 3 gaps
genuínos comparando item a item com este novo contrato, e foquei
só neles.

## Gap 1 (seção 3/20): cancelar() nunca existia

O estado CANCELADO já existia no enum INVENTARIO_ESTADOS desde a
primeira versão do módulo — mas nenhuma função jamais fazia essa
transição. Um inventário não podia ser cancelado de verdade; só
reprovado (depois de já contado) ou deixado pra sempre num estado
ativo. Corrigido: cancelar() novo, restrito a estados ainda ativos
(nunca depois de aprovado/finalizado — desfazer uma operação que
já ajustou estoque de verdade não é "cancelar", é outra operação),
com a mesma checagem de acesso (_podeVer) já usada em get().

## Gap 2 (seção 6/7): divergência financeira nunca existia

O módulo só calculava divergência de quantidade. Este contrato
pede explicitamente "valor unitário", "valor sistêmico", "valor
contado", "diferença financeira" por item, e "valor total"/
"divergência total" no inventário inteiro.

Achado importante na auditoria: PRODUTOS não tem NENHUM campo de
custo — a única fonte real de preço no sistema inteiro é o
histórico de nota fiscal aprovada, que o Módulo 03 (Pré-Compra)
já usa internamente (Service_PreCompra._historicoPrecos).
Reaproveitei essa lógica em vez de inventar um sistema de custo
paralelo — expus Service_PreCompra.obterPrecoReferencia() (repasse
fino da função que já existia) e o Inventário passou a consultar
isso na abertura, gravando o preço médio real por item.

Honestidade: produto sem histórico de nota fiscal aprovada fica
com valorUnitarioDisponivel: false e valor financeiro zerado —
nunca um número inventado. O relatório final soma só os itens que
TÊM preço real (totalItensSemPrecoDisponivel informa quantos
ficaram de fora do cálculo, de forma transparente).

## Gap 3 (seção 5): campo tipo do inventário não existia

Adicionado (GERAL/CICLICO/ROTATIVO — texto livre, informativo, não
validado contra lista fechada porque o contrato não define uma
lista fechada).

## O que já existia e foi só confirmado (sem duplicar)

| Seção do contrato | Onde já está |
|---|---|
| 2. Responsabilidades (criação, obra, local, responsável, status, itens, observações, conferência, fechamento, histórico) | Service_Inventario já cobria tudo isso |
| 4. Identificação única | Utils_ID.tokenComAno('INV', seq) já gera exatamente INV-2026-000001 |
| 8. Contagem (bipagem, busca manual, incremento, correção, usuário, data/hora, histórico) | scan/count/recount já existiam |
| 9. Rastreabilidade (usuário/data/hora/ação/valor anterior/novo/origem) | Audit_Service.record em toda transição, já era assim |
| 10. Integração com o Core (sessão/permissão/eventos) | já era assim desde a criação do módulo |
| 11. Ações via API (criar/listar/buscar/abrir/iniciarContagem/...) | já existiam com nomes equivalentes (create/listar/get/open/scan/count/finish/approve) — contrato admite "nomes poderão ser ajustados" |
| 13. Permissões por perfil (Operador conta quando autorizado, Almoxarife cria/finaliza, Gestor aprova) | já era exatamente assim (_podeContar, _podeVer) |
| 14. Validações antes de concluir | finish() já rejeitava fechamento incompleto |
| 16. Doutor do Sistema | Doctor_Contracts.describe('MOD_10_INVENTARIO') já expõe tudo isso desde o Módulo 17 |

## Mapeamento de eventos (nomes diferentes, mesma cobertura)

| Nome do contrato | Nome real já usado |
|---|---|
| INVENTORY_CREATED | INVENTARIO_CRIADO |
| INVENTORY_STARTED | INVENTARIO_INICIADO |
| ITEM_COUNTED/ITEM_UPDATED | implícito em scan/count/recount (não há evento dedicado por item — decisão preservada, ver pendências) |
| INVENTORY_CLOSED | INVENTARIO_FECHADO |
| INVENTORY_SENT_APPROVAL | INVENTARIO_DIVERGENCIA (é o ponto em que o inventário passa a aguardar decisão) |
| INVENTORY_APPROVED/INVENTORY_REJECTED | ambos cobertos por INVENTARIO_FECHADO com decisao: 'APROVADO'/'REPROVADO' |
| INVENTORY_CANCELLED | INVENTARIO_CANCELADO — novo, criado nesta entrega |

## Arquivos alterados

```
SERVICES/Service_Inventario.gs — cancelar() novo; financeiro real em open/scan/count/recount/relatorio; campo tipo
SERVICES/Service_PreCompra.gs  — obterPrecoReferencia() exposto (repasse, reaproveitamento)
API/API_Inventario.gs          — rota inventario.cancelar
DATABASE/DB_Mapping.gs         — INVENTARIOS.tipo, CONTAGENS com 5 campos financeiros (tudo aditivo)
EVENTS/Event_Types.gs          — INVENTARIO_CANCELADO
TESTS/Test_IntegracaoFinal.gs  — teste novo no runner mestre
```

## Arquivo criado

```
TESTS/Test_Bloco04_Inventario.gs
```

## Nenhum backend/banco/autenticação paralelo criado

Confirmado por auditoria: zero acesso direto a SpreadsheetApp,
zero sessão própria, zero sistema de permissão próprio — tudo via
DB_Query/DB_Insert/Auth_RBAC/Auth_Session que já existiam.

## Testes executados — Test_Bloco04_Inventario.gs

ID gerado no formato exato do contrato (INV-2026-000001); campo
tipo registrado; abertura populando valor unitário real (25,
vindo de uma nota fiscal aprovada de teste) e calculando valor
sistêmico corretamente (20 × 25 = 500); item sem histórico de
preço tratado honestamente (zerado, disponivel: false); contagem
recalculando o financeiro corretamente (18 contados vs 20
esperados, a 25 cada = diferença de -50); totais do inventário
inteiro corretos, ignorando o item sem preço e informando quantos
ficaram de fora; cancelar() funcionando de verdade; inventário
cancelado não pode ser reaberto; inventário já aprovado não pode
ser cancelado retroativamente; usuário sem acesso ao inventário
bloqueado de cancelá-lo.

O núcleo que já existia (criar/abrir/bipar/contar/aprovar/escopo/
autorização de equipe/detecção de movimentação) já tinha teste
próprio em Test_Modulo04_Inventario.gs — não duplicado aqui.

## Dependências

Nenhuma nova. SchemaCore/DB_Errors do Bloco 02 não precisaram ser
usados aqui (o Inventário já tinha sua própria validação
estruturada desde antes).

## Relação com Core/API/Data Layer (seção 10/20)

Nenhuma alteração no Core pra resolver problema do Inventário —
os 3 gaps encontrados eram todos internos ao próprio módulo
(Service_Inventario) ou uma exposição fina de função já existente
em outro módulo de negócio (Service_PreCompra), nunca no Core.

## Diagnóstico (seção 16)

doctor.moduleContract com moduloId: 'MOD_10_INVENTARIO' (já
existia desde o Módulo 17) mostra id/versão/status/dependências/
rotas/permissões do módulo — incluindo a rota cancelar nova,
automaticamente, sem precisar atualizar o Doutor manualmente (ele
sintetiza a partir do que já está registrado).

## Limitações reais (não escondidas)

- Não existe evento dedicado ITEM_COUNTED/ITEM_UPDATED por item
  individual — cada bipagem/contagem já é auditada (Audit_Service)
  mas não emite um evento de domínio próprio por item, só a
  transição de estado do inventário como um todo. Não implementei
  isso porque o volume seria alto (um evento por item bipado) pro
  ganho de rastreabilidade que a auditoria já cobre — mesma
  decisão já tomada e documentada no Bloco 03 sobre DATA_READ/
  DATA_WRITE.
- "Valor sistêmico"/"valor contado" refletem o preço médio
  HISTÓRICO (de notas aprovadas), não necessariamente o "custo
  contábil atual" de um sistema de custo formal (que este projeto
  não tem) — documentado como a fonte real disponível, não uma
  limitação escondida.
- tipo do inventário é texto livre — sem uma lista fechada de
  valores válidos, porque o contrato não definiu uma.

---

## Critério de conclusão (seção 19, literal)

Core -> API -> Data Layer -> Inventário funcionando de forma
integrada ✅ (já era, confirmado) · Criar/consultar/contar/
calcular divergência/rastrear/finalizar sem código paralelo ✅ ·
Divergência financeira real implementada (gap novo) ✅ ·
Cancelamento real implementado (gap novo) ✅ · Testes cobrindo os
3 gaps + não-regressão do que já existia ✅ · 214 arquivos, 0
erros de sintaxe ✅.

BLOCO 04 — CONCLUÍDO.
