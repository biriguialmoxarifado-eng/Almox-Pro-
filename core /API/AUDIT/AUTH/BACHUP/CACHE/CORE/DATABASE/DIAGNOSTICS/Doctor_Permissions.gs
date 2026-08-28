/**
 * ============================================================
 * ALMOXA PRO — Doctor_Permissions.gs
 * MÓDULO 08 — a peça mais importante do contrato: "Permissão
 * visual NÃO deve ser considerada segurança suficiente."
 *
 * Este arquivo AUTOMATIZA exatamente o tipo de auditoria manual
 * que precisou ser feita repetidamente ao longo deste projeto —
 * usuario.* nunca ligado a módulo (Fase 3), notificacao.read
 * sem dono (Fase 4), reserva.get/calendar vazando (Fase 6),
 * doctor.* sem permissão nenhuma (Fase 8). Cada uma dessas foi
 * encontrada lendo código manualmente. Agora o sistema encontra
 * sozinho: toda rota registrada que NÃO tem permissão explícita
 * em Auth_RBAC cai no padrão VIEW — que a maioria dos perfis
 * tem. Isso é sempre um RISCO A CONFERIR, não necessariamente um
 * bug (algumas rotas são legitimamente amplas), mas o Doutor
 * nunca deve esconder isso.
 * ============================================================
 */

const Doctor_Permissions = (function () {

  function check() {
    const rotas = Core_Registry.getAllRoutes();
    const mapaPermissoes = Auth_RBAC.getActionPermissionMap();
    const acoes = Object.keys(rotas);

    const semPermissaoExplicita = [];
    const publicas = [];

    acoes.forEach(acao => {
      if (Core_Registry.isPublicRoute(acao)) {
        publicas.push(acao);
        return; // rota pública é uma decisão consciente do módulo (registerPublicRoute) — não é "esquecimento"
      }
      if (!mapaPermissoes[acao]) {
        semPermissaoExplicita.push(acao);
      }
    });

    const baseMatrix = Auth_RBAC.getBaseMatrix();
    const perfisComViewPadrao = Object.keys(baseMatrix).filter(p => baseMatrix[p]['*'] || baseMatrix[p].VIEW);

    return {
      status: semPermissaoExplicita.length ? CORE_CONSTANTS.DOCTOR_STATUS.WARNING : CORE_CONSTANTS.DOCTOR_STATUS.OK,
      totalRotas: acoes.length,
      totalPublicas: publicas.length,
      totalSemPermissaoExplicita: semPermissaoExplicita.length,
      rotasSemPermissaoExplicita: semPermissaoExplicita,
      rotasPublicas: publicas,
      perfisQueAlcancamRotaSemPermissao: perfisComViewPadrao,
      observacao: semPermissaoExplicita.length
        ? 'Rotas listadas caem no padrão VIEW — confira se isso é intencional pra cada uma.'
        : 'Toda rota não-pública tem permissão explícita registrada.'
    };
  }

  return { check };
})();
