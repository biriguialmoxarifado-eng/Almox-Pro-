/**
 * ============================================================
 * ALMOXA PRO — Auth_Permissions.gs  (CAMADA 3)
 * Exposição de permissões efetivas de um usuário — usado pelo
 * futuro frontend para esconder/mostrar elementos de UI.
 * IMPORTANTE: isso é só conveniência visual. A validação real
 * acontece sempre em Auth_RBAC.can(), dentro do Router.
 * ============================================================
 */

const Auth_Permissions = (function () {

  function getEffectivePermissions(perfil) {
    // Lista simplificada para a fase de esqueleto — quando os
    // módulos registrarem suas ACTION_PERMISSION_MAP reais
    // (Auth_RBAC.registerActionPermission), esta função passa a
    // devolver a lista completa e granular por módulo.
    return {
      perfil: perfil,
      isAdmin: perfil === CORE_CONSTANTS.PERFIS.ADMIN,
      generico: Object.keys(CORE_CONSTANTS.PERMISSOES).filter(p =>
        Auth_RBAC.can(perfil, '__generic__.' + p) || perfil === CORE_CONSTANTS.PERFIS.ADMIN
      )
    };
  }

  return { getEffectivePermissions };
})();
