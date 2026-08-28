/**
 * ============================================================
 * ALMOXA PRO — Auth_Biometric.gs  (CAMADA 3)
 * Camada de abstração de biometria (seção 12). O sistema NÃO
 * fica preso a um fornecedor — qualquer provider real (facial,
 * digital, WebAuthn, outro) implementa este contrato.
 *
 * IMPORTANTE (privacidade): a planilha NUNCA guarda foto/
 * template biométrico bruto. Só guarda biometricId, provider,
 * credentialId/reference, status, consentimento e auditoria
 * (ver tabela BIOMETRIA no mapa de dados).
 * ============================================================
 */

const BiometricProvider = (function () {

  /** Contrato que qualquer provider real deve implementar. */
  const CONTRACT = ['register', 'verify', 'identify', 'delete', 'status', 'healthCheck'];

  const _providers = {}; // tipo -> implementação

  function registerProvider(tipo, impl) {
    CONTRACT.forEach(fn => {
      if (typeof impl[fn] !== 'function') {
        throw new Error('BiometricProvider: provider "' + tipo + '" não implementa ' + fn + '().');
      }
    });
    _providers[tipo] = impl;
  }

  function get(tipo) { return _providers[tipo] || null; }

  return { registerProvider, get, CONTRACT };
})();

const Auth_Biometric = (function () {

  const MODULE_ID = 'BIOMETRIA';

  function _providerAtivo() {
    const tipo = Core_Config.get('BIOMETRIC_PROVIDER');
    if (!tipo || tipo === 'NONE') return null;
    return BiometricProvider.get(tipo);
  }

  /**
   * Impede que um usuário comum registre/apague biometria de
   * OUTRO usuário — só ADMIN pode administrar biometria alheia
   * (ex: revogar biometria de alguém que perdeu o celular).
   * Se payload.userId não vier, assume o próprio usuário logado.
   */
  function _resolverUserIdAlvo(ctx) {
    const alvo = (ctx.payload && ctx.payload.userId) || ctx.userId;
    if (String(alvo) !== String(ctx.userId) && ctx.perfil !== CORE_CONSTANTS.PERFIS.ADMIN) {
      return { erro: true };
    }
    return { erro: false, userId: alvo };
  }

  function register(ctx) {
    const provider = _providerAtivo();
    if (!provider) {
      return Core_Response.error(
        CORE_CONSTANTS.RESPONSE_CODES.EXTERNAL_INTEGRATION_NOT_CONFIGURED,
        'Nenhum provider biométrico configurado (BIOMETRIC_PROVIDER=NONE).', {}, ctx.requestId
      );
    }
    if (!ctx.payload || ctx.payload.consentimento !== true) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'Consentimento biométrico obrigatório.', {}, ctx.requestId);
    }
    const resolvido = _resolverUserIdAlvo(ctx);
    if (resolvido.erro) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.PERMISSION_DENIED, 'Você só pode registrar sua própria biometria.', {}, ctx.requestId);
    }

    try {
      const result = provider.register(Object.assign({}, ctx.payload, { userId: resolvido.userId }));
      Event_Bus.emit(EVENT_TYPES.BIOMETRIA_VALIDADA, { userId: resolvido.userId, acao: 'REGISTRO' }, ctx);
      Audit_Service.record(ctx, 'BIOMETRIA_REGISTRO', { entidade: 'BIOMETRIA', entidadeId: resolvido.userId });
      return Core_Response.ok(result, 'Biometria registrada.', 'SUCCESS', {}, ctx.requestId);
    } catch (e) {
      return Core_Response.error(e.code || CORE_CONSTANTS.RESPONSE_CODES.INTERNAL_ERROR, e.message, {}, ctx.requestId);
    }
  }

  function verify(ctx) {
    const provider = _providerAtivo();
    if (!provider) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.EXTERNAL_INTEGRATION_NOT_CONFIGURED, 'Provider biométrico não configurado.', {}, ctx.requestId);
    }
    const userId = (ctx.payload && ctx.payload.userId) || ctx.userId;
    const result = provider.verify(Object.assign({}, ctx.payload, { userId }));
    Audit_Service.record(ctx, 'BIOMETRIA_VALIDADA', { entidade: 'BIOMETRIA', entidadeId: userId }, null, result);
    return Core_Response.ok(result, '', 'SUCCESS', {}, ctx.requestId);
  }

  function identify(ctx) {
    const provider = _providerAtivo();
    if (!provider) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.EXTERNAL_INTEGRATION_NOT_CONFIGURED, 'Provider biométrico não configurado.', {}, ctx.requestId);
    }
    // identify() é 1:N (não sabe de quem é) — por natureza é uma
    // operação administrativa (ex: totem de ponto). Permissão
    // já garante isso (ver init/registerActionPermission abaixo).
    return Core_Response.ok(provider.identify(ctx.payload), '', 'SUCCESS', {}, ctx.requestId);
  }

  function del(ctx) {
    const provider = _providerAtivo();
    if (!provider) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.EXTERNAL_INTEGRATION_NOT_CONFIGURED, 'Provider biométrico não configurado.', {}, ctx.requestId);
    }
    const resolvido = _resolverUserIdAlvo(ctx);
    if (resolvido.erro) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.PERMISSION_DENIED, 'Você só pode remover sua própria biometria (ou ser ADMIN).', {}, ctx.requestId);
    }
    const result = provider.delete({ userId: resolvido.userId });
    Audit_Service.record(ctx, 'BIOMETRIA_REMOVIDA', { entidade: 'BIOMETRIA', entidadeId: resolvido.userId });
    return Core_Response.ok(result, 'Biometria removida.', 'SUCCESS', {}, ctx.requestId);
  }

  function status(ctx) {
    const provider = _providerAtivo();
    const userId = (ctx.payload && ctx.payload.userId) || ctx.userId;
    return Core_Response.ok({
      providerConfigurado: Core_Config.get('BIOMETRIC_PROVIDER'),
      ativo: !!provider,
      cadastro: provider ? provider.status({ userId }) : null,
      health: provider ? provider.healthCheck() : { status: CORE_CONSTANTS.DOCTOR_STATUS.NOT_CONFIGURED }
    }, '', 'SUCCESS', {}, ctx.requestId);
  }

  function getRoutes() {
    return {
      'biometria.register': register,
      'biometria.verify': verify,
      'biometria.identify': identify,
      'biometria.delete': del,
      'biometria.status': status
    };
  }
  function getServices() { return { Auth_Biometric, BiometricProvider, Integration_Biometric }; }
  function getEvents() { return ['BIOMETRIA_VALIDADA', 'BIOMETRIA_REGISTRO']; }
  function getVersion() { return '1.1.0'; }

  function init() {
    // FASE 11: registra o provider real (era só o contrato vazio até aqui).
    BiometricProvider.registerProvider('DEVICE_SECRET', Integration_Biometric.deviceSecretProvider);

    // Corrige um bug de segurança da Fase 1: estas rotas nunca
    // tinham permissão registrada, então caíam no fallback VIEW
    // — qualquer perfil de leitura conseguia registrar/identificar
    // biometria de qualquer usuário. register/delete exigem
    // CREATE; identify (1:N, tipo totem) exige ADMIN.
    Auth_RBAC.registerActionPermission('biometria.register', 'BIOMETRIA.CREATE');
    Auth_RBAC.registerActionPermission('biometria.verify', 'BIOMETRIA.VIEW');
    Auth_RBAC.registerActionPermission('biometria.identify', 'BIOMETRIA.ADMIN');
    Auth_RBAC.registerActionPermission('biometria.delete', 'BIOMETRIA.CREATE');
    Auth_RBAC.registerActionPermission('biometria.status', 'BIOMETRIA.VIEW');
  }

  function healthCheck() {
    return Integration_Biometric.healthCheck();
  }

  return { register, verify, identify, delete: del, status, getRoutes, getServices, getEvents, getVersion, init, healthCheck, id: MODULE_ID };
})();
