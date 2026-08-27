/**
 * auth-ui.js — Interface login, inscription, abonnements
 */
const AuthUI = (() => {

  // ── Afficher l'écran auth ──
  function show(mode = 'login') {
    document.getElementById('authScreen').style.display = 'flex';
    document.getElementById('appRoot').style.display = 'none';
    renderAuth(mode);
  }

  function hide() {
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('appRoot').style.display = 'block';
  }

  function renderAuth(mode) {
    const el = document.getElementById('authScreen');
    el.innerHTML = mode === 'login' ? loginHTML() : registerHTML();
  }

  function loginHTML() {
    return `
    <div class="auth-box">
      <div class="auth-logo">
        <div class="auth-logo-icon">WL</div>
        <div class="auth-logo-name">Wend-Lamita</div>
        <div class="auth-logo-sub">Gestion commerce · Bobo-Dioulasso</div>
      </div>
      <div class="auth-form">
        <div class="auth-title">Connexion</div>
        <div class="field">
          <div class="flabel">Nom de la boutique</div>
          <input type="text" class="finput" id="loginShop" placeholder="Ex: Wend-Lamita" autocomplete="username" style="font-size:16px">
        </div>
        <div class="field">
          <div class="flabel">Mot de passe</div>
          <div style="position:relative">
            <input type="password" class="finput" id="loginPass" placeholder="••••••••" autocomplete="current-password" style="font-size:16px;padding-right:44px" onkeydown="if(event.key==='Enter')AuthUI.doLogin()">
            <button onclick="AuthUI.togglePass('loginPass')" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;font-size:18px;cursor:pointer;color:var(--muted)">👁</button>
          </div>
        </div>
        <div id="loginErr" style="color:var(--red);font-size:12px;margin-bottom:8px;display:none"></div>
        <button class="btn-primary-auth" onclick="AuthUI.doLogin()">Se connecter</button>
        <div class="auth-sep">ou</div>
        <button class="btn-secondary-auth" onclick="AuthUI.show('register')">Créer un compte</button>
        <button class="btn-demo-auth" onclick="AuthUI.loginDemo()">🎮 Essayer sans compte</button>
      </div>
    </div>`;
  }

  function registerHTML() {
    return `
    <div class="auth-box">
      <div class="auth-logo">
        <div class="auth-logo-icon">WL</div>
        <div class="auth-logo-name">Wend-Lamita</div>
        <div class="auth-logo-sub">Créez votre espace boutique</div>
      </div>
      <div class="auth-form">
        <div class="auth-title">Nouveau compte</div>
        <div class="field">
          <div class="flabel">Nom de votre boutique *</div>
          <input type="text" class="finput" id="regShop" placeholder="Ex: Épicerie Koné" style="font-size:16px">
        </div>
        <div class="field">
          <div class="flabel">Ville</div>
          <input type="text" class="finput" id="regCity" placeholder="Bobo-Dioulasso" style="font-size:16px">
        </div>
        <div class="field">
          <div class="flabel">Mot de passe *</div>
          <div style="position:relative">
            <input type="password" class="finput" id="regPass" placeholder="6 caractères minimum" style="font-size:16px;padding-right:44px">
            <button onclick="AuthUI.togglePass('regPass')" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;font-size:18px;cursor:pointer;color:var(--muted)">👁</button>
          </div>
        </div>
        <div class="field">
          <div class="flabel">Confirmer le mot de passe *</div>
          <input type="password" class="finput" id="regPass2" placeholder="••••••••" style="font-size:16px" onkeydown="if(event.key==='Enter')AuthUI.doRegister()">
        </div>
        <div id="regErr" style="color:var(--red);font-size:12px;margin-bottom:8px;display:none"></div>
        <button class="btn-primary-auth" onclick="AuthUI.doRegister()">Créer mon compte</button>
        <div class="auth-sep">déjà inscrit ?</div>
        <button class="btn-secondary-auth" onclick="AuthUI.show('login')">Se connecter</button>
      </div>
    </div>`;
  }

  // ── Actions ──
  function doLogin() {
    const shop = document.getElementById('loginShop')?.value.trim();
    const pass = document.getElementById('loginPass')?.value;
    const errEl = document.getElementById('loginErr');
    if (!shop || !pass) { showErr(errEl, 'Remplissez tous les champs'); return; }
    const res = Auth.login(shop, pass);
    if (!res.ok) { showErr(errEl, res.error); return; }
    hide();
    initApp();
  }

  function doRegister() {
    const shop  = document.getElementById('regShop')?.value.trim();
    const city  = document.getElementById('regCity')?.value.trim();
    const pass  = document.getElementById('regPass')?.value;
    const pass2 = document.getElementById('regPass2')?.value;
    const errEl = document.getElementById('regErr');
    if (!shop || !pass) { showErr(errEl, 'Nom et mot de passe requis'); return; }
    if (pass.length < 6) { showErr(errEl, 'Mot de passe trop court (6 min)'); return; }
    if (pass !== pass2) { showErr(errEl, 'Mots de passe différents'); return; }
    const res = Auth.register(shop, pass);
    if (!res.ok) { showErr(errEl, res.error); return; }
    // Stocker la ville si renseignée
    if (city && window.APP_CONFIG) window.APP_CONFIG.APP_SHOP = city;
    hide();
    initApp();
    // Montrer les plans après inscription
    setTimeout(() => showPlans(), 800);
  }

  function loginDemo() {
    Auth.register('Boutique Démo ' + Date.now(), 'demo1234');
    hide();
    initApp();
  }

  function togglePass(id) {
    const el = document.getElementById(id);
    el.type = el.type === 'password' ? 'text' : 'password';
  }

  function showErr(el, msg) {
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
    setTimeout(() => el.style.display = 'none', 4000);
  }

  // ── Modal abonnements ──
  function showPlans() {
    const overlay = document.getElementById('plansOverlay');
    overlay.classList.add('open');
    renderPlans();
  }

  function hidePlans() {
    document.getElementById('plansOverlay').classList.remove('open');
  }

  function renderPlans() {
    const current = Auth.currentPlan();
    const plans = Auth.PLANS;
    const days = Auth.daysLeft();
    const el = document.getElementById('plansContent');

    el.innerHTML = `
      <div class="mhandle"></div>
      <h2 style="margin-bottom:4px">Plans & Abonnements</h2>
      ${days !== null ? `<div style="font-size:12px;color:var(--muted);margin-bottom:16px">Plan actuel : <strong style="color:var(--gold)">${current.label}</strong> · ${days} jour${days > 1 ? 's' : ''} restant${days > 1 ? 's' : ''}</div>` : `<div style="font-size:12px;color:var(--muted);margin-bottom:16px">Plan actuel : <strong style="color:var(--gold)">${current.label}</strong></div>`}

      ${Object.values(plans).map(p => planCardHTML(p, current.id === p.id)).join('')}

      ${current.id !== 'gratuit' ? '' : `
      <div class="card" style="margin-top:4px;border-color:var(--gold)">
        <div class="card-title" style="font-size:13px">💳 Payer via Orange Money</div>
        <div style="font-size:12px;color:var(--muted);margin-bottom:12px;line-height:1.6">
          Envoyez le montant au <strong style="color:var(--text)">+226 XX XX XX XX</strong><br>
          avec la note : <strong style="color:var(--gold)">WL-PRO</strong> ou <strong style="color:var(--gold)">WL-BUSINESS</strong><br>
          puis entrez la référence de transaction ci-dessous :
        </div>
        <div class="field">
          <div class="flabel">Référence transaction OM</div>
          <input type="text" class="finput" id="omRefPlan" placeholder="Ex: TXN20240825XXXXX">
        </div>
        <div class="field-grid">
          <button onclick="AuthUI.activatePlan('pro')"   style="background:var(--gold);color:#0F1923;border:none;border-radius:var(--rs);padding:12px;font-weight:800;font-size:13px;cursor:pointer">Activer Pro<br><span style="font-size:10px;font-weight:400">500 F/mois</span></button>
          <button onclick="AuthUI.activatePlan('business')" style="background:var(--green);color:#fff;border:none;border-radius:var(--rs);padding:12px;font-weight:800;font-size:13px;cursor:pointer">Activer Business<br><span style="font-size:10px;font-weight:400">1500 F/mois</span></button>
        </div>
      </div>`}

      <button class="btn-cancel" onclick="AuthUI.hidePlans()">Fermer</button>
    `;
  }

  function planCardHTML(plan, isCurrent) {
    const emoji = { gratuit: '🆓', pro: '⭐', business: '🚀' }[plan.id] || '📦';
    return `
      <div class="card" style="margin-bottom:10px;border-color:${isCurrent ? plan.color : 'var(--border)'};${isCurrent ? 'background:rgba(0,0,0,.2)' : ''}">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:22px">${emoji}</span>
            <div>
              <div style="font-size:15px;font-weight:800;color:${plan.color}">${plan.label}</div>
              <div style="font-size:11px;color:var(--muted)">${plan.price === 0 ? 'Gratuit' : plan.price + ' F CFA / mois'}</div>
            </div>
          </div>
          ${isCurrent ? `<div style="background:${plan.color};color:#0F1923;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:800">Actif</div>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;gap:4px">
          ${plan.features.map(f => `<div style="font-size:12px;color:var(--muted);display:flex;align-items:center;gap:6px"><span style="color:${plan.color}">✓</span>${f}</div>`).join('')}
        </div>
      </div>`;
  }

  function activatePlan(planId) {
    const ref = document.getElementById('omRefPlan')?.value.trim();
    if (!ref) { alert('Entrez la référence de votre transaction Orange Money'); return; }
    const res = Auth.activatePlan(planId, 30, ref);
    if (res.ok) {
      hidePlans();
      renderPlanBadge();
      toast(`✅ Plan ${Auth.getPlanDetails(planId).label} activé !`);
    }
  }

  // ── Badge plan dans l'app ──
  function renderPlanBadge() {
    const plan = Auth.currentPlan();
    const user = Auth.getUser();
    const el = document.getElementById('planBadge');
    if (!el) return;
    const days = Auth.daysLeft();
    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:6px;cursor:pointer" onclick="AuthUI.showPlans()">
        <div style="background:${plan.color};color:#0F1923;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:800">${plan.label.toUpperCase()}</div>
        ${days !== null ? `<div style="font-size:10px;color:var(--muted)">${days}j</div>` : ''}
      </div>`;
    // Afficher le nom boutique
    const shopEl = document.getElementById('shopSub');
    if (shopEl && user) shopEl.textContent = user.shop;
  }

  return { show, hide, doLogin, doRegister, loginDemo, togglePass, showPlans, hidePlans, activatePlan, renderPlanBadge };
})();
