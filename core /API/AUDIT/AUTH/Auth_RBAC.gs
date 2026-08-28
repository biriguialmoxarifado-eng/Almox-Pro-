/**
 * ============================================================
 * ALMOXA PRO — Auth_RBAC.gs  (CAMADA 3)
 * Controle de acesso baseado em papel (seção 10). Granularidade
 * por MÓDULO.AÇÃO (ex: ESTOQUE.EDIT, INVENTARIO.APPROVE).
 * Verificado no Router (nunca só no frontend).
 * ============================================================
 */

const Auth_RBAC = (function () {

  const P = CORE_CONSTANTS.PERFIS;
  const A = CORE_CONSTANTS.PERMISSOES;

  // Matriz base — pode ser sobrescrita por registro em
  // PERMISSOES_CUSTOM (aba) via _customOverride, sem alterar código.
  const BASE = {
    [P.ADMIN]:        { '*': true },
    [P.GESTOR]:       { VIEW: true, CREATE: true, EDIT: true, APPROVE: true, REJECT: true, EXPORT: true, AUDIT: true },
    [P.ALMOXARIFE]:   { VIEW: true, CREATE: true, EDIT: true, EXPORT: true },
    [P.OPERADOR]:     { VIEW: true, CREATE: true },
    [P.MESTRE_OBRA]:  { VIEW: true, CREATE: true },
    [P.COMPRAS]:      { VIEW: true, CREATE: true, IMPORT: true, EXPORT: true },
    [P.AUDITOR]:      { VIEW: true, AUDIT: true, EXPORT: true },
    [P.CONSULTA]:     { VIEW: true }
  };

  // Mapa action → permissão granular exigida (ex: 'estoque.adjust' → ESTOQUE.EDIT)
  // Populado dinamicamente pelos módulos via registerActionPermission().
  const ACTION_PERMISSION_MAP = {};

  function registerActionPermission(action, permissionKey) {
    ACTION_PERMISSION_MAP[action] = permissionKey; // ex: 'ESTOQUE.EDIT'
  }

  function _customOverride(perfil, permissionKey) {
    try {
      const row = DB_Query.findOne('PERMISSOES_CUSTOM', r => r.perfil === perfil && r.permissao === permissionKey);
      return row ? String(row.permitido).toUpperCase() === 'TRUE' : null;
    } catch (e) {
      return null; // aba ainda não existe nesta fase — cai no fallback
    }
  }

  function can(perfil, action) {
    if (!perfil) return false;
    if (perfil === P.ADMIN) return true;

    const permissionKey = ACTION_PERMISSION_MAP[action]; // ex: 'ESTOQUE.EDIT'
    const acaoGenerica = permissionKey ? permissionKey.split('.')[1] : A.VIEW;

    if (permissionKey) {
      const override = _customOverride(perfil, permissionKey);
      if (override !== null) return override;
    }

    const base = BASE[perfil];
    if (!base) return false;
    if (base['*']) return true;
    return !!base[acaoGenerica];
  }

  /**
   * MÓDULO 08 (Doctor Engine) — precisa enumerar quais ações TÊM
   * permissão explícita registrada e quais caem no padrão VIEW
   * "por omissão" (exatamente a classe de bug que já corrigimos
   * manualmente várias vezes ao longo do projeto: usuario.*,
   * notificacao.read, reserva.get/calendar, doctor.*). Sem essa
   * exposição, o Doutor não tinha como checar isso sozinho.
   */
  function getActionPermissionMap() {
    return Object.assign({}, ACTION_PERMISSION_MAP);
  }

  function getBaseMatrix() {
    return JSON.parse(JSON.stringify(BASE)); // cópia — nunca expor a referência real, mutável
  }

  return { can, registerActionPermission, getActionPermissionMap, getBaseMatrix };
})();
