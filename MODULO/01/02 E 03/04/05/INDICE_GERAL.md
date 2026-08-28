# ALMOXA PRO — PACOTE COMPLETO
### Backend (13 fases) + Front Mobile (9 fases) — tudo num arquivo só

---

## Como usar este ZIP

1. Leia `LEIA-ME.md` primeiro — é o guia de instalação completo,
   na ordem certa, com todas as atualizações de cada fase.
2. Os relatórios técnicos de cada fase do Front estão na raiz:
   `FRONTEND_FASE1_RELATORIO.md` até `FRONTEND_FASE9_RELATORIO.md`
   (mais `FRONTEND_FASE2_REVISAO.md`, uma correção intermediária).
3. `FASE13_INTEGRACAO_FINAL.md` documenta o backend completo.
4. `DOCUMENTACAO/` guarda o Mapa Mestre de Módulos — referência
   pros próximos módulos de negócio (Estoque avançado, Compras,
   Ferramentas, EPI, Mestre de Obra, Ocorrências, Rastreabilidade,
   etc.) que ainda serão implementados como fases futuras.

---

## O que está dentro

### Backend (Google Apps Script) — pastas por camada
```
CORE, AUTH, DATABASE, CACHE, EVENTS, AUDIT, DIAGNOSTICS, BACKUP,
API, SERVICES, MODULES, INTEGRATIONS, UTILS, TESTS, MAINTENANCE
+ Code.gs, Setup.gs, Gatilhos.gs (raiz)
```
176 arquivos `.gs`. Cobre: autenticação, permissões (RBAC), banco
de dados (abas do Sheets), cache, eventos, auditoria, backup, API
central, Doutor do Sistema, e os módulos de negócio: Cadastros,
Nota Fiscal, Conferência, Estoque, Reservas, Saídas, Inventário,
Projetos/Obras/Atividades/Equipe, Ocorrências, Notificações,
Relatórios, SAP/Importação/Exportação, Biometria, Etiquetas, IA
(estatística), Configurações, Loja (autocadastro + rotas
públicas), Solicitações, e a Identidade Central.

### Front Mobile (Google Apps Script HtmlService) — pasta `FRONTEND/`
```
FRONTEND/
  Front_App.html, Front_Styles.html, Header.html
  Screen_*.html          (23 telas)
  Components/            (11 componentes reutilizáveis)
  JS/                     (App, Router, Session, API, Cart, Store, Connectivity)
```
47 arquivos. As 9 fases, em ordem:

| Fase | Nome | O que entrega |
|---|---|---|
| 1 | Fundação | App Shell, Header, Router, Session, API, 8 componentes base |
| 2 | Lojinha | Categorias, Catálogo, Carrinho — dado 100% real, sem invenção |
| 3 | Identificação | Login, Autocadastro, Foto (câmera real), Biometria (WebAuthn), Identidade Central |
| 4 | Área Autenticada | Home, Central de Notificações, Perfil |
| 5 | Menu Central | Barra inferior + Bottom Sheet com submenu |
| 6 | Módulos | Solicitações (fluxo completo com baixa de estoque), Reservas, Consulta de Estoque, Relatórios |
| 7 | Configuração | Cards da Home e Módulos do Menu editáveis pelo ADMIN |
| 8 | Diagnóstico | Doutor do Sistema conectado de verdade, detecção de sem conexão |
| 9 | PWA | Manifest real, "adicionar à tela inicial"; Service Worker documentado como inviável nesta hospedagem |

`service-worker.js` (raiz do pacote) — preparado pra uma
hospedagem futura fora do Apps Script; não cole isso no Apps
Script, não serve pra nada lá (motivo explicado em
`FRONTEND_FASE9_RELATORIO.md`).

---

## Bugs de segurança reais corrigidos ao longo da jornada

Nenhum foi pedido explicitamente — todos foram encontrados
checando se cada rota do backend aguentaria uso real pelo mobile,
antes de construir a tela em cima:

1. Rotas `usuario.*` nunca estavam ligadas a nenhum módulo (Fase 3)
2. `notificacao.list`/`read` vazavam e permitiam mexer em notificação de outro usuário (Fase 4)
3. `reserva.get`/`calendar` vazavam reserva de todo mundo; `reserva.cancel` bloqueava até o próprio dono (Fase 6)
4. Rotas `doctor.*` nunca tinham permissão registrada — qualquer perfil via diagnóstico completo do sistema (Fase 8)

Cada um tem teste dedicado em `/TESTS`, citado no relatório da
fase correspondente.

---

## Pendências conhecidas (documentadas, não escondidas)

- Inventário mobile com câmera/bipagem
- Entradas/Notas Fiscais com OCR
- EPI/Fichas (sem backend ainda — ver Mapa Mestre de Módulos)
- Ferramentas, Obras/Mestre de Obra, Ocorrências, Rastreabilidade
  completa, Compras/Pré-Compra, IA/Agente — todos mapeados no
  documento de `DOCUMENTACAO/`, prontos pra virar prompt de
  implementação quando chegar a vez.
