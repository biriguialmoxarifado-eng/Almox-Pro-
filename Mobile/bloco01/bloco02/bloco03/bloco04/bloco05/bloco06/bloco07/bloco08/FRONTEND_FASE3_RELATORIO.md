# ALMOXA PRO — FRONT MOBILE — FASE 3 (V3)
### Autenticação, Identidade Central e Biometria — Relatório de entrega

---

## 1) Arquivos novos — Backend

| Arquivo | Papel |
|---|---|
| `MODULES/IdentityService.gs` | **Identidade Central** — monta o `IdentityContext` único (seção 11 da V3), consumível por qualquer módulo futuro |
| `MODULES/Usuarios_Core.gs` | Corrige bug real da Fase 1 (ver seção 3) |
| `TESTS/Test_IdentityService.gs` | Testa o IdentityContext |
| `TESTS/Test_Loja_CadastroFoto.gs` | Testa autocadastro + upload de foto |

## 2) Arquivos novos — Front

```
Screen_Identification.html    — Tela 05: Já tenho cadastro / Sou novo aqui
Screen_Login.html              — Tela 06: matrícula + senha
Screen_Register.html            — Tela 07: cadastro etapa 1 (dados básicos)
Screen_RegisterPhoto.html       — Tela 08: câmera real (getUserMedia)
Screen_RegisterBiometric.html   — Tela 09: biometria via WebAuthn + DEVICE_SECRET
Screen_Confirmation.html        — Tela 10: resumo + IdentityContext
Screen_Home_Placeholder.html    — 1ª rota com requiresAuth:true de verdade
```

`Screen_IdentificationPlaceholder.html` (da Fase 2) foi **removida**
— era só um aviso "Fase 3 ainda não existe", agora substituída
pela implementação real.

## 3) Bug real encontrado e corrigido (não fazia parte do pedido, mas bloqueava a Fase 3)

`API_Usuarios_getRoutes()` existia desde a Fase 1, mas **nenhum
módulo em `ALL_MODULES` chamava essa função** — o gerador da
época pulou `MOD_01_CORE` de propósito (Core não é módulo de
negócio) e ninguém assumiu essas rotas. `usuario.get/search/
create/update` nunca foram alcançáveis via `Core_Router` — sempre
devolveriam `ROUTE_NOT_FOUND`. Descobri isso ao precisar de
`usuario.salvarFoto` funcionando de verdade. Corrigido com
`Usuarios_Core.gs`, registrado na lista mestra.

## 4) Identidade Central — como ficou (seção 3/11 da V3)

```
USUÁRIO (dado real em USUARIOS)
   +
BIOMETRIA (referência, nunca dado bruto)
   =
IdentityContext = {
  userId, identityId,       // hoje iguais — ver decisão abaixo
  profileId, workId, sessionId,
  authMethod, authStatus,
  biometricReference: { biometricId, provider, status } | null,
  signatureReference: null,  // seção 10 — fase futura, nunca inventado
  locationContext: null,     // seção 29 — fase futura
  deviceContext: null,
  nome, matricula, cargo, fotoUrl,
  createdAt, updatedAt, timestamp
}
```

**Decisão documentada** (seção 3 pede pra não duplicar identidade
por dispositivo): `identityId` é hoje igual a `userId`. Não criei
uma tabela `IDENTIDADES` separada porque, com uma única fonte de
verdade (`USUARIOS`) e sessão central (`Auth_Session`), uma
segunda tabela guardando o mesmo ID seria duplicação sem
necessidade real — o que a própria seção 34 da V3 proíbe. Fica
registrado: se um dia existir identidade N:1 com usuário (ex.:
múltiplos contratos por pessoa), `IdentityService.gs` é o único
arquivo que precisa mudar — nenhum módulo consumidor precisa
saber disso.

Módulos futuros (Reservas, EPI, Ferramentas) vão consumir
`IdentityService.build(ctx)` internamente, ou a rota
`identidade.contexto` pelo Front — nunca remontando essa
informação sozinhos.

## 5) Foto de perfil ≠ Identidade facial (seção 7 da V3)

Essa separação **já nasceu certa** desde a Fase 2, sem eu saber
que a V3 viria pedir isso explicitamente:
- `usuario.salvarFoto` → grava em `USUARIOS.fotoUrl` (Drive, uso de avatar/interface).
- `biometria.register` → grava em `BIOMETRIA` (referência de credencial, nunca a foto).

Nunca há conversão automática de uma coisa na outra.

## 6) Biometria — o que é real e o que não é (transparência exigida na seção 37)

- **Real**: o navegador aciona o autenticador de plataforma do
  celular (`navigator.credentials.create` com
  `authenticatorAttachment: 'platform'`) — isso dispara Face
  ID/digital **nativos do sistema operacional**, não uma
  simulação nossa.
- **Não fizemos** (e documentei o porquê): verificação
  criptográfica completa da assinatura WebAuthn no servidor —
  exigiria parsing CBOR/COSE e verificação assimétrica, pesado
  demais sem biblioteca externa em Apps Script (mesma limitação
  já documentada desde a Fase 11 do backend).
- **Como fechamos o ciclo**: usamos o sucesso do WebAuthn como
  gatilho real de "o biométrico do aparelho confirmou a pessoa
  agora", e a partir daí seguimos com o provider `DEVICE_SECRET`
  já auditado na Fase 11 (segredo aleatório, só o hash vai pro
  servidor).
- Se o navegador não suportar (`isUserVerifyingPlatformAuthenticatorAvailable`
  retorna `false`) ou a pessoa cancelar o prompt, o cadastro
  **nunca trava** — biometria é reforço opcional, não obrigatório.

## 7) Segurança (checklist da seção 28)

- [x] Front nunca decide autorização sozinho — permissão sempre validada no `Core_Router`.
- [x] `ctx.userId` vem da sessão validada, nunca do payload — `usuario.salvarFoto` e `identidade.contexto` só operam sobre o PRÓPRIO usuário.
- [x] Senha nunca em texto puro (`Auth_Tokens.hash`).
- [x] Biometria bruta nunca em Sheets — só `biometricId`/`provider`/`status`.
- [x] `deviceSecret` nunca chega ao servidor em texto puro sem virar hash antes de gravar.
- [x] Auditoria registrada em `AUTOCADASTRO_LOJA`, `USUARIO_FOTO_ATUALIZADA`, `BIOMETRIA_REGISTRO`.

## 8) O que ficou de fora — de propósito (seção 32)

Reservas, EPI, Ficha de EPI, Ferramentas, QR de crachá, GPS,
assinatura, bloqueio de tela, notificação automática de entrega.
**Nada disso foi implementado** — só os *contratos* que essas
fases vão consumir (`IdentityContext`, catálogo de eventos
ampliado em `Event_Types.gs`). A V3 é explícita: infraestrutura
agora, módulos depois.

## 9) Testes

- `Test_IdentityService_fluxoCompleto`: cadastra usuário teste, confere `IdentityContext` (identityId=userId, perfil OPERADOR, signatureReference null, biometricReference null pra usuário novo), confere que a rota exige sessão.
- `Test_Loja_CadastroFoto_fluxoCompleto`: autocadastro público, bloqueio de matrícula duplicada, upload de foto real.
- Validei sintaxe JS de **todos os 30 arquivos do Front** (script Node local) — 0 erros.

**Preciso que você teste no navegador**: câmera (permissão do
celular) e biometria (Face ID/digital reais) só dá pra confirmar
de verdade em um aparelho físico.

---

## Compatibilidade confirmada com Fases 1 e 2
Nenhum arquivo de `Front_App.html`, `Header.html`, `JS/Router.html`,
`JS/API.html`, `Store.html`, `Cart.html` foi alterado na lógica —
só `JS/App.html` (registro de rotas) e `JS/Session.html` (adição
aditiva de `Session.identity`, sem remover nenhum campo antigo).

## Ponto de entrada da próxima fase
`/inicio` já existe, registrado com `requiresAuth: true` — a
Fase 4 (Home configurável) só precisa trocar
`Screen_Home_Placeholder` por uma Home de verdade.

---

## PARANDO AQUI — aguardando validação antes da Fase 4.
