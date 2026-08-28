# ALMOXA PRO — FRONT MOBILE — FASE 4
### Área Autenticada: Home, Notificações, Perfil — Relatório de entrega

---

## 1) Dois bugs de segurança reais encontrados e corrigidos

Achei os dois checando se `notificacao.*` (Fase 8 do backend)
aguentaria uso real pelo mobile antes de construir a Central de
Notificações em cima:

1. **`notificacao.list` vazava notificação de outro usuário.** O
   Service confiava em `payload.destinatario` — qualquer pessoa
   logada podia passar o `userId` de outra e ler as notificações
   dela. Corrigido: só ADMIN pode consultar notificação de
   terceiros; todo mundo mais só vê a própria (`ctx.userId`,
   vindo da sessão validada, nunca do payload).
2. **`notificacao.read` não conferia dono.** Dava pra marcar como
   lida a notificação de **qualquer usuário**, só adivinhando o
   ID. Corrigido com checagem de propriedade real.
3. **Bônus, não-segurança**: a permissão de `notificacao.read`
   exigia `EDIT`, que o perfil `OPERADOR` (padrão de quem se
   cadastra pela loja) não tem — a Central de Notificações
   simplesmente não funcionaria pra ninguém que se cadastrou pela
   loja. Corrigida pra `VIEW` (a segurança de verdade agora está
   no ownership check acima, não na permissão de papel — mesmo
   padrão que já tínhamos usado em `usuario.salvarFoto`).

Teste dedicado: `Test_Notificacao_Seguranca.gs` — dois usuários
de teste, um tenta ler/marcar notificação do outro (deve falhar),
cada um lê a própria (deve funcionar).

## 2) Telas novas

| Tela | O que faz |
|---|---|
| `Screen_Home.html` | Substitui o placeholder da Fase 3. Cards **reais**: notificações não lidas (contagem de verdade), carrinho (só aparece se tiver item), meu perfil, e um card extra só pra quem não é OPERADOR |
| `Screen_Notifications.html` | Lista real, toca pra marcar como lida, atualiza o contador do sino |
| `Screen_Profile.html` | Dados, foto (reaproveita a câmera da Fase 3), biometria (ativar/desativar de verdade), sair (com confirmação) |

## 3) Sobre os "Cards configuráveis" — por que não construí isso agora

A spec pede cards que o administrador configura por perfil
(seção 23/30 do doc de telas). **Isso é literalmente a Fase 7**
("Configuração: perfil, cards, menus, identidade, permissões
visuais") — construir agora seria adiantar módulo futuro, o que
toda fase até aqui evitou de propósito.

O que fiz em vez disso: os cards desta fase são fixos no código,
mas **genuinamente diferentes por perfil** (a spec exige isso na
seção 22 — Home não pode ser igual pra todo mundo) e **só mostram
dado real**: notificação de verdade, carrinho de verdade, nunca
um número inventado tipo "12 solicitações pendentes" (não existe
módulo de Solicitações ainda).

## 4) Reaproveitamento sem duplicar código

`Screen_RegisterPhoto` e `Screen_RegisterBiometric` (Fase 3)
ganharam um `returnRoute` opcional — por padrão continuam levando
pra próxima etapa do cadastro, mas o Perfil pode setar
`returnRoute = '/perfil'` antes de navegar até elas, e ao
terminar (ou pular) elas voltam pra onde vieram. **Nenhum código
de câmera ou de WebAuthn foi copiado** — é a mesma implementação
da Fase 3, só reaproveitada (regra explícita contra duplicação,
seção 19/86 do doc de telas).

## 5) Header — agora clicável de verdade

Sino → `/notificacoes`. Avatar → `/perfil`. Se a pessoa não
estiver logada, os dois levam pra `/identificacao` em vez de
travar sem feedback. Continuam existindo **só no Header** — nunca
duplicados em barra inferior nenhuma (a Fase 5 vai criar o menu
central, mas sino e avatar são território exclusivo do Header,
regra que vem desde a Fase 1).

## 6) Testes

- `Test_Notificacao_Seguranca_fluxoCompleto`: os 2 bugs de segurança, confirmados corrigidos.
- Validei sintaxe de **todos os 32 arquivos do Front** — 0 erros.
- **Preciso que você confirme no navegador**: Home carregando cards certos por perfil, sino atualizando contador ao marcar notificação como lida, foto/biometria funcionando quando acessadas pelo Perfil (não só pelo cadastro).

---

## Compatibilidade confirmada com Fases 1-3
Nenhuma lógica de `Front_App.html`, `Router.html`, `API.html`,
`Store.html`, `Cart.html` foi alterada. `Session.html` não mudou
nesta fase. `Header.html` mudou só os dois `addEventListener`
(sino/avatar) — a estrutura visual é a mesma desde a Fase 1.

## Ponto de entrada da próxima fase
A Fase 5 (Menu Central + Bottom Sheet + Submenus) só precisa
adicionar a barra inferior ao `Front_App.html` — nenhuma tela
desta fase precisa mudar pra isso.

---

## PARANDO AQUI — aguardando validação antes da Fase 5.
