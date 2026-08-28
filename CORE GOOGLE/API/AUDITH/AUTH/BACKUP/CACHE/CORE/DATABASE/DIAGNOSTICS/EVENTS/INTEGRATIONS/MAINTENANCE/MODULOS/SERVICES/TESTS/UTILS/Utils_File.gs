/**
 * ============================================================
 * ALMOXA PRO — Utils_File.gs
 * Helpers de Drive usados por vários módulos (NF, backup,
 * digitalização) — a chamada real ao Drive fica centralizada
 * aqui e em Integration_GoogleDrive.gs.
 * ============================================================
 */
const Utils_File = (function () {
  function getOrCreateFolder(parentId, name) {
    const parent = DriveApp.getFolderById(parentId);
    const existing = parent.getFoldersByName(name);
    if (existing.hasNext()) return existing.next();
    return parent.createFolder(name);
  }
  function extensionOf(filename) {
    const parts = String(filename || '').split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : '';
  }
  return { getOrCreateFolder, extensionOf };
})();
