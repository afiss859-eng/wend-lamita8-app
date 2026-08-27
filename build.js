#!/usr/bin/env node
require('dotenv').config();
const fs=require('fs'),path=require('path');
const cfg={APP_NAME:process.env.APP_NAME||'Wend-Lamita',APP_SHOP:process.env.APP_SHOP||'Bobo-Dioulasso',APP_VERSION:process.env.APP_VERSION||'1.0.0',HCNSEC_KEY:process.env.HCNSEC_KEY||'',GEMINI_KEY:process.env.GEMINI_KEY||'',GROQ_KEY:process.env.GROQ_KEY||'',OPENROUTER_KEY:process.env.OPENROUTER_KEY||'',ANTHROPIC_KEY:process.env.ANTHROPIC_KEY||'',BUILD_DATE:new Date().toISOString()};
const content=`// Généré par build.js\nwindow.APP_CONFIG = ${JSON.stringify(cfg,null,2)};\n`;
const outDir=path.join(__dirname,'www','js');
if(!fs.existsSync(outDir))fs.mkdirSync(outDir,{recursive:true});
fs.writeFileSync(path.join(outDir,'config.js'),content);
console.log('✅ config.js généré');
const hasAny=Object.entries(cfg).some(([k,v])=>k.endsWith('_KEY')&&v);
console.log(hasAny?'✅ Clés détectées':'ℹ️  Aucune clé — Tesseract local uniquement');
