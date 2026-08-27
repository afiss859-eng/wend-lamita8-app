/**
 * auth.js — Login local + système abonnements
 * Stockage : localStorage (pas de serveur requis)
 * Plans : Gratuit | Pro (500 F/mois) | Business (1500 F/mois)
 */
const Auth = (() => {
  const KEY_USER  = 'wl_user';
  const KEY_PLAN  = 'wl_plan';
  const KEY_USERS = 'wl_users'; // multi-comptes

  // ── Lire ──
  function getUser()  { return JSON.parse(localStorage.getItem(KEY_USER)  || 'null'); }
  function getPlan()  { return JSON.parse(localStorage.getItem(KEY_PLAN)  || 'null'); }
  function getUsers() { return JSON.parse(localStorage.getItem(KEY_USERS) || '{}'); }

  function isLoggedIn() { return !!getUser(); }

  // ── Plans disponibles ──
  const PLANS = {
    gratuit: {
      id: 'gratuit', label: 'Gratuit', price: 0, color: '#8A9BAD',
      maxProducts: 20, maxOM: 50, ocr: true, stats: false, multiUser: false,
      features: ['20 produits max', '50 transactions OM/mois', 'OCR scan pièces', 'Stock basique']
    },
    pro: {
      id: 'pro', label: 'Pro', price: 500, color: '#F5A623',
      maxProducts: 500, maxOM: -1, ocr: true, stats: true, multiUser: false,
      features: ['500 produits', 'Transactions illimitées', 'OCR avancé', 'Statistiques complètes', 'Export données']
    },
    business: {
      id: 'business', label: 'Business', price: 1500, color: '#2ECC71',
      maxProducts: -1, maxOM: -1, ocr: true, stats: true, multiUser: true,
      features: ['Produits illimités', 'Multi-utilisateurs (5)', 'OCR prioritaire', 'Rapports avancés', 'Support prioritaire', 'Sauvegarde cloud']
    }
  };

  function getPlanDetails(planId) { return PLANS[planId] || PLANS.gratuit; }
  function currentPlan() {
    const p = getPlan();
    if (!p) return PLANS.gratuit;
    // Vérifier expiration
    if (p.expiresAt && Date.now() > p.expiresAt) {
      localStorage.setItem(KEY_PLAN, JSON.stringify({ ...p, id: 'gratuit', expiresAt: null }));
      return PLANS.gratuit;
    }
    return PLANS[p.id] || PLANS.gratuit;
  }

  // ── Vérifications limites ──
  function canAddProduct(currentCount) {
    const plan = currentPlan();
    return plan.maxProducts === -1 || currentCount < plan.maxProducts;
  }
  function canDoOM(monthlyCount) {
    const plan = currentPlan();
    return plan.maxOM === -1 || monthlyCount < plan.maxOM;
  }
  function hasStats() { return currentPlan().stats; }

  // ── Inscription ──
  function register(shop, password) {
    if (!shop || !password) return { ok: false, error: 'Champs requis' };
    const users = getUsers();
    const id = shop.toLowerCase().replace(/\s+/g, '_');
    if (users[id]) return { ok: false, error: 'Ce nom de boutique existe déjà' };

    const user = { id, shop, createdAt: Date.now() };
    users[id] = { ...user, passwordHash: simpleHash(password) };
    localStorage.setItem(KEY_USERS, JSON.stringify(users));
    localStorage.setItem(KEY_USER, JSON.stringify(user));
    localStorage.setItem(KEY_PLAN, JSON.stringify({ id: 'gratuit', activatedAt: Date.now() }));
    return { ok: true, user };
  }

  // ── Connexion ──
  function login(shop, password) {
    const users = getUsers();
    const id = shop.toLowerCase().replace(/\s+/g, '_');
    const stored = users[id];
    if (!stored) return { ok: false, error: 'Boutique introuvable' };
    if (stored.passwordHash !== simpleHash(password)) return { ok: false, error: 'Mot de passe incorrect' };
    const user = { id: stored.id, shop: stored.shop, createdAt: stored.createdAt };
    localStorage.setItem(KEY_USER, JSON.stringify(user));
    return { ok: true, user };
  }

  function logout() {
    localStorage.removeItem(KEY_USER);
  }

  // ── Activer un plan (après paiement OM) ──
  function activatePlan(planId, durationDays = 30, refOM = '') {
    const plan = PLANS[planId];
    if (!plan) return { ok: false, error: 'Plan inconnu' };
    const data = {
      id: planId,
      activatedAt: Date.now(),
      expiresAt: Date.now() + durationDays * 86400000,
      refOM,
      durationDays
    };
    localStorage.setItem(KEY_PLAN, JSON.stringify(data));
    return { ok: true, plan: data };
  }

  // Hash simple (pas cryptographique — stockage local seulement)
  function simpleHash(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h) + str.charCodeAt(i);
    return (h >>> 0).toString(36);
  }

  function daysLeft() {
    const p = getPlan();
    if (!p?.expiresAt) return null;
    const d = Math.ceil((p.expiresAt - Date.now()) / 86400000);
    return Math.max(0, d);
  }

  return { isLoggedIn, getUser, register, login, logout, currentPlan, getPlanDetails, PLANS, canAddProduct, canDoOM, hasStats, activatePlan, daysLeft };
})();
