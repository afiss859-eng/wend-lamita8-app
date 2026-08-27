/**
 * cni-history.js — Historique des cartes d'identité scannées
 * Stockage local, filtrage par date/type/nom, recherche
 */
const CNIHistory = (() => {
  const KEY = 'wl_cni_history';

  function getAll() { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
  function save(list) { localStorage.setItem(KEY, JSON.stringify(list)); }

  function uid() { return Math.random().toString(36).slice(2,9) + Date.now().toString(36); }

  // Ajouter une CNI à l'historique (appelé après chaque scan OM)
  function add(cniData, txnType = null, txnMontant = null) {
    const list = getAll();
    const entry = {
      id: uid(),
      ts: Date.now(),
      date: new Date().toISOString().slice(0,10),
      // Données CNI
      type_piece: cniData.type_piece || 'INCONNU',
      nom: cniData.nom || '',
      prenoms: cniData.prenoms || '',
      date_naissance: cniData.date_naissance || '',
      lieu_naissance: cniData.lieu_naissance || '',
      numero_piece: cniData.numero_piece || '',
      reference: cniData.reference || '',
      date_expiration: cniData.date_expiration || '',
      sexe: cniData.sexe || '',
      nationalite: cniData.nationalite || '',
      // Données transaction liée
      txn_type: txnType,
      txn_montant: txnMontant,
      num_client: cniData.num_client || '',
      confiance_ocr: cniData.confiance || 'basse',
      engine_ocr: cniData._engine || 'Tesseract',
    };
    list.unshift(entry);
    save(list);
    return entry;
  }

  // Supprimer une entrée
  function remove(id) {
    save(getAll().filter(e => e.id !== id));
  }

  // Filtrer
  function filter({ dateFrom, dateTo, type, search, txnType } = {}) {
    let list = getAll();
    if (dateFrom) list = list.filter(e => e.date >= dateFrom);
    if (dateTo)   list = list.filter(e => e.date <= dateTo);
    if (type && type !== 'TOUS') list = list.filter(e => e.type_piece === type);
    if (txnType && txnType !== 'TOUS') list = list.filter(e => e.txn_type === txnType);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(e =>
        e.nom.toLowerCase().includes(q) ||
        e.prenoms.toLowerCase().includes(q) ||
        e.numero_piece.toLowerCase().includes(q) ||
        e.num_client.toLowerCase().includes(q)
      );
    }
    return list;
  }

  // Stats rapides pour une période
  function stats(dateFrom, dateTo) {
    const list = filter({ dateFrom, dateTo });
    return {
      total: list.length,
      parType: list.reduce((acc, e) => { acc[e.type_piece] = (acc[e.type_piece]||0)+1; return acc; }, {}),
      retraits: list.filter(e => e.txn_type === 'retrait').length,
      depots: list.filter(e => e.txn_type === 'depot').length,
      volumeTotal: list.reduce((s, e) => s + (e.txn_montant||0), 0),
    };
  }

  // Export CSV
  function exportCSV(filters = {}) {
    const list = filter(filters);
    const rows = [
      ['Date','Heure','Nom','Prénoms','Type pièce','N° pièce','Date naissance','Lieu naissance','Expiration','Sexe','N° OM client','Transaction','Montant (F)','Confiance OCR'],
      ...list.map(e => {
        const d = new Date(e.ts);
        return [
          d.toLocaleDateString('fr-FR'), d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}),
          e.nom, e.prenoms, e.type_piece, e.numero_piece,
          e.date_naissance, e.lieu_naissance, e.date_expiration, e.sexe,
          e.num_client, e.txn_type||'scan seul', e.txn_montant||0, e.confiance_ocr
        ];
      })
    ];
    const csv = rows.map(r => r.map(v => `"${String(v||'').replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cni-historique-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),5000);
  }

  return { add, remove, filter, stats, exportCSV, getAll };
})();
