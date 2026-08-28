/**
 * ============================================================
 * ALMOXA PRO — Utils_String.gs
 * Usado, entre outros, para normalizar descrição de produto na
 * chegada da NF (seção 17).
 * ============================================================
 */
const Utils_String = (function () {
  function normalize(str) {
    return String(str || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
      .toUpperCase().trim().replace(/\s+/g, ' ');
  }
  function slugify(str) {
    return normalize(str).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }
  function similarity(a, b) {
    // Similaridade simples por token compartilhado — suficiente
    // para "produto semelhante encontrado" (seção 17); um
    // algoritmo mais robusto (Levenshtein/fuzzy) pode substituir
    // esta função sem mudar o contrato.
    const ta = new Set(normalize(a).split(' '));
    const tb = new Set(normalize(b).split(' '));
    const inter = [...ta].filter(t => tb.has(t)).length;
    const union = new Set([...ta, ...tb]).size;
    return union === 0 ? 0 : inter / union;
  }
  return { normalize, slugify, similarity };
})();
