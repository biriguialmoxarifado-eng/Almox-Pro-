# ALMOXA PRO — FRONT MOBILE — FASE 5
### Menu Central + Bottom Sheet + Submenus — Relatório de entrega

---

## 1) Contradição real encontrada na spec — e a decisão tomada

A especificação mais recente (seção 63, "Barra Inferior") desenha
um layout de 4 ícones:

```
🏠 Início   📋 Solicitações   ☰ MENU   👤 Perfil
```

Isso contradiz **a própria regra obrigatória** da mesma
especificação, repetida em 4 seções diferentes (18, 20, 62, 73):
> "❌ pessoa no topo + pessoa embaixo" — nunca duplicar avatar.

O avatar já vive no Header desde a Fase 1 (seção 20/22: "a foto
do usuário fica no Header" — "NÃO colocar outro ícone de pessoa
embaixo"). Colocar "👤 Perfil" na barra de novo duplicaria.

Além disso, **"Solicitações" ainda não existe como módulo** (é
Fase 6) — um ícone que leva pra rota inexistente violaria a regra
de não inventar tela (seção 89: "se uma informação não estiver
definida, não inventar").

**Decisão**: segui a regra textual (mais forte, repetida e
chamada de "obrigatória") em vez do diagrama ilustrativo — a
própria spec permite essa flexibilidade logo depois do desenho
("a quantidade de itens pode ser adaptada"). Barra final:
**🏠 Início · 🛍️ Loja · ☰ MENU** (central, destacado).

## 2) Arquivos novos

```
Components/BottomBar.html   — barra inferior (3 itens, mostra/esconde por sessão)
Components/MenuSheet.html    — Bottom Sheet: Módulo → Submenu → Tela
```

**Por que `MenuSheet.html` cobre módulo E submenu no mesmo
arquivo** (a spec lista `MenuSheet` e `SubMenu` como componentes
separados): as duas telas do sheet compartilham o mesmo overlay,
a mesma função de renderizar item de lista, e a mesma lógica de
abrir/fechar. Separar em dois arquivos exigiria duplicar essa
função ou criar acoplamento cruzado entre os dois arquivos — a
própria spec proíbe duplicação de componente (seção 19/86). Fica
documentado no cabeçalho do arquivo, mesmo raciocínio já usado na
Fase 1 pro Router.

## 3) Como o Menu foi montado — dinâmico de verdade, não fingido

```js
MODULES = [
  { id: 'loja', submenu: [Categorias, Meu carrinho] },
  { id: 'diagnostico', route: '/diagnostico', profiles: ['ADMIN'] }
]
```

Filtro real: `_modulosPermitidos()` compara `Session.identity.profileId`
contra `profiles` de cada item — quem não é ADMIN nunca vê
"Diagnóstico do Sistema" no menu (nem desabilitado — some de
verdade, como a seção 27 exige: "sem permissão → não exibir").

**Por que a lista é curta**: os módulos operacionais de verdade
(Estoque, Solicitações, Inventário, Entradas, Saídas...) são a
Fase 6, ainda não construídos. Colocar eles aqui agora seria
inventar tela. A arquitetura (Menu → Submenu → Tela, com filtro
de perfil) já está pronta — cada módulo da Fase 6 só precisa
virar mais uma entrada no array `MODULES`, nada mais muda.

## 4) Peça pequena, mas nova: `Router.onAfterRender`

A barra inferior precisa saber quando trocar de tela pra destacar
o ícone certo e decidir se aparece (só quando autenticado). Em
vez de cada tela nova ter que lembrar de "avisar a barra", criei
um hook genérico no Router: `Router.onAfterRender(fn)`. O Router
não sabe o que é `BottomBar` — só avisa "troquei de rota" pra quem
quiser escutar. Aditivo, não muda nenhum comportamento antigo.

## 5) Ajuste de sobreposição visual encontrado e corrigido

O botão flutuante do carrinho (Fase 2, tela de catálogo) ficava
fixo a 20px do fundo da tela. Com a barra inferior nova (68px de
altura) aparecendo pra quem está logado, os dois iam se sobrepor
pra um usuário autenticado navegando o catálogo. Corrigido com uma
regra CSS que sobe o botão do carrinho quando a barra está
visível (`#app-content.has-bottombar .cart-fab`).

## 6) O que ficou de fora — de propósito

Estoque, Solicitações, Inventário, Entradas, Notas Fiscais,
Saídas, Rastreabilidade, EPI/Fichas, Aprovações, Reservas,
Relatórios, Usuários, Configurações, Auditoria — **nenhum módulo
de negócio foi inventado no menu**. A Fase 6 vai preencher isso,
um módulo real de cada vez.

## 7) Testes

Validei sintaxe de **todos os 34 arquivos do Front** (script Node
local) — 0 erros. Não há mudança de backend nesta fase (Menu é
100% Front, consumindo só `Session.identity.profileId` que já
existe desde a Fase 3).

**Preciso que você confirme no navegador**: barra aparece só
quando logado, ícone ativo destaca certo, Menu sobe suavemente,
toque fora fecha, submenu de Loja volta certinho, e o item
Diagnóstico só aparece logado como `admin`.

---

## Compatibilidade confirmada com Fases 1-4
Nenhuma tela existente foi alterada. `Router.html` ganhou só uma
função nova (`onAfterRender`), sem tocar no que já funcionava.
`Front_Styles.html` só recebeu CSS novo, nada removido.

## Ponto de entrada da próxima fase
A Fase 6 (módulos operacionais) só precisa acrescentar itens ao
array `MODULES` em `MenuSheet.html` e registrar as rotas novas em
`App.js` — a arquitetura de navegação já aguenta.

---

## PARANDO AQUI — aguardando validação antes da Fase 6.
