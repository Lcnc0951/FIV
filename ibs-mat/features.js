/* ============ Magevennlig kjøkken: ukeplan, dagbok, testfase og verktøy ============ */
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad=n=>String(n).padStart(2,'0');
const dayKey=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const DAYS=['Mandag','Tirsdag','Onsdag','Torsdag','Fredag','Lørdag','Søndag'];
const SLOTS=[['frokost','Frokost'],['lunsj','Lunsj'],['middag','Middag']];
const FOD=['fruktan','gos','laktose','fruktose','polyol'];
let toastT;function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('show'),2200)}

/* ---------- Lagring: privat i Claude-kontoen, ellers i nettleseren ---------- */
const Store={cloud:false,db:null,uid:null,timers:{},
 lget(k,d){try{const v=localStorage.getItem('mk-'+k);return v?JSON.parse(v):d}catch(e){return d}},
 lset(k,v){try{localStorage.setItem('mk-'+k,JSON.stringify(v))}catch(e){}},
 path(k){return `data/users/${this.uid}/${k}`},
 put(k,v){this.lset(k,v);if(!this.cloud)return;clearTimeout(this.timers[k]);const body=JSON.parse(JSON.stringify(v));
  this.timers[k]=setTimeout(()=>{this.db.doc(this.path(k)).set({v:body,t:Date.now()}).then(()=>setSync('cloud')).catch(()=>setSync('error'))},600)},
 async load(k){const s=await within(this.db.doc(this.path(k)).get());return s.exists?s.data().v:undefined},
 diary(){return this.db.doc(this.path('dagbok')).collection('innslag')},
 async addEntry(e){this.lset('diary',DIARY);if(!this.cloud)return;try{await this.diary().doc(e.id).set(e);setSync('cloud')}catch(x){setSync('error')}},
 async delEntry(id){this.lset('diary',DIARY);if(!this.cloud)return;try{await this.diary().doc(id).delete()}catch(x){setSync('error')}}
};
function within(p,ms=10000){let t;return Promise.race([p,new Promise((_,rej)=>{t=setTimeout(()=>rej({code:'timeout'}),ms)})]).finally(()=>clearTimeout(t))}
function setSync(m){const el=$('#syncNote');if(!el)return;el.textContent=m==='cloud'?'Planen, dagboken og testene dine lagres privat i Claude-kontoen din. Ingen andre kan se dem.':m==='error'?'Kunne ikke lagre i kontoen akkurat nå. Endringene ligger i denne nettleseren.':'Planen, dagboken og testene dine lagres bare i denne nettleseren.'}

let PLAN=Store.lget('plan',{days:{}});
let SHOP=Store.lget('shop',{checked:{}});
let REINTRO=Store.lget('reintro',{active:null,results:{}});
let DIARY=Store.lget('diary',[]);
let SAMPLE=null; // eksempeldata, lagres aldri

async function initCloud(){
 if(!window.claude||!window.claude.use){setSync('local');return}
 try{
  const[db,user]=await Promise.all([claude.use('db'),claude.use('user')]);
  if(!db||!user){setSync('local');return}
  const uid=await user.id();if(!uid){setSync('local');return}
  Store.db=db;Store.uid=uid;Store.cloud=true;
  const keys=['settings','plan','shop','reintro'];
  const vals=await Promise.all(keys.map(k=>Store.load(k).catch(()=>undefined)));
  keys.forEach((k,i)=>{const v=vals[i];
   if(v===undefined){const loc=k==='settings'?{avoid:[...state.avoid],favs:[...state.favs]}:k==='plan'?PLAN:k==='shop'?SHOP:REINTRO;Store.put(k,loc);return}
   if(k==='settings'){state.avoid=new Set(v.avoid||[]);state.favs=new Set(v.favs||[]);Store.lset('state',v);renderOpts();update()}
   if(k==='plan'){PLAN=v&&v.days?v:{days:{}};Store.lset('plan',PLAN)}
   if(k==='shop'){SHOP=v&&v.checked?v:{checked:{}};Store.lset('shop',SHOP)}
   if(k==='reintro'){REINTRO=v&&v.results?v:{active:null,results:{}};Store.lset('reintro',REINTRO)}});
  const snap=await within(Store.diary().get());
  if(snap.empty&&DIARY.length){for(const e of DIARY){await Store.diary().doc(e.id).set(e)}}
  else{DIARY=snap.docs.map(d=>({...d.data()})).sort((a,b)=>b.ts-a.ts);Store.lset('diary',DIARY)}
  setSync('cloud');renderDynamic();
 }catch(e){Store.cloud=false;setSync('local')}
}

/* ---------- Gjenkjenning av FODMAP i fritekst og etiketter ---------- */
const B='(?<![a-zæøåé])';
const DET=[
 ['fruktan',`[a-zæøå]*løk(?!solje)|[a-zæøå]*hvetemel|sjalott|purre|hvete|rug|bygg|couscous|bulgur|inulin|sikori|fruktooligo|oligofruktose|fos(?![a-zæøå])|pasta|spagetti|makaroni|lasagne|brød|loff|rundstykke|baguette|knekkebrød|pizza|nudler|kjeks|wienerbrød|bolle|dadler|svisker|fiken|rosin|tørket frukt|kamille|cashew|pistasj|grapefrukt|rosenkål|artisjokk`,`vårløk\\w*|gressløk|grønn(e)? del(en)?|det grønne|hvitløksolje|glutenfri\\w*( \\w+)?|surdeig\\w*|spelt\\w*|risnudl\\w*|maistortilla\\w*|riskjeks|uten (hvit)?løk`],
 ['gos',`[a-zæøå]*bønne(?!spirer)|[a-zæøå]*bønner|[a-zæøå]*linser|linse|kikert|hummus|erter|ertemel|silketofu|soyamel|soyabønne|cashew|pistasj|falafel`,`grønne bønner|aspargesbønner|edamame|erteprotein`],
 ['laktose',`[a-zæøå]*melk[a-zæøå]*|[a-zæøå]*yoghurt|[a-zæøå]*fløte|[a-zæøå]*rømme|crème fraîche|kremost|smøreost|cottage|ricotta|kesam|kvarg|iskrem|brunost|prim|myse|laktose|kondensert|latte|cappuccino|vaniljesaus|pudding|milkshake`,`laktosefri( \\w+){0,2}|mandelmelk|kokosmelk|havremelk|rismelk|soyamelk|kokosfløte|kokosyoghurt|melkesyre\\w*|melkeprotein\\w*`],
 ['fruktose',`honning|agave|mango|eple|epler|pære|fruktose|fruktosesirup|glukose-fruktosesirup|vannmelon|asparges|sukkererter|eplejuice|pærejuice|fruktjuice`,`honningmelon|eplecider\\w*`],
 ['polyol',`sopp|champignon|sjampinjong|blomkål|avokado|sukkererter|plomme|svisker|fersken|nektarin|aprikos|kirsebær|bjørnebær|søtpotet|vannmelon|eple|epler|pære|sorbitol|mannitol|xylitol|maltitol|isomalt|laktitol|e ?-?420|e ?-?421|e ?-?953|e ?-?965|e ?-?966|e ?-?967|sukkerfri`,`østerssopp`],
 ['gluten',`hvete|spelt|rug|bygg|havre|pasta|spagetti|makaroni|brød|loff|rundstykke|knekkebrød|pizza|couscous|bulgur|soyasaus|kjeks|nudler|seitan|malt|lasagne|wienerbrød`,`glutenfri\\w*( \\w+)?|tamari|risnudl\\w*|maistortilla\\w*|maltodekstrin`],
 ['egg',`egg(?!plante)|eggerøre|omelett|majones|marengs|eggehvite|eggeplomme`,`chiaegg|linfrøegg`],
 ['notter',`nøtt|peanøtt|mandel|mandler|valnøtt|cashew|pistasj|hasselnøtt|pekan|macadamia|nutella|marsipan`,``],
 ['fisk',`laks|torsk|sei(?![a-zæøå])|makrell|tunfisk|ørret|hyse|lange|kveite|sardin|ansjos|fisk|steinbit|sild|kaviar|sushi|klippfisk|rødspette`,``],
 ['skalldyr',`reke|reker|scampi|krabbe|blåskjell|hummer|kamskjell|skjell|kreps|blekksprut`,``],
 ['sterkt',`chili|cayenne|sriracha|jalapeño|jalapeno|harissa|tabasco|sambal|sterk`,`uten chili|sløyf chili\\w*`]
].map(([g,inc,exc])=>({g,inc:new RegExp(B+'('+inc+')','i'),exc:exc?new RegExp(B+'('+exc.replace(/\\w/g,'[a-zæøåéè]')+')','gi'):null}));
function detect(text){const out=new Set();const t=' '+String(text||'').toLowerCase()+' ';for(const d of DET){const tt=d.exc?t.replace(d.exc,' '):t;if(d.inc.test(tt))out.add(d.g)}return[...out]}
function eatenGroups(r){const a=adapt(r);const out=new Set();r.ingr.forEach((i,ix)=>{if(typeof i==='string')return;if(a.ingr[ix].orig)return;(i.g+' '+(i.h||'')).trim().split(/\s+/).forEach(t=>t&&out.add(t))});return[...out]}
const gname=g=>GNAME[g]||g;
const gtags=(gs,cls='')=>gs.map(g=>`<span class="gtag ${cls}">${esc(gname(g))}</span>`).join('');

/* ---------- Oppskriftsdialog: porsjoner, ukeplan, logg, kokemodus ---------- */
const FRAC={'½':.5,'¼':.25,'¾':.75,'⅓':1/3,'⅔':2/3};
function fmtNum(x){if(x>=20)return String(Math.round(x/5)*5);if(x>=10)return String(Math.round(x));const w=Math.floor(x),f=x-w;const near=[[0,''],[.25,'¼'],[1/3,'⅓'],[.5,'½'],[2/3,'⅔'],[.75,'¾'],[1,'']];let best=near[0];for(const n of near)if(Math.abs(f-n[0])<Math.abs(f-best[0]))best=n;const ww=best[0]===1?w+1:w;if(Math.abs(f-best[0])>.09)return String(Math.round(x*10)/10).replace('.',',');return(ww?ww:'')+(best[1]||(ww?'':'0'))}
function scaleText(t,f){if(f===1)return t;return t.replace(/(\d+(?:[.,]\d+)?\s*[½¼¾⅓⅔]?|[½¼¾⅓⅔])(?=\s*(?:[–-]\s*\d|[a-zæøåA-ZÆØÅ(]|$|\s))(?!\s*(?:°|%|min|grader|timer|cm|sek))/g,m=>{const s=m.trim();let v=0;const mm=s.match(/^(\d+(?:[.,]\d+)?)?\s*([½¼¾⅓⅔])?$/);if(!mm)return m;if(mm[1])v+=parseFloat(mm[1].replace(',','.'));if(mm[2])v+=FRAC[mm[2]];return fmtNum(v*f)+(m.endsWith(' ')?' ':'')})}
function ingHtml(a,f){return a.ingr.map(i=>i.orig?`<li class="swapped"><span class="why">Byttet ut · ${i.tags.map(t=>GNAME[t]).join(', ')}</span>${esc(scaleText(i.text,f))}<del>${esc(scaleText(i.orig,f))}</del></li>`:`<li>${esc(scaleText(i.text,f))}</li>`).join('')}
function enhanceDialog(r,a,d){
 let serv=r.serv;const tools=d.querySelector('#dlgTools');const list=d.querySelector('#ingList');
 const opts=DAYS.map((dn,i)=>SLOTS.map(([k,l])=>`<option value="${i}|${k}">${dn} ${l.toLowerCase()}</option>`).join('')).join('');
 const defSlot=['frokost','lunsj','middag'].includes(r.meal)?r.meal:'middag';const today=(new Date().getDay()+6)%7;
 tools.innerHTML=`<div class="stepper" aria-label="Antall porsjoner"><button type="button" data-d="-1" aria-label="Færre porsjoner">−</button><output id="servOut">${serv} ${serv===1?'porsjon':'porsjoner'}</output><button type="button" data-d="1" aria-label="Flere porsjoner">+</button></div>
 <span class="inline-select"><label class="sr" for="planSel" hidden>Dag og måltid</label><select id="planSel">${opts}</select><button class="btn btn-ghost btn-sm" type="button" id="toPlan">Legg i ukeplan</button></span>
 <button class="btn btn-ghost btn-sm" type="button" id="ateBtn">Jeg spiste dette</button>
 <button class="btn btn-ghost btn-sm" type="button" id="cookBtn">Kokemodus</button>`;
 tools.querySelector('#planSel').value=`${today}|${defSlot}`;
 tools.querySelectorAll('[data-d]').forEach(b=>b.addEventListener('click',()=>{serv=Math.max(1,Math.min(20,serv+ +b.dataset.d));tools.querySelector('#servOut').textContent=`${serv} ${serv===1?'porsjon':'porsjoner'}`;list.innerHTML=ingHtml(a,serv/r.serv)}));
 tools.querySelector('#toPlan').addEventListener('click',()=>{const[di,k]=tools.querySelector('#planSel').value.split('|');setSlot(di,k,r.id);toast(`Lagt til ${DAYS[di].toLowerCase()} ${k}`)});
 tools.querySelector('#ateBtn').addEventListener('click',()=>{logEntry({type:'meal',text:r.name,recipeId:r.id,groups:eatenGroups(r)});toast('Lagt i dagboken')});
 tools.querySelector('#cookBtn').addEventListener('click',()=>cookMode(r));
}
async function cookMode(r){let i=0,lock=null;const el=document.createElement('div');el.className='cook';el.setAttribute('role','dialog');el.setAttribute('aria-label','Kokemodus');
 const render=()=>{el.innerHTML=`<div class="cook-top"><b>${esc(r.name)}</b><button class="btn btn-ghost btn-sm" type="button" data-x>Lukk</button></div>
 <div class="cook-step"><div><p class="hidden-note" style="margin-bottom:14px">Steg ${i+1} av ${r.steps.length}</p><p>${esc(r.steps[i])}</p></div></div>
 <div class="cook-nav"><button class="btn btn-ghost" type="button" data-p ${i?'':'disabled'}>Forrige</button><button class="btn btn-primary" type="button" data-n>${i<r.steps.length-1?'Neste steg':'Ferdig'}</button></div>`;
  el.querySelector('[data-x]').onclick=close;el.querySelector('[data-p]').onclick=()=>{if(i>0){i--;render()}};el.querySelector('[data-n]').onclick=()=>{if(i<r.steps.length-1){i++;render()}else close()};el.querySelector('[data-n]').focus()};
 const close=()=>{el.remove();try{lock&&lock.release()}catch(e){}};
 $('#dlg').appendChild(el);render();
 try{lock=await navigator.wakeLock.request('screen')}catch(e){}}

/* ---------- Ukeplan og handleliste ---------- */
function setSlot(di,k,id){PLAN.days[di]=PLAN.days[di]||{};if(id)PLAN.days[di][k]=id;else delete PLAN.days[di][k];Store.put('plan',PLAN);renderWeek()}
const byId=id=>R.find(r=>r.id===id);
function renderWeek(){const today=(new Date().getDay()+6)%7;
 $('#week').innerHTML=DAYS.map((dn,di)=>`<div class="wday${di===today?' today':''}"><b>${dn}</b>${SLOTS.map(([k,l])=>{const r=byId((PLAN.days[di]||{})[k]);
  if(!r)return`<div class="slot empty"><small>${l}</small><button class="add" type="button" data-pick="${di}|${k}">+ Velg rett</button></div>`;
  const a=adapt(r);return`<div class="slot"><small>${l}${a.ok?'':' · passer ikke lenger'}</small><button class="open" type="button" data-open="${r.id}">${esc(r.name)}</button><button class="rm" type="button" data-rm="${di}|${k}" aria-label="Fjern ${esc(r.name)}">×</button></div>`}).join('')}</div>`).join('');
 $('#week').querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openRecipe(b.dataset.open));
 $('#week').querySelectorAll('[data-rm]').forEach(b=>b.onclick=()=>{const[d,k]=b.dataset.rm.split('|');setSlot(d,k,null)});
 $('#week').querySelectorAll('[data-pick]').forEach(b=>b.onclick=()=>{const[d,k]=b.dataset.pick.split('|');openPicker(d,k)});
 renderShop()}
function suitable(meal){return R.filter(r=>r.meal===meal&&adapt(r).ok&&(state.diet==='alle'||r.diets.includes(state.diet)))}
function openPicker(di,k){const p=$('#pick');const label=SLOTS.find(s=>s[0]===k)[1].toLowerCase();
 p.innerHTML=`<div class="pk"><div class="row" style="justify-content:space-between"><h2 id="pickTitle" style="font-size:1.2rem">Velg ${label} for ${DAYS[di].toLowerCase()}</h2><button class="btn btn-ghost btn-sm" type="button" data-x>Lukk</button></div>
 <label class="search" for="pickQ"><input id="pickQ" type="search" placeholder="Søk i oppskrifter som passer deg"></label><ul id="pickList"></ul></div>`;
 const draw=()=>{const q=norm(p.querySelector('#pickQ').value.trim());const rs=suitable(k).filter(r=>!q||norm(r.name+' '+r.desc).includes(q));
  p.querySelector('#pickList').innerHTML=rs.slice(0,80).map(r=>`<li><button type="button" data-id="${r.id}"><b>${esc(r.name)}</b><small>${r.time} min · ${r.diets.map(d=>DIETNAME[d]).join(', ')||'Kjøtt og kylling'}</small></button></li>`).join('')||'<li class="hint">Ingen treff som passer filteret ditt.</li>';
  p.querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>{setSlot(di,k,b.dataset.id);p.close()})};
 p.querySelector('#pickQ').oninput=draw;p.querySelector('[data-x]').onclick=()=>p.close();draw();p.showModal()}
function fillWeek(){const used=new Set(Object.values(PLAN.days).flatMap(d=>Object.values(d)));let n=0;
 const fishDays=[0,2,4];const vegDays=[1,5];
 for(let di=0;di<7;di++){PLAN.days[di]=PLAN.days[di]||{};for(const[k]of SLOTS){if(PLAN.days[di][k])continue;let pool=suitable(k).filter(r=>!used.has(r.id));
  if(k==='middag'){const want=fishDays.includes(di)?'sjomat':vegDays.includes(di)?'vegetar':null;const pref=want?pool.filter(r=>r.diets.includes(want)):pool.filter(r=>!r.diets.includes('sjomat'));if(pref.length)pool=pref}
  if(!pool.length)pool=suitable(k);if(!pool.length)continue;const r=pool[Math.floor(Math.random()*pool.length)];PLAN.days[di][k]=r.id;used.add(r.id);n++}}
 Store.put('plan',PLAN);renderWeek();toast(n?`La inn ${n} retter. Fisk tre ganger og vegetar to ganger i uka.`:'Uka er allerede full')}
const SHOPCAT=[['Fisk og sjømat',/laks|torsk|sei\b|makrell|tunfisk|ørret|hyse|lange|kveite|sardin|ansjos|fisk|steinbit|reke|scampi|krabbe|skjell|blekksprut|kaviar|rødspette/i],
 ['Kjøtt og kylling',/kylling|kalkun|kjøtt|bacon|skinke|svin|storfe|lam\b|lamme|biff|filet|pølse|chorizo|elg|hjort|ribbe|nakke|guanciale|roastbiff/i],
 ['Hermetikk og kraft',/boks|kokosmelk|kraft|tomatpuré|kondensert/i],
 ['Oljer, sauser og krydder',/olje|eddik|saus|tamari|soya|sennep|majones|pesto|ketsjup|karri|krydder|salt|pepper|paprikapulver|spisskummen|kanel|kardemomme|gurkemeie|oregano|vanilje|miso|kapers|muskat|safran|laurbær|nellik|garam|timian|rosmarin|estragon|stjerneanis|einebær/i],
 ['Meieri og egg',/melk|yoghurt|fløte|rømme|crème|ost\b|ost |osten|feta|mozzarella|parmesan|cheddar|smør|egg|halloumi|kvarg|cottage|brie|chèvre|pecorino|jarlsberg|norvegia|gruyère|kremost/i],
 ['Frukt og grønt',/tomat|agurk|paprika|squash|aubergine|gulrot|gulrøtter|potet|spinat|salat|ruccola|purre|vårløk|gressløk|pak choi|bønner|brokkoli|kål|pastinakk|kålrot|sitron|lime|appelsin|banan|kiwi|bær|ananas|druer|melon|ingefær|persille|dill|basilikum|mynte|koriander|urter|oliven|reddik|selleri|fennikel|gresskar|rødbet|pasjonsfrukt|rabarbra|chili|mais|sitrongress|bønnespirer|edamame|sopp/i],
 ['Tørrvarer og bakst',/ris|pasta|spagetti|havre|quinoa|polenta|mel\b|mel |brød|nudler|lasagne|gnocchi|knekkebrød|riskake|tortilla|hirse|bokhvete|maisenna|potetmel|kjeks|cornflakes|psyllium|gjær|bakepulver|natron|sukker|sirup|kakao|sjokolade|chia|linfrø|kjerner|frø|nøtt|peanøtt|kokos|tahini|popcorn|makaroni|orzo|lompe|rispapir|nori|gelatin|rosiner/i]];
function shopItems(){const items=new Map();
 for(const d of Object.values(PLAN.days))for(const id of Object.values(d)){const r=byId(id);if(!r)continue;const a=adapt(r);
  a.ingr.forEach(i=>{if(i.blocked)return;const text=i.text.replace(/\s*\(se [^)]*\)/i,'').trim();const key=norm(text);const it=items.get(key)||{text,n:0,from:new Set()};it.n++;it.from.add(r.name);items.set(key,it)})}
 const groups=SHOPCAT.map(([c])=>[c,[]]);groups.push(['Annet',[]]);
 for(const[key,it]of items){const idx=SHOPCAT.findIndex(([,re])=>re.test(it.text));groups[idx<0?groups.length-1:idx][1].push({key,...it})}
 return groups.filter(g=>g[1].length)}
function renderShop(){const groups=shopItems();const total=groups.reduce((s,g)=>s+g[1].length,0);
 $('#shopNote').textContent=total?`${total} varer fra ukeplanen. Mengder står per oppskrift, så slå sammen det som går igjen.`:'Legg retter i ukeplanen, så dukker handlelisten opp her.';
 $('#shop').innerHTML=groups.map(([c,its])=>`<div class="card-pad"><h3>${c}</h3>${its.map(it=>`<label><input type="checkbox" data-k="${esc(it.key)}" ${SHOP.checked[it.key]?'checked':''}><span>${esc(it.text)}${it.n>1?` <span class="x">× ${it.n} oppskrifter</span>`:''}</span></label>`).join('')}</div>`).join('');
 $('#shop').querySelectorAll('input').forEach(cb=>cb.onchange=()=>{if(cb.checked)SHOP.checked[cb.dataset.k]=1;else delete SHOP.checked[cb.dataset.k];Store.put('shop',SHOP)})}
function shopText(){return'Handleliste – Magevennlig kjøkken\n\n'+shopItems().map(([c,its])=>c.toUpperCase()+'\n'+its.filter(i=>!SHOP.checked[i.key]).map(i=>'☐ '+i.text+(i.n>1?` (×${i.n})`:'')).join('\n')).join('\n\n')}

/* ---------- Kopier og last ned ---------- */
async function copyText(t){try{await navigator.clipboard.writeText(t);toast('Kopiert')}catch(e){const ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();try{document.execCommand('copy');toast('Kopiert')}catch(x){toast('Marker teksten og kopier selv')}ta.remove()}}
async function saveFile(name,text){let dl=null;if(window.claude&&window.claude.use){try{dl=await claude.use('downloads')}catch(e){}}
 if(dl){try{await dl.save({filename:name,data:text});return}catch(e){if(e&&e.code==='declined')return;copyText(text);return}}
 if(!window.claude){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));a.download=name;document.body.appendChild(a);a.click();a.remove();return}
 copyText(text)}

/* ---------- Dagbok ---------- */
const SYM=[['bloat','Oppblåsthet'],['pain','Magesmerter'],['gas','Luft'],['nausea','Kvalme']];
const SEV=['Ingen','Lett','Moderat','Sterk'];
const BRISTOL=[[1,'Harde klumper'],[2,'Klumpete pølse'],[3,'Pølse med sprekker'],[4,'Myk og glatt'],[5,'Myke biter'],[6,'Grøtaktig'],[7,'Vandig']];
let form={sym:{bloat:0,pain:0,gas:0,nausea:0},bristol:null};
function nowLocal(){const d=new Date();return`${dayKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`}
function buildForm(){
 $('#symRows').innerHTML=SYM.map(([k,l])=>`<div class="sym-row"><b>${l}</b><div class="chips" role="radiogroup" aria-label="${l}">${SEV.map((s,i)=>`<button type="button" class="pill s${i}" data-sym="${k}" data-v="${i}" aria-pressed="${form.sym[k]===i}">${s}</button>`).join('')}</div></div>`).join('')
 +`<div class="sym-row"><b>Stress</b><div class="chips" role="radiogroup" aria-label="Stress">${SEV.map((s,i)=>`<button type="button" class="pill s${i}" data-sym="stress" data-v="${i}" aria-pressed="${(form.sym.stress||0)===i}">${s}</button>`).join('')}</div></div>`;
 $('#bristol').innerHTML=BRISTOL.map(([n,l])=>`<button type="button" class="pill${n<3||n>5?' s2':''}" data-b="${n}" aria-pressed="${form.bristol===n}" title="${l}">${n} · ${l}</button>`).join('');
 $('#symRows').querySelectorAll('[data-sym]').forEach(b=>b.onclick=()=>{form.sym[b.dataset.sym]=+b.dataset.v;buildForm()});
 $('#bristol').querySelectorAll('[data-b]').forEach(b=>b.onclick=()=>{form.bristol=form.bristol===+b.dataset.b?null:+b.dataset.b;buildForm()});
 $('#bristolHint').textContent=form.bristol?(form.bristol===4||form.bristol===3?'Normal avføring.':form.bristol<3?'Tegn på forstoppelse.':'Tegn på løs mage.'):'Velg om du har hatt avføring. Trykk igjen for å fjerne.'}
function curType(){return document.querySelector('input[name="ltype"]:checked').value}
function syncType(){const t=curType();document.querySelectorAll('#logForm [data-for]').forEach(el=>el.hidden=el.dataset.for!==t)}
function mealGroups(text){const r=R.find(x=>norm(x.name)===norm(text.trim()));return r?{recipeId:r.id,groups:eatenGroups(r)}:{groups:detect(text)}}
function logEntry(e){const ts=e.ts||Date.now();const entry={id:'e'+ts.toString(36)+Math.random().toString(36).slice(2,6),ts,...e};DIARY.unshift(entry);DIARY.sort((a,b)=>b.ts-a.ts);Store.addEntry(entry);renderDiary();return entry}
function symScore(e){if(e.type!=='symptom')return null;const s=e.sym||{};let m=Math.max(s.bloat||0,s.pain||0,s.gas||0,s.nausea||0);if(e.bristol&&(e.bristol<=2||e.bristol>=6))m=Math.max(m,2);return m}
function allEntries(){return SAMPLE?[...SAMPLE,...DIARY].sort((a,b)=>b.ts-a.ts):DIARY}
function analyse(entries){const meals=entries.filter(e=>e.type==='meal');const syms=entries.filter(e=>e.type==='symptom');const H=3600e3;
 const outcome=m=>{const w=syms.filter(s=>s.ts>=m.ts+2*H&&s.ts<=m.ts+24*H);return w.length?Math.max(...w.map(symScore)):null};
 const res=[];const groups=[...FOD,'gluten','egg','notter','fisk','skalldyr','sterkt'];
 const scored=meals.map(m=>({m,o:outcome(m)})).filter(x=>x.o!==null);
 for(const g of groups){const w=scored.filter(x=>(x.m.groups||[]).includes(g));const wo=scored.filter(x=>!(x.m.groups||[]).includes(g));if(w.length<3||wo.length<2)continue;
  const avg=a=>a.reduce((s,x)=>s+x.o,0)/a.length;res.push({g,n:w.length,with:avg(w),without:avg(wo)})}
 return res.sort((a,b)=>(b.with-b.without)-(a.with-a.without))}
function renderInsights(){const es=allEntries();const today=new Date();today.setHours(0,0,0,0);
 const days=[...Array(14)].map((_,i)=>{const d=new Date(today);d.setDate(d.getDate()-13+i);const k=dayKey(d);const sc=es.filter(e=>e.type==='symptom'&&dayKey(new Date(e.ts))===k).map(symScore);return{d,k,v:sc.length?Math.max(...sc):null}});
 const res=analyse(es);const meals=es.filter(e=>e.type==='meal').length,syms=es.filter(e=>e.type==='symptom').length;
 $('#insights').innerHTML=`${SAMPLE?`<div class="banner"><span>Du ser eksempeldata. Ingenting av dette er lagret.</span><button class="btn btn-ghost btn-sm" type="button" id="noSample">Fjern eksempeldata</button></div>`:''}
 <div><h2>Siste 14 dager</h2><p class="hidden-note">Verste symptom hver dag. Grått betyr at du ikke har logget symptomer.</p></div>
 <div class="strip" role="img" aria-label="Symptomer de siste 14 dagene">${days.map(x=>`<i class="${x.v===null?'':'l'+x.v}" title="${x.d.toLocaleDateString('nb-NO',{weekday:'short',day:'numeric',month:'short'})}: ${x.v===null?'ikke logget':SEV[x.v].toLowerCase()}"></i>`).join('')}</div>
 <div class="strip-lbl"><span>${days[0].d.toLocaleDateString('nb-NO',{day:'numeric',month:'short'})}</span><span>i dag</span></div>
 <div><h2>Mulige utløsere</h2><p class="hidden-note">Gjennomsnittlig verste symptom 2–24 timer etter måltider med hver gruppe (0 = ingen, 3 = sterke). Streken viser snittet etter andre måltider.</p></div>
 ${res.length?`<div class="bars">${res.map(r=>{const hot=r.with-r.without>=.75;return`<div class="bar${hot?' hot':''}"><span>${esc(gname(r.g))} <small class="hint">(${r.n})</small></span><span class="track"><span class="fill" style="width:${r.with/3*100}%"></span><span class="base" style="left:${r.without/3*100}%"></span></span><span>${r.with.toFixed(1).replace('.',',')}</span></div>`}).join('')}</div>
 <p class="hidden-note">${res.some(r=>r.with-r.without>=.75)?'Røde søyler skiller seg tydelig ut. Det er et hint, ikke et bevis. Bekreft det i testfasen.':'Ingen grupper skiller seg tydelig ut ennå.'}</p>`
 :`<p class="hint">Når du har logget minst tre måltider med samme gruppe og symptomene etterpå, dukker mønstrene opp her. Nå: ${meals} måltider og ${syms} symptomlogger.</p>`}
 <div class="row">${es.length?`<button class="btn btn-ghost btn-sm" type="button" id="repDl">Last ned rapport</button><button class="btn btn-ghost btn-sm" type="button" id="repCopy">Kopier rapport</button>`:''}${SAMPLE?'':`<button class="btn btn-ghost btn-sm" type="button" id="yesSample">Vis med eksempeldata</button>`}</div>`;
 const q=s=>$('#insights').querySelector(s);
 q('#noSample')&&(q('#noSample').onclick=()=>{SAMPLE=null;renderDiary()});
 q('#yesSample')&&(q('#yesSample').onclick=()=>{SAMPLE=makeSample();renderDiary()});
 q('#repDl')&&(q('#repDl').onclick=()=>saveFile(`magedagbok-${dayKey(new Date())}.txt`,report()));
 q('#repCopy')&&(q('#repCopy').onclick=()=>copyText(report()))}
function renderTimeline(){const es=allEntries().slice(0,300);if(!es.length){$('#timeline').innerHTML='<div class="empty">Dagboken er tom. Logg det første måltidet ditt over, eller trykk «Jeg spiste dette» i en oppskrift.</div>';return}
 const by=new Map();es.forEach(e=>{const k=dayKey(new Date(e.ts));if(!by.has(k))by.set(k,[]);by.get(k).push(e)});
 $('#timeline').innerHTML=[...by].map(([k,list])=>{const d=new Date(k+'T12:00');return`<div class="day"><h3>${d.toLocaleDateString('nb-NO',{weekday:'long',day:'numeric',month:'long'})}</h3>${list.map(e=>{const t=new Date(e.ts);const ico=e.type==='meal'?'M':e.type==='symptom'?'S':'N';
  let body='';if(e.type==='meal')body=`${esc(e.text)}${(e.groups||[]).length?`<small>${gtags(e.groups)}</small>`:''}`;
  else if(e.type==='symptom'){const s=e.sym||{};const parts=SYM.filter(([k])=>s[k]).map(([k,l])=>`${l.toLowerCase()} ${SEV[s[k]].toLowerCase()}`);if(s.stress)parts.push(`stress ${SEV[s.stress].toLowerCase()}`);body=`${parts.length?parts.join(', '):'Ingen symptomer'}${e.bristol?`<small>Bristol ${e.bristol}: ${BRISTOL[e.bristol-1][1].toLowerCase()}</small>`:''}`}
  if(e.note)body+=`<small>${esc(e.note)}</small>`;
  return`<div class="entry"><time>${pad(t.getHours())}:${pad(t.getMinutes())}</time><span class="ico ${e.type}" aria-hidden="true">${ico}</span><div>${body}</div>${e.sample?'<span></span>':`<button class="del" type="button" data-del="${e.id}" aria-label="Slett innslag">×</button>`}</div>`}).join('')}</div>`}).join('');
 $('#timeline').querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{DIARY=DIARY.filter(e=>e.id!==b.dataset.del);Store.delEntry(b.dataset.del);renderDiary();toast('Slettet')})}
function renderDiary(){renderInsights();renderTimeline()}
function report(){const es=allEntries().slice().sort((a,b)=>a.ts-b.ts);const res=analyse(es);
 const lines=['MAGEDAGBOK – Magevennlig kjøkken',`Laget ${new Date().toLocaleDateString('nb-NO')}`,`Unngår nå: ${[...state.avoid].map(gname).join(', ')||'ingenting'}`,''];
 const done=Object.entries(REINTRO.results||{});if(done.length){lines.push('TESTFASE');done.forEach(([id,r])=>{const t=TESTS.find(x=>x.id===id);if(t)lines.push(`- ${t.name}: ${STATUS[r.status]}${r.note?' ('+r.note+')':''}`)});lines.push('')}
 if(res.length){lines.push('MULIGE UTLØSERE (snitt verste symptom 2–24 t etter måltid, 0–3)');res.forEach(r=>lines.push(`- ${gname(r.g)}: ${r.with.toFixed(1)} mot ${r.without.toFixed(1)} ellers (${r.n} måltider)`));lines.push('')}
 lines.push('LOGG');let last='';es.forEach(e=>{const d=new Date(e.ts);const k=d.toLocaleDateString('nb-NO',{weekday:'long',day:'numeric',month:'long'});if(k!==last){lines.push('',k.toUpperCase());last=k}
  const t=`${pad(d.getHours())}:${pad(d.getMinutes())}`;if(e.type==='meal')lines.push(`${t} Mat: ${e.text}${(e.groups||[]).length?' ['+e.groups.map(gname).join(', ')+']':''}`);
  else if(e.type==='symptom'){const s=e.sym||{};lines.push(`${t} Symptomer: `+SYM.map(([k,l])=>`${l.toLowerCase()} ${s[k]||0}`).join(', ')+`, stress ${s.stress||0}${e.bristol?`, Bristol ${e.bristol}`:''}`)}
  else lines.push(`${t} Notat`);if(e.note)lines.push(`      ${e.note}`)});
 if(SAMPLE)lines.unshift('OBS: RAPPORTEN INNEHOLDER EKSEMPELDATA','');return lines.join('\n')}
function makeSample(){const out=[];const now=new Date();const H=3600e3;
 const safe=[['Overnight oats med blåbær',['gluten']],['Laks med poteter og grønne bønner',['fisk']],['Kyllingwok med ris',[]],['Omelett med spinat',['egg']],['Tofubowl med ris',[]],['Torsk i tomatsaus',['fisk']]];
 const fr=[['Pasta med hvitløk og parmesan',['fruktan','gluten']],['Pizza med løk',['fruktan','gluten']],['Brødskive av hvetebrød',['fruktan','gluten']]];
 const lak=['Kaffe latte',['laktose']];
 for(let d=13;d>=0;d--){const base=new Date(now);base.setDate(base.getDate()-d);base.setHours(0,0,0,0);
  const fDay=d%3===0,lDay=d%4===1;
  const meals=[safe[0],lDay?lak:safe[(d+3)%safe.length],fDay?fr[d%fr.length]:safe[(d+1)%safe.length]];
  meals.forEach(([text,groups],i)=>out.push({id:`s${d}${i}`,ts:base.getTime()+[8,12,18][i]*H,type:'meal',text,groups,sample:true}));
  out.push({id:`s${d}a`,ts:base.getTime()+15*H,type:'symptom',sym:{bloat:lDay?1:0,pain:0,gas:lDay?1:0,nausea:0,stress:d%5===0?2:0},bristol:null,sample:true});
  out.push({id:`s${d}b`,ts:base.getTime()+22*H,type:'symptom',sym:{bloat:fDay?3:d%5===0?1:0,pain:fDay?2:0,gas:fDay?2:lDay?1:0,nausea:0,stress:0},bristol:fDay?6:4,sample:true,note:fDay?'Vondt i magen og løs mage':''})}
 return out}

/* ---------- Testfase ---------- */
const TESTS=[
 {id:'laktose',g:'laktose',name:'Laktose',food:'Vanlig melk eller yoghurt',doses:['1 dl','2 dl','2,5 dl']},
 {id:'fruktose',g:'fruktose',name:'Fruktose',food:'Honning',doses:['1 ts','1½ ts','2 ts']},
 {id:'sorbitol',g:'polyol',name:'Polyoler: sorbitol',food:'Avokado',doses:['¼ avokado','⅓ avokado','½ avokado']},
 {id:'mannitol',g:'polyol',name:'Polyoler: mannitol',food:'Sjampinjong',doses:['1 dl i skiver','2 dl','3 dl']},
 {id:'gos',g:'gos',name:'GOS (belgfrukter)',food:'Hermetiske kikerter eller linser, skylt',doses:['½ dl','1 dl','1,5 dl']},
 {id:'hvete',g:'fruktan',name:'Fruktaner: hvete',food:'Vanlig hvetebrød',doses:['½ skive','1 skive','2 skiver']},
 {id:'hvitlok',g:'fruktan',name:'Fruktaner: hvitløk',food:'Hvitløk i maten',doses:['¼ fedd','½ fedd','1 fedd']},
 {id:'lok',g:'fruktan',name:'Fruktaner: løk',food:'Stekt eller kokt løk',doses:['1 ss hakket','¼ løk','½ løk']}];
const STATUS={ok:'Tålt',delvis:'Tålt i små mengder',reagerte:'Reagerte',pagar:'Pågår'};
function startTest(id){REINTRO.active={id,started:dayKey(new Date()),days:[null,null,null]};Store.put('reintro',REINTRO);renderReintro();toast('Testen er startet')}
function logTestDay(score){const a=REINTRO.active;const t=TESTS.find(x=>x.id===a.id);const i=a.days.findIndex(x=>x===null);a.days[i]=score;
 logEntry({type:'meal',text:`Testfase: ${t.food.toLowerCase()}, ${t.doses[i]}`,groups:[t.g],note:`Dag ${i+1} av 3`});
 if(score>=2||i===2){let status,note='';if(score>=2&&i===0){status='reagerte';note=`symptomer allerede ved ${t.doses[0]}`}else if(score>=2){status='delvis';note=`tålte ${t.doses[i-1]}, reagerte på ${t.doses[i]}`}else{status='ok';note=score===1?`lette symptomer ved ${t.doses[2]}`:`ingen plager ved ${t.doses[2]}`}
  REINTRO.results[a.id]={status,note,date:dayKey(new Date())};REINTRO.active=null;toast(`${t.name}: ${STATUS[status].toLowerCase()}`)}
 Store.put('reintro',REINTRO);renderReintro()}
function proposedAvoid(){const next=new Set(state.avoid);const changes=[];
 for(const g of FOD){const ts=TESTS.filter(t=>t.g===g);const rs=ts.map(t=>REINTRO.results[t.id]);if(rs.some(r=>!r))continue;
  const ok=rs.every(r=>r.status==='ok');if(ok&&next.has(g)){next.delete(g);changes.push(`${gname(g)} fjernes fra «tåler ikke»`)}if(!ok&&!next.has(g)){next.add(g);changes.push(`${gname(g)} legges til i «tåler ikke»`)}}
 return{next,changes}}
function renderReintro(){const a=REINTRO.active;const at=a&&TESTS.find(t=>t.id===a.id);const{changes}=proposedAvoid();
 let html=`<div class="steps-intro"><div><b>Før du starter.</b> Gå på lav-FODMAP i 2–6 uker til magen er rolig. Fortsett med lav-FODMAP mens du tester.</div><div><b>Én test om gangen.</b> Spis testmaten tre dager på rad i økende mengde. Stopp hvis du får tydelige plager.</div><div><b>Pause mellom testene.</b> Ta 2–3 dager med vanlig lav-FODMAP før neste test. Mengdene er forslag. Tilpass dem gjerne sammen med ernæringsfysiolog.</div></div>`;
 if(at){const i=a.days.findIndex(x=>x===null);html+=`<div class="active-test"><div class="row" style="justify-content:space-between"><div><span class="status pagar">Pågår</span><h2 style="margin-top:6px">${at.name}</h2><p class="hidden-note">Testmat: ${at.food}. Startet ${new Date(a.started+'T12:00').toLocaleDateString('nb-NO',{day:'numeric',month:'long'})}.</p></div><button class="btn btn-ghost btn-sm" type="button" id="abortTest">Avbryt testen</button></div>
  <div class="tdays">${at.doses.map((d,ix)=>`<div class="tday${ix===i?' cur':''}"><b>Dag ${ix+1}</b><span class="dose">${d}</span>${a.days[ix]!==null?`<span class="hint">Magen: ${SEV[a.days[ix]].toLowerCase()}</span>`:ix===i?'<span class="hint">I dag</span>':''}</div>`).join('')}</div>
  <div class="field"><span>Dag ${i+1}: Spis ${at.doses[i]} ${at.food.toLowerCase()}. Hvordan var magen resten av dagen og natten?</span><div class="chips">${SEV.map((s,v)=>`<button type="button" class="pill s${v}" data-score="${v}">${s} plager</button>`).join('')}</div><small class="hint">Lagres også i dagboken.</small></div></div>`}
 html+=`<div class="tests">${TESTS.map(t=>{const r=REINTRO.results[t.id];const act=a&&a.id===t.id;return`<div class="test"><span class="status ${act?'pagar':r?r.status:''}">${act?'Pågår':r?STATUS[r.status]:'Ikke testet'}</span><h3>${t.name}</h3><p>${t.food}: ${t.doses.join(' → ')}</p>${r&&r.note?`<p>${esc(r.note)}</p>`:''}${act?'':`<button class="btn btn-ghost btn-sm" type="button" data-start="${t.id}" ${a?'disabled':''}>${r?'Test på nytt':'Start test'}</button>`}</div>`}).join('')}</div>`;
 if(changes.length)html+=`<div class="card-pad" style="margin-top:18px"><h2>Bruk resultatene</h2><p>${changes.join('. ')}.</p><p class="hidden-note">Oppskriftene, ukeplanen og matlisten oppdateres med en gang. En gruppe fjernes bare når alle testene i den er tålt.</p><div><button class="btn btn-primary" type="button" id="applyTests">Oppdater «tåler ikke»</button></div></div>`;
 $('#reintro').innerHTML=html;
 $('#reintro').querySelectorAll('[data-start]').forEach(b=>b.onclick=()=>startTest(b.dataset.start));
 $('#reintro').querySelectorAll('[data-score]').forEach(b=>b.onclick=()=>logTestDay(+b.dataset.score));
 const ab=$('#abortTest');if(ab)ab.onclick=()=>{REINTRO.active=null;Store.put('reintro',REINTRO);renderReintro()};
 const ap=$('#applyTests');if(ap)ap.onclick=()=>{state.avoid=proposedAvoid().next;save();renderOpts();update();toast('«Tåler ikke» er oppdatert')}}

/* ---------- Etikettsjekk ---------- */
const LBL_NOTES={inulin:'Fiber fra sikorirot, mye fruktaner',sikori:'Mye fruktaner',fruktooligo:'Fruktaner',oligofruktose:'Fruktaner',honning:'Overskudd av fruktose',agave:'Overskudd av fruktose',sorbitol:'Polyol, kan gi diaré',mannitol:'Polyol',xylitol:'Polyol',maltitol:'Polyol',isomalt:'Polyol',
 'løkpulver':'Fruktaner, også små mengder kan merkes','hvitløkspulver':'Fruktaner, også små mengder kan merkes'};
function checkLabel(txt){const raw=txt.replace(/^\s*ingredienser\s*:?/i,'').replace(/[()[\]]/g,',').split(/[,;]|\s\bog\b\s/).map(s=>s.trim().replace(/\.$/,'')).filter(Boolean).reduce((a,s)=>{if(/^\d+(?:[.,]\d+)?\s*%$/.test(s)&&a.length)a[a.length-1]+=' ('+s+')';else a.push(s);return a},[]);
 const n=raw.length;return raw.map((s,i)=>{const pct=(s.match(/(\d+(?:[.,]\d+)?)\s*%/)||[])[1];const p=pct?parseFloat(pct.replace(',','.')):null;
  const gs=detect(s).filter(g=>g!=='gluten'||state.avoid.has('gluten'));const strong=/inulin|sikori|fruktooligo|oligofruktose|løkpulver|hvitløkspulver|honning|agave|sorbitol|mannitol|xylitol|maltitol|isomalt|e ?-?42[01]|e ?-?96[5-7]|e ?-?953/i.test(s);
  const small=!strong&&((p!==null&&p<=5)||(p===null&&n>=5&&i>=Math.ceil(n*.6)));
  const key=Object.keys(LBL_NOTES).find(k=>s.toLowerCase().includes(k));return{s,gs,small,strong,note:key?LBL_NOTES[key]:''}})}
function renderLabel(){const txt=$('#lbl').value.trim();if(!txt){$('#lblOut').innerHTML='';return}
 const items=checkLabel(txt);const flagged=items.filter(x=>x.gs.length);const mine=flagged.filter(x=>x.gs.some(g=>state.avoid.has(g)||!state.avoid.size&&FOD.includes(g)));
 const big=mine.filter(x=>!x.small);let cls='good',msg='Fant ingen kjente FODMAP-kilder i listen.';
 if(big.length){cls='bad';msg=`Inneholder ${[...new Set(big.flatMap(x=>x.gs))].map(g=>gname(g).toLowerCase()).join(', ')}. Trolig ikke trygt i fase 1.`}
 else if(mine.length){cls='mid';msg='Bare små mengder av FODMAP-kilder. Mange tåler dette i en vanlig porsjon.'}
 else if(flagged.length){cls='good';msg='Ingen av gruppene du unngår. Se merkene under.'}
 $('#lblOut').innerHTML=`<div class="verdict ${cls}">${msg}</div><div class="ingr-chips">${items.map(x=>`<span class="${x.gs.length?(x.small?'small':'flag'):''}" title="${esc(x.note)}">${esc(x.s)}${x.gs.length?`<em>${x.gs.map(gname).join(', ')}${x.small?' · lite':''}</em>`:''}</span>`).join('')}</div>
 ${items.some(x=>x.note)?`<ul class="hint" style="margin:0;padding-left:18px">${[...new Set(items.filter(x=>x.note).map(x=>`<li><b>${esc(x.s)}:</b> ${esc(x.note)}</li>`))].join('')}</ul>`:''}
 <p class="hint">Huket av: ${state.avoid.size?[...state.avoid].map(gname).join(', '):'ingenting (sjekker alle FODMAP-grupper)'}. «Lite» betyr under 5 % eller sent i listen. Sjekk Monash- eller FODMAP Friendly-merket for sikre produkter.</p>`}

/* ---------- Spise ute ---------- */
const OUT=[
 ['Italiensk',['Grillet fisk eller kjøtt med poteter','Risotto uten løk (spør)','Carpaccio, caprese og grønn salat med olje og eddik','Glutenfri pasta med tomat og olivenolje'],'Om sausen har løk eller hvitløk, og om de kan lage den med olivenolje og urter.','Hvitløksbrød, pasta i store porsjoner, kremete sauser og tiramisu med vanlig fløte.'],
 ['Sushi og japansk',['Sashimi og nigiri','Maki med laks, tunfisk eller agurk','Misosuppe og edamame','Ris, ingefær og wasabi'],'Om du kan få glutenfri tamari i stedet for soyasaus ved cøliaki.','Tempura med hvetemel, teriyakisaus med honning og avokadoruller i større mengder.'],
 ['Burger og grill',['Burger uten brød, eller i glutenfritt brød','Grillet kylling eller biff','Pommes frites og bakt potet','Coleslaw i liten porsjon'],'Om burgerkrydder og dressinger har løk eller hvitløk. Be om ketsjup og sennep ved siden av.','Løkringer, stekt løk på toppen, BBQ-saus og milkshake.'],
 ['Kebab og Midtøsten',['Kyllingspyd eller grillet kjøtt med ris','Grillede grønnsaker og salat','Feta og oliven'],'Om marinaden har hvitløk og løk, og om de kan droppe hvitløksdressingen.','Hummus, falafel, pitabrød og hvitløkssaus.'],
 ['Indisk',['Tandoori kylling eller fisk','Basmatiris','Raita i liten mengde'],'Om de kan lage en mild rett uten løk. Mange sauser starter med løk og hvitløk.','Dal, chana, naan, samosa og sterke retter hvis chili plager deg.'],
 ['Thai og vietnamesisk',['Sommerruller med reker','Pho med ris-nudler og kraft uten løk (spør)','Wok med ris, sitrongress og ingefær'],'Om de kan bruke mindre hvitløk og løk, og hva som er i kraften.','Søtsur saus, cashewnøtter og retter med mye chili.'],
 ['Kafé og bakeri',['Omelett eller eggerøre','Havregrøt med bær','Glutenfri brødskive med ost','Kaffe med laktosefri melk'],'Om de har laktosefri melk eller havremelk til kaffen.','Vanlige boller, wienerbrød, eplekake og smoothies med eple og mango.'],
 ['Fiskerestaurant',['Stekt eller dampet fisk med poteter','Skalldyr med sitron','Grønnsaker og smørsaus'],'Om sausen har løk eller sjalottløk, og om de kan servere smør eller sitron i stedet.','Fiskesuppe med løk, panert fisk med hvetemel og fløtesauser.']];
function renderOut(){$('#outGrid').innerHTML=OUT.map(([n,ok,ask,avoid])=>`<div class="out"><h3>${n}</h3><b>Trygge valg</b><p>${ok.join('. ')}.</p><b>Spør om</b><p>${ask}</p><b>Unngå</b><p>${avoid}</p></div>`).join('')}

/* ---------- Pusteøvelse ---------- */
let breathT=null,breathEnd=0;
function breathStop(){clearTimeout(breathT);breathT=null;$('#ring').className='breath-ring';$('#breathText').textContent='Klar';$('#breathBtn').textContent='Start 3 minutter';$('#breathClock').textContent=''}
function breathStep(phase){if(!breathT&&phase!=='start')return;const left=Math.max(0,Math.round((breathEnd-Date.now())/1000));$('#breathClock').textContent=`${Math.floor(left/60)}:${pad(left%60)} igjen`;
 if(left<=0){breathStop();$('#breathText').textContent='Ferdig';return}
 const inh=phase!=='in';$('#ring').className='breath-ring '+(inh?'in':'out');$('#breathText').textContent=inh?'Pust inn':'Pust ut';breathT=setTimeout(()=>breathStep(inh?'in':'out'),inh?4000:6000)}
$('#breathBtn').addEventListener('click',()=>{if(breathT){breathStop();return}breathEnd=Date.now()+180000;$('#breathBtn').textContent='Stopp';breathT=1;breathStep('start')});

/* ---------- Kobling ---------- */
function renderDynamic(){renderWeek();renderDiary();renderReintro();renderLabel()}
function onView(v){if(v==='ukeplan')renderWeek();if(v==='dagbok'){renderDiary();$('#logTime').value=nowLocal()}if(v==='testfase')renderReintro();if(v!=='verktoy'&&breathT)breathStop()}
function onAvoidChange(){if(!$('#view-ukeplan').hidden)renderWeek();if(!$('#view-testfase').hidden)renderReintro();if($('#lbl').value)renderLabel()}
$('#recipeNames').innerHTML=R.map(r=>`<option value="${esc(r.name)}">`).join('');
document.querySelectorAll('input[name="ltype"]').forEach(r=>r.addEventListener('change',syncType));
$('#logMeal').addEventListener('input',()=>{const m=mealGroups($('#logMeal').value);$('#detected').innerHTML=$('#logMeal').value.trim()?(m.groups.length?`<span class="hint">Inneholder trolig:</span> ${gtags(m.groups)}`:'<span class="gtag okg">Ingen kjente FODMAP-kilder</span>'):''});
$('#logForm').addEventListener('submit',e=>{e.preventDefault();const type=curType();const ts=$('#logTime').value?new Date($('#logTime').value).getTime():Date.now();const note=$('#logNote').value.trim();
 if(type==='meal'){const text=$('#logMeal').value.trim();if(!text){toast('Skriv hva du spiste');$('#logMeal').focus();return}logEntry({type,ts,text,note,...mealGroups(text)});$('#logMeal').value='';$('#detected').innerHTML=''}
 else if(type==='symptom'){logEntry({type,ts,sym:{...form.sym},bristol:form.bristol,note});form={sym:{bloat:0,pain:0,gas:0,nausea:0},bristol:null};buildForm()}
 else{if(!note){toast('Skriv et notat');$('#logNote').focus();return}logEntry({type,ts,note})}
 $('#logNote').value='';$('#logTime').value=nowLocal();toast('Lagret i dagboken')});
$('#fillWeek').addEventListener('click',fillWeek);
$('#clearWeek').addEventListener('click',()=>{PLAN={days:{}};SHOP={checked:{}};Store.put('plan',PLAN);Store.put('shop',SHOP);renderWeek();toast('Uka er tømt')});
$('#copyShop').addEventListener('click',()=>copyText(shopText()));
$('#dlShop').addEventListener('click',()=>saveFile('handleliste.txt',shopText()));
$('#resetShop').addEventListener('click',()=>{SHOP={checked:{}};Store.put('shop',SHOP);renderShop()});
$('#lblCheck').addEventListener('click',renderLabel);
$('#lbl').addEventListener('input',()=>{clearTimeout(window._lt);window._lt=setTimeout(renderLabel,400)});
$('#lblExample').addEventListener('click',()=>{$('#lbl').value='Havregryn (45 %), glukosesirup, sjokolade (sukker, kakaosmør, helmelkpulver, emulgator (soyalecitin)), inulin, honning (3 %), mandler (2 %), salt, aroma';renderLabel()});
document.querySelectorAll('[data-jump]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();$('#'+a.dataset.jump).scrollIntoView({behavior:'smooth',block:'start'})}));
buildForm();syncType();$('#logTime').value=nowLocal();renderOut();renderDynamic();setSync('local');initCloud();
show(location.hash.slice(1));
