# Comment ouvrir l'app sur Android sans compiler

## Méthode 1 — Via Termux (recommandée, caméra temps réel)
```bash
pkg install nodejs python -y
cd /sdcard/Download
unzip wend-lamita-app.zip
cd wend-lamita-app
npm install
npm run build
npx serve www -p 8080
```
→ Ouvrez Chrome : **http://localhost:8080**
→ La caméra temps réel fonctionne sur localhost ✓

## Méthode 2 — Ouverture directe (file://)
Ouvrez `www/index.html` directement dans Chrome.
→ La caméra temps réel ne fonctionne PAS (restriction Chrome)
→ **MAIS** : le bouton "Photographier" ouvre l'appareil photo natif Android ✓
→ L'OCR Tesseract analyse la photo automatiquement ✓
→ Tout le reste fonctionne normalement ✓

## Résumé
| Méthode | Caméra temps réel | Photo native | OCR |
|---|---|---|---|
| localhost (Termux) | ✅ | ✅ | ✅ |
| file:// (direct) | ❌ | ✅ | ✅ |
| APK compilé | ✅ | ✅ | ✅ |
