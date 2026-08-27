/**
 * export.js — Export reçu OM, rapport stock, sauvegarde/restauration
 */
const Export = (() => {

  // ── Reçu Orange Money (impression / partage) ──
  function printOMReceipt(txn) {
    const now = new Date(txn.ts).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
    const typeLabel = txn.type === 'retrait' ? 'RETRAIT' : 'DÉPÔT';
    const sign = txn.type === 'retrait' ? '−' : '+';

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Reçu OM — ${txn.nom}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Courier New', monospace; background:#fff; color:#000; padding:10px; font-size:13px; }
  .receipt { max-width:320px; margin:0 auto; border:2px dashed #333; padding:16px; }
  .header { text-align:center; border-bottom:2px solid #000; padding-bottom:10px; margin-bottom:10px; }
  .header .logo { font-size:20px; font-weight:900; letter-spacing:2px; }
  .header .sub { font-size:11px; color:#555; margin-top:2px; }
  .om-logo { font-size:24px; margin:6px 0; }
  .type-badge { background:#FF6600; color:#fff; padding:3px 12px; border-radius:4px; font-size:12px; font-weight:900; letter-spacing:1px; display:inline-block; margin:4px 0; }
  .row { display:flex; justify-content:space-between; padding:5px 0; border-bottom:1px dotted #ccc; }
  .row:last-child { border-bottom:none; }
  .label { color:#555; font-size:12px; }
  .value { font-weight:700; font-size:12px; text-align:right; max-width:60%; word-break:break-all; }
  .amount-section { text-align:center; padding:12px 0; border-top:2px solid #000; border-bottom:2px solid #000; margin:10px 0; }
  .amount-label { font-size:11px; color:#555; }
  .amount-value { font-size:28px; font-weight:900; color:${txn.type==='retrait'?'#c0392b':'#27ae60'}; }
  .footer { text-align:center; font-size:10px; color:#777; margin-top:10px; }
  .qr-placeholder { width:60px;height:60px;border:1px solid #ccc;margin:8px auto;display:flex;align-items:center;justify-content:center;font-size:9px;color:#aaa;text-align:center }
  @media print {
    body { padding:0; }
    .no-print { display:none; }
    .receipt { border:none; max-width:100%; }
  }
</style>
</head>
<body>
<div class="receipt">
  <div class="header">
    <div class="logo">WEND-LAMITA</div>
    <div class="sub">Agent Orange Money · Bobo-Dioulasso</div>
    <div class="om-logo">🟠</div>
    <div class="type-badge">${typeLabel}</div>
  </div>

  <div class="amount-section">
    <div class="amount-label">Montant</div>
    <div class="amount-value">${sign}${(txn.montant||0).toLocaleString('fr-FR')} F</div>
  </div>

  <div class="row"><span class="label">Date & heure</span><span class="value">${now}</span></div>
  <div class="row"><span class="label">Client</span><span class="value">${txn.nom||'—'}</span></div>
  <div class="row"><span class="label">Type pièce</span><span class="value">${txn.type_piece||'—'}</span></div>
  <div class="row"><span class="label">N° pièce</span><span class="value">${txn.num_piece||'—'}</span></div>
  <div class="row"><span class="label">N° OM client</span><span class="value">${txn.num_client||'—'}</span></div>
  ${txn.num_dest ? `<div class="row"><span class="label">N° destinataire</span><span class="value">${txn.num_dest}</span></div>` : ''}
  <div class="row"><span class="label">Solde avant</span><span class="value">${(txn.solde_avant||0).toLocaleString('fr-FR')} F</span></div>
  <div class="row"><span class="label">Solde après</span><span class="value">${(txn.solde_apres||0).toLocaleString('fr-FR')} F</span></div>
  <div class="row"><span class="label">Référence</span><span class="value">${txn.id?.slice(-8).toUpperCase()||'—'}</span></div>

  <div class="qr-placeholder">Ref.<br>${txn.id?.slice(-6).toUpperCase()}</div>

  <div class="footer">
    Ce reçu est généré automatiquement<br>
    par l'application Wend-Lamita.<br>
    Conservez-le comme justificatif.
  </div>
</div>

<div class="no-print" style="text-align:center;margin-top:16px;display:flex;gap:8px;justify-content:center">
  <button onclick="window.print()" style="background:#FF6600;color:#fff;border:none;border-radius:8px;padding:10px 20px;font-size:14px;font-weight:700;cursor:pointer">🖨 Imprimer</button>
  <button onclick="window.close()" style="background:#eee;border:none;border-radius:8px;padding:10px 20px;font-size:14px;cursor:pointer">✕ Fermer</button>
</div>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=380,height=650');
    if (win) {
      win.document.write(html);
      win.document.close();
    } else {
      // Fallback : blob download
      const blob = new Blob([html], { type: 'text/html' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `recu-om-${txn.nom?.replace(/\s+/g,'-')}-${Date.now()}.html`;
      a.click();
    }
  }

  // ── Rapport stock CSV ──
  function exportStockCSV() {
    const prods = Inventory.getAll();
    const rows = [
      ['Nom', 'Catégorie', 'Prix vente (F)', 'Prix achat (F)', 'Quantité', 'Seuil alerte', 'Valeur stock (F)', 'Statut'],
      ...prods.map(p => [
        p.nom, p.cat, p.prix, p.achat||0, p.qty, p.seuil,
        p.qty * p.prix,
        p.qty === 0 ? 'ÉPUISÉ' : p.qty <= p.seuil ? 'BAS' : 'OK'
      ])
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    downloadText(csv, `stock-wend-lamita-${dateSlug()}.csv`, 'text/csv');
  }

  // ── Rapport ventes CSV ──
  function exportSalesCSV(since = 0) {
    const sales = Inventory.getSales(since);
    const rows = [
      ['Date', 'Heure', 'Produit', 'Catégorie', 'Quantité', 'Prix unitaire (F)', 'Total (F)'],
      ...sales.map(s => {
        const d = new Date(s.ts);
        return [
          d.toLocaleDateString('fr-FR'), d.toLocaleTimeString('fr-FR', {hour:'2-digit',minute:'2-digit'}),
          s.nom, s.cat||'', s.qty, s.prix, s.qty * s.prix
        ];
      })
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    downloadText(csv, `ventes-wend-lamita-${dateSlug()}.csv`, 'text/csv');
  }

  // ── Sauvegarde complète JSON ──
  function backupAll() {
    const user = Auth.getUser();
    const backup = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      shop: user?.shop || 'Wend-Lamita',
      products: JSON.parse(localStorage.getItem('wl_products') || '[]'),
      sales: JSON.parse(localStorage.getItem('wl_sales') || '[]'),
      om: JSON.parse(localStorage.getItem('wl_om') || '[]'),
    };
    const json = JSON.stringify(backup, null, 2);
    downloadText(json, `backup-wend-lamita-${dateSlug()}.json`, 'application/json');
    return backup;
  }

  // ── Restauration JSON ──
  function restoreFromFile(file, onSuccess, onError) {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data.version || !data.products) throw new Error('Fichier invalide');
        if (!confirm(`Restaurer ${data.products.length} produits et ${data.sales?.length||0} ventes depuis la sauvegarde du ${new Date(data.exportedAt).toLocaleDateString('fr-FR')} ?\n\nLes données actuelles seront remplacées.`)) return;
        localStorage.setItem('wl_products', JSON.stringify(data.products));
        localStorage.setItem('wl_sales',    JSON.stringify(data.sales || []));
        localStorage.setItem('wl_om',       JSON.stringify(data.om || []));
        onSuccess?.(data);
      } catch(err) {
        onError?.(err.message);
      }
    };
    reader.onerror = () => onError?.('Lecture impossible');
    reader.readAsText(file);
  }

  // ── Helpers ──
  function downloadText(content, filename, mime) {
    const blob = new Blob(['\uFEFF' + content], { type: mime + ';charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  function dateSlug() {
    return new Date().toISOString().slice(0,10);
  }

  return { printOMReceipt, exportStockCSV, exportSalesCSV, backupAll, restoreFromFile };
})();
