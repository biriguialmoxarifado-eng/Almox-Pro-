/**
 * ============================================================
 * ALMOXA PRO — Doctor_Dependencies.gs
 * MÓDULO 08 — verifica se algum módulo declara depender de um
 * id que não está registrado. Reaproveita o campo `dependencies`
 * que Core_ModuleManager._resolveOrder já usa pra ordenar a
 * inicialização — nunca duplica essa leitura, só confere se cada
 * dependência declarada realmente existe.
 * ============================================================
 */

const Doctor_Dependencies = (function () {

  function check() {
    const modulos = Core_Registry.getAllModules();
    const idsExistentes = new Set(modulos.map(m => m.id));
    const problemas = [];

    modulos.forEach(m => {
      (m.dependencies || []).forEach(depId => {
        if (!idsExistentes.has(depId)) {
          problemas.push({ modulo: m.id, dependeDe: depId, motivo: 'Módulo dependência não está registrado.' });
        }
      });
    });

    return {
      status: problemas.length ? CORE_CONSTANTS.DOCTOR_STATUS.ERROR : CORE_CONSTANTS.DOCTOR_STATUS.OK,
      totalModulos: modulos.length,
      problemas
    };
  }

  return { check };
})();
