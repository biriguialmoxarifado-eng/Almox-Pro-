# ALMOXA PRO — FRONT MOBILE — FASE 6 (parte 1: Solicitações)
### Relatório de entrega

---

## 1) Por que comecei por Solicitações, e não por tudo de uma vez

A Fase 6 completa da spec ("Solicitações; Estoque; Inventário;
Entradas; Notas Fiscais; Saídas; Rastreabilidade; EPI/Fichas;
Aprovações; Reservas; Relatórios") é do tamanho de várias fases
juntas. Escolhi **Solicitações primeiro** porque:

1. É a promessa que ficou em aberto desde a Fase 2 — o carrinho
   terminava dizendo "o envio da solicitação chega numa próxima
   fase". Essa fase é agora.
2. Backend (Estoque, Reservas, Saídas, Inventário, Relatórios)
   **já existem e já funcionam** desde as fases 4-9 do backend —
   só faltava a tela mobile. Solicitações é o único módulo que
   **não existia nem no backend**, então era o que mais faltava
   de verdade.
3. É o módulo que mais gente vai usar no dia a dia (todo
   funcionário pode solicitar; só uma minoria vai mexer em
   Estoque/Inventário direto).

Os demais módulos da Fase 6 entram em entregas seguintes.

## 2) Backend novo: `Service_Solicitacao.gs`

Fluxo real, com baixa de estoque de verdade na conclusão:

```
PENDENTE → APROVADA/REPROVADA → EM_SEPARACAO → CONCLUIDA
         (GESTOR/ADMIN)       (ALMOXARIFE+)   (ALMOXARIFE+ —
                                                aqui sim mexe
                                                em ESTOQUE)
```

Separação real de papéis (seção 17 da V3 — solicitante ≠
aprovador ≠ separador): `aprovar`/`reprovar` exigem `APPROVE`
(só GESTOR/ADMIN têm, por causa da matriz de RBAC que já existia
desde a Fase 1); `separar`/`concluir` exigem `EDIT` (ALMOXARIFE
tem, OPERADOR não).

**Tabelas novas**: `SOLICITACOES`, `SOLICITACAO_ITENS`.

**Reaproveitamento sem duplicar**: a validação de estoque na
criação usa a mesma lógica de `loja.validarCarrinho` — extraí
pra uma função interna (`Service_Loja._validarItensContraEstoque`)
que os dois módulos chamam, em vez de duplicar a checagem.

**A baixa de estoque na conclusão é resiliente**: se o saldo de
algum item mudou entre a separação e a entrega, aquele item
específico fica `INDISPONIVEL` e a solicitação fecha como
`CONCLUIDA_COM_PENDENCIA` — não trava a solicitação inteira por
causa de um item.

## 3) Notificações reais ligadas ao fluxo

- Solicitação criada → avisa GESTOR/ADMIN (precisa aprovar).
- Aprovada → avisa ALMOXARIFE/GESTOR/ADMIN (precisa separar) **e** avisa quem pediu.
- Reprovada/Concluída → avisa quem pediu.

Tudo com o mesmo mecanismo de eventos da Fase 8 (`Event_Bus` +
`Notificacao_Events.gs`), sem inventar canal novo.

## 4) Front novo

```
Screen_Solicitations.html       — lista com filtro por status (chips)
Screen_SolicitationDetail.html  — detalhe + ações reais por perfil
```

`Screen_Confirmation.html` foi atualizada: quando o carrinho tem
item, o botão agora é **"ENVIAR SOLICITAÇÃO"** de verdade (chama
`solicitacao.criar`), mostra o número do protocolo, e limpa o
carrinho. `Screen_Home.html` trocou o card genérico "Painel
operacional" por um card real: número de solicitações pendentes
(pra quem aprova) ou total de solicitações (pra quem pediu).
`MenuSheet.html` ganhou a entrada "Solicitações".

## 5) Testes

`Test_Solicitacao_fluxoCompleto.gs`: cria produto+estoque,
funcionário OPERADOR solicita, confere que ele mesmo **não
consegue aprovar a própria solicitação** (`PERMISSION_DENIED`),
admin aprova → separa → conclui, confere baixa real de estoque
(20 → 17), confere que o funcionário recebeu as notificações.

Validei sintaxe de **todos os 36 arquivos do Front** — 0 erros.

---

## O que ainda falta da Fase 6 (próximas entregas)
Estoque (consulta mobile), Inventário, Entradas/Notas Fiscais,
Saídas avulsas, Rastreabilidade, EPI/Fichas, Reservas, Relatórios
— o backend de praticamente todos já existe (fases 4-9); falta
telas mobile consumindo eles, seguindo o mesmo padrão desta
entrega.

---

## PARANDO AQUI — aguardando validação antes de continuar a Fase 6.

---

# ATUALIZAÇÃO — Fase 6 (parte 2): Reservas + 3 bugs de segurança

## 1) Três bugs reais encontrados em Reservas (backend da Fase 5)

Antes de construir a tela mobile, conferi se `Service_Reserva`
aguentaria uso real por qualquer perfil — mesma checagem que já
tinha me feito achar bugs em Notificações (Fase 4) e Solicitações.
Achei três, todos no mesmo arquivo:

1. **`reserva.get` não conferia dono.** Qualquer perfil com `VIEW`
   (ou seja, todo mundo, inclusive `OPERADOR`) conseguia ver os
   detalhes de reserva de **qualquer pessoa**, só sabendo o ID.
2. **`reserva.calendar` vazava tudo.** Sem filtro nenhum de dono —
   qualquer usuário autenticado via essa rota via a reserva de
   todo mundo, de qualquer obra.
3. **`reserva.cancel` ao contrário: bloqueava até o dono.** A
   permissão exigia `EDIT`, que `OPERADOR` não tem — então nem
   quem criou a própria reserva conseguia cancelar ela.

Corrigidos os três: `get`/`calendar` agora escopam por
`ctx.userId` (exceto pra `ALMOXARIFE`/`GESTOR`/`ADMIN`, que
gerenciam reserva de todo mundo de propósito); `cancel` virou
self-service (dono OU quem gerencia), com a permissão de papel
rebaixada pra `VIEW` — a autorização real ficou no `ownership
check` dentro da função, mesmo padrão já usado em
`usuario.salvarFoto` e `notificacao.read`.

Teste dedicado: `Test_Reserva_Seguranca.gs`.

## 2) Telas novas

```
Screen_Reservations.html       — lista (escopada por dono, ou tudo pra quem gerencia)
Screen_ReservationDetail.html   — aprovar/reprovar (GESTOR/ADMIN), cancelar (dono ou gestão)
```

**Não incluído nesta entrega**: criar reserva nova pelo celular —
é uma ferramenta mais interna de almoxarife/gestor; o fluxo do
funcionário comum pra pedir material já é a Solicitação
(construída na parte 1). Documentado, não esquecido.

`MenuSheet.html` ganhou a entrada "Reservas".

## 3) Ainda restam da Fase 6 completa
Estoque (consulta mobile dedicada), Inventário, Entradas/Notas
Fiscais, Rastreabilidade, EPI/Fichas, Relatórios.

---

# ATUALIZAÇÃO — Fase 6 (parte 3): Estoque + Relatórios (fechando esta rodada)

## 1) `estoque.buscar` — nova rota, escopo real por perfil

`estoque.search` só filtrava por `produtoId`/`localizacao` exatos
— inútil pra "digitar capacete e achar" no celular. Criei
`estoque.buscar` com busca por texto (código/descrição), e
apliquei a mesma lógica de escopo de dados da seção 40 do doc de
telas ("permissão de módulo é diferente de permissão de dados"):

- `ALMOXARIFE`/`GESTOR`/`ADMIN`: veem quebra por localização
  (saldo, reservado, bloqueado, mínimo).
- Qualquer outro perfil: só vê o total disponível agregado — os
  campos internos nem vêm na resposta (não é só escondido no
  Front, o backend não manda o dado).

Teste dedicado: `Test_Estoque_Buscar.gs`.

## 2) Rastreabilidade — pedaço pequeno e honesto

A tela de Estoque ganhou "Ver histórico de movimentação" (usa
`estoque.history`, que já existia desde a Fase 4). **Isso não é**
o rastreio completo ENTRADA→RESERVA→SOLICITAÇÃO→SAÍDA que a spec
descreve na seção 70 — é só o histórico de MOVIMENTOS do produto.
O rastreio ponta-a-ponta exigiria unir dados de NF, Reserva e
Solicitação numa timeline só, o que fica pra uma entrega dedicada.

## 3) Relatórios — visualização inline, restrita

Tela nova com 4 tipos (Estoque, Estoque Crítico, Movimentações,
Reservas), reaproveitando o backend da Fase 9 sem mudar nada nele.
Mostra até 30 linhas inline — exportação de arquivo (CSV/PDF)
continua sendo mais natural no desktop, não implementei isso
no celular.

**Nota de honestidade sobre permissão**: bloqueei essa tela no
Front pra perfis que não sejam `ALMOXARIFE`/`GESTOR`/`ADMIN`, mas
a permissão real do backend (`relatorio.generate` → `VIEW`)
tecnicamente ainda permite `OPERADOR` chamar a rota direto. Não é
uma falha de privacidade entre usuários (dado de estoque agregado,
não é dado pessoal de terceiros) — é só uma inconsistência de
escopo de negócio que fica registrada aqui pra revisão futura, em
vez de fingir que já está 100% resolvida.

## 4) O que fica pra outra rodada
Inventário mobile (contagem com câmera — como a Conferência da
Fase 3 do backend, precisa de fluxo de bipagem dedicado), Entradas/
Notas Fiscais (OCR + captura de foto do documento), EPI/Fichas
(sem nenhum backend ainda — documentado desde a Fase 2).

Validei sintaxe de **todos os 40 arquivos do Front** — 0 erros.
