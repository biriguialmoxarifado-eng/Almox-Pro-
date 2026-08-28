# ALMOXA PRO — MÓDULO 01: USUÁRIOS / IDENTIDADE
### Relatório técnico de implementação

---

## 1) Inventário feito antes de codificar (seção "regra absoluta" do contrato)

Conferido no ZIP antes de escrever qualquer linha:

| Item | Estado encontrado |
|---|---|
| `API_Usuarios.gs` | Rotas já registradas (`usuario.get/search/create/update/salvarFoto`), permissões já mapeadas |
| `Usuarios_Core.gs` | Módulo já ligado ao `Core_Registry` (bug de rotas nunca-alcançáveis já tinha sido corrigido na Fase 3 do Front Mobile) |
| `Service_Usuario.gs` | `get/search/create/update` retornavam `MODULE_NOT_IMPLEMENTED`; `salvarFoto` já era real |
| `Auth_RBAC`, `Auth_Session`, `Auth_Tokens`, `Auth_Biometric` | Completos, não tocados |

Nada foi duplicado. Só completei as 4 funções que já tinham
contrato de rota esperando por elas.

## 2) O que foi implementado

- `get`: retorna usuário com campos filtrados por escopo (ver seção 3).
- `search`: busca por nome/matrícula (`Utils_String.normalize`, mesmo padrão usado em `loja.catalogo`), mesmo filtro de escopo aplicado a cada linha.
- `create`: exige ADMIN (RBAC já garantia isso); valida perfil contra o enum real (`CORE_CONSTANTS.PERFIS`) — nunca aceita string arbitrária; bloqueia matrícula duplicada; senha nunca fica em texto puro (`Auth_Tokens.hash`); emite `USER_CREATED`; audita.
- `update`: exige ADMIN; mesma validação de perfil; bloqueia troca de matrícula pra uma já existente; nunca aceita `senha_hash` nem `fotoUrl` no payload, mesmo que venham — filtrados de propósito (isso continua sendo trabalho de `usuario.salvarFoto` e de uma futura rota de redefinição de senha, que não existe ainda); emite `USER_UPDATED` sempre, `USER_PROFILE_CHANGED`/`USER_STATUS_CHANGED` quando esses campos específicos mudam; audita antes/depois.
- `salvarFoto`: preservada sem nenhuma alteração.

## 3) Escopo de campos — a parte mais importante do contrato

```
_filtrarCampos(usuarioAlvo, ctx):
  SEMPRE (qualquer perfil, sobre qualquer usuário):
    ID, nome, matricula, cargo, funcao, fotoUrl, obraAtual

  SE (é o próprio usuário) OU (ctx.perfil === ADMIN), adiciona:
    email, telefone, perfil, status, ambiente, permissoes,
    dataCadastro, ultimoAcesso, statusBiometria, dataAtualizacao

  NUNCA, pra ninguém, nem ADMIN, nem o próprio dono:
    senha_hash, sessaoAtual, biometricId, faceCredentialId,
    consentimentoBiometrico, dataConsentimento
```

Testei explicitamente (`escopoLimitadoParaTerceiro`) que um
OPERADOR buscando outro usuário não recebe `perfil` nem `email`
na resposta — não é um campo escondido na tela, o backend nem
manda esse dado.

## 4) Segurança (seção 7 do contrato, item por item)

- [x] Perfil nunca aceito sem validar contra o enum real (`create` e `update`).
- [x] Ninguém altera foto/dado de outro usuário mudando um ID no payload — `salvarFoto` usa `ctx.userId`; `update`/`create` exigem ADMIN via RBAC, testado com usuário comum tentando (`PERMISSION_DENIED`).
- [x] Senha/hash nunca aparecem em resposta de API — testado (`senhaNuncaExposta`).
- [x] Nenhuma duplicação de `Auth_RBAC`/`Auth_Session`/`Auth_Tokens`/`Auth_Biometric`.
- [x] Endpoint administrativo bloqueado no backend (RBAC), não só escondido no Front.

## 5) Eventos

`USER_CREATED`, `USER_UPDATED`, `USER_PROFILE_CHANGED`,
`USER_STATUS_CHANGED` adicionados ao catálogo — implementados de
verdade (emitidos por `create`/`update`), diferente dos contratos
de evento que a Fase 3 do Front Mobile tinha deixado só como nome
reservado pra módulos futuros.

## 6) Testes — `Test_Modulo01_Usuarios.gs`

Cobre os 9 cenários da seção 10 do contrato: login válido/
inválido, sessão ausente, usuário comum tentando criar/atualizar
(bloqueado), admin criando/atualizando (funciona), usuário
tentando alterar outro pelo payload (bloqueado), foto própria
(funciona) e sem sessão (bloqueado), campos obrigatórios e perfil
inexistente (bloqueados), e o escopo de campos por perfil.

## 7) O que ficou pendente — documentado, não escondido

- Redefinição de senha: o contrato não pede uma rota pra isso (só
  menciona "recuperação de acesso" no objetivo geral do módulo,
  no Mapa Mestre) — não inventei uma rota que não foi
  especificada no contrato de rotas da seção 4. Fica como próximo
  passo natural quando for pedido explicitamente.
- Autoatualização de dados básicos pelo próprio usuário (ex:
  telefone/email sem ser ADMIN): o contrato só define
  `usuario.update` como rota administrativa e `usuario.salvarFoto`
  como self-service — não existe uma terceira rota de "autoedição"
  no contrato. Não criei uma pra não extrapolar o que foi pedido.
- Coluna `permissoes` em `USUARIOS`: existe no esquema desde fases
  anteriores, mas a autorização real do sistema é 100% baseada em
  perfil (RBAC), não em permissão individual por usuário — a
  coluna é aceita em `create`/`update` mas não é consultada em
  lugar nenhum da autorização. Documentado aqui pra não gerar a
  falsa impressão de que ela faz algo.
- Recursos biométricos avançados e autenticação por voz: a seção
  12 do contrato já marca como 🟡, não bloqueante — nada feito
  aqui, nada fingido.

---

## Critério de conclusão (seção 13 do contrato)

Funções obrigatórias implementadas ✅ · Rotas protegidas por RBAC
real (testado com usuário sem permissão) ✅ · Testes cobrindo os
cenários pedidos ✅ · Nenhuma duplicação de lógica ✅.

MÓDULO 01 — CONCLUÍDO, com as pendências acima registradas
explicitamente (nenhuma delas bloqueia os módulos 02/03).
