# ALMOXA PRO — INTEGRAÇÃO 01: CORE ↔ API ↔ MÓDULOS 01–17
### Relatório de integração estrutural

---

## Natureza deste trabalho

Diferente de um módulo novo, esta tarefa pediu pra auditar e
testar o mecanismo que já une Core, API e os 17 módulos — não
para reconstruir nada disso. A arquitetura de comunicação já
existia inteira desde a Fase 1 (Core_API → Core_Router →
Core_Registry → módulo). O trabalho real foi: auditar essa cadeia
com rigor, achar os pontos onde o contrato dizia uma coisa e o
código fazia outra, e corrigir só esses pontos.

## Arquitetura confirmada (já existia, validada agora)

```
Usuário/Front
    v
Core_API.call(request)          — fachada pública única
    v
Core_Router.dispatch(request)   — ORQUESTRA toda a cadeia:
    v  1. Core_Context.build()      -> identificação da requisição
    v  2. Auth_Session.validate()   -> sessão
    v  3. Core_Registry.getRoute()  -> localizar rota
    v  3a. checar módulo dono       -> NOVO nesta entrega (ver abaixo)
    v  3b. Auth_RBAC.can()          -> permissão
    v  5. route.handler(ctx)        -> executa o módulo
    v  5b. validar formato da resposta -> NOVO nesta entrega
    v  6. Audit_Service.record()    -> auditoria
    v  7. Utils_Log.record()        -> observabilidade
    v  8. Core_Response padronizado -> retorno único
```

Cada um dos 25 módulos (17 de negócio/arquitetura + Core/Auth/
Database/etc.) já declara identificação, versão, estado,
dependências via seu descritor (id, version, status, dependencies,
getRoutes, getServices, getEvents, healthCheck) — confirmado
auditando _ModuleList.gs e uma amostra de descritores.
Doctor_Contracts.describe() (Módulo 17) já sintetiza isso tudo num
retrato só, sem duplicar o dado.

## Dois problemas reais encontrados — e corrigidos

### 1) "Módulo indisponível" nunca era verificado de verdade

Core_Registry.registerModule() absorve as rotas de um módulo
incondicionalmente — nunca checava se o status do módulo era
DISABLED ou ERROR. E pior: quando descriptor.init() falhava
durante o boot, o erro só ficava registrado num relatório local
(Core_ModuleManager._initReport) que nada mais no sistema
consultava — o objeto real do módulo (o mesmo que Core_Registry
guarda) continuava dizendo status: ACTIVE pra sempre. Resultado
prático: um módulo que falhasse ao inicializar continuava com
todas as rotas 100% executáveis.

RESPONSE_CODES.MODULE_DISABLED já existia reservado no enum, nunca
usado em lugar nenhum — a peça estava pronta, faltava a ligação.

Correção: Core_Router.dispatch() agora consulta o módulo dono da
rota (Core_Registry.getModule(route.moduleId)) antes de executar
o handler, e bloqueia com MODULE_DISABLED se o status for
DISABLED/ERROR. Core_ModuleManager.initAll() agora muta o
descriptor real quando init() falha, não só o relatório — testado
ponta a ponta (desativei MOD_07_RESERVAS em tempo de execução,
confirmei bloqueio, restaurei, confirmei que voltou a funcionar).

### 2) "Resposta inválida" nunca era detectada

Se um handler de módulo (por bug futuro, não hoje) retornasse
undefined ou um objeto sem o campo success, o Router devolvia
isso direto pro chamador — quebrando o contrato Core_Response
silenciosamente, sem log, sem aviso.

Correção: Core_Router.dispatch() agora valida o formato da
resposta antes de devolvê-la; se inválida, registra em AUDITORIA
(RESPOSTA_INVALIDA) e devolve um INTERNAL_ERROR explícito em vez
de propagar o dado malformado. Testado com uma rota de teste
temporária (nunca tocando módulo real) que retorna um objeto sem
success — confirmado que vira erro tratado, e que uma resposta
válida continua passando normalmente (não-regressão).

## Contratos confirmados

- Core não tem regra de negócio: auditado — Core_Router,
  Core_Registry, Core_API só orquestram, nunca decidem estoque/
  reserva/aprovação/etc.
- Nenhum módulo acessa implementação interna de outro: todo
  acesso cross-módulo já confirmado nas entregas anteriores como
  sendo via Service_X.funçãoPública(), nunca DB_Query direto na
  tabela de outro domínio sem passar pela função dona.
- Retorno padronizado: Core_Response.ok/error — único formato,
  agora verificado ativamente pelo Router (item 2 acima), não só
  uma convenção que os módulos seguem por disciplina.
- Identificação da requisição: Core_Context.build() já gera
  requestId desde a Fase 1, presente em toda resposta.
- Logs: Utils_Log.record() roda em toda dispatch, sucesso ou erro.
- Controle de permissões: Auth_RBAC.can() roda no Router ANTES do
  handler — nenhum módulo decide sozinho quem pode chamá-lo
  (reforçado pelo próprio Módulo 08, Doctor_Permissions, que
  audita isso continuamente).

## Dependências (confirmadas via Doctor_Contracts.mapaDoSistema())

Grafo de dependências já é real e consultável — por exemplo,
MOD_07_RESERVAS declara depender de MOD_06_ESTOQUE, e o reverso
(quem depende de quem) já é calculável desde o Módulo 17. Nenhuma
dependência circular foi encontrada (Core_ModuleManager
._resolveOrder já detectaria isso e lançaria erro no boot — não
lançou).

## Arquivos alterados

```
CORE/Core_Router.gs         — checagem de módulo disponível + validação de resposta
CORE/Core_ModuleManager.gs  — muta o descriptor real quando init() falha
```

Nenhum arquivo novo de "arquitetura" foi necessário — a
arquitetura já existia; só dois pontos precisos foram corrigidos
no arquivo que já orquestra tudo.

## Arquivo de teste criado

```
TESTS/Test_Integracao01_CoreModulos.gs
```
Também adicionado ao runner mestre (Test_RunTudo, Test_IntegracaoFinal.gs).

## Testes executados — os 7 cenários pedidos, literalmente

1. Módulo registrado — Core_Registry.getModule('MOD_07_RESERVAS') retorna o descritor real.
2. Módulo ativo — rota de um módulo ACTIVE executa normalmente (não bloqueada por MODULE_DISABLED).
3. Módulo indisponível — desativei MOD_07_RESERVAS em tempo real, confirmei bloqueio com MODULE_DISABLED, restaurei, confirmei que voltou a funcionar.
4. Erro de comunicação — rota de teste com handler que lança exceção, confirmado INTERNAL_ERROR tratado (não derruba o processo).
5. Usuário sem permissão — operador comum tentando backup.create, bloqueado com PERMISSION_DENIED.
6. Sessão inválida — sessionId inexistente, bloqueado com SESSION_EXPIRED.
7. Resposta inválida — rota de teste retornando objeto sem success, confirmado detectado e convertido em erro explícito; resposta válida (login normal) confirmada não afetada.

Bônus (adjacente, barato de confirmar): rota inexistente tratada com ROUTE_NOT_FOUND.

## Problemas encontrados (resumo)

| Problema | Gravidade | Status |
|---|---|---|
| Módulo indisponível não bloqueava rota nenhuma | Real, mas nunca explorado (nenhum módulo tinha ficado DISABLED/ERROR em produção até hoje) | Corrigido e testado |
| Falha de init() não refletia no descriptor real | Consequência direta do problema acima | Corrigido e testado |
| Resposta de handler nunca era validada | Nenhuma ocorrência real encontrada (todo módulo já usa Core_Response disciplinadamente) — risco preventivo | Corrigido e testado |

Nenhum dos dois problemas já tinha causado um incidente real (todos
os módulos existentes sempre foram ACTIVE e sempre retornaram
Core_Response corretamente) — mas ambos eram brechas estruturais
reais que ficariam invisíveis até o dia em que um módulo realmente
falhasse ou um handler novo esquecesse o contrato.

## Dependências externas

Nenhuma. Toda a correção foi interna ao Core.

---

## Critério de conclusão

Comunicação Core↔API↔Módulos validada em cadeia ✅ · Contratos
confirmados (identificação/versão/estado/dependências) ✅ · Dois
problemas estruturais reais corrigidos e testados ✅ · Os 7
cenários pedidos testados literalmente ✅ · Nenhum módulo de
negócio alterado (regra explícita respeitada) ✅ · Nenhum HTML
demonstrativo criado ✅ · 206 arquivos, 0 erros de sintaxe ✅.

INTEGRAÇÃO 01 — CONCLUÍDA.
