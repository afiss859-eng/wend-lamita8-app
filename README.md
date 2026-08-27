# Wend-Lamita App — Guide de compilation Android

## Prérequis (sur PC/Mac/Linux)
- Node.js 18+ : https://nodejs.org
- Android Studio : https://developer.android.com/studio
- JDK 17 : inclus avec Android Studio

## Étape 1 — Configurer vos secrets
Copiez `.env.example` → `.env` et remplissez votre clé API :

```
cp .env.example .env
```

Éditez `.env` :
```
ANTHROPIC_API_KEY=sk-ant-VOTRE_CLE_ICI
```

## Étape 2 — Installer les dépendances
```bash
npm install
```

## Étape 3 — Injecter les secrets dans l'app
```bash
npm run build
```
Cette commande lit `.env` et génère `www/js/config.js` automatiquement.

## Étape 4 — Compiler pour Android
```bash
npx cap sync android
npx cap open android
```
Dans Android Studio : Build → Generate Signed APK

## Structure du projet
```
wend-lamita-app/
├── .env                  ← VOS SECRETS (ne jamais partager)
├── .env.example          ← modèle sans valeurs réelles
├── .gitignore            ← exclut .env du git
├── package.json
├── capacitor.config.json
├── build.js              ← injecte .env dans config.js
└── www/
    ├── index.html        ← application principale
    ├── css/style.css
    └── js/
        ├── app.js
        ├── ocr.js        ← logique scan CNI
        ├── inventory.js
        ├── om.js
        └── config.js     ← généré par build.js (ne pas éditer)
```
