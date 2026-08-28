# ALMOXA PRO — MÓDULO 05: RESERVAS
### Relatório técnico de implementação

---

## Auditoria do código existente

`Service_Reserva.gs` já tinha create/get/approve/reject/cancel/
calendar/schedule reais, com a regra fundamental corretamente
implementada desde a Fase 5: reserva trava `reservado` no
Estoque, nunca mexe em `saldo` físico. A Fase 6 do Front Mobile
já tinha corrigido 3 bugs de segurança aqui (get/calendar
vazando reserva de terceiros, cancel bloqueado até pro dono) —
tudo isso continua intocado.

A lacuna real e central: nenhuma reserva jamais completava o
ciclo até a saída física. Uma vez aprovada, ficava APROVADA pra
sempre — sem separação, sem entrega, sem baixa real no estoque.
A regra "reserva reduz disponível; o físico só muda na saída
real" (seção 1 do contrato) só tinha a metade implementada.
Outros achados: reject() nunca emitia evento nenhum (solicitante
não era avisado da reprovação), e não existia rota de consulta de
disponibilidade nem de histórico.

## Decisão documentada sobre os estados (seção 4 do contrato)

A spec pede também "Rascunho", "Em análise" e "Pré-reserva" antes
de "Reservada". Não criei esses três como estados novos — o
PENDENTE que já existe desde a Fase 5 cumpre exatamente essa
função (saldo travado, aguardando decisão). Desdobrar isso em
mais estados só pra bater literalmente com o vocabulário da spec
não mudaria nenhum comportamento e contrariaria a própria regra
do contrato ("não duplicar enum"). Formalizei um RESERVA_ESTADOS
em Core_Constants.gs com os nomes que já eram usados como string
solta, mais os elos novos que realmente faltavam.

## Arquivos alterados

- `SERVICES/Service_Reserva.gs` — núcleo antigo preservado; 6 funções novas
- `API/API_Reservas.gs` — 6 rotas novas
- `DATABASE/DB_Mapping.gs` — RESERVAS ganhou colunas de rastreio do ciclo (aditivo)
- `CORE/Core_Constants.gs` — RESERVA_ESTADOS formalizado (aditivo)
- `EVENTS/Event_Types.gs` — 8 eventos novos (os 4 que já existiam continuam)
- `EVENTS/Notificacao_Events.gs` — 6 notificações reais novas
- `SERVICES/Service_Notificacao.gs` — verificarReservasVencendo passou a emitir o evento formal RESERVA_EXPIRANDO (a notificação em si já existia, só não passava pelo Event_Bus)

## Arquivos criados

- `TESTS/Test_Modulo05_Reservas.gs`

## Funções novas

`disponibilidade`, `historico`, `separar`, `marcarPronta`,
`entregar` (a mais importante — é onde a saída física real
acontece), `concluir`.

## Rotas

```
reserva.create           (preservada)
reserva.get               (preservada)
reserva.approve           (ampliada: agora aceita comentário — seção 8)
reserva.reject            (corrigida: agora emite evento e grava motivo)
reserva.cancel            (preservada, agora cobre também EM_SEPARACAO/PRONTA)
reserva.calendar          (preservada)
reserva.schedule          (preservada)
reserva.disponibilidade   NOVA
reserva.historico         NOVA
reserva.separar           NOVA
reserva.marcarPronta      NOVA
reserva.entregar          NOVA — efetiva a saída física real
reserva.concluir          NOVA
```

## Integrações

- Service_Estoque._registrarSaidaInterna — reaproveitada exatamente como Service_Solicitacao já fazia (mesmo padrão, terceira vez que esse mecanismo é usado no sistema, zero duplicação)
- Service_Estoque.get — reaproveitada dentro de disponibilidade(), nunca recalcula saldo por fora
- AUDITORIA — reaproveitada dentro de historico(), sem trilha própria paralela

## Testes executados — Test_Modulo05_Reservas.gs

Cobre o que é novo: reserva sem saldo (bloqueada), disponibilidade
composta com Estoque, reserva reduzindo só o disponível (saldo
físico intacto), tentativa de alterar reserva de outro (bloqueada),
tentativa de aprovar sem permissão (bloqueada), aprovação com
comentário, separação → pronta → entrega (com a baixa real
conferida no Estoque depois), conclusão pelo próprio solicitante,
bloqueio de cancelamento após concluída, histórico reproduzindo o
ciclo inteiro, duas reservas concorrentes respeitando o saldo (a
segunda falha quando a primeira já consumiu o disponível), e a
reprovação agora gerando notificação de verdade pro solicitante.

O núcleo que já existia (criar com saldo suficiente, aprovar,
cancelar, expirar, vazamento entre usuários) já tinha teste
próprio em Test_Loja_RotasPublicas.gs/Test_Reserva_Seguranca.gs —
não duplicado aqui.

## 🟢 Concluído

Ciclo completo até a saída física real, disponibilidade sob
demanda, histórico real, aprovação com comentário, reprovação com
motivo e notificação, cancelamento cobrindo os novos estados
intermediários, notificações reais em cada etapa relevante,
concorrência respeitando o saldo real do Estoque.

## 🟡 Pendente (documentado, não escondido)

- Deep link pra abrir a reserva (seção 8/9 do contrato): é
  responsabilidade do Front Mobile montar essa URL — nada foi
  feito no Front nesta rodada (o pacote de módulos 04/05/06 é
  backend). A notificação já carrega reservaId, então o dado pra
  montar o link já está disponível quando o Front for construído.
- "Pré-reserva" como conceito visual distinto: decisão
  documentada acima — não é um estado novo, é o PENDENTE já
  existente.
- QR Code / biometria na retirada: o contrato do Módulo 06
  (Ferramentas) trata isso especificamente; Reservas de material
  (não-ferramenta) não pediram esse requisito na seção 3 deste
  módulo, então não implementei aqui — evita antecipar o Módulo 06.

## 🔴 Bloqueado

Nenhum item bloqueado.

## Riscos encontrados

- entregar() agora é o único ponto que tira saldo físico de uma
  reserva — se alguém pular etapas chamando rotas antigas de
  forma incomum, o sistema bloqueia (entregar() exige status
  PRONTA, que só existe depois de separar()+marcarPronta()),
  então não há caminho de bypass, mas isso significa que
  integrações antigas que talvez esperassem "aprovar = pronto pra
  usar" agora precisam passar pelas 3 etapas novas explicitamente.
  Nenhuma integração existente no sistema fazia essa suposição
  (conferido — só a Loja/Solicitação consomem Estoque diretamente,
  nunca "aprovam uma reserva esperando saída automática"), mas
  fica registrado como mudança de contrato de uso.

---

## Critério de conclusão

Backend existe e protegido ✅ · Service_Reserva não foi recriado,
só ampliado ✅ · Disponibilidade real (sem fórmula paralela) ✅ ·
Aprovação ✅ · Prazo 48h preservado ✅ · Separação ✅ · Retirada ✅ ·
Saída real ✅ · Cancelamento/expiração ✅ · Histórico ✅ ·
Notificações ✅ · Testes ✅.

MÓDULO 05 — CONCLUÍDO (com pendências 🟡 registradas, nenhuma
bloqueante).
