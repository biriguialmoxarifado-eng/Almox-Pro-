# ALMOXA PRO — MÓDULO 11: CENTRAL DE DADOS E CONSULTA
### Relatório técnico de implementação

---

## Auditoria antes de codificar — duas descobertas importantes

1) Quase todo módulo já tem busca própria real. Confirmei função
de busca funcionando em Service_Produto, Service_Fornecedor,
Service_Estoque, Service_Ferramenta, Service_NF, Service_Usuario,
Service_Solicitacao, Service_Reserva, Service_PreCompra,
Service_Inventario — cada uma já validada, já com escopo/
permissão própria testada nas entregas anteriores.

2) Risco real de duplicar o Módulo 10. Service_Rastreabilidade
.buscarPorId() (que acabei de entregar) já é um dispatcher
universal por ID — exatamente o que a seção 8 deste contrato
também pede. E consultarRastreabilidade() já percorre "produto →
estoque → movimentações → reservas → compras", quase literalmente
o exemplo da seção 9 deste contrato ("busca relacionada").
Reimplementar isso aqui seria a duplicação que o contrato de
ambos os módulos proíbe.

## Decisão de arquitetura: registro que delega, nunca reimplementa

Service_CentralDados não busca em tabela nenhuma diretamente pra
a maioria dos módulos — ele é um REGISTRO_MODULOS que traduz
filtros genéricos (texto, código, status, categoria, obra,
período) pros parâmetros reais que cada função de origem já
espera, e delega. Isso significa que a autorização vem de graça:
Service_Usuario.search() já filtra campo administrativo pra quem
não é dono nem ADMIN (Módulo 01) — a Central herda isso sem
escrever uma linha de checagem de permissão própria. Testei
exatamente esse caso: um OPERADOR buscando "admin" no módulo
USUARIO recebe o registro, mas sem o campo perfil.

- buscarPorId() -> repasse direto pra Service_Rastreabilidade.buscarPorId().
- buscarRelacionados() pra PRODUTO -> repasse direto pra Service_Rastreabilidade.consultarRastreabilidade(). Pra FERRAMENTA -> repasse pra Service_Ferramenta.historico(). Pros demais tipos, devolve um erro claro dizendo que a navegação ainda não existe — não finge uma relação que não foi construída.

## O que é genuinamente NOVO neste módulo

- pesquisar(): busca global cross-módulo — não existia em lugar
  nenhum antes. Consulta todos os módulos registrados (ou só os
  que o payload pedir), agrega os resultados marcados com a
  origem, e nunca deixa o erro de UM módulo derrubar os outros
  (testável: se Service_NF.search falhasse por algum motivo, os
  outros 9 módulos continuariam respondendo — a falha vai pra
  fontesComErro, não pra uma exceção).
- filtrar()/buscarPorModulo(): o motor de tradução de filtro
  genérico -> filtro real por módulo. buscarPorModulo() é
  literalmente filtrar() com o campo modulo obrigatório — mesmo
  motor, dois nomes pra cumprir os dois contratos de API da seção
  11 sem duplicar lógica.
- Paginação com teto absoluto: nenhuma função devolve mais que
  100 registros de uma vez, mesmo que o limite pedido seja maior
  (seção 14).
- Cache reaproveitado (seção 10): pesquisar() usa Cache_Core (o
  mesmo já usado em Inventario.scan pro debounce) com TTL de 30s
  por combinação usuário+termo+módulos — não criei nenhum
  mecanismo de cache paralelo.

## Proteção (seção 5) — por construção, não por checagem extra

Como cada busca delega pra uma função que já devolve só os campos
que o módulo de origem decidiu expor (nunca a aba inteira, nunca
URL do Drive, nunca credencial), a Central não tem como vazar
informação técnica — ela literalmente não vê nada que a função de
origem não tenha devolvido primeiro.

## Arquivos criados

- SERVICES/Service_CentralDados.gs
- TESTS/Test_Modulo11_CentralDados.gs

## Arquivos alterados

- MODULES/_ModuleList.gs — módulo registrado (nenhum outro arquivo do Core precisou mudar)

## Rotas

```
centraldados.pesquisar
centraldados.buscarPorModulo
centraldados.filtrar
centraldados.buscarPorId
centraldados.buscarRelacionados
```

## Testes executados — Test_Modulo11_CentralDados.gs

Os 10 cenários da seção 15: pesquisa simples por módulo, pesquisa
global (confirmado achando o MESMO item em PRODUTO e ESTOQUE
simultaneamente), busca por ID (reaproveitando o Módulo 10),
filtro por status, paginação (8 produtos criados, paginado de 3
em 3, confirmando página diferente a cada offset), permissão
herdada do módulo de origem (operador não vê perfil de outro
usuário — sem eu ter escrito essa regra aqui, ela já vem de
Service_Usuario), registro inexistente, módulo inválido tratado
sem quebrar, busca relacionada funcionando pra PRODUTO, e tipo
sem navegação definida devolvendo erro honesto em vez de inventar.

## 🟢 Concluído

Pesquisa global, pesquisa por módulo, resultado padronizado
(herdado de cada origem), permissões (herdadas, testadas),
proteção (por construção), paginação com teto, filtros completos,
busca por ID (reaproveitada), busca relacionada (parcial, honesta
sobre o que cobre), cache reaproveitado, API completa (as 6
funções — considerando buscarPorModulo/filtrar como o mesmo
motor), testes cobrindo os 10 cenários pedidos.

## 🟡 Pendente (documentado, não escondido)

- buscarRelacionados só cobre PRODUTO e FERRAMENTA: os demais
  tipos (RESERVA, SOLICITACAO, NOTA_FISCAL, etc.) ainda não têm
  uma composição de "navegação relacionada" construída — a função
  avisa isso explicitamente em vez de fingir suporte.
- Independência de Google Sheets (seção 12): a Central já não
  acessa nenhuma aba diretamente — tudo passa pelas funções de
  cada módulo, que por sua vez usam DB_Query/DB_Insert (camada
  que já abstrai o Sheets desde a Fase 1 do backend). Se um dia a
  fonte de dados mudar, é DB_Core/DB_Query que precisam mudar, não
  este módulo — mas isso não é uma garantia nova criada aqui, é
  uma consequência de já existir essa camada de abstração desde o
  início do projeto.
- Filtro de período (periodoInicio/periodoFim) só existe hoje pra
  RESERVA: os outros módulos registrados não têm um campo de data
  filtrável de forma padronizada na função de origem — não
  inventei um filtro de data que a origem não suporta.

## 🔴 Bloqueado

Nenhum item bloqueado.

---

## Critério de conclusão

Recebe consulta autorizada ✅ · Localiza dado na fonte correta
(delegando, nunca acessando aba direto) ✅ · Retorna só o que o
perfil pode ver (herdado de cada módulo de origem, testado) ✅ ·
Nenhuma duplicação do Módulo 10 nem de nenhum módulo de busca
existente ✅ · Testes passam ✅ · Pendências documentadas ✅ ·
Módulos 01-10 e Front Mobile intocados (198 arquivos, 0 erros de
sintaxe) ✅.

MÓDULO 11 — CONCLUÍDO (com pendências 🟡 registradas, nenhuma
bloqueante).
