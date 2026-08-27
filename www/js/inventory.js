/**
 * inventory.js — Gestion du stock Wend-Lamita
 */
const Inventory = (() => {
  const KEY = 'wl_products';
  const SALES_KEY = 'wl_sales';

  let products = JSON.parse(localStorage.getItem(KEY) || '[]');
  let salesLog = JSON.parse(localStorage.getItem(SALES_KEY) || '[]');

  function save() { localStorage.setItem(KEY, JSON.stringify(products)); }
  function saveSales() { localStorage.setItem(SALES_KEY, JSON.stringify(salesLog)); }

  function uid() { return Math.random().toString(36).slice(2,9) + Date.now().toString(36); }

  function addProduct(data) {
    const p = { id: uid(), ...data, createdAt: Date.now() };
    products.push(p); save(); return p;
  }

  function updateProduct(id, data) {
    const i = products.findIndex(p => p.id === id);
    if (i < 0) return null;
    products[i] = { ...products[i], ...data, updatedAt: Date.now() };
    save(); return products[i];
  }

  function deleteProduct(id) {
    products = products.filter(p => p.id !== id); save();
  }

  function sell(id, qty = 1) {
    const p = products.find(x => x.id === id);
    if (!p || p.qty < qty) return false;
    p.qty -= qty;
    salesLog.push({ id, nom: p.nom, cat: p.cat, qty, prix: p.prix, ts: Date.now() });
    save(); saveSales(); return true;
  }

  function restock(id, qty) {
    const p = products.find(x => x.id === id);
    if (!p) return false;
    p.qty += qty; save(); return true;
  }

  function getAll() { return products; }
  function getSales(since = 0) { return salesLog.filter(s => s.ts >= since); }
  function getLowStock() { return products.filter(p => p.qty <= p.seuil); }

  function stats(since = 0) {
    const sales = getSales(since);
    return {
      ca: sales.reduce((s, x) => s + x.prix * x.qty, 0),
      articles: sales.reduce((s, x) => s + x.qty, 0),
      transactions: sales.length,
      topProducts: Object.entries(
        sales.reduce((acc, s) => { acc[s.nom] = (acc[s.nom] || 0) + s.qty; return acc; }, {})
      ).sort((a, b) => b[1] - a[1]).slice(0, 5)
    };
  }

  return { addProduct, updateProduct, deleteProduct, sell, restock, getAll, getSales, getLowStock, stats };
})();
