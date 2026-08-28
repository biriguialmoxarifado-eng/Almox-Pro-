# ALMOXA PRO — FRONT MOBILE — FASE 7
### Configuração — Relatório de entrega

---

## 1) O que virou configurável de verdade

| Antes (Fase 1-6) | Agora (Fase 7) |
|---|---|
| Cards da Home fixos no código de `Screen_Home.html` | `HOME_CARDS_CONFIG` (backend) — ADMIN edita ícone, título, ordem, visibilidade |
| Módulos do Menu fixos no código de `MenuSheet.html` | `MENU_MODULES_CONFIG` (backend) — mesma edição |
| Banner/título/subtítulo da loja só editável chamando `config.update` direto no Apps Script | Tela "Identidade da Loja", dentro do app |

**Nenhuma instalação existente muda de aparência sozinha**: os
valores padrão em `Core_Config.gs` reproduzem exatamente o que já
estava fixo no código das fases anteriores. Só muda quando o
admin mexer de propósito.

## 2) O que o admin NÃO pode fazer (limite deliberado)

Não dá pra criar um card ou módulo **novo** com destino
inventado — o editor só deixa mudar **ícone, texto, ordem e
visibilidade** de itens que já existem (`id` fixo, com lógica de
dado real por trás quando aplicável). Mudar a **rota de destino**
ou o **perfil autorizado** exigiria validar contra uma lista de
telas reais (pra não deixar o admin criar um link quebrado) — não
implementei essa camada de validação ainda, documentado aqui em
vez de fingir que dá pra apontar pra qualquer lugar com segurança.

## 3) Reaproveitamento sem duplicar

`Components/ConfigListEditor.html` — um editor genérico de lista
reordenável (usado por Cards da Home e Módulos do Menu, que
precisam exatamente da mesma mecânica de ↑↓/mostrar-ocultar).
`Screen_ConfigHomeCards.html` e `Screen_ConfigMenu.html` são
arquivos finos que só passam os parâmetros certos pro editor —
zero lógica de UI duplicada.

## 4) Onde "Configurações" mora agora

Adicionei no Perfil (seção 59/60 do doc de telas — é o lugar
certo), visível só pra ADMIN. `MenuSheet` também tem a entrada
(já usando o novo sistema de config, restrita a ADMIN no próprio
`MENU_MODULES_CONFIG` padrão).

## 5) Segurança

`config.update` já exigia ADMIN desde a Fase 12 do backend (só
ADMIN tem `'*':true` na matriz de RBAC — conferido antes de
começar essa fase). Testei explicitamente que OPERADOR não
consegue editar configuração nenhuma, incluindo tentando
diretamente via `Core_API.call` (não só escondido na tela).

## 6) Testes

`Test_Config_Fase7.gs`: confirma que OPERADOR não edita config
(`PERMISSION_DENIED`), que ADMIN edita e a mudança realmente
aparece na rota pública da loja sem precisar de sessão, e que
editar `HOME_CARDS_CONFIG` (ocultando o card do carrinho) grava
e reflete de verdade.

Validei sintaxe de todos os 45 arquivos do Front — 0 erros.

---

## Compatibilidade confirmada com Fases 1-6
`Screen_Home.html` e `Components/MenuSheet.html` foram reescritos
por dentro, mas o comportamento observável continua idêntico ao
da Fase 6 quando a config não foi editada (fallback pros mesmos
valores fixos de antes). Nenhuma outra tela foi tocada.

## Próximas fases
Fase 8 (Diagnóstico): padronizar estados de tela, detecção de
sem-conexão, ligar visualmente no Doutor do Sistema.
Fase 9 (PWA): manifest, service worker, instalação — só depois
de tudo validado, como a própria spec pede.

---

## PARANDO AQUI — aguardando validação antes da Fase 8.
