# ALMOXA PRO — MÓDULO 02: ESTOQUE (AMPLIAÇÃO)
### Relatório técnico de implementação

---

## 1) Inventário antes de codificar

Confirmado: `Service_Estoque.gs` já tinha `entry/exit/transfer/
adjust/history/setMinimo/get/search/buscar` reais, com
rastreabilidade completa em `MOVIMENTOS` e eventos
`ESTOQUE_ENTRADA`/`ESTOQUE_SAIDA` já emitidos. Nada disso foi
reescrito. Só adicionei o que faltava: classificação, consumo
médio e o gatilho de pré-compra.

Também descobri que `Gatilho_VerificarEstoqueCritico` (Fase 8)
já fazia uma verificação parecida (saldo ≤ mínimo → notifica
GESTOR/ADMIN) — preservei sem tocar e criei um gatilho novo e
separado, porque a lógica dele é mais simples (usa `saldo` bruto,
não `disponível`, e só cobre "vermelho") e mudar o comportamento
dele quebraria a regra de "não remover funcionalidade das fases
anteriores".

## 2) O que foi implementado

- `classificar(estoqueRow)`: verde/amarelo/vermelho, baseado em
  `disponível` (saldo − reservado − bloqueado, não saldo bruto)
  contra o `estoqueMinimo` configurado. Sem mínimo configurado →
  `NAO_CONFIGURADO` (nunca inventa um limiar).
- `_consumoMedioDiario`: soma as saídas reais (`MOVIMENTOS` tipo
  `SAIDA`) numa janela configurável (padrão 30 dias) ÷ dias da
  janela. Exige um mínimo de eventos (padrão 3) pra considerar
  "histórico suficiente" — com menos que isso, devolve `null`,
  nunca um número especulativo.
- `verificarNiveis(ctx)`: varre todo `ESTOQUE` com mínimo
  configurado, classifica cada linha, e emite
  `ESTOQUE_AMARELO_IDENTIFICADO` pra quem estiver em amarelo —
  não cria nada, só avisa (regra explícita do contrato).
- `get()` e `buscar()` enriquecidos: a classificação/consumo
  entram na MESMA resposta dessas rotas que já existiam — não
  criei uma rota nova (`estoque.classificar`), seguindo a
  orientação do contrato de compor com rotas existentes antes de
  criar uma nova.
- Limiares configuráveis: `ESTOQUE_FATOR_ALERTA_AMARELO` (1.5),
  `ESTOQUE_CONSUMO_DIAS_JANELA` (30),
  `ESTOQUE_CONSUMO_MIN_EVENTOS` (3) — em `Core_Config`, ajustáveis
  sem precisar reimplantar código.
- `Gatilho_VerificarNiveisEstoque`: novo gatilho de tempo (1x/dia),
  instalado junto dos outros dois em `setup_instalarGatilhosDeTempo`.

## 3) Regras de negócio (seção 7 do contrato)

- [x] Nunca altera saldo sem `MOVIMENTOS` — nada mudou aqui, comportamento preservado.
- [x] Campos `reservado`/`bloqueado` continuam escopados por perfil em `buscar()` (regra da Fase 6, preservada).
- [x] Não duplica lógica de reserva — `classificar()` só lê saldo/reservado/bloqueado já existentes, nunca mexe neles.
- [x] Não declara rastreabilidade completa — a seção 12 do contrato já marca isso como pendente; não fingi que ficou pronto.

## 4) Testes — `Test_Modulo02_Estoque.gs`

Cobre especificamente o que é novo: sem mínimo configurado,
verde, amarelo, vermelho, histórico insuficiente → suficiente
(com `diasCobertura` calculado), o gatilho rodando e emitindo
evento só pra quem está amarelo, e erro de produto/localização
inexistente. As funções que já existiam (entrada, saída,
transferência, ajuste, busca, escopo, reserva, histórico) já
tinham teste próprio nas fases anteriores — não dupliquei.

## 5) O que ficou pendente — documentado

- Rastreabilidade completa (ENTRADA→RESERVA→SOLICITAÇÃO→SAÍDA
  numa linha do tempo só): depende de módulos que ainda não
  existem integrados dessa forma — seção 12 do contrato já
  classifica isso como 🟡, não bloqueante.
- OCR de nota fiscal: depende do módulo de Entradas/NF (ainda
  esqueleto, documentado desde a Fase 2 do backend).

---

## Critério de conclusão

Funções obrigatórias implementadas ✅ · Nenhuma duplicação
(gatilho existente preservado, rotas compostas em vez de
recriadas) ✅ · Testes cobrindo o que é novo ✅.

MÓDULO 02 — CONCLUÍDO (ampliação, núcleo intocado).
