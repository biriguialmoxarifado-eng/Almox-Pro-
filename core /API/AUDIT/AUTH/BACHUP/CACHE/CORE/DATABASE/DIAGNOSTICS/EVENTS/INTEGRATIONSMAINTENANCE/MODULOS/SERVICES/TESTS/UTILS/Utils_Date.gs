/**
 * ============================================================
 * ALMOXA PRO — Utils_Date.gs
 * ============================================================
 */
const Utils_Date = (function () {
  function format(date, pattern) {
    return Utilities.formatDate(date, Session.getScriptTimeZone(), pattern || 'dd/MM/yyyy HH:mm:ss');
  }
  function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }
  function isExpired(date) { return new Date(date).getTime() < Date.now(); }
  function diffInHours(dateA, dateB) {
    return Math.abs(new Date(dateA).getTime() - new Date(dateB).getTime()) / 36e5;
  }
  return { format, addDays, isExpired, diffInHours };
})();
