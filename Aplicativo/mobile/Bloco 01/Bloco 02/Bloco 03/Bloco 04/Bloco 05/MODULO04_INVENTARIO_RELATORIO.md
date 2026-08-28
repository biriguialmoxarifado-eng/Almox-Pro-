# ALMOXA PRO — MÓDULO 04: INVENTÁRIO
### Relatório técnico de implementação

---

## Auditoria do código existente (antes de qualquer alteração)

`Service_Inventario.gs` já tinha um núcleo real e funcional desde
a Fase 6 do backend: `create/open/scan/count/recount/finish/
approve`, com token gerado, saldo esperado congelado na abertura,
debounce de bipagem, e `approve()` aplicando ajuste real em
`ESTOQUE` via `Service_Estoque.adjust`. Nada disso foi reescrito.

Lacunas reais encontradas (confirmadas lendo o código, não
supostas):

| Lacuna | Evidência |
|---|---|
| Nenhuma rota de consulta | Só existiam as 7 ações de fluxo — sem `get`/`listar`, ninguém conseguia ver um inventário sem ter acabado de criar/abrir/etc. |
| OPERADOR bloqueado de contar | `scan`/`count`/`recount` exigiam EDIT, que OPERADOR não tem — mesmo a spec querendo "operador conta quando autorizado" |
| Planejamento só por localização | Sem suporte a categoria/conjunto de produtos |
| Sem checagem de conflito | Dava pra abrir dois inventários simultâneos na mesma localização |
| Sem liberação programada | CRIADO → ABERTO era sempre imediato |
| Sem geração D-1 | Não existia gatilho nem função pra isso |
| DIVERGENCIAS não usada | A tabela genérica já existe (usada pela Conferência de NF) mas o Inventário guardava divergência só no campo `diferenca` de CONTAGENS, sem registro formal, justificativa ou aprovação individual |
| Sem relatório | Nenhuma função reunia os campos que a seção 2.6 pede |
| Sem detecção de movimentação durante contagem | MOVIMENTOS nunca era consultado |

## Arquivos alterados

- `SERVICES/Service_Inventario.gs` — ampliado (funções antigas preservadas na lógica central; só ganharam autorização/registro extra)
- `API/API_Inventario.gs` — 6 rotas novas, permissão de scan/count/recount corrigida
- `DATABASE/DB_Mapping.gs` — INVENTARIOS e CONTAGENS ganharam colunas novas (aditivo)
- `CORE/Core_Constants.gs` — LIBERADO adicionado ao enum (aditivo)
- `CORE/Core_Config.gs` — INVENTARIO_D1_LOCALIZACOES (vazio por padrão)
- `EVENTS/Event_Types.gs` — 7 eventos novos da seção 6 do contrato (os 2 que já existiam continuam intactos)
- `EVENTS/Notificacao_Events.gs` — 2 gatilhos de notificação novos
- `Gatilhos.gs` — Gatilho_GerarInventarioD1 novo

## Arquivos criados

- `TESTS/Test_Modulo04_Inventario.gs`

## Funções implementadas (novas)

`liberar`, `justificarDivergencia`, `get`, `listar`, `relatorio`,
`gerarInventarioD1`, mais os helpers internos `_podeContar`,
`_podeVer`, `_existeInventarioAtivoNoEscopo`,
`_movimentacoesDuranteInventario`.

## Rotas

```
inventario.create      (já existia, ampliada: categoria/produtosEscopo/equipeAutorizada/dataLiberacao/checagem de conflito)
inventario.liberar      NOVA
inventario.open         (já existia, ampliada: filtro por categoria/produtos, exige liberação quando configurada)
inventario.scan         (já existia, ampliada: autorização real de equipe, registra operador/dispositivo/data)
inventario.count        (já existia, ampliada: idem)
inventario.recount      (já existia, ampliada: idem + emite evento)
inventario.finish       (já existia, ampliada: registra em DIVERGENCIAS, detecta movimentação)
inventario.justificarDivergencia  NOVA
inventario.approve      (já existia, ampliada: também marca DIVERGENCIAS como aprovada, emite INVENTARIO_FECHADO)
inventario.get          NOVA
inventario.listar       NOVA
inventario.relatorio    NOVA
inventario.gerarInventarioD1  NOVA (ADMIN — pensada pro gatilho, exposta pra teste manual)
```

## Tabelas/dados usados

INVENTARIOS, CONTAGENS (ambas estendidas, nada removido),
DIVERGENCIAS (reaproveitada — a mesma tabela da Conferência de
NF, como o contrato pediu pra não inventar aba nova), ESTOQUE,
MOVIMENTOS, PRODUTOS (pra filtro por categoria).

## Integrações

- Service_Estoque.adjust — ajuste real no fechamento (preservado, não duplicado)
- Event_Bus/Audit_Service — mesmo padrão de todos os outros módulos
- Notificacao_Events — divergência avisa Gestor/Admin; fechamento avisa o responsável

## Testes executados — Test_Modulo04_Inventario.gs

Cobre o que é novo: conflito de escopo bloqueado, autorização
real de quem conta (equipe explícita — testado com autorizado
passando e não-autorizado bloqueado), divergência virando registro
real em DIVERGENCIAS, justificativa, aprovação aplicando ajuste
real (saldo final conferido no Estoque), bloqueio de alteração após
fechamento, relatório reproduzindo os dados finais, escopo de
listagem (operador só vê o que está na própria equipe), e liberação
programada bloqueando abertura antes da hora.

O núcleo que já existia (criar/abrir/bipar/contar/recontar/
aprovar em fluxo simples, sem os recursos novos) já tinha teste
próprio em Test_Fase6_Inventario.gs — não duplicado aqui.

## 🟢 Concluído

Planejamento por localização/categoria/conjunto de produtos,
conflito de escopo, liberação programada, autorização real de
quem conta, registro formal de divergência (reaproveitando tabela
existente), justificativa de divergência, relatório discriminado,
geração D-1 (gatilho + função), detecção de movimentação durante
o inventário, notificações reais.

## 🟡 Pendente (documentado, não escondido)

- Assinatura/identificação do responsável no relatório (seção
  2.6, "quando o sistema suportar"): não existe módulo de
  assinatura digital no sistema ainda — o relatório traz o
  responsavel (ID/nome), não uma assinatura formal.
- QR Code na contagem: scan() já aceita código de barras
  (reaproveitando codigo/codigoBarras de PRODUTOS); QR Code
  fisicamente é o mesmo dado lido por câmera em vez de leitor a
  laser — não há um serviço de câmera/QR compartilhado
  implementado ainda no backend pra diferenciar a origem da
  leitura (fica registrado como integração futura de "serviço
  compartilhado", conforme a própria regra de arquitetura do
  documento).
- "Dispositivo" na contagem: o campo existe e é aceito
  (dispositivo em CONTAGENS), mas depende do Front mandar essa
  informação — nenhum dispositivo é inferido/inventado no backend.
- Recontagem no relatório: o relatório atual traz uma
  aproximação honesta de "quantas contagens tiveram edição em
  estado de recontagem" — não existe uma tabela RECONTAGENS
  separada (o contrato permite entidades conceituais; optei por
  não criar uma tabela nova só pra isso, já que CONTAGENS com
  dataHora sobrescrita já registra a última contagem — um
  histórico completo de CADA tentativa exigiria versionar cada
  contagem, o que não foi pedido de forma que justificasse a
  tabela nova agora).

## 🔴 Bloqueado

Nenhum item bloqueado — nada dependia de infraestrutura ausente
crítica.

## Riscos encontrados

- A mudança de permissão de scan/count/recount (de EDIT pra VIEW
  + autorização real por dentro) é uma mudança de modelo de
  segurança, não só uma correção de bug isolado — documentando
  aqui com destaque: quem não é ALMOXARIFE+ e não está na
  equipeAutorizada explícita de um inventário específico NÃO
  consegue contar, mesmo sendo OPERADOR. Isso é intencional (é
  literalmente "contar quando autorizado" da seção 7), mas
  precisa ser comunicado pra quem for usar: inventários sem
  equipeAutorizada definida só podem ser contados por
  ALMOXARIFE/GESTOR/ADMIN (comportamento restritivo por padrão,
  proposital).
- gerarInventarioD1 cria E abre automaticamente — se um operador
  não tiver sido colocado na equipe autorizada daquele escopo
  antes do gatilho rodar, ninguém vai conseguir contar até um
  ALMOXARIFE+ ajustar a equipe manualmente (não há rota de
  "adicionar à equipe" nesta entrega — outra pendência a
  registrar, não bloqueante pro núcleo, mas relevante pro uso
  real do D-1 automático).

---

## Critério de conclusão

Backend existe e protegido ✅ · Dados reais (sem mock) ✅ ·
Integração com Core/API/Eventos/Auditoria correta ✅ · Testes
passam ✅ · Pendências documentadas acima ✅ · Nenhum módulo
anterior quebrado (validado por inspeção — nenhuma função
removida, só ampliada) ✅.

MÓDULO 04 — CONCLUÍDO (com pendências 🟡 registradas, nenhuma
bloqueante).
