/**
 * ============================================================
 * ALMOXA PRO — Doctor_Contracts.gs
 * MÓDULO 17 — seção 3/4/9: "cada módulo deve possuir
 * identificação, versão, contrato, entradas/saídas, eventos,
 * dependências, permissões, status, mecanismo de comunicação".
 *
 * AUDITORIA: cada módulo JÁ declara isso — todo descritor em
 * /MODULES tem id/name/version/status/dependencies/getRoutes/
 * getServices/getEvents/healthCheck desde a Fase 1. Pedir que os
 * módulos ganhem um método novo só pra "ter contrato formal"
 * seria alterar módulo existente sem necessidade real — o dado
 * já existe, só não tinha uma função que o REÚNE num retrato só.
 *
 * Isso é o que este arquivo faz: SINTETIZA o contrato a partir
 * do que Core_Registry já sabe. Nenhum módulo precisou mudar.
 * ============================================================
 */

const Doctor_Contracts = (function () {

  /** Contrato completo de UM módulo — identificação, versão, rotas (entrada), eventos (saída), dependências, permissões por rota, status. */
  function describe(moduloId) {
    const modulo = Core_Registry.getModule(moduloId);
    if (!modulo) return null;

    const mapaPermissoes = Auth_RBAC.getActionPermissionMap();
    const rotasDoModulo = Object.keys(modulo.getRoutes ? modulo.getRoutes() : {});

    const entradas = rotasDoModulo.map(acao => ({
      acao,
      publica: Core_Registry.isPublicRoute(acao),
      permissao: mapaPermissoes[acao] || null // null = sem permissão explícita (mesmo alerta do doctor.permissions, Módulo 08)
    }));

    // "dependentes" (quem depende DESTE módulo) — reverso do que
    // já existe em cada descritor, nunca armazenado duas vezes.
    const dependentes = Core_Registry.getAllModules()
      .filter(m => (m.dependencies || []).includes(moduloId))
      .map(m => m.id);

    return {
      id: modulo.id, nome: modulo.name || modulo.id, versao: modulo.version || (modulo.getVersion ? modulo.getVersion() : null),
      status: modulo.status || CORE_CONSTANTS.MODULE_STATUS.ACTIVE,
      dependencias: modulo.dependencies || [], dependentes,
      entradas, totalEntradas: entradas.length,
      saidas: (modulo.getEvents ? modulo.getEvents() : []),
      saude: modulo.healthCheck ? modulo.healthCheck() : null
    };
  }

  /** Mapa do sistema inteiro (seção 1 do Módulo 17 — "rede de comunicação") — reaproveita describe() por módulo, não recalcula nada. */
  function mapaDoSistema() {
    return Core_Registry.getAllModules().map(m => describe(m.id));
  }

  return { describe, mapaDoSistema };
})();
