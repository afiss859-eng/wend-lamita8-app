/**
 * admin.js — Panel administrateur Wend-Lamita
 * Accès : mot de passe admin séparé (stocké en hash local)
 * Fonctions : gestion utilisateurs, stats globales, logs, config système
 */
const Admin = (() => {
  const ADMIN_KEY = 'wl_admin_pass';
  const ADMIN_LOGS = 'wl_admin_logs';
  const DEFAULT_ADMIN_HASH = simpleHash('admin1234'); // À changer à la 1ère connexion

  function simpleHash(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h) + str.charCodeAt(i);
    return (h >>> 0).toString(36);
  }

  function isAdminConfigured() { return !!localStorage.getItem(ADMIN_KEY); }

  function checkPassword(pwd) {
    const stored = localStorage.getItem(ADMIN_KEY) || DEFAULT_ADMIN_HASH;
    return simpleHash(pwd) === stored;
  }

  function setPassword(oldPwd, newPwd) {
    if (isAdminConfigured() && !checkPassword(oldPwd)) return { ok: false, error: 'Ancien mot de passe incorrect' };
    if (newPwd.length < 6) return { ok: false, error: 'Mot de passe trop court' };
    localStorage.setItem(ADMIN_KEY, simpleHash(newPwd));
    return { ok: true };
  }

  function log(action, detail = '') {
    const logs = JSON.parse(localStorage.getItem(ADMIN_LOGS) || '[]');
    logs.unshift({ ts: Date.now(), action, detail, user: Auth.getUser()?.shop || 'système' });
    if (logs.length > 200) logs.splice(200);
    localStorage.setItem(ADMIN_LOGS, JSON.stringify(logs));
  }

  function getLogs(limit = 50) { return JSON.parse(localStorage.getItem(ADMIN_LOGS) || '[]').slice(0, limit); }

  function getGlobalStats() {
    const prods = Inventory.getAll();
    const sales = Inventory.getSales(0);
    const omH = OM.getHistory(1000);
    const cniH = CNIHistory.getAll();
    const now = Date.now();
    const today = new Date(); today.setHours(0,0,0,0);

    return {
      produits: { total: prods.length, valeur: prods.reduce((s,p)=>s+p.qty*p.prix,0), bas: Inventory.getLowStock().length, epuises: prods.filter(p=>p.qty===0).length },
      ventes: {
        total: sales.length,
        ca_total: sales.reduce((s,x)=>s+x.prix*x.qty,0),
        ca_aujourd: sales.filter(s=>s.ts>=today.getTime()).reduce((s,x)=>s+x.prix*x.qty,0),
        ca_mois: sales.filter(s=>s.ts>=now-30*86400000).reduce((s,x)=>s+x.prix*x.qty,0),
        articles: sales.reduce((s,x)=>s+x.qty,0),
      },
      om: {
        total: omH.length,
        retraits: omH.filter(h=>h.type==='retrait').length,
        depots: omH.filter(h=>h.type==='depot').length,
        volume: omH.reduce((s,h)=>s+(h.montant||0),0),
        volume_mois: omH.filter(h=>h.ts>=now-30*86400000).reduce((s,h)=>s+(h.montant||0),0),
      },
      cni: {
        total: cniH.length,
        parType: cniH.reduce((acc,e)=>{acc[e.type_piece]=(acc[e.type_piece]||0)+1;return acc;},{}),
        aujourd: cniH.filter(e=>new Date(e.ts)>=today).length,
      },
    };
  }

  function resetAllData(confirmText) {
    if (confirmText !== 'CONFIRMER RESET') return { ok: false, error: 'Texte de confirmation incorrect' };
    ['wl_products','wl_sales','wl_om','wl_cni_history','wl_ai_history'].forEach(k=>localStorage.removeItem(k));
    log('RESET_TOTAL', 'Toutes les données effacées');
    return { ok: true };
  }

  function exportFullBackup() {
    const data = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      products: JSON.parse(localStorage.getItem('wl_products')||'[]'),
      sales: JSON.parse(localStorage.getItem('wl_sales')||'[]'),
      om: JSON.parse(localStorage.getItem('wl_om')||'[]'),
      cni: JSON.parse(localStorage.getItem('wl_cni_history')||'[]'),
      logs: getLogs(200),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `backup-admin-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    log('EXPORT_BACKUP', `${data.products.length} produits, ${data.sales.length} ventes`);
  }

  return { checkPassword, setPassword, isAdminConfigured, log, getLogs, getGlobalStats, resetAllData, exportFullBackup, simpleHash };
})();
