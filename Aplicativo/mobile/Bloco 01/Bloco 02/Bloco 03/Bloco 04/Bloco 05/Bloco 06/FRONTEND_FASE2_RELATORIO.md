# ALMOXA PRO — FRONT MOBILE — FASE 2: LOJINHA
### Relatório de entrega

---

## 1) O que foi construído

Fluxo completo: **Loja → Categorias → Catálogo (com busca) →
Carrinho**, tudo com dado real do backend, carrinho persistente
entre navegações, e um placeholder honesto pra Identificação
(Fase 3, ainda não construída).

## 2) Descoberta importante: 2 lacunas reais no backend

Ao implementar a lojinha, encontrei duas coisas que a especificação
do front **exige** mas que as 13 fases do backend não tinham
previsto (backend foi especificado antes do front). Resolvi as
duas com extensões pequenas e isoladas, documentadas:

**a) Categoria de produto não existia.** `PRODUTOS` não tinha
campo `categoria`. Adicionei (`DB_Mapping.gs` + `Service_Produto.gs`)
com fallback `'SEM CATEGORIA'` pra produtos antigos — não quebra
nada que já existia.

**b) Toda rota exigia sessão, menos `auth.login`.** A spec do
front é explícita: "a pessoa não deve ser obrigada a entrar no
sistema completo simplesmente para solicitar um material" — a
loja precisa ser navegável **sem login**. O `Core_Router` só tinha
uma exceção hardcoded (`auth.login`). Generalizei isso:
`Core_Registry.registerPublicRoute(action)` — qualquer módulo pode
declarar suas próprias rotas como públicas, no seu próprio `init()`
(nunca é o Front que decide isso, continua sendo regra do backend).

## 3) Novo módulo de backend: `Service_Loja.gs`

Isolado de propósito — expõe só o que a vitrine pública precisa,
nunca as rotas internas de Estoque/Produto na íntegra:

- `loja.config` — banner, título, subtítulo (administrável via `config.update`, que já existia desde a Fase 12)
- `loja.categorias` — categorias reais, agregadas do cadastro
- `loja.catalogo` — produtos + saldo disponível **agregado** (nunca expõe reservado/bloqueado/localização física)

Todas as três são rotas públicas. Nenhuma outra rota do sistema
foi tornada pública — o resto continua exigindo sessão normalmente
(testei isso explicitamente, ver seção 5).

## 4) Arquivos do Front criados

```
FRONTEND/
  Screen_Store.html                    — Tela 01 (banner + CTA)
  Screen_Categories.html                — Tela 02 (grid de categorias reais)
  Screen_Catalog.html                   — Tela 03 (busca + lista de produtos)
  Screen_Cart.html                      — Tela 04 (carrinho)
  Screen_IdentificationPlaceholder.html — placeholder honesto da Fase 3

  Components/
    ProductCard.html                     — card com stepper [-] qtd [+] e adicionar

  JS/
    Cart.html                            — estado do carrinho (sessionStorage)
    Store.html                           — camada de dados da loja (wrapper sobre API.call)
```

**9 arquivos novos.** `Front_Styles.html` ganhou os estilos da
lojinha (hero, grid de categoria, product card, stepper, carrinho)
— tudo centralizado, nenhum componente novo tem CSS próprio.
`JS/App.html` foi atualizado só pra registrar as novas rotas.

## 5) Testes realizados

Backend (`Test_Loja_RotasPublicas.gs`, incluso):
- `loja.config`/`loja.categorias`/`loja.catalogo` respondem **sem sessionId** ✅
- Categoria aparece só se existir produto cadastrado com ela (testei criando "EPI" de verdade) ✅
- Rota comum (`estoque.get`) **continua bloqueada** sem sessão — a mudança no Router não abriu brecha nenhuma ✅

Front (manual, seção 82 da spec — preciso que você confirme no navegador):
- Entrada → categorias → catálogo → busca → adicionar → carrinho → quantidade → remover → continuar
- Carrinho vazio não deixa continuar (mostra EmptyState com botão "Voltar pra loja")
- Voltar da tela de carrinho pra loja e voltar de novo pro carrinho: item continua lá (sessionStorage)

## 6) O que ficou honestamente pendente

- **Regra de restrição de EPI** (seção 11 da spec): depende de um
  módulo de Fichas/EPI que não existe nas 13 fases do backend.
  Documentei isso no código — quando esse módulo existir, o
  catálogo já está pronto pra receber o campo de bloqueio sem
  precisar mudar estrutura.
- **Imagem de produto**: hoje é um ícone placeholder (📦) — não
  existe campo de imagem em `PRODUTOS` ainda.
- **Subcategorias** (seção 9 do documento mais recente): não
  implementei — o backend não tem esse conceito nem em 1 nível
  completo ainda (categoria simples), então dois níveis seria
  inventar estrutura que não existe. Fica documentado como
  possível refinamento futuro.
- **Paginação/lazy loading real** (seção 68): a busca já é
  server-side (não carrega catálogo inteiro), mas não implementei
  paginação por página ainda — pra catálogos pequenos/médios não é
  gargalo; vale revisitar se o catálogo crescer muito.

## 7) Como a Fase 3 vai conectar

`/identificacao` já existe como rota registrada — a Fase 3 só
precisa trocar `Screen_IdentificationPlaceholder` por um
`Screen_Identification` de verdade (JÁ TENHO CADASTRO / SOU NOVO
AQUI → Login/Cadastro/Foto/Biometria). O carrinho já sobrevive a
qualquer navegação, então nada precisa mudar na Fase 2 pra isso
funcionar.

---

## PARANDO AQUI — aguardando validação antes da Fase 3
## (Identificação: Login, Cadastro, Foto, Biometria).
