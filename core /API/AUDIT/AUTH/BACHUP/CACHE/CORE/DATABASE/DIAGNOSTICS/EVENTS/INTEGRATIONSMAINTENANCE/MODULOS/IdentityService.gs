/**
 * ============================================================
 * ALMOXA PRO — IdentityService.gs
 * FASE 3 (V3) DO FRONT MOBILE — IDENTIDADE CENTRAL.
 *
 * Único lugar que monta o IdentityContext (seção 11 da spec).
 * Nenhum módulo futuro (Reservas, EPI, Ferramentas, Estoque...)
 * deve remontar essa informação sozinho — todos consomem
 * `IdentityService.build(ctx)` (uso interno) ou a rota
 * `identidade.contexto` (uso pelo Front).
 *
 * DECISÃO DOCUMENTADA (seção 3 da spec): hoje `identityId` é
 * igual a `userId` — a mesma pessoa é reconhecida com a MESMA
 * identidade em qualquer dispositivo, porque a identidade não
 * pertence ao celular/computador, pertence ao registro em
 * USUARIOS. Não existe uma tabela de identidade separada
 * porque, com uma única fonte de verdade (USUARIOS) e sessão
 * central (Auth_Session), criar uma segunda tabela só pra
 * guardar o mesmo ID seria duplicar estrutura sem necessidade
 * real (regra explícita da spec, seção 34 — "não duplicar
 * identidade por módulo"). Se um dia existir múltiplas
 * identidades por pessoa (ex: perfis distintos por contrato),
 * este é o único arquivo que precisa mudar.
 *
 * O QUE NÃO ESTÁ AQUI (seção 32 — infraestrutura, não módulo):
 * Reservas, EPI, Ficha de EPI, Ferramentas, GPS, assinatura,
 * bloqueio de tela, QR de crachá. Só o contrato que essas fases
 * futuras vão consumir.
 * ============================================================
 */

const IdentityService = (function () {

  /**
   * Monta o IdentityContext a partir do que já existe —
   * sessão validada (ctx), USUARIOS e BIOMETRIA. Não inventa
   * nenhum campo que não tenha dado real por trás:
   * - signatureReference: sempre null nesta fase (seção 10 diz
   *   explicitamente que assinatura é conceito futuro).
   * - locationContext/deviceContext: só preenchidos se o Front
   *   mandar (GPS é opcional e futuro, seção 29) — nunca
   *   inventados no servidor.
   */
  function build(ctx, extras) {
    const user = DB_Query.get('USUARIOS', ctx.userId);
    if (!user) return null;

    const biometria = DB_Query.findOne('BIOMETRIA', b =>
      String(b.userId) === String(user.ID) && b.status === 'ATIVO'
    );

    return {
      userId: user.ID,
      identityId: user.ID, // ver decisão documentada acima
      profileId: user.perfil,
      workId: user.obraAtual || null,
      sessionId: ctx.sessionId,

      authMethod: 'MATRICULA_SENHA', // único método real hoje — seção 8
      authStatus: 'AUTENTICADO',

      biometricReference: biometria ? {
        biometricId: biometria.biometricId,
        provider: biometria.provider,
        status: biometria.status
      } : null, // nunca dado bruto — seção 6

      signatureReference: null, // seção 10 — fase futura, não inventado

      locationContext: (extras && extras.locationContext) || null,
      deviceContext: (extras && extras.deviceContext) || null,

      nome: user.nome,
      matricula: user.matricula,
      cargo: user.cargo,
      fotoUrl: user.fotoUrl || '', // seção 7 — foto de perfil, NUNCA tratada como credencial facial

      createdAt: user.dataCadastro,
      updatedAt: user.dataAtualizacao,
      timestamp: new Date().toISOString()
    };
  }

  function contexto(ctx) {
    const identity = build(ctx, ctx.payload);
    if (!identity) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Usuário da sessão não encontrado.', {}, ctx.requestId);
    }
    return Core_Response.ok(identity, '', 'SUCCESS', {}, ctx.requestId);
  }

  function getRoutes() {
    return { 'identidade.contexto': contexto };
  }
  function getServices() { return { IdentityService }; }
  function getEvents() { return []; }
  function getVersion() { return '1.0.0'; }
  function init() {
    // 'identidade.contexto' fica DE PROPÓSITO sem sessão pública
    // nem permissão especial registrada — cai no padrão VIEW,
    // que todo perfil autenticado tem. A identidade retornada é
    // sempre a do PRÓPRIO ctx.userId (da sessão validada pelo
    // Router), nunca de um id arbitrário do payload — não dá pra
    // um usuário consultar a identidade de outro por aqui.
  }
  function healthCheck() { return { status: CORE_CONSTANTS.DOCTOR_STATUS.OK }; }

  return { build, contexto, getRoutes, getServices, getEvents, getVersion, init, healthCheck, id: 'IDENTIDADE' };
})();
