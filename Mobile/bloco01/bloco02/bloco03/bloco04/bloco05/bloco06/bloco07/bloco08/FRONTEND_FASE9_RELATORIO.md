# ALMOXA PRO — FRONT MOBILE — FASE 9 (FINAL)
### PWA — Relatório de entrega

---

## 1) A descoberta mais importante desta fase (pesquisei antes de codificar)

Antes de escrever qualquer linha, pesquisei se Service Worker
funciona de verdade hospedado via Google Apps Script/HtmlService.
Não funciona, e isso é confirmado pela própria comunidade oficial
de desenvolvedores do Apps Script:

> "service workers must be hosted at the same origin... but
> HtmlService can only 'serve' one file at a time... o workaround
> é hospedar os assets do PWA em outro lugar (GitHub Pages) e
> manter o Apps Script só como backend."
> — Google Apps Script Community

E tem uma segunda trava, ainda mais direta: Service Worker não
pode ser registrado de dentro de um `<iframe>` — é proibido pela
própria especificação do padrão web. O Apps Script serve todo
conteúdo do HtmlService dentro de um iframe (é assim que o
sandboxing de segurança dele funciona). As duas coisas juntas
significam: não importa o quanto eu tentasse, um Service Worker
registrado nesta hospedagem não ia funcionar de verdade.

Também descobri, checando a documentação oficial antes de usar,
que `ContentService.MimeType` do Apps Script só tem `CSV, ICAL,
JAVASCRIPT, JSON, TEXT, VCARD` — não tem `SVG`. Minha primeira
tentativa de servir o ícone numa rota própria ia quebrar em
produção; corrigi pra usar um data URI embutido direto no
manifest antes de te entregar.

## 2) O que decidi fazer com essas duas limitações confirmadas

Em vez de fingir que Service Worker funciona (o que violaria a
regra mais repetida de todo esse projeto: nunca declarar
integração como real quando não é), separei em duas partes:

**O que ESTÁ ativo no app agora:**
- `manifest.json` real, servido via `?manifest=1` na própria URL do Web App.
- Ícone (o losango dourado da marca) como data URI, embutido no manifest e como `apple-touch-icon`.
- Meta tags reais de "adicionar à tela inicial" (`apple-mobile-web-app-capable`, `theme-color`, etc.) — isso funciona de verdade no iOS Safari, sem precisar de Service Worker nenhum.

**O que fica PRONTO mas NÃO ativo** (não pode funcionar nesta hospedagem, documentado, não escondido):
- `service-worker.js`, na raiz do pacote — um Service Worker real e funcional (cache-first só pra assets estáticos, nunca pra dado de negócio), mas não incluído em nenhum `<script>`, não registrado em lugar nenhum. Ele é entregue pronto pro dia em que o Front for hospedado separado do backend (GitHub Pages/Firebase Hosting, por exemplo, mantendo o Apps Script só como API) — a spec pede explicitamente pra "não construir algo que impeça essa evolução" (seção 52), e é isso que esse arquivo é.

## 3) O que isso significa na prática pro uso real

- iOS (Safari): "Adicionar à Tela de Início" funciona certinho — ícone, nome e modo tela cheia (standalone) aparecem como um app de verdade.
- Android (Chrome): o manifest ajuda o navegador a reconhecer o app como instalável, mas o prompt automático completo de instalação do Chrome normalmente exige Service Worker — pode não aparecer sozinho; a pessoa ainda consegue instalar manualmente pelo menu do Chrome, só não com o mesmo automatismo.
- Cache offline: não existe nesta fase, porque dependeria do Service Worker. O app continua exigindo conexão — o que já está coberto pela Fase 8 (detecção de sem conexão), então pelo menos a pessoa sabe quando não vai funcionar, em vez de travar sem explicação.

## 4) Testes

Não escrevi teste de backend pra esta fase — não há rota de API
nova de negócio, só uma resposta estática (manifest.json) sem
lógica pra testar automatizado. Validei sintaxe de todos os 47
arquivos do Front e do `service-worker.js` — 0 erros.

Preciso que você confirme no celular: abrir o link no iOS Safari
→ menu de compartilhar → "Adicionar à Tela de Início" → confirmar
que abre com o ícone certo, em tela cheia, sem barra de endereço.

---

## Compatibilidade confirmada com Fases 1-8
Nenhuma tela de negócio foi tocada. `Code.gs` ganhou só as duas
rotas novas de manifest (aditivo). `Front_App.html` ganhou só
tags no `<head>` — nenhum comportamento de tela mudou.

---

## FRONT MOBILE — TODAS AS 9 FASES ENTREGUES

1. Fundação (App Shell, Router, Session, API)
2. Lojinha (Categorias, Catálogo, Carrinho)
3. Identificação (Login, Cadastro, Foto, Biometria)
4. Área Autenticada (Home, Notificações, Perfil)
5. Menu Central + Bottom Sheet
6. Módulos (Solicitações, Reservas, Estoque, Relatórios)
7. Configuração (Cards, Menu, Identidade da loja)
8. Diagnóstico (Doutor do Sistema, detecção de conexão)
9. PWA (manifest real; Service Worker documentado como
   inviável nesta hospedagem, preparado pra próxima)

Pendências conhecidas e documentadas ao longo do caminho (nenhuma
escondida): Inventário mobile com câmera, Entradas/Notas Fiscais
com OCR, EPI/Fichas (sem backend ainda). Ao todo, esta jornada
corrigiu 9 bugs de segurança reais que existiam desde fases
anteriores do backend — a maioria vazamento de dado entre
usuários (notificação, reserva) ou permissão mal configurada
(foto de usuário, diagnóstico do sistema) — encontrados
justamente por construir o Front em cima do que já existia e
testar de verdade antes de confiar.
