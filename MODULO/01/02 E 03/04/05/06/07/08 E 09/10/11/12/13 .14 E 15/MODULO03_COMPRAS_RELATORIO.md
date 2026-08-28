# ALMOXA PRO — MÓDULO 03: COMPRAS / PRÉ-COMPRA
### Relatório técnico de implementação

---

## 1) Inventário antes de codificar

Confirmado: não existia pasta/módulo/tabela de Compras no pacote.
Camada nova de verdade. Mas o inventário revelou uma peça que
muda a qualidade da implementação: `NOTAS_ITENS` já existe desde
a Fase 2 do backend, com `valorUnitario` por item e ligação à
`NOTAS_FISCAIS` (que tem `emitenteCNPJ`/`emitenteNome`). Isso é
histórico REAL de preço e fornecedor — sem essa tabela, eu teria
que declarar "sem fonte de preço disponível" pra tudo; com ela,
dá pra cumprir de verdade a exigência do contrato de nunca
inventar preço/fornecedor.

## 2) Arquitetura — o que consome, o que não duplica

```
Service_PreCompra
  ├─ lê Service_Estoque.classificar()/_saldoDisponivel()  (Módulo 02, não recalcula sozinho)
  ├─ lê NOTAS_ITENS + NOTAS_FISCAIS (status='APROVADA')    (preço/fornecedor reais)
  ├─ lê FORNECEDORES                                        (cadastro real)
  └─ emite eventos → Notificacao_Events reage (não conhece WhatsApp/canal)
```

Nenhuma tabela de reserva paralela, nenhum recálculo de estoque
por fora do Módulo 02, nenhuma duplicação de RBAC.

## 3) O que foi implementado

- `criar`: um ou vários itens no mesmo documento (testado ambos
  os casos). Cada item recebe um snapshot real no momento da
  criação (saldo, classificação, consumo médio, dias de
  cobertura, preço min/médio/max) — não é recalculado depois, é
  o retrato daquele instante, útil pro histórico.
- `calcularResumo`: prévia sob demanda (produto + localização
  opcional), sem criar registro — pro Front mostrar dado real
  antes de a pessoa confirmar.
- `sugerirFornecedores`: só lista fornecedor que já forneceu esse
  produto de verdade (via NF aprovada), com preço médio histórico
  real, ordenado do mais barato pro mais caro. Sem histórico →
  lista vazia com aviso explícito, nunca uma recomendação
  inventada.
- `gerarRelatorio`: reproduz exatamente os itens já registrados
  na criação (testado) — nunca recalcula um número diferente do
  que foi salvo.
- `enviarAprovacao` e `atualizarStatus`: fluxo RASCUNHO/ABERTA →
  EM_ANALISE → APROVADA/REPROVADA/ENCAMINHADA/CONCLUIDA/CANCELADA.
  Só COMPRAS/GESTOR/ADMIN decidem o status pra frente; o próprio
  solicitante só cancela enquanto ainda está aberto (mesmo padrão
  já usado em Solicitações).
- Gatilho automático: reage a `ESTOQUE_AMARELO_IDENTIFICADO`
  (emitido pelo Módulo 02) criando uma pré-compra RASCUNHO (nunca
  uma compra executada) — com deduplicação: não cria um segundo
  rascunho se já existe um aberto pro mesmo produto (testado
  rodando o gatilho duas vezes).

## 4) Regras de negócio (seção 7 do contrato, item por item)

- [x] Não cria compra oficial nem número SAP fictício — só um rascunho de necessidade.
- [x] Não inventa preço — testado explicitamente com item sem histórico (`precoMedio: null`).
- [x] Não inventa fornecedor recomendado — testado com produto sem histórico (`fornecedores: []` + aviso).
- [x] Alerta amarelo vira RASCUNHO pra análise, nunca pedido automático irreversível.
- [x] Front não altera saldo de estoque — este módulo nem escreve em ESTOQUE, só lê.
- [x] Responsável, data e origem do gatilho registrados em cada pré-compra (`solicitanteId`, `dataAbertura`, `origem`).
- [x] Estado da pré-compra é próprio (`PRE_COMPRAS.status`), separado de qualquer compra corporativa real (que nem existe ainda).
- [x] Não envia pra WhatsApp direto — só emite evento; quem decide o canal é `Notificacao_Events`.

## 5) Testes — `Test_Modulo03_PreCompra.gs`

Cobre os cenários da seção 10 do contrato, usando dados reais
(criei 2 notas fiscais de fornecedores diferentes, aprovei as
duas, e confirmei que o preço de referência min/médio/max bate
exatamente com os valores lançados: R$20/R$25/R$30). Também
testei o gatilho automático rodando duas vezes seguidas pra
confirmar que não duplica o rascunho.

## 6) O que ficou pendente — documentado, seção 12 do contrato

- Integração direta com sistema corporativo de compras/SAP — não existe contrato real pra isso ainda.
- Inteligência avançada de escolha de fornecedor — a ordenação atual é só "menor preço médio histórico", um dado, não uma recomendação de IA.
- Preço em tempo real via API externa — nenhuma fonte autorizada configurada.
- Agente IA de recomendação — fora de escopo desta entrega.
- `PRE_COMPRA_SEM_RETORNO` (evento de "sem retorno" pra pré-compra parada) — o contrato já marca como "evento futuro", não implementei.
- Wiring com `Service_Relatorio` (módulo de Relatórios já existente desde a Fase 9 do backend): `gerarRelatorio` devolve estrutura própria em vez de registrar um novo tipo no dispatcher genérico de relatórios — decisão de escopo pra não mexer num módulo que não fazia parte deste contrato; fica registrado como possível unificação futura.

---

## Critério de conclusão

Funções obrigatórias implementadas ✅ · Rotas protegidas por RBAC
real (testado operador tentando aprovar) ✅ · Nenhum dado
inventado (testado com e sem histórico) ✅ · Testes cobrindo os
cenários pedidos ✅ · Nenhuma duplicação de Estoque/Fornecedor/
RBAC/Eventos ✅.

MÓDULO 03 — CONCLUÍDO, com as pendências acima registradas
explicitamente (nenhuma bloqueia o núcleo entregue).
