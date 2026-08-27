/**
 * app.js — Contrôleur principal Wend-Lamita (version complète)
 */
let editingId=null, selectedCat='', currentImgData=null, currentPeriod='auj', currentCardType='CNIB', adminUnlocked=false, lastOCRData=null;

// ── Boot ──
document.addEventListener('DOMContentLoaded',()=>{
  loadSavedKeys();
  if(Auth.isLoggedIn()) initApp(); else AuthUI.show('login');
});

function initApp(){
  AuthUI.hide();
  seedDemo();
  renderDashboard(); renderProducts(); renderCatFilter();
  renderOMHistory(); renderStats(); renderCNIHistory(); renderCNIStats();
  AuthUI.renderPlanBadge(); renderEngineStatus(); renderAccountInfo(); renderLimitBanner();
  renderCameraContext(); renderAISuggestions();
}

// ── Navigation ──
function showSec(id,btn){
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('sec-'+id).classList.add('active');
  if(btn) btn.classList.add('active');
  if(id==='dash') renderDashboard();
  if(id==='stats') renderStats();
  if(id==='cni') { renderCNIHistory(); renderCNIStats(); }
  if(id==='cfg') { renderEngineStatus(); renderAccountInfo(); }
  if(id==='ai') renderAISuggestions();
  if(id==='admin') { if(!adminUnlocked){document.getElementById('adminLoginView').style.display='block';document.getElementById('adminDashView').style.display='none';} else renderAdminDash(); }
}

function confirmLogout(){ if(!confirm('Se déconnecter ?')) return; Auth.logout(); location.reload(); }

// ── Limit banner ──
function renderLimitBanner(){
  const plan=Auth.currentPlan(); const el=document.getElementById('limitBanner'); if(!el) return;
  const prods=Inventory.getAll().length;
  el.innerHTML=plan.maxProducts!==-1&&prods>=plan.maxProducts*0.9
    ?`<div class="limit-banner">⚠️ ${prods}/${plan.maxProducts} produits (plan ${plan.label})<button onclick="AuthUI.showPlans()">Upgrader</button></div>`:'' ;
}

// ── Dashboard ──
function renderDashboard(){
  const prods=Inventory.getAll();
  document.getElementById('ds-stock').textContent=prods.reduce((s,p)=>s+p.qty,0);
  document.getElementById('ds-val').textContent=fmt(prods.reduce((s,p)=>s+p.qty*p.prix,0));
  document.getElementById('ds-sales').textContent=Inventory.getSales(startOf('auj')).reduce((s,x)=>s+x.qty,0);
  document.getElementById('ds-low').textContent=Inventory.getLowStock().length;
  const low=Inventory.getLowStock();
  document.getElementById('dashAlerts').innerHTML=!low.length
    ?'<div class="empty"><div class="ei">✅</div>Tous les stocks sont bons</div>'
    :low.map(p=>`<div class="alert-row"><div><div style="font-size:13px;font-weight:700">${p.nom}</div><div style="font-size:10px;color:var(--muted)">${p.cat}</div></div><div style="color:var(--red);font-weight:800;font-size:13px">${p.qty} rest.</div></div>`).join('');
  const st=Inventory.stats(startOf('auj'));
  const chart=document.getElementById('dashChart');
  chart.innerHTML=!st.topProducts.length?'<div class="empty"><div class="ei">📦</div>Pas encore de ventes</div>'
    :st.topProducts.map(([n,q])=>{const mx=st.topProducts[0][1];return`<div class="chart-row"><div class="cn">${n}</div><div class="chart-track"><div class="chart-fill" style="width:${Math.round(q/mx*100)}%"><span>${q}</span></div></div></div>`;}).join('');
}

// ── Inventaire ──
function renderProducts(){
  const grid=document.getElementById('prodGrid');
  let list=Inventory.getAll();
  const q=(document.getElementById('searchInput')?.value||'').toLowerCase();
  if(q) list=list.filter(p=>p.nom.toLowerCase().includes(q));
  if(selectedCat) list=list.filter(p=>p.cat===selectedCat);
  if(!list.length){grid.innerHTML='<div class="empty" style="grid-column:span 2"><div class="ei">🏪</div>Aucun produit</div>';return;}
  grid.innerHTML=list.map(p=>{
    const cls=p.qty===0?'out':p.qty<=p.seuil?'low':'';
    const sb=p.qty===0?'sb-out':p.qty<=p.seuil?'sb-low':'sb-ok';
    const img=p.img?`<img src="${p.img}">`:`<span>${catEmoji(p.cat)}</span>`;
    return`<div class="prod-card ${cls}" onclick="openEdit('${p.id}')"><div class="prod-img">${img}<div class="stock-badge ${sb}">${p.qty===0?'✗':p.qty}</div></div><div class="prod-info"><div class="pn">${p.nom}</div><div class="pc">${p.cat}</div><div class="pp">${fmt(p.prix)}</div><div class="qty-ctrl" onclick="event.stopPropagation()"><button class="qbtn" onclick="sell('${p.id}')">−</button><div class="qval">${p.qty}</div><button class="qbtn" onclick="restock('${p.id}')">+</button></div></div></div>`;
  }).join('');
}
function renderCatFilter(){
  const cats=[...new Set(Inventory.getAll().map(p=>p.cat))];
  document.getElementById('catFilter').innerHTML=`<div class="chip active" onclick="filterCat(this,'')">Tous</div>`+cats.map(c=>`<div class="chip" onclick="filterCat(this,'${c}')">${catEmoji(c)} ${c.replace(/^[^\s]+\s/,'')}</div>`).join('');
}
function catEmoji(c){return{'Alimentaire':'🌾','Boissons':'🥤','Hygiène':'🧴','Divers':'📦','Électronique':'📱'}[c]||'📦';}
function filterCat(el,cat){document.querySelectorAll('.chip').forEach(c=>c.classList.remove('active'));el.classList.add('active');selectedCat=cat;renderProducts();}
function filterProds(){renderProducts();}
function sell(id){const ok=Inventory.sell(id,1);if(!ok){toast('Stock insuffisant',true);return;}renderProducts();renderDashboard();toast('Vente ✓');}
function restock(id){Inventory.restock(id,1);renderProducts();renderDashboard();toast('+1 ajouté');}

// ── Modal produit ──
function openAdd(){
  if(!Auth.canAddProduct(Inventory.getAll().length)){toast('Limite produits atteinte. Upgradez !',true);setTimeout(()=>AuthUI.showPlans(),800);return;}
  editingId=null;document.getElementById('modalTitle').textContent='Nouveau produit';
  ['pNom','pPrix','pQty','pAchat'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('pSeuil').value='5';currentImgData=null;resetImgPick();
  document.getElementById('addModal').classList.add('open');
}
function openEdit(id){
  const p=Inventory.getAll().find(x=>x.id===id);if(!p)return;
  editingId=id;document.getElementById('modalTitle').textContent='Modifier produit';
  document.getElementById('pNom').value=p.nom;document.getElementById('pPrix').value=p.prix;
  document.getElementById('pQty').value=p.qty;document.getElementById('pSeuil').value=p.seuil;
  document.getElementById('pAchat').value=p.achat||'';currentImgData=p.img||null;
  const pick=document.getElementById('imgPick');
  if(p.img){pick.innerHTML=`<input type="file" id="pImg" accept="image/*" style="display:none" onchange="prevImg(this)"><img src="${p.img}">`;}else{resetImgPick();}
  document.querySelectorAll('#catTags .tag').forEach(t=>t.classList.toggle('sel',t.textContent.includes(p.cat)));
  document.getElementById('addModal').classList.add('open');
}
function closeModal(){document.getElementById('addModal').classList.remove('open');}
function saveProd(){
  const nom=document.getElementById('pNom').value.trim();if(!nom){toast('Entrez un nom !',true);return;}
  const rawCat=document.querySelector('#catTags .tag.sel')?.textContent||'Divers';
  const cat=rawCat.replace(/^[^\w\sÀ-ÿ]+\s*/,'').trim();
  const data={nom,cat,prix:parseInt(document.getElementById('pPrix').value)||0,qty:parseInt(document.getElementById('pQty').value)||0,seuil:parseInt(document.getElementById('pSeuil').value)||5,achat:parseInt(document.getElementById('pAchat').value)||0,img:currentImgData};
  if(editingId){Inventory.updateProduct(editingId,data);}else{Inventory.addProduct(data);Admin.log('ADD_PRODUCT',nom);}
  closeModal();renderProducts();renderCatFilter();renderDashboard();renderLimitBanner();
  toast(editingId?'Mis à jour ✓':'Produit ajouté ✓');
}
function selTag(el){document.querySelectorAll('#catTags .tag').forEach(t=>t.classList.remove('sel'));el.classList.add('sel');}
function prevImg(input){const f=input.files[0];if(!f)return;const r=new FileReader();r.onload=e=>{currentImgData=e.target.result;document.getElementById('imgPick').innerHTML=`<input type="file" id="pImg" accept="image/*" style="display:none" onchange="prevImg(this)"><img src="${currentImgData}">`};r.readAsDataURL(f);}
function resetImgPick(){document.getElementById('imgPick').innerHTML=`<input type="file" id="pImg" accept="image/*" style="display:none" onchange="prevImg(this)"><span style="font-size:26px">📷</span><div style="font-size:11px;color:var(--muted);margin-top:4px">Ajouter photo</div>`;}

// ── Orange Money ──
function setType(el,type){document.querySelectorAll('.type-btn').forEach(b=>b.classList.remove('active'));el.classList.add('active');currentCardType=type;}
function calcApres(){document.getElementById('omApres').value=Math.max(0,(parseInt(document.getElementById('omAvant').value)||0)-(parseInt(document.getElementById('omMontant').value)||0));}
function saveOM(type){
  const nom=document.getElementById('omNom').value.trim();const montant=parseInt(document.getElementById('omMontant').value)||0;
  if(!nom||!montant){toast('Nom et montant requis !',true);return;}
  const txnData={nom,type_piece:currentCardType,num_piece:document.getElementById('omCni').value,date_naissance:document.getElementById('omDob').value,reference:document.getElementById('omRef').value,num_client:document.getElementById('omNum').value,num_dest:document.getElementById('omDest').value,solde_avant:parseInt(document.getElementById('omAvant').value)||0,montant,solde_apres:parseInt(document.getElementById('omApres').value)||0};
  const txn=OM.record(type,txnData);
  // Sauvegarder dans historique CNI si données disponibles
  if(lastOCRData){
    CNIHistory.add({...lastOCRData,num_client:txnData.num_client},type,montant);
    lastOCRData=null;
  } else if(nom){
    CNIHistory.add({type_piece:currentCardType,nom,prenoms:'',numero_piece:txnData.num_piece,date_naissance:txnData.date_naissance,reference:txnData.reference,num_client:txnData.num_client,confiance:'basse'},type,montant);
  }
  renderOMHistory();renderStats();renderCNIHistory();renderCNIStats();
  toast(type==='retrait'?`Retrait ${fmt(montant)} ✓`:`Dépôt ${fmt(montant)} ✓`);
  clearOM();
}
function clearOM(){['omNom','omCni','omDob','omRef','omNum','omDest','omAvant','omMontant','omApres'].forEach(id=>{const el=document.getElementById(id);el.value='';el.classList.remove('filled');});document.getElementById('ocrConfidence').style.display='none';lastOCRData=null;}
function fillFromOCR(data){
  lastOCRData=data;
  setField('omNom',[data.nom,data.prenoms].filter(Boolean).join(' '));
  setField('omCni',data.numero_piece);setField('omDob',data.date_naissance);
  setField('omRef',data.reference||(data.type_piece+' – Burkina Faso'));
  const conf=data.confiance||'moyenne';
  const el=document.getElementById('ocrConfidence');el.style.display='inline-flex';el.className='confidence '+conf;
  el.textContent={haute:'✅ Lecture haute confiance',moyenne:'⚠️ Vérifiez les champs',basse:'❌ Relisez manuellement'}[conf];
  if(data._engine) el.textContent+=' ('+data._engine+')';
}
function setField(id,val){const el=document.getElementById(id);if(!el)return;el.value=val||'';el.classList.toggle('filled',!!val);}
function renderOMHistory(){
  const hist=OM.getHistory(30);
  document.getElementById('omHistory').innerHTML=!hist.length?'<div class="empty"><div class="ei">📋</div>Aucune transaction</div>'
    :hist.map(h=>`<div class="hist-item"><div class="hist-icon ${h.type==='retrait'?'hi-r':'hi-d'}">${h.type==='retrait'?'💸':'💰'}</div><div style="flex:1"><div class="hname">${h.nom}</div><div class="hnum">${h.type_piece||''} · ${new Date(h.ts).toLocaleString('fr-FR',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit'})}</div></div><div class="hamount ${h.type==='retrait'?'ha-r':'ha-d'}">${h.type==='retrait'?'−':'+'}${fmt(h.montant)}</div><div class="hist-actions"><button class="hist-act-btn" onclick="Export.printOMReceipt(${JSON.stringify(h).replace(/"/g,'&quot;')})" title="Reçu">🖨</button></div></div>`).join('');
}

// ── CNI Historique ──
function getCNIFilters(){
  return{search:document.getElementById('cniSearch')?.value||'',dateFrom:document.getElementById('cniFrom')?.value||'',dateTo:document.getElementById('cniTo')?.value||'',type:document.getElementById('cniType')?.value||'TOUS',txnType:document.getElementById('cniTxn')?.value||'TOUS'};
}
function renderCNIHistory(){
  const filters=getCNIFilters();
  const list=CNIHistory.filter(filters);
  const el=document.getElementById('cniList');
  if(!list.length){el.innerHTML='<div class="empty"><div class="ei">🪪</div>Aucune pièce trouvée</div>';return;}
  el.innerHTML=list.map(e=>`
    <div class="cni-item">
      <div class="cni-type-badge">${e.type_piece.replace('CARTE_','')}</div>
      <div class="cni-info" style="flex:1">
        <div class="cn-name">${[e.nom,e.prenoms].filter(Boolean).join(' ')||'—'}</div>
        <div class="cn-num">${e.numero_piece||'N° inconnu'} · ${e.num_client?'OM: '+e.num_client:''}</div>
        <div class="cn-date">${new Date(e.ts).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}</div>
      </div>
      ${e.txn_type?`<div class="cni-txn ${e.txn_type==='retrait'?'r':'d'}">${e.txn_type==='retrait'?'−':'+'}${fmt(e.txn_montant||0)}</div>`:''}
      <button onclick="CNIHistory.remove('${e.id}');renderCNIHistory();renderCNIStats()" style="background:none;border:none;color:var(--muted);font-size:14px;cursor:pointer;flex-shrink:0;padding:2px">🗑</button>
    </div>`).join('');
}
function renderCNIStats(){
  const today=new Date().toISOString().slice(0,10);
  const from30=new Date(Date.now()-30*86400000).toISOString().slice(0,10);
  const stats=CNIHistory.stats(from30,today);
  const all=CNIHistory.getAll();
  document.getElementById('cniStatsRow').innerHTML=`
    <div class="cni-stat"><div class="csv">${all.length}</div><div class="csl">Total</div></div>
    <div class="cni-stat"><div class="csv">${stats.retraits}</div><div class="csl">Retraits (30j)</div></div>
    <div class="cni-stat"><div class="csv">${stats.depots}</div><div class="csl">Dépôts (30j)</div></div>`;
}

// ── IA Assistant ──
function renderAISuggestions(){
  const el=document.getElementById('aiSuggestions');if(!el)return;
  const sugs=AIAssistant.getSuggestions();
  el.innerHTML=sugs.map(s=>`<div class="ai-sug" onclick="sendAIMsg(this.textContent)">${s}</div>`).join('');
}
async function sendAI(){
  const input=document.getElementById('aiInput');const msg=input.value.trim();if(!msg)return;
  input.value='';await sendAIMsg(msg);
}
async function sendAIMsg(msg){
  const msgs=document.getElementById('aiMessages');const typing=document.getElementById('aiTyping');
  msgs.innerHTML+=`<div class="ai-msg user">${escHtml(msg)}</div>`;
  typing.classList.add('show');msgs.scrollTop=msgs.scrollHeight;
  try{
    const res=await AIAssistant.callAI(msg);
    typing.classList.remove('show');
    msgs.innerHTML+=`<div class="ai-msg bot">${escHtml(res.reply)}<div class="ai-provider">via ${res.provider}</div></div>`;
    msgs.scrollTop=msgs.scrollHeight;
  }catch(e){
    typing.classList.remove('show');
    msgs.innerHTML+=`<div class="ai-msg bot" style="color:var(--red)">❌ ${e.message}</div>`;
    msgs.scrollTop=msgs.scrollHeight;
  }
}
function clearAIChat(){AIAssistant.clearHistory();document.getElementById('aiMessages').innerHTML='<div class="ai-msg bot">👋 Bonjour ! Je suis votre assistant IA. Posez-moi une question !</div>';}
function escHtml(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');}

// ── Scan caméra ──
function renderCameraContext(){
  const s=CameraFix.getBestStrategy();const info=document.getElementById('cameraContextInfo');const btn=document.getElementById('scanBtn');if(!info||!btn)return;
  if(s==='input-capture'){info.style.display='block';info.textContent='📂 Mode fichier local — appareil photo natif utilisé';btn.innerHTML='📷 Ouvrir l\'appareil photo';}
  else{info.style.display='block';info.textContent='🌐 Scan temps réel disponible';}
}
async function startScan(){
  if(CameraFix.getBestStrategy()==='input-capture'){document.getElementById('nativeCameraInput').click();return;}
  document.getElementById('scanScreen').classList.add('open');
  document.getElementById('scanFallback').style.display='none';
  document.getElementById('scanStatus').textContent='';
  const r=await OCR.initCamera(document.getElementById('scanVideo'),document.getElementById('scanCanvas'));
  if(r&&!r.ok){document.getElementById('scanStatus').textContent=r.reason;document.getElementById('shutterBtn').style.display='none';if(r.useFileFallback)document.getElementById('scanFallback').style.display='block';}
  else{document.getElementById('shutterBtn').style.display='flex';}
}
function stopScan(){OCR.stopCamera();document.getElementById('scanScreen').classList.remove('open');document.getElementById('shutterBtn').style.display='flex';}
async function handleNativeCamera(input){const f=input.files[0];if(!f)return;input.value='';await processImageFile(f);}
async function handleFileInput(input){const f=input.files[0];if(!f)return;await processImageFile(f);}
async function handleScanFallback(input){const f=input.files[0];if(!f)return;document.getElementById('scanScreen').classList.remove('open');OCR.stopCamera();await processImageFile(f);}
async function processImageFile(file){
  document.getElementById('ocrLoader').classList.add('show');
  try{const r=await OCR.analyzeFile(file);fillFromOCR(r);showSec('om',document.querySelectorAll('.nav-btn')[2]);toast('✅ Pièce analysée !');}
  catch(e){toast(e.message,true);}
  finally{document.getElementById('ocrLoader').classList.remove('show');}
}
async function shoot(){
  const btn=document.getElementById('shutterBtn');const loader=document.getElementById('ocrLoader');
  btn.disabled=true;loader.classList.add('show');
  try{
    const r=await OCR.captureAndAnalyze();stopScan();fillFromOCR(r);
    const tmap={CNIB:'CNIB',PASSEPORT:'PASSEPORT',CARTE_CONSULAIRE:'CONSULAIRE',CARTE_MILITAIRE:'MILITAIRE'};
    const det=tmap[r.type_piece];if(det)document.querySelectorAll('.type-btn').forEach(b=>{if(b.getAttribute('onclick')?.includes(det))b.click();});
    showSec('om',document.querySelectorAll('.nav-btn')[2]);toast('✅ Pièce lue : '+(r._engine||'OK'));
  }catch(e){document.getElementById('scanStatus').textContent='❌ '+e.message;document.getElementById('scanFallback').style.display='block';toast(e.message,true);}
  finally{loader.classList.remove('show');btn.disabled=false;}
}

// ── Stats ──
function setPeriod(el,p){document.querySelectorAll('.pbtn').forEach(b=>b.classList.remove('active'));el.classList.add('active');currentPeriod=p;renderStats();}
function renderStats(){
  const hs=Auth.hasStats();document.getElementById('statsLock').style.display=hs?'none':'block';document.getElementById('statsContent').style.display=hs?'block':'none';if(!hs)return;
  const since=startOf(currentPeriod);const s=Inventory.stats(since);const om=OM.stats(since);
  const cniSince=new Date(since).toISOString().slice(0,10);const cniTo=new Date().toISOString().slice(0,10);const cniSt=CNIHistory.stats(cniSince,cniTo);
  document.getElementById('stCA').textContent=fmt(s.ca);document.getElementById('stOM').textContent=om.total;document.getElementById('stArt').textContent=s.articles;
  document.getElementById('stCNI').textContent=cniSt.total;document.getElementById('stVol').textContent=fmt(om.volumeRetrait+om.volumeDepot);
  const txns=Inventory.getSales(since).slice().reverse().slice(0,15);
  document.getElementById('stTxn').innerHTML=!txns.length?'<div class="empty"><div class="ei">🛒</div>Pas encore de ventes</div>'
    :txns.map(s=>`<div class="txn-item"><div class="txn-left"><div class="tn">${s.nom}</div><div class="tt">${new Date(s.ts).toLocaleString('fr-FR',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit'})}</div></div><div class="txn-amount">+${fmt(s.prix*s.qty)}</div></div>`).join('');
}

// ── Admin ──
function showAdminLogin(){showSec('admin',null);document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));}
function checkAdminLogin(){
  const pwd=document.getElementById('adminPwdInput')?.value;
  if(Admin.checkPassword(pwd)){adminUnlocked=true;document.getElementById('adminLoginView').style.display='none';document.getElementById('adminDashView').style.display='block';renderAdminDash();Admin.log('ADMIN_LOGIN','Connexion admin');}
  else{toast('Mot de passe incorrect',true);}
}
function lockAdmin(){adminUnlocked=false;document.getElementById('adminLoginView').style.display='block';document.getElementById('adminDashView').style.display='none';document.getElementById('adminPwdInput').value='';}
function renderAdminDash(){
  const st=Admin.getGlobalStats();
  document.getElementById('adminKPI').innerHTML=`
    <div class="admin-kpi-card"><div class="akc-val gold">${st.produits.total}</div><div class="akc-label">Produits</div></div>
    <div class="admin-kpi-card"><div class="akc-val gold">${fmt(st.produits.valeur)}</div><div class="akc-label">Valeur stock</div></div>
    <div class="admin-kpi-card"><div class="akc-val green">${fmt(st.ventes.ca_mois)}</div><div class="akc-label">CA 30 jours</div></div>
    <div class="admin-kpi-card"><div class="akc-val blue">${st.om.total}</div><div class="akc-label">Trans. OM total</div></div>
    <div class="admin-kpi-card"><div class="akc-val gold">${fmt(st.om.volume)}</div><div class="akc-label">Volume OM total</div></div>
    <div class="admin-kpi-card"><div class="akc-val">${st.cni.total}</div><div class="akc-label">CNI scannées</div></div>`;
  const logs=Admin.getLogs(50);
  document.getElementById('adminLogs').innerHTML=!logs.length?'<div style="padding:12px;text-align:center;color:var(--muted);font-size:12px">Aucun log</div>'
    :logs.map(l=>`<div class="log-item"><div class="log-time">${new Date(l.ts).toLocaleString('fr-FR',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit'})}</div><div class="log-action">${l.action}</div><div class="log-detail">${l.detail}</div></div>`).join('');
}
function changeAdminPwd(){
  const r=Admin.setPassword(document.getElementById('adminOldPwd')?.value,document.getElementById('adminNewPwd')?.value);
  if(r.ok){toast('Mot de passe changé ✓');document.getElementById('adminOldPwd').value='';document.getElementById('adminNewPwd').value='';}
  else toast(r.error,true);
}
function doAdminReset(){
  const txt=document.getElementById('resetConfirmInput')?.value;
  const r=Admin.resetAllData(txt);
  if(r.ok){toast('Données effacées');setTimeout(()=>location.reload(),1000);}
  else toast(r.error,true);
}
function restoreBackup(input){
  const f=input.files[0];if(!f)return;
  Export.restoreFromFile(f,()=>{toast('Restauration réussie !');setTimeout(()=>location.reload(),1000);},e=>toast('Erreur: '+e,true));
}

// ── Config ──
function loadSavedKeys(){
  const keys=JSON.parse(localStorage.getItem('wl_keys')||'{}');
  if(!window.APP_CONFIG)window.APP_CONFIG={};
  ['HCNSEC_KEY','GEMINI_KEY','GROQ_KEY','OPENROUTER_KEY','ANTHROPIC_KEY'].forEach(k=>{if(keys[k])window.APP_CONFIG[k]=keys[k];});
  const fmap={HCNSEC_KEY:'cfgHCNSEC',GEMINI_KEY:'cfgGemini',GROQ_KEY:'cfgGroq',OPENROUTER_KEY:'cfgOR',ANTHROPIC_KEY:'cfgAnthropic'};
  Object.entries(fmap).forEach(([k,id])=>{const el=document.getElementById(id);if(el&&keys[k])el.value=keys[k];});
}
function saveKeys(){
  const keys={HCNSEC_KEY:document.getElementById('cfgHCNSEC')?.value.trim()||'',GEMINI_KEY:document.getElementById('cfgGemini')?.value.trim()||'',GROQ_KEY:document.getElementById('cfgGroq')?.value.trim()||'',OPENROUTER_KEY:document.getElementById('cfgOR')?.value.trim()||'',ANTHROPIC_KEY:document.getElementById('cfgAnthropic')?.value.trim()||''};
  localStorage.setItem('wl_keys',JSON.stringify(keys));loadSavedKeys();renderEngineStatus();toast('✅ Clés sauvegardées');
}
function renderEngineStatus(){
  const cfg=window.APP_CONFIG||{};
  const engines=[
    {name:'Tesseract.js (OCR local)',active:typeof Tesseract!=='undefined',note:'Offline · aucune clé'},
    {name:'HCNSEC (IA + OCR)',active:!!cfg.HCNSEC_KEY,note:'~4000 crédits gratuits'},
    {name:'Gemini Flash (IA + OCR)',active:!!cfg.GEMINI_KEY,note:'1500 req/jour gratuit'},
    {name:'Groq Vision (OCR)',active:!!cfg.GROQ_KEY,note:'30 req/min gratuit'},
    {name:'OpenRouter (IA + OCR)',active:!!cfg.OPENROUTER_KEY,note:'Modèles gratuits'},
    {name:'Anthropic (OCR)',active:!!cfg.ANTHROPIC_KEY,note:'Optionnel payant'},
  ];
  const el=document.getElementById('engineStatus');if(!el)return;
  el.innerHTML=engines.map(e=>`<div class="engine-row"><div><div style="font-size:13px;font-weight:600">${e.name}</div><div style="font-size:10px;color:var(--muted)">${e.note}</div></div><div style="font-size:12px;font-weight:700;color:${e.active?'var(--green)':'var(--muted)'}">${e.active?'● Actif':'○ Inactif'}</div></div>`).join('');
}
function renderAccountInfo(){
  const user=Auth.getUser();const plan=Auth.currentPlan();const days=Auth.daysLeft();const el=document.getElementById('accountInfo');if(!el||!user)return;
  el.innerHTML=`Boutique : <strong style="color:var(--text)">${user.shop}</strong><br>Plan : <strong style="color:${plan.color}">${plan.label}</strong>${days!==null?` · ${days}j restants`:''}<br>Inscrit le : <strong style="color:var(--text)">${new Date(user.createdAt).toLocaleDateString('fr-FR')}</strong>`;
}

// ── Utilitaires ──
function fmt(n){return(n||0).toLocaleString('fr-FR')+' F';}
function startOf(p){const now=new Date();if(p==='auj')return new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime();if(p==='sem')return Date.now()-7*86400000;if(p==='mois')return new Date(now.getFullYear(),now.getMonth(),1).getTime();return 0;}
function toast(msg,err=false){const t=document.getElementById('toast');t.textContent=msg;t.className='toast'+(err?' err':'');t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2800);}
function seedDemo(){
  if(Inventory.getAll().length)return;
  [{nom:'Riz Parfumé 5kg',cat:'Alimentaire',prix:4500,qty:18,seuil:5,achat:3800},{nom:'Coca-Cola 33cl',cat:'Boissons',prix:500,qty:3,seuil:10,achat:300},{nom:'Fanta Orange',cat:'Boissons',prix:500,qty:24,seuil:10,achat:300},{nom:'Savon Omo 400g',cat:'Hygiène',prix:1200,qty:0,seuil:3,achat:900},{nom:'Huile Végétale 1L',cat:'Alimentaire',prix:1800,qty:7,seuil:5,achat:1400},{nom:'Sucre 1kg',cat:'Alimentaire',prix:750,qty:30,seuil:10,achat:600}].forEach(d=>Inventory.addProduct({...d,img:null}));
}

// ── Imprimer reçu depuis historique ──
function printReceipt(id){
  const txn = OM.getHistory(500).find(h=>h.id===id);
  if(txn) Export.printOMReceipt(txn);
  else toast('Transaction introuvable',true);
}
