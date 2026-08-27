/**
 * om.js — Gestion transactions Orange Money
 */
const OM = (() => {
  const KEY = 'wl_om';
  let history = JSON.parse(localStorage.getItem(KEY) || '[]');

  function uid() { return Math.random().toString(36).slice(2,9) + Date.now().toString(36); }
  function save() { localStorage.setItem(KEY, JSON.stringify(history)); }

  function record(type, data) {
    const txn = { id: uid(), type, ...data, ts: Date.now() };
    history.unshift(txn); save(); return txn;
  }

  function getHistory(limit = 50) { return history.slice(0, limit); }

  function stats(since = 0) {
    const filtered = history.filter(h => h.ts >= since);
    return {
      total: filtered.length,
      retraits: filtered.filter(h => h.type === 'retrait').length,
      depots: filtered.filter(h => h.type === 'depot').length,
      volumeRetrait: filtered.filter(h => h.type === 'retrait').reduce((s, h) => s + (h.montant || 0), 0),
      volumeDepot: filtered.filter(h => h.type === 'depot').reduce((s, h) => s + (h.montant || 0), 0)
    };
  }

  return { record, getHistory, stats };
})();
