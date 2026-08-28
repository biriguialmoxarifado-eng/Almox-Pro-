# ALMOXA PRO — BLOCO 03: API INTERNA + COMUNICAÇÃO CENTRAL
### Relatório técnico

---

## Aviso sobre este bloco

A auditoria confirmou que a arquitetura CORE→API→DATA LAYER→
MÓDULOS que este bloco pede já existe e já foi testada —
Core_Router (todo request passa por ele desde a Fase 1, e foi
ampliado na Integração 01 com checagem de módulo indisponível e
validação de resposta), Doctor_Communication (teste real em
cadeia Core→API→Data Layer, já construído na Integração 01), e
Doctor_Contracts (registro de módulo com id/versão/status/
dependências/endpoints/permissões, já construído no Módulo 17).
O trabalho real foi auditar o formato exato de request/response
que a seção 3 pede e os eventos de ciclo de vida de módulo da
seção 7 — os dois pontos onde havia gap real.

## Gap 1 (seção 3): resposta não ecoava module/action, erro não vinha aninhado

Core_Context.build() já capturava module/action desde a Fase 1 —
só nunca eram devolvidos na resposta final. E o formato de erro
era só campos soltos (code/message/details), nunca um objeto
aninhado error: {code, message, details} como o exemplo literal
da seção 3 mostra.

Decisão de risco controlado: Core_Response.ok/error é chamado em
~200 lugares diferentes do sistema (todo Service_X.gs). Mudar a
ASSINATURA dessas funções seria o tipo exato de risco que a seção
2 do contrato proíbe ("não duplicar/quebrar serviços"). Em vez
disso, o enriquecimento acontece só no Core_Router — o único
ponto por onde toda resposta já passava antes de sair pro
chamador — adicionando module/action e o objeto error aninhado
sem remover nenhum campo que já existia. Testado explicitamente
que uma resposta de sucesso comum continua tendo success/code/
message/data/timestamp exatamente onde sempre esteve.

module é derivado automaticamente do prefixo da action (ex:
'estoque.get' -> 'estoque') — nenhum Front precisou mudar pra
enviar um campo que nunca enviava antes.

## Gap 2 (seção 7): eventos de ciclo de vida de módulo nunca existiam

Core_ModuleManager.initAll() já registrava e inicializava todo
módulo desde a Fase 1, mas nunca emitia evento nenhum durante esse
processo — só atualizava um relatório interno (_initReport).
Agora emite MODULE_REGISTERED (logo após
Core_Registry.registerModule()), MODULE_STARTED (após init() bem
sucedido) e MODULE_ERROR (se init() falhar — o mesmo ponto onde a
Integração 01 já corrigiu o descriptor.status pra ERROR, agora
também emitindo o evento correspondente).

Decisão documentada sobre DATA_READ/DATA_WRITE: os nomes foram
formalizados no catálogo (a seção 7 pede "eventos padronizados"),
mas deliberadamente não conectados a cada leitura/escrita
individual do DB_Query/DB_Insert. Emitir um evento a cada leitura
de QUALQUER tela do sistema inteiro explodiria o volume de
EVENTOS_LOG (cada Event_Bus.emit() já grava uma linha lá) e
adicionaria custo em toda operação. Os eventos já granulares por
domínio que o sistema tem (ESTOQUE_ENTRADA/SAIDA,
MIGRACAO_EXECUTADA, RESERVA_CRIADA...) já cobrem rastreabilidade
de escrita de forma mais útil e escalável do que um DATA_WRITE
genérico disparado em cada insert(). Documentado aqui, não
escondido.

## O que já existia e foi só confirmado/reaproveitado (sem duplicar)

| Seção do contrato | Onde já está |
|---|---|
| 4. Registro de módulos (id/versão/status/dependências/endpoints/permissões) | Doctor_Contracts.describe() (Módulo 17) |
| 6. Segurança (sessão->autenticação->autorização->execução->registro) | Core_Router.dispatch(), ordem fixa desde a Fase 1, testada na Integração 01 |
| 8. Diagnóstico (API/Core/Data Layer online/offline) | Doctor_Communication.testarCadeia() (Integração 01) |
| 9. Versionamento de módulo | descriptor.version em cada MOD_XX.gs, consultável via Doctor_Contracts |
| 13. Critério de aprovação (Core->API->Data Layer comunicando, com teste) | Doctor_Communication, já testado na Integração 01 e reconfirmado aqui |

## Arquivos alterados

```
CORE/Core_Router.gs         — enriquecimento aditivo (module/action/error aninhado); limpeza de cabeçalho duplicado
CORE/Core_ModuleManager.gs  — emite MODULE_REGISTERED/STARTED/ERROR de verdade
EVENTS/Event_Types.gs       — 5 eventos novos (MODULE_REGISTERED/STARTED/ERROR, DATA_READ/WRITE)
TESTS/Test_IntegracaoFinal.gs — teste novo no runner mestre
```

## Arquivo criado

```
TESTS/Test_Bloco03_APIInterna.gs
```

## Nenhum arquivo novo de "API" foi necessário

A API já existia (Core_API.call -> Core_Router.dispatch ->
Core_Registry -> módulo) — este bloco ampliou o CONTRATO dela em
2 pontos precisos, não criou uma segunda camada de API.

## Testes executados — os pontos da seção 10, literalmente

Resposta de sucesso com module/action corretos; resposta de erro
com objeto error aninhado e campos soltos preservados
(retrocompatibilidade testada explicitamente); ação sem ponto não
quebra a derivação de módulo; contrato de resposta antigo 100%
intacto; mecanismo de eventos de ciclo de vida funcionando
(Event_Bus emite/recebe os 3 nomes novos); boot real do sistema
confirmado no relatório (Core_ModuleManager.getReport(), módulos
reais registrados com sucesso); registro de módulo com endpoints e
permissões (reaproveitado); diagnóstico de cadeia Core->API->Data
Layer funcionando (reaproveitado); ação inválida e módulo
inexistente tratados sem quebrar.

## Honestidade sobre o que não foi testado por injeção de falha real

MODULE_ERROR não foi testado forçando uma falha real num módulo
de produção — isso corromperia ALL_MODULES/Core_Registry pro
resto da suíte de testes (Test_RunTudo roda tudo na mesma
execução). O mecanismo de emissão foi confirmado (Event_Bus
recebe o evento quando emitido), e o ponto de emissão foi
confirmado por revisão de código (mesmo bloco catch que a
Integração 01 já usa pra marcar descriptor.status = ERROR, agora
também emitindo o evento). Documentado, não fingido como testado
com falha real.

## Limitações reais

- Versionamento de API em nível de REQUEST (o exemplo da seção 3
  mostra "version": "1.0" no payload de entrada) não é validado/
  imposto pelo Router — cada módulo já carrega sua própria versão
  (descriptor.version), mas não existe hoje uma verificação de
  "esta versão de request é compatível com a versão atual do
  módulo". Como o Apps Script roda uma única implantação ativa
  por vez (não há múltiplas versões de API coexistindo em
  produção), essa validação teria baixo valor prático agora —
  documentado como possível extensão futura, não implementado
  preventivamente.
- DATA_READ/DATA_WRITE existem só como nomes no catálogo, não emitidos — decisão documentada acima.

---

## Critério de conclusão (seção 13, literal)

Core -> API -> Data Layer comunicando corretamente ✅ (já eram,
Integração 01) · Testes comprovando essa comunicação ✅
(reconfirmado nesta entrega) · Formato de request/response da
seção 3 implementado de forma aditiva, sem quebrar nenhum dos
~200 pontos que já usam Core_Response ✅ · Eventos de ciclo de
vida de módulo reais (não só nomes reservados) ✅ · Nenhum módulo
de negócio (Inventário ou outro) implementado neste bloco ✅ ·
213 arquivos, 0 erros de sintaxe ✅.

BLOCO 03 — CONCLUÍDO.
