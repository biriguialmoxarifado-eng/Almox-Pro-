# ALMOXA PRO — MÓDULO 10: RASTREABILIDADE E HISTÓRICO
### Relatório técnico de implementação

---

## Auditoria antes de codificar — a descoberta mais importante

AUDITORIA (tabela) e Audit_Service (Camada 4 do Core) já são, na
prática, o histórico de eventos que este módulo precisa. Todo
módulo desde a Fase 1 chama Audit_Service.record() em toda
operação relevante — e o schema de AUDITORIA já cobre quase tudo
que a seção 1 do contrato pede: ID do registro (entidadeId),
módulo de origem (modulo), tipo de operação (acao), usuário, data,
hora, estado anterior (antes), novo estado (depois), origem,
identificador da operação (correlationId).

Por isso este módulo NÃO tem tabela de evento própria. Criar uma
seria duplicar o Core — proibido explicitamente pelo próprio
contrato ("não duplicar funções do Core"). Service_Rastreabilidade
é uma camada de orquestração, não uma segunda fonte de verdade.

Também encontrei uma duplicação real já existente:
Service_Reserva.historico() e Service_Ferramenta.historico()
reimplementam, cada uma no seu canto, a mesma query (AUDITORIA
filtrada por entidade+entidadeId). Não refatorei essas duas nesta
entrega — funcionam, já são testadas, e mexer nelas sem
necessidade violaria a regra 11 do contrato ("não modificar
módulos existentes sem necessidade"). Documentado como
oportunidade de reaproveitamento futuro.

## O que foi implementado

- registrarEvento: alias fino de Audit_Service.record — existe
  pra cumprir o contrato de API da seção 8, mas é literalmente a
  mesma função por baixo. Documentado, não escondido.
- consultarHistorico: filtros reais (usuário, módulo, ação,
  entidade/registro, obra, status, período) + paginação
  obrigatória (limite/offset, teto de 200 por página — nunca
  devolve tudo de uma vez, seção 10 do contrato). Escopo de
  permissão por dentro: perfil de gestão (ALMOXARIFE/GESTOR/
  ADMIN/AUDITOR) vê qualquer histórico; os demais só veem o
  próprio, e o filtro usuario que vier no payload é ignorado se a
  pessoa não for de perfil amplo — não dá pra pedir o histórico
  de outra pessoa nem tentando.
- consultarRastreabilidade: a trajetória de um produto
  atravessando módulos (Cadastro → Pré-Compra → Movimentos de
  entrada/saída → Estoque atual → Reservas → Solicitações), toda
  unida por produtoId real, nunca por texto (regra explícita da
  seção 2, testada).
- buscarPorId: busca universal — com tipo informado, vai direto
  na tabela certa; sem tipo, tenta em ordem até achar. Nunca
  reimplementa a leitura de outro módulo (delega pro DB_Query.get
  de cada tabela, e reaproveita Service_Usuario._filtrarCampos do
  Módulo 01 pra nunca expor campo sensível de usuário por aqui).
- buscarLinhaDoTempo: versão genérica e centralizada da mesma
  lógica que Reserva/Ferramenta já tinham duplicada.

## Extensões no Core (mínimas, retrocompatíveis)

- AUDITORIA ganhou 2 colunas (obraId, status) — aditivo, linhas
  antigas continuam válidas com esses campos em branco.
- Audit_Service.record() passou a aceitar detalhes.obraId/
  detalhes.status opcionais — quem já chama a função sem esses
  campos continua funcionando idêntico.
- Audit_Service.search() ganhou os filtros que faltavam (entidade,
  entidadeId, obra, status, período) — antes só filtrava por
  usuário/módulo/ação. Retrocompatível.

Essas foram as únicas mudanças em arquivo do Core — exatamente o
mínimo necessário pra este módulo funcionar sem duplicar nada,
consistente com a regra "integrar com módulos existentes... não
quebrar Core".

## Arquivos criados

- SERVICES/Service_Rastreabilidade.gs
- TESTS/Test_Modulo10_Rastreabilidade.gs

## Arquivos alterados

- AUDIT/Audit_Service.gs — record()/search() ampliados (aditivo)
- DATABASE/DB_Mapping.gs — AUDITORIA ganhou 2 colunas (aditivo)
- MODULES/_ModuleList.gs — módulo registrado

## Rotas

```
rastreabilidade.registrarEvento
rastreabilidade.consultarHistorico
rastreabilidade.consultarRastreabilidade
rastreabilidade.buscarPorId
rastreabilidade.buscarLinhaDoTempo
```

## Testes executados — Test_Modulo10_Rastreabilidade.gs

Os 9 cenários da seção 12, literalmente: criação de evento (número
sobe de verdade), consulta de histórico com filtro (só devolve o
que bate), rastreabilidade (cadastro sempre primeiro, entrada e
saída aparecem na trajetória), busca por ID universal e com tipo
explícito, registro inexistente (erro claro, não quebra),
validação de payload incompleto (erro tratado), permissões
(operador só vê o próprio histórico, mesmo tentando pedir o de
outro no filtro — o sistema ignora e força o próprio; admin vê
qualquer um), grande quantidade de registros (15 eventos criados,
paginado de 5 em 5, confirmando que nunca vem tudo de uma vez), e
linha do tempo genérica funcionando sobre uma reserva de verdade.

## 🟢 Concluído

Histórico de registros, rastreabilidade por ID (nunca texto),
consulta por ID universal, linha do tempo, filtros completos
(período/usuário/módulo/tipo/registro/obra/status), integridade
(histórico só é gravado via Audit_Service.record, nunca editável
por rota nenhuma), permissões (self-scope real, testado),
paginação (nunca carrega tudo de uma vez), API completa (as 5
funções da seção 8), testes cobrindo os 9 cenários pedidos.

## 🟡 Pendente (documentado, não escondido)

- Refatorar Service_Reserva.historico()/Service_Ferramenta
  .historico() pra delegar em buscarLinhaDoTempo() em vez de
  duplicar a query: não fiz nesta entrega pra não mexer em módulo
  já testado sem necessidade (regra 11 do contrato). Fica
  registrado como melhoria futura de baixo risco.
- Rastreabilidade cross-módulo pra Ferramentas: consultarRastreabilidade
  hoje só percorre a trajetória de produto (Estoque/Reserva/
  Solicitação/Pré-Compra) — Ferramentas tem seu próprio ciclo de
  vida (Módulo 06) que não passa por produtoId. Uma trajetória
  equivalente pra ferramenta individual ficaria pro
  Service_Ferramenta.historico() já existente, não duplicada aqui.
- ip real na auditoria: Audit_Service.record() sempre grava
  ip: '' — o Apps Script não expõe o IP de origem da requisição
  nesta arquitetura (HtmlService/API), então nunca foi um dado
  real disponível, documentado desde a criação do Audit_Service
  original (Camada 4), não uma lacuna nova deste módulo.

## 🔴 Bloqueado

Nenhum item bloqueado.

---

## Critério de conclusão

Código executa ✅ · Comunica com o Core (Audit_Service ampliado,
nunca duplicado) ✅ · Histórico registra e consulta de verdade ✅ ·
Rastreabilidade funciona por ID real ✅ · Permissões respeitadas
(self-scope testado, inclusive tentativa de vazamento bloqueada) ✅
· Testes principais passam (9 cenários) ✅ · Nenhum módulo anterior
quebrado (196 arquivos, 0 erros de sintaxe; Audit_Service.record/
search continuam aceitando as mesmas chamadas de sempre) ✅.

MÓDULO 10 — CONCLUÍDO (com pendências 🟡 registradas, nenhuma
bloqueante).
