/**
 * ai-assistant.js — Assistant IA multi-fournisseur
 * Fournisseurs : HCNSEC → Gemini → Groq → OpenRouter
 * Contexte : stock, ventes, OM, CNI history
 */
const AIAssistant = (() => {
  const KEY_HISTORY = 'wl_ai_history';
  let chatHistory = JSON.parse(localStorage.getItem(KEY_HISTORY) || '[]');

  // Prompt système avec contexte boutique
  function buildSystemPrompt() {
    const user = Auth.getUser();
    const plan = Auth.currentPlan();
    const prods = Inventory.getAll();
    const lowStock = Inventory.getLowStock();
    const today = new Date().toLocaleDateString('fr-FR');
    const salesStats = Inventory.stats(Date.now() - 30 * 86400000);
    const omStats = OM.stats(Date.now() - 30 * 86400000);
    const cniStats = CNIHistory.stats(
      new Date(Date.now() - 30*86400000).toISOString().slice(0,10),
      new Date().toISOString().slice(0,10)
    );

    return `Tu es l'assistant IA de la boutique "${user?.shop || 'Wend-Lamita'}" à Bobo-Dioulasso, Burkina Faso.
Tu aides le commerçant avec : gestion du stock, transactions Orange Money, analyse des ventes, conseils commerciaux.
Tu réponds en français, de façon concise et pratique.

=== DONNÉES ACTUELLES (${today}) ===
Produits en stock : ${prods.length} (${lowStock.length} en stock bas)
Top produits bas : ${lowStock.slice(0,3).map(p=>`${p.nom} (${p.qty} restant)`).join(', ') || 'aucun'}
CA 30 jours : ${salesStats.ca.toLocaleString('fr-FR')} F CFA
Articles vendus (30j) : ${salesStats.articles}
Transactions OM (30j) : ${omStats.total} (${omStats.retraits} retraits, ${omStats.depots} dépôts)
CNI scannées (30j) : ${cniStats.total}
Plan abonnement : ${plan.label}

=== RÈGLES ===
- Si on te demande des données précises, réponds avec les chiffres fournis ci-dessus
- Pour les conseils stock, base-toi sur les produits en stock bas
- Ne jamais inventer de données
- Réponses courtes (3-5 phrases max sauf si analyse demandée)
- Tu peux faire des calculs simples de marge, bénéfice, etc.`;
  }

  // Appel API — cascade fournisseurs
  async function callAI(userMessage) {
    const cfg = window.APP_CONFIG || {};
    const msgs = [
      ...chatHistory.slice(-10).map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: userMessage }
    ];

    const providers = [];
    if (cfg.HCNSEC_KEY)     providers.push({ name: 'HCNSEC',     fn: () => callHCNSEC(msgs, cfg.HCNSEC_KEY) });
    if (cfg.GEMINI_KEY)     providers.push({ name: 'Gemini',     fn: () => callGeminiChat(msgs, cfg.GEMINI_KEY) });
    if (cfg.GROQ_KEY)       providers.push({ name: 'Groq',       fn: () => callGroqChat(msgs, cfg.GROQ_KEY) });
    if (cfg.OPENROUTER_KEY) providers.push({ name: 'OpenRouter', fn: () => callOpenRouterChat(msgs, cfg.OPENROUTER_KEY) });

    if (!providers.length) throw new Error('Aucune clé API configurée. Ajoutez une clé dans ⚙️ Config.');

    let lastErr;
    for (const p of providers) {
      try {
        const reply = await p.fn();
        // Sauvegarder dans l'historique
        chatHistory.push({ role: 'user', content: userMessage, ts: Date.now() });
        chatHistory.push({ role: 'assistant', content: reply, ts: Date.now(), provider: p.name });
        if (chatHistory.length > 100) chatHistory = chatHistory.slice(-100);
        localStorage.setItem(KEY_HISTORY, JSON.stringify(chatHistory));
        return { reply, provider: p.name };
      } catch(e) { lastErr = e; console.warn('[AI]', p.name, e.message); }
    }
    throw lastErr || new Error('Tous les fournisseurs ont échoué');
  }

  // ── HCNSEC (OpenAI-compatible, gratuit ~4000 crédits) ──
  async function callHCNSEC(msgs, key) {
    const res = await fetch('https://api.hcnsec.cn/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 800,
        messages: [{ role: 'system', content: buildSystemPrompt() }, ...msgs]
      })
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message || 'HCNSEC error'); }
    const d = await res.json();
    return d.choices?.[0]?.message?.content || '';
  }

  // ── Gemini Flash (chat) ──
  async function callGeminiChat(msgs, key) {
    const contents = msgs.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: buildSystemPrompt() }] }, contents, generationConfig: { maxOutputTokens: 800 } })
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message); }
    const d = await res.json();
    return d.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  // ── Groq (llama) ──
  async function callGroqChat(msgs, key) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ model: 'llama-3.1-8b-instant', max_tokens: 800, messages: [{ role: 'system', content: buildSystemPrompt() }, ...msgs] })
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message); }
    const d = await res.json();
    return d.choices?.[0]?.message?.content || '';
  }

  // ── OpenRouter ──
  async function callOpenRouterChat(msgs, key) {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}`, 'HTTP-Referer': 'https://wendlamita.bf', 'X-Title': 'Wend-Lamita' },
      body: JSON.stringify({ model: 'google/gemini-2.0-flash-exp:free', max_tokens: 800, messages: [{ role: 'system', content: buildSystemPrompt() }, ...msgs] })
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message); }
    const d = await res.json();
    return d.choices?.[0]?.message?.content || '';
  }

  function clearHistory() { chatHistory = []; localStorage.removeItem(KEY_HISTORY); }
  function getHistory() { return chatHistory; }

  // Suggestions rapides contextuelles
  function getSuggestions() {
    const low = Inventory.getLowStock();
    const suggestions = [
      '📊 Résume mes ventes du mois',
      '💡 Quels produits dois-je réapprovisionner ?',
      '💰 Calcule ma marge bénéficiaire',
      '📈 Comment augmenter mon chiffre d\'affaires ?',
      '🔍 Analyse mes transactions Orange Money',
    ];
    if (low.length) suggestions.unshift(`⚠️ J'ai ${low.length} produit(s) en stock bas, que faire ?`);
    return suggestions.slice(0, 5);
  }

  return { callAI, clearHistory, getHistory, getSuggestions };
})();
