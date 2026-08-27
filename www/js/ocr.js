/**
 * ocr.js — Scan CNI multi-moteur GRATUIT
 * Moteurs : Tesseract.js (local) → Gemini → Groq → OpenRouter → Anthropic
 * Fallback caméra : si getUserMedia bloqué → input file natif Android
 */
const OCR = (() => {
  let stream = null;
  let videoEl = null;
  let canvasEl = null;

  const PROMPT = `Tu es un OCR spécialisé pièces d'identité Burkina Faso (Orange Money).
Pièces acceptées : CNIB, Passeport, Carte Consulaire, Carte Militaire.
Réponds UNIQUEMENT en JSON valide, sans markdown :
{"type_piece":"CNIB|PASSEPORT|CARTE_CONSULAIRE|CARTE_MILITAIRE|INCONNU","nom":"","prenoms":"","date_naissance":"","lieu_naissance":"","numero_piece":"","reference":"","date_expiration":"","sexe":"","nationalite":"","confiance":"haute|moyenne|basse"}
Règles: champ vide si illisible, ne jamais inventer.`;

  // ══ CAMÉRA — 6 tentatives progressives ══
  async function initCamera(videoElement, canvasElement) {
    videoEl = videoElement;
    canvasEl = canvasElement;
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }

    if (!navigator.mediaDevices?.getUserMedia) {
      return { ok: false, reason: 'API caméra indisponible. Utilisez Chrome ou compilez l\'APK.', useFileFallback: true };
    }

    const attempts = [
      { video: { facingMode: { exact: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } },
      { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } } },
      { video: { facingMode: 'environment' } },
      { video: true },
      { video: { width: { min: 320 }, height: { min: 240 } } },
      { video: { width: 640, height: 480 } },
    ];

    let lastErr = null;
    for (const c of attempts) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(c);
        videoEl.srcObject = stream;
        videoEl.setAttribute('playsinline', 'true');
        videoEl.setAttribute('autoplay', 'true');
        videoEl.muted = true;
        await new Promise((res, rej) => {
          videoEl.onloadedmetadata = res;
          videoEl.onerror = rej;
          setTimeout(res, 3000);
        });
        await videoEl.play().catch(() => {});
        return { ok: true };
      } catch (e) { lastErr = e; }
    }

    // Analyse erreur → message clair + fallback
    let reason = 'Caméra inaccessible.';
    let useFileFallback = false;

    if (lastErr) {
      const n = lastErr.name;
      if (n === 'NotAllowedError' || n === 'PermissionDeniedError') {
        reason = 'Permission caméra refusée.\n\n→ Paramètres › Apps › Chrome › Autorisations › Caméra → Autoriser\n\nOu utilisez le bouton "Choisir une photo" ci-dessous.';
        useFileFallback = true;
      } else if (n === 'NotFoundError' || n === 'DevicesNotFoundError') {
        reason = 'Aucune caméra détectée.';
        useFileFallback = true;
      } else if (n === 'NotReadableError' || n === 'TrackStartError') {
        reason = 'Caméra occupée par une autre app. Fermez-la et réessayez.';
        useFileFallback = true;
      } else if (location.protocol === 'http:' && !location.hostname.includes('localhost')) {
        reason = 'HTTPS requis pour la caméra.\n\n→ Compilez l\'APK Android (voir COMPILATION.md)\nOu utilisez "Choisir une photo".';
        useFileFallback = true;
      } else {
        reason = `Erreur: ${lastErr.message}\n\nUtilisez "Choisir une photo".`;
        useFileFallback = true;
      }
    }
    return { ok: false, reason, useFileFallback };
  }

  function stopCamera() {
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  }

  function captureFrame() {
    const ctx = canvasEl.getContext('2d');
    canvasEl.width = videoEl.videoWidth || 640;
    canvasEl.height = videoEl.videoHeight || 480;
    ctx.drawImage(videoEl, 0, 0);
    return {
      base64: canvasEl.toDataURL('image/jpeg', 0.85).split(',')[1],
      dataUrl: canvasEl.toDataURL('image/jpeg', 0.85)
    };
  }

  // Analyser une image depuis un File (fallback)
  async function analyzeFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async e => {
        const dataUrl = e.target.result;
        const base64 = dataUrl.split(',')[1];
        try { resolve(await runAllEngines(base64, dataUrl)); }
        catch (err) { reject(err); }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function captureAndAnalyze() {
    const { base64, dataUrl } = captureFrame();
    return runAllEngines(base64, dataUrl);
  }

  // ══ ORCHESTRATEUR ══
  async function runAllEngines(base64, dataUrl) {
    const cfg = window.APP_CONFIG || {};
    const engines = [
      { name: 'Tesseract (local)', fn: () => runTesseract(dataUrl) },
    ];
    if (cfg.GEMINI_KEY)      engines.push({ name: 'Gemini Flash',  fn: () => runGemini(base64, cfg.GEMINI_KEY) });
    if (cfg.GROQ_KEY)        engines.push({ name: 'Groq Vision',   fn: () => runGroq(base64, cfg.GROQ_KEY) });
    if (cfg.OPENROUTER_KEY)  engines.push({ name: 'OpenRouter',    fn: () => runOpenRouter(base64, cfg.OPENROUTER_KEY) });
    if (cfg.ANTHROPIC_KEY)   engines.push({ name: 'Anthropic',     fn: () => runAnthropic(base64, cfg.ANTHROPIC_KEY) });

    let bestResult = null;
    for (const eng of engines) {
      try {
        setScanStatus(`🔍 ${eng.name}…`);
        const r = await eng.fn();
        if (!r) continue;
        r._engine = eng.name;
        // Si confiance haute ou numéro trouvé → retourner immédiatement
        if (r.confiance === 'haute' || (r.numero_piece && r.nom)) return r;
        // Sinon garder comme meilleur résultat et essayer suivant
        if (!bestResult || scoreResult(r) > scoreResult(bestResult)) bestResult = r;
      } catch (e) {
        console.warn(`[OCR] ${eng.name}:`, e.message);
      }
    }
    if (bestResult) return bestResult;
    throw new Error('Aucun moteur n\'a pu lire la pièce. Réessayez avec plus de lumière.');
  }

  function scoreResult(r) {
    let s = 0;
    if (r.type_piece !== 'INCONNU') s += 3;
    if (r.numero_piece) s += 3;
    if (r.nom) s += 2;
    if (r.date_naissance) s += 2;
    if (r.confiance === 'haute') s += 2;
    if (r.confiance === 'moyenne') s += 1;
    return s;
  }

  // ══ MOTEUR 1 : Tesseract.js (offline) ══
  async function runTesseract(dataUrl) {
    if (typeof Tesseract === 'undefined') throw new Error('Tesseract non chargé');
    const res = await Tesseract.recognize(dataUrl, 'fra+eng', {
      logger: m => { if (m.status === 'recognizing text') setScanStatus(`Tesseract ${Math.round(m.progress * 100)}%`); }
    });
    return parseText(res.data.text);
  }

  function parseText(text) {
    const up = text.toUpperCase();
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    let type_piece = 'INCONNU';
    if (up.includes('CNIB') || up.includes('CARTE NATIONALE') || up.includes('BURKINABE') || up.includes('BURKINA')) type_piece = 'CNIB';
    else if (up.includes('PASSEPORT') || up.includes('PASSPORT')) type_piece = 'PASSEPORT';
    else if (up.includes('CONSULAIRE')) type_piece = 'CARTE_CONSULAIRE';
    else if (up.includes('MILITAIRE') || up.includes('FORCES ARMEES') || up.includes('ARMEE')) type_piece = 'CARTE_MILITAIRE';

    const numPatterns = [/\b(B\d{7,10})\b/, /\b(BF\s?\d{6,10})\b/, /\b([A-Z]{2}\d{6,9})\b/, /N[°o]?\s*:?\s*([A-Z0-9]{6,12})/i];
    let numero_piece = '';
    for (const p of numPatterns) { const m = text.match(p); if (m) { numero_piece = m[1].replace(/\s/g,''); break; } }

    const dateP = [
      /(?:né[e]?|naissance|dob|birth)[^\d]*(\d{1,2}[\s\/\-\.]\d{1,2}[\s\/\-\.]\d{2,4})/i,
      /(\d{2}[\/-]\d{2}[\/-]\d{4})/
    ];
    let date_naissance = '';
    for (const p of dateP) { const m = text.match(p); if (m) { date_naissance = m[1]; break; } }

    const expP = [/(?:expir|valid(?:ité)?|expire)[^\d]*(\d{1,2}[\s\/\-\.]\d{1,2}[\s\/\-\.]\d{2,4})/i];
    let date_expiration = '';
    for (const p of expP) { const m = text.match(p); if (m) { date_expiration = m[1]; break; } }

    let nom = '', prenoms = '';
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (/^NOM\s*[:\-]/i.test(l)) nom = l.replace(/^NOM\s*[:\-]\s*/i, '').trim();
      if (/^PR[ÉE]NOMS?\s*[:\-]/i.test(l)) prenoms = l.replace(/^PR[ÉE]NOMS?\s*[:\-]\s*/i, '').trim();
    }
    // Heuristique : si pas trouvé, chercher lignes en majuscules
    if (!nom) {
      const majLines = lines.filter(l => /^[A-ZÀÂÄÉÈÊËÎÏÔÙÛÜ\s\-]{4,}$/.test(l) && l.length > 3 && l.length < 40);
      if (majLines.length > 0) nom = majLines[0];
      if (majLines.length > 1) prenoms = majLines[1];
    }

    const sexe = /\bM\b|\bMALE\b|\bMASCULIN\b/i.test(up) ? 'M' : /\bF\b|\bFEMALE\b|\bF[EÉ]MININ\b/i.test(up) ? 'F' : '';
    const lieuM = text.match(/(?:né[e]?\s+[àaÀ]\s+|lieu\s+de\s+naissance\s*:?\s*)([A-ZÀ-Ü][a-zA-ZÀ-ü\s\-]{2,25})/i);
    const lieu_naissance = lieuM ? lieuM[1].trim() : '';

    const confiance = (numero_piece && nom && date_naissance) ? 'haute' :
                      (numero_piece || (nom && date_naissance)) ? 'moyenne' : 'basse';

    return { type_piece, nom, prenoms, date_naissance, lieu_naissance, numero_piece, reference: type_piece + ' – Burkina Faso', date_expiration, sexe, nationalite: 'Burkinabè', confiance };
  }

  // ══ MOTEUR 2 : Gemini Flash ══
  async function runGemini(b64, key) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ inlineData: { mimeType: 'image/jpeg', data: b64 } }, { text: PROMPT }] }], generationConfig: { maxOutputTokens: 500, temperature: 0 } })
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message || 'Gemini error'); }
    const d = await res.json();
    return safeJSON(d.candidates?.[0]?.content?.parts?.[0]?.text);
  }

  // ══ MOTEUR 3 : Groq ══
  async function runGroq(b64, key) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ model: 'llama-3.2-11b-vision-preview', max_tokens: 500, messages: [{ role: 'user', content: [{ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}` } }, { type: 'text', text: PROMPT }] }] })
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message || 'Groq error'); }
    const d = await res.json();
    return safeJSON(d.choices?.[0]?.message?.content);
  }

  // ══ MOTEUR 4 : OpenRouter ══
  async function runOpenRouter(b64, key) {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}`, 'HTTP-Referer': 'https://wendlamita.bf', 'X-Title': 'Wend-Lamita' },
      body: JSON.stringify({ model: 'google/gemini-2.0-flash-exp:free', max_tokens: 500, messages: [{ role: 'user', content: [{ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}` } }, { type: 'text', text: PROMPT }] }] })
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message || 'OpenRouter error'); }
    const d = await res.json();
    return safeJSON(d.choices?.[0]?.message?.content);
  }

  // ══ MOTEUR 5 : Anthropic ══
  async function runAnthropic(b64, key) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 500, messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } }, { type: 'text', text: PROMPT }] }] })
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message || 'Anthropic error'); }
    const d = await res.json();
    return safeJSON(d.content?.[0]?.text);
  }

  function safeJSON(raw) {
    if (!raw) return null;
    try { return JSON.parse(raw.replace(/```json|```/g, '').trim()); } catch { return null; }
  }

  function setScanStatus(msg) {
    const el = document.getElementById('scanStatus');
    if (el) el.textContent = msg;
  }

  return { initCamera, stopCamera, captureAndAnalyze, analyzeFile };
})();
