# GUIDE COMPILATION APK — Wend-Lamita

## Sur votre téléphone Android (Termux)

### Étape 1 — Installer Node.js dans Termux
```bash
pkg update && pkg upgrade -y
pkg install nodejs git zip unzip -y
```

### Étape 2 — Préparer le projet
```bash
cd ~
# Extrayez le zip wend-lamita-app.zip ici
unzip wend-lamita-app.zip
cd wend-lamita-app
```

### Étape 3 — Configurer la clé API
```bash
cp .env.example .env
nano .env
# Remplacez sk-ant-METTEZ_VOTRE_CLE_ICI par votre vraie clé
# Ctrl+X puis Y pour sauvegarder
```

### Étape 4 — Générer config.js
```bash
npm install
npm run build
```
→ Si vous voyez "✅ config.js généré", c'est bon.

### Étape 5 — Tester dans le navigateur
```bash
npm run dev
# Ouvrez http://localhost:3000 dans Chrome
```

---

## Sur PC (pour compiler l'APK)

### Prérequis
1. Android Studio : https://developer.android.com/studio
2. Node.js 18+ : https://nodejs.org
3. JDK 17 (inclus avec Android Studio)

### Étape A — Configurer et builder
```bash
cp .env.example .env
# Éditez .env avec votre clé API
npm install
npm run build
```

### Étape B — Initialiser Capacitor
```bash
npm install @capacitor/cli @capacitor/core @capacitor/android @capacitor/camera
npx cap init "Wend-Lamita" "bf.wendlamita.app" --web-dir www
npx cap add android
npx cap sync android
```

### Étape C — Ajouter les permissions Android
Ouvrez : `android/app/src/main/AndroidManifest.xml`
Ajoutez avant `<application>` (voir android-config/AndroidManifest-extras.xml)

### Étape D — Générer l'APK
```bash
npx cap open android
```
Dans Android Studio :
- Build → Generate Signed Bundle/APK
- Choisir APK
- Créer un keystore (ou utiliser un existant)
- Build Variant : release
- Cliquer Finish

L'APK sera dans : `android/app/release/app-release.apk`

---

## Notes importantes
- La clé API Anthropic est nécessaire pour le scan OCR des pièces d'identité
- Sans clé API, toutes les autres fonctions (stock, Orange Money manuel) fonctionnent
- Les données sont stockées localement sur l'appareil (localStorage)
- Aucune donnée n'est envoyée à un serveur externe sauf lors du scan OCR
