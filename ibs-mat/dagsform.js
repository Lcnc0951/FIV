/* ============ I dag: dagsform, forklaring, forslag og trend ============ */
const LEVELS=[[5,'Veldig bra'],[4,'Bra'],[3,'Litt urolig'],[2,'Dårlig'],[1,'Oppbluss']];
const LNAME=Object.fromEntries(LEVELS);
const SX=[['luft','Oppblåst og luft'],['smerte','Smerter og kramper'],['los','Løs mage'],['treg','Treg mage'],['kvalme','Kvalme'],['halsbrann','Halsbrann'],['sliten','Sliten, lite matlyst']];
const CTX=[['stress','Stress'],['sovn','Dårlig søvn'],['mensen','Mensen'],['reise','Reise eller nye rutiner'],['syk','Har vært syk'],['kaffe','Mye kaffe eller alkohol'],['bevegelse','Lite bevegelse']];
const SXN=Object.fromEntries(SX),CTXN=Object.fromEntries(CTX);

/* Hvorfor kroppen reagerer, og hva som hjelper */
const WHY={
 luft:['Hvorfor blir magen oppblåst?','FODMAP-er trekker vann inn i tarmen og gjæres av bakteriene i tykktarmen. Da dannes gass. Ved IBS er tarmveggen ofte ekstra følsom for strekk, så en vanlig mengde gass kjennes som trykk og oppblåsthet. Det blir gjerne verre utover dagen.','Varm mat, rolige måltider og ingefær- eller peppermyntete. Unngå kullsyre, tyggegummi og store porsjoner rå kål og løk.'],
 smerte:['Hvorfor gjør det vondt?','Nervene i tarmen sender sterkere signaler enn vanlig, og tarmen kan trekke seg sammen i kramper. Stress og lite søvn skrur opp volumet på signalene gjennom tarm-hjerne-aksen. Det er ekte smerte, selv om tarmen ikke er skadet.','Varme på magen, varm og mild mat, små måltider og rolig magepust. Fet og sterk mat forsterker ofte krampene.'],
 los:['Hvorfor blir magen løs?','Maten går fortere gjennom tarmen. Fruktose, polyoler og laktose trekker vann inn i tarmen, og fet mat, kaffe, alkohol og chili setter fart på bevegelsene.','Skånsom mat som ris, potet, havre, kokt gulrot, egg og hvit fisk. Drikk godt med vann. Appen er strengere på fruktose, polyoler og laktose i dag.'],
 treg:['Hvorfor er magen treg?','Tarmen beveger seg saktere, og avføringen blir hard fordi tarmen trekker ut mer vann. For lite drikke, løselig fiber og bevegelse gjør det verre, og det samme gjør stress og endrede rutiner.','Kiwi (to om dagen har god dokumentasjon), havre, chiafrø, linfrø, nok drikke og en gåtur. Øk fiberen gradvis.'],
 kvalme:['Hvorfor er jeg kvalm?','Magesekken kan tømme seg saktere, ofte sammen med stress eller etter store og fete måltider. Ved IBS er hele fordøyelsessystemet mer følsomt.','Små, lette måltider, ingefær og kald eller nøytral mat. Spis rolig og ikke legg deg rett etter maten.'],
 halsbrann:['Hvorfor får jeg halsbrann?','Magesyre presses opp i spiserøret. Det skjer lettere etter store og fete måltider, sent på kvelden, og med kaffe, alkohol, chili, tomat og sitrus. Mange med IBS har også sure oppstøt.','Mindre porsjoner, mild mat og minst tre timer fra siste måltid til du legger deg. Hev hodeenden på sengen hvis det plager deg om natten.'],
 sliten:['Hvorfor er jeg sliten og uten matlyst?','Plager i magen, dårlig søvn og bekymring for hva du tåler tapper energi. Når man spiser lite og uregelmessig, blir magen ofte mer urolig.','Små, næringsrike måltider med protein, og faste tider. Velg raske retter som ikke krever mye.'],
 stress:['Stress og magen','Hjernen og tarmen er koblet gjennom nerver og hormoner. Stress endrer tarmens bevegelser og gjør nervene mer følsomme, så samme måltid kan gi mer plager på en stressende dag.','Ro i magen-øvelsen under Verktøy tar tre minutter. Spis sittende og uten skjerm.'],
 sovn:['Søvn og magen','Dårlig søvn senker smerteterskelen og forstyrrer tarmens døgnrytme. Mange med IBS merker mer plager dagen etter en dårlig natt.','Hold deg til kjent, trygg mat i dag og ikke test noe nytt.'],
 mensen:['Mensen og magen','Rundt mensen frigjøres prostaglandiner som får tarmen til å trekke seg mer sammen. Mange får løsere mage og mer smerter, og hormonendringer kan gjøre tarmen mer følsom.','Varm, mild mat og varme på magen. Ikke bruk disse dagene til testfasen.'],
 reise:['Nye rutiner og magen','Endret døgnrytme, annen mat og annet drikkevann påvirker tarmen. Forstoppelse på reise er svært vanlig.','Ta med trygg mat, drikk nok og bruk guiden til å spise ute under Verktøy.'],
 syk:['Etter sykdom','Etter magesjau eller antibiotika kan tarmen være ekstra følsom i flere uker. Laktose tåles ofte dårligere en periode.','Skånsom mat og laktosefrie produkter en stund. Gi tarmen tid.'],
 kaffe:['Kaffe, alkohol og magen','Kaffe setter fart på tarmen, og alkohol irriterer tarmveggen og påvirker opptaket av vann. Øl og søte drinker inneholder også FODMAP.','Vann, te og mild mat i dag. Ved løs mage hjelper skånsomme karbohydrater som ris og potet.'],
 bevegelse:['Bevegelse og magen','Fysisk aktivitet hjelper tarmen å bevege seg og demper stress. Lite bevegelse gjør oftere magen treg og oppblåst.','En gåtur på 15–20 minutter etter middag kan hjelpe mye.'],
 flare:['Når magen blusser opp','En oppblussing er ofte summen av flere ting: stress, dårlig søvn, mat og hormoner. Tarmen er i alarmberedskap, og det som vanligvis går fint, kan gi plager.','Skånemodus er slått på i dag: bare streng lav-FODMAP, mild og lite fett. Det går over. Ta kontakt med lege ved blod i avføringen, feber, vekttap eller nattlige plager.']
};

/* Egenskaper ved hver oppskrift, lest ut fra navn og ingredienser */
const FEAT={};
function feats(r){if(FEAT[r.id])return FEAT[r.id];const t=norm(r.name+' '+r.desc+' '+r.ingr.map(i=>typeof i==='string'?i:i.t).join(' '));const h=re=>re.test(t);
 return FEAT[r.id]={
  fet:h(/rømmegrøt|ostekrem|[12] dl (raps)?olje|kremfløte|bacon|fløte|smørsaus|frityr|majones|kokosmelk|paibunn|pai\b|grateng|lasagne|carbonara|pulled|ribbe|svinestek|chorizo|peanøttsmør|bearnaise|brownie|karamell|mousse|fondant|halloumi|1\d0 g smør|200 g smør|makrell|pommes|ostekake|tiramisu/),
  sterk:h(/chili|cayenne|harissa|sriracha|karripasta|tandoori|garam masala/),
  mild:h(/suppe|(?<!rømme)grøt|\bris\b|risotto|potet|kylling|torsk|sei\b|hyse|egg|gulrot|polenta|havre|banan|omelett|dampet|kokt|pocher/),
  varm:h(/suppe|(?<!rømme)grøt|gryte|\bdal\b|curry|risotto/)||/stek|kok|ovn/.test(t),
  suppe:h(/suppe|(?<!rømme)grøt/),
  fiber:h(/havre|chia|linfrø|kiwi|quinoa|bokhvete|frø|kjerner|grønnkål|spinat|bær|surdeig|psyllium/),
  raa:h(/salat|ruccola|coleslaw|kålsalat/),
  kaal:h(/hvitkål|rødkål|brokkoli|rosenkål|grønnkål|kålsalat/),
  syrlig:h(/tomat|sitron|appelsin|lime|eddik/),
  ingefaer:h(/ingefær/),
  rask:r.time<=20,
  protein:h(/egg|kylling|laks|torsk|fisk|tofu|reker|kjøtt|kalkun|cottage|kvarg|tempeh|makrell|tunfisk|skyr/)}}
const FNAME={mild:'Mild',varm:'Varm',suppe:'Suppe eller grøt',fiber:'Fiberrik',ingefaer:'Ingefær',rask:'Rask å lage',protein:'Proteinrik'};
const RULE={
 luft:{minus:{raa:2,kaal:2,fet:1},plus:{varm:1,ingefaer:2,mild:1}},
 smerte:{minus:{fet:2,sterk:3,raa:1},plus:{varm:2,mild:2,suppe:1}},
 los:{minus:{fet:3,sterk:3,raa:1,fiber:1},plus:{mild:2,suppe:1,varm:1},strict:['fruktose','polyol','laktose']},
 treg:{minus:{fet:1},plus:{fiber:3,varm:1}},
 kvalme:{minus:{fet:3,sterk:2,syrlig:1},plus:{ingefaer:2,mild:2,rask:1}},
 halsbrann:{minus:{fet:2,sterk:3,syrlig:2},plus:{mild:1}},
 sliten:{minus:{},plus:{rask:2,protein:1}},
 sovn:{minus:{},plus:{rask:1,mild:1}},
 stress:{minus:{sterk:1},plus:{mild:1,varm:1}},
 mensen:{minus:{fet:1},plus:{varm:2,mild:1}}};

let FORM=Store.lget('form',{byDate:{}});
let FSAMPLE=null;
let draft=null;
function lg(g){return g==='gos'?'GOS (belgfrukter)':gname(g).toLowerCase()}
function todayKey(){return dayKey(new Date())}
function curForm(){return draft||FORM.byDate[todayKey()]||null}
function effAvoid(f){const s=new Set(state.avoid);if(!f)return s;if(f.level<=2)FOD.forEach(g=>s.add(g));(f.sx||[]).forEach(k=>(RULE[k]&&RULE[k].strict||[]).forEach(g=>s.add(g)));return s}
function withAvoid(set,fn){const old=state.avoid;state.avoid=set;try{return fn()}finally{state.avoid=old}}
function seeded(str){let h=hash(str);return()=>{h^=h<<13;h>>>=0;h^=h>>>17;h^=h<<5;h>>>=0;return h/4294967296}}
function scoreRecipe(r,f){const ft=feats(r);let s=0;const why=new Set();
 const keys=[...(f?f.sx||[]:[]),...(f?f.ctx||[]:[])];
 if(f&&f.level<=2)keys.push('_flare');if(f&&f.level===3)keys.push('_uro');
 const rules=keys.map(k=>k==='_flare'?{minus:{fet:3,sterk:3,raa:2,kaal:2},plus:{mild:2,varm:1,suppe:1}}:k==='_uro'?{minus:{fet:1,sterk:1},plus:{mild:1}}:RULE[k]).filter(Boolean);
 for(const ru of rules){for(const[k,w]of Object.entries(ru.minus))if(ft[k])s-=w;for(const[k,w]of Object.entries(ru.plus))if(ft[k]){s+=w;why.add(k)}}
 if(rules.some(ru=>ru.minus.fet)&&!ft.fet)why.add('_lavfett');
 return{s,why:[...why]}}
function nextMeal(){const h=new Date().getHours();return h<10?'frokost':h<14?'lunsj':h<20?'middag':'mellom'}
let sugMeal=null;
function suggest(f,filter,limit=6){const av=effAvoid(f);const rnd=seeded(todayKey());
 const list=withAvoid(av,()=>R.filter(r=>adapt(r).ok&&filter(r)).map(r=>({r,a:adapt(r),...scoreRecipe(r,f),j:rnd()})));
 list.sort((x,y)=>y.s-x.s||x.j-y.j);return list.slice(0,limit)}
function sugCard({r,a,why}){const tags=why.map(k=>k==='_lavfett'?'Lite fett':FNAME[k]).filter(Boolean);
 return`<article class="card" tabindex="0" role="button" data-id="${r.id}" aria-label="${esc(r.name)}">${media(r)}<div class="card-body"><div class="meta"><span>${MEALNAME[r.meal]}</span><span>·</span><span>${r.time} min</span></div><h3>${esc(r.name)}</h3><p>${esc(r.desc)}</p>
 <div class="reasons">${tags.slice(0,3).map(t=>`<span>${t}</span>`).join('')}${a.swaps?`<span class="tag swap">${a.swaps} ${a.swaps===1?'bytte':'bytter'}</span>`:''}</div></div></article>`}
function bindCards(root){root.querySelectorAll('.card').forEach(el=>{el.onclick=()=>openRecipeWith(el.dataset.id);el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openRecipeWith(el.dataset.id)}}})}
function openRecipeWith(id){const f=curForm();const av=effAvoid(f);if(av.size===state.avoid.size){openRecipe(id);return}withAvoid(av,()=>openRecipe(id))}

/* Lyst på noe bestemt */
const CRAVE=[
 [/pasta|spagett?i|lasagne|makaroni|gnocchi|nudl/,r=>/pasta|spagetti|lasagne|makaroni|gnocchi|orzo|linguine|nudl|carbonara|bolognese|pad thai|ramen|cacio/i.test(r.name)],
 [/pizza/,r=>/pizza|focaccia/i.test(r.name)],
 [/burger/,r=>/burger/i.test(r.name)],
 [/taco|meksikansk|tortilla|nacho|burrito|fajita|quesadilla/,r=>/taco|tortilla|nacho|quesadilla|fajita|meksikansk|burrito/i.test(r.name)],
 [/sushi|japansk|poke|miso/,r=>/sushi|onigiri|poke|teriyaki|miso|sushibolle/i.test(r.name)],
 [/asiatisk|wok|thai|kinesisk|indisk|curry|karri/,r=>/wok|thai|curry|karri|satay|pad thai|ramen|nudel|teriyaki|søtsur|indisk|dal\b|tikka|masala|sitrongress|sommerrull|bali/i.test(r.name)],
 [/suppe/,r=>/suppe/i.test(r.name)],
 [/søtt|dessert|kake|sjokolade|\bis\b|godteri|snop|kos/,r=>['dessert','bakst'].includes(r.meal)&&!/brød|knekkebrød|lomper|pizzadeig|rundstykker/i.test(r.name)||/sjokolade|smoothie|chia/i.test(r.name)&&r.meal==='mellom'],
 [/salt|snacks|chips|popcorn|småsulten|mellommåltid/,r=>r.meal==='mellom'],
 [/frokost|grøt|pannekake|vaffel|vafler/,r=>r.meal==='frokost'||/vafler|pannekake/i.test(r.name)],
 [/fisk|sjømat|laks|torsk|reke|sei\b|makrell/,r=>r.diets.includes('sjomat')&&['middag','lunsj'].includes(r.meal)],
 [/kylling/,r=>/kylling/i.test(r.name)],
 [/kjøtt|biff|kjøttdeig|svin|lam|kjøttkake/,r=>/kjøtt|biff|svin|lam|stek|kotelett|fårikål|lapskaus|stroganoff|bolognese|taco|ribbe|vilt/i.test(r.name)],
 [/vegetar|vegan|grønnsak|tofu/,r=>r.diets.includes('vegetar')&&['middag','lunsj'].includes(r.meal)],
 [/salat/,r=>/salat|tabbouleh|caprese|panzanella|niçoise/i.test(r.name)],
 [/egg|omelett/,r=>/egg|omelett|frittata|shakshuka/i.test(r.name)],
 [/brød|smørbrød|sandwich|toast|lunsj|matpakke/,r=>/brød|toast|sandwich|smørbrød|lompe|wrap|blt/i.test(r.name)],
 [/noe varmt|varm|kos|trøst/,r=>feats(r).varm&&['middag','lunsj'].includes(r.meal)],
 [/lett|lite|noe enkelt|raskt|kjapt/,r=>r.time<=20&&['middag','lunsj','frokost'].includes(r.meal)]];
const CRAVE_CHIPS=['Pasta','Pizza','Taco','Noe søtt','Suppe','Fisk','Asiatisk','Noe raskt'];
function craveFilter(q){const n=norm(q);const hits=CRAVE.filter(([re])=>re.test(n)).map(c=>c[1]);if(hits.length)return r=>hits.some(fn=>fn(r));
 return r=>norm(r.name+' '+r.desc+' '+r.ingr.map(i=>typeof i==='string'?i:i.t+' '+(i.s||'')).join(' ')).includes(n)}
function foodHits(q){const n=norm(q).replace(/^noe /,'');if(n.length<3)return[];const out=[];
 FOOD.forEach(c=>c.items.forEach(([name,st,note=''])=>{if(norm(name).includes(n)||n.includes(norm(name).split(' ')[0])&&norm(name).split(' ')[0].length>3)out.push({name,st,note})}));return out.slice(0,6)}

/* ---------- Visning ---------- */
function renderCheckin(){const f=curForm()||{level:null,sx:[],ctx:[],note:''};const saved=FORM.byDate[todayKey()];
 $('#checkin').innerHTML=`<div><h2>Dagsform</h2><p class="hidden-note">${saved&&!draft?`Lagret ${new Date(saved.ts).toLocaleTimeString('nb-NO',{hour:'2-digit',minute:'2-digit'})}. Du kan endre den når som helst i dag.`:'Tar ti sekunder. Forslagene under tilpasses med en gang.'}</p></div>
 <div class="levels" role="radiogroup" aria-label="Hvordan har magen det">${LEVELS.map(([l,n])=>`<button type="button" class="lvl" data-l="${l}" aria-pressed="${f.level===l}"><i></i>${n}</button>`).join('')}</div>
 <div class="field"><span>Hva kjennes mest?</span><div class="chips">${SX.map(([k,n])=>`<button type="button" class="pill" data-sx="${k}" aria-pressed="${(f.sx||[]).includes(k)}">${n}</button>`).join('')}</div></div>
 <div class="field"><span>Hva skjer rundt deg?</span><div class="chips">${CTX.map(([k,n])=>`<button type="button" class="pill" data-ctx="${k}" aria-pressed="${(f.ctx||[]).includes(k)}">${n}</button>`).join('')}</div></div>
 <label class="field" for="formNote"><span>Notat (valgfritt)</span><input id="formNote" value="${esc(f.note||'')}" placeholder="For eksempel: kramper etter lunsj"></label>
 <div class="row"><button class="btn btn-primary" type="button" id="saveForm" ${f.level?'':'disabled'}>Lagre dagsformen</button>${saved?'<button class="btn btn-ghost btn-sm" type="button" id="clearForm">Slett dagens</button>':''}</div>`;
 const edit=fn=>{draft=draft||JSON.parse(JSON.stringify(curForm()||{level:null,sx:[],ctx:[],note:''}));fn(draft);draft.note=$('#formNote').value;renderToday()};
 $('#checkin').querySelectorAll('[data-l]').forEach(b=>b.onclick=()=>edit(d=>{d.level=+b.dataset.l}));
 $('#checkin').querySelectorAll('[data-sx]').forEach(b=>b.onclick=()=>edit(d=>{d.sx=toggle(d.sx||[],b.dataset.sx)}));
 $('#checkin').querySelectorAll('[data-ctx]').forEach(b=>b.onclick=()=>edit(d=>{d.ctx=toggle(d.ctx||[],b.dataset.ctx)}));
 $('#formNote').oninput=()=>{draft=draft||JSON.parse(JSON.stringify(curForm()||{level:null,sx:[],ctx:[],note:''}));draft.note=$('#formNote').value;const b=$('#saveForm');if(b)b.disabled=!draft.level};
 $('#saveForm').onclick=()=>{const d=draft||curForm();if(!d||!d.level)return;FORM.byDate[todayKey()]={...d,ts:Date.now()};draft=null;Store.put('form',FORM);renderToday();toast('Dagsformen er lagret')};
 const c=$('#clearForm');if(c)c.onclick=()=>{delete FORM.byDate[todayKey()];draft=null;Store.put('form',FORM);renderToday()}}
function toggle(arr,k){return arr.includes(k)?arr.filter(x=>x!==k):[...arr,k]}
function renderWhy(){const f=curForm();const keys=[];if(f&&f.level<=2)keys.push('flare');(f?f.sx||[]:[]).forEach(k=>keys.push(k));(f?f.ctx||[]:[]).forEach(k=>keys.push(k));
 if(!keys.length){$('#why').innerHTML=`<h2>Hvorfor kjennes det slik?</h2><p class="hidden-note">Velg hva du kjenner, så forklarer appen hva som skjer i kroppen og hva som pleier å hjelpe.</p>
  <div class="why-item"><h3>IBS i korte trekk</h3><p>Ved IBS er tarmen ikke skadet, men den er mer følsom og beveger seg annerledes. Signalene mellom tarm og hjerne er skrudd opp. Derfor kan mat, stress, søvn og hormoner gi tydelige plager selv om prøvene er normale.</p></div>`;return}
 $('#why').innerHTML=`<h2>Hvorfor kjennes det slik?</h2>${keys.slice(0,4).map(k=>{const[t,b,h]=WHY[k];return`<div class="why-item"><h3>${t}</h3><p>${b}</p><p class="helps">Hjelper ofte: ${h}</p></div>`}).join('')}
 ${keys.length>4?`<p class="hint">Og ${keys.length-4} til. Velg færre for å se forklaringen på dem.</p>`:''}
 ${keys.includes('stress')||keys.includes('smerte')?`<button class="btn btn-ghost btn-sm" type="button" id="goBreath">Start Ro i magen</button>`:''}`;
 const gb=$('#goBreath');if(gb)gb.onclick=()=>{location.hash='verktoy';setTimeout(()=>{$('#tool-breath').scrollIntoView({behavior:'smooth'})},50)}}
function renderSuggestions(){const f=curForm();const q=$('#crave').value.trim();const meal=sugMeal||nextMeal();const av=effAvoid(f);const extra=[...av].filter(g=>!state.avoid.has(g));
 $('#craveChips').innerHTML=(q?'':MEALS.filter(([k])=>['frokost','lunsj','middag','mellom'].includes(k)).map(([k,l])=>`<button class="chip" type="button" data-sm="${k}" aria-pressed="${meal===k}">${l}</button>`).join(''))+CRAVE_CHIPS.map(c=>`<button class="chip" type="button" data-cv="${c}" aria-pressed="${norm(q)===norm(c)}">${c}</button>`).join('');
 $('#craveChips').querySelectorAll('[data-sm]').forEach(b=>b.onclick=()=>{sugMeal=b.dataset.sm;renderSuggestions()});
 $('#craveChips').querySelectorAll('[data-cv]').forEach(b=>b.onclick=()=>{$('#crave').value=norm(q)===norm(b.dataset.cv)?'':b.dataset.cv;renderSuggestions()});
 const mode=extra.length?`<div class="mode"><b>${f.level<=2?'Skånemodus i dag.':'Litt strengere i dag.'}</b> Unngår også ${extra.map(g=>lg(g)).join(', ')} uten å endre innstillingene dine.</div>`:'';
 let list,info='';
 if(q){const fl=craveFilter(q);list=suggest(f,fl,9);const all=R.filter(fl);const blocked=withAvoid(av,()=>all.filter(r=>!adapt(r).ok));
  $('#sugTitle').textContent=`Lyst på ${q.toLowerCase()}?`;
  $('#sugNote').textContent=list.length?`${list.length} forslag som passer det du tåler${f?' og dagsformen din':''}, de beste først.`:'';
  const fh=foodHits(q);
  info=mode+(fh.length?`<div class="food-hint">${fh.map(x=>`<span class="${x.st}"><b>${esc(x.name)}:</b> ${x.st==='ok'?'trygt':x.st==='lite'?'små porsjoner':'unngå i starten'}${x.note?` (${esc(x.note)})`:''}</span>`).join('')}</div>`:'')
   +(blocked.length?`<p class="hint">${blocked.length} ${blocked.length===1?'rett':'retter'} med ${esc(q.toLowerCase())} passer ikke i dag fordi de inneholder ${[...new Set(withAvoid(av,()=>blocked.flatMap(r=>adapt(r).block)))].map(g=>lg(g)).join(', ')}.</p>`:'')
   +(!list.length&&!all.length?`<p class="hint">Fant ingen oppskrifter på «${esc(q)}». Prøv et annet ord, eller spør Claude under.</p>`:'');}
 else{list=suggest(f,r=>r.meal===meal,6);$('#sugTitle').textContent=`Forslag til ${MEALNAME[meal].toLowerCase()}`;
  $('#sugNote').textContent=f?`Valgt ut fra dagsformen din: ${LNAME[f.level].toLowerCase()}${(f.sx||[]).length?', '+f.sx.map(k=>SXN[k].toLowerCase()).join(', '):''}.`:'Fyll inn dagsformen, så blir forslagene tilpasset magen din i dag.';info=mode}
 $('#craveInfo').innerHTML=info;$('#sugGrid').innerHTML=list.map(sugCard).join('');bindCards($('#sugGrid'));renderAiBox(list)}
let sampleFn=null,aiCtl=null;
function renderAiBox(list){if(!sampleFn){$('#aiBox').innerHTML='';return}
 $('#aiBox').innerHTML=`<div class="ai" id="aiInner"><div class="row" style="justify-content:space-between"><div><b>Spør Claude</b><p class="hint" style="margin:2px 0 0">Få en personlig vurdering ut fra dagsform, det du tåler og det du har lyst på.</p></div><button class="btn btn-primary btn-sm" type="button" id="askAi">Spør Claude</button></div><div id="aiOut"></div></div>`;
 $('#askAi').onclick=()=>askAi(list)}
async function askAi(list){const f=curForm();const q=$('#crave').value.trim();const av=effAvoid(f);
 const cands=(list.length?list:suggest(f,()=>true,25)).concat(suggest(f,r=>['middag','lunsj'].includes(r.meal),15)).filter((x,i,a)=>a.findIndex(y=>y.r.id===x.r.id)===i).slice(0,25);
 const prompt=`Du er en varm og praktisk kostveileder for en person med IBS som følger lav-FODMAP. Svar på norsk bokmål, kort og konkret, uten å stille diagnoser.
Dagsform: ${f?LNAME[f.level]:'ikke oppgitt'}. Plager: ${f&&f.sx&&f.sx.length?f.sx.map(k=>SXN[k]).join(', '):'ingen oppgitt'}. Rundt personen: ${f&&f.ctx&&f.ctx.length?f.ctx.map(k=>CTXN[k]).join(', '):'ingenting oppgitt'}.${f&&f.note?' Notat: '+f.note:''}
Unngår (FODMAP-grupper og annet): ${[...av].map(gname).join(', ')||'ingenting'}.
Har lyst på: ${q||'ikke oppgitt, foreslå neste måltid'}.
Velg opptil 3 oppskrifter BARE fra denne listen (id | navn | beskrivelse):
${cands.map(x=>`${x.r.id} | ${x.r.name} | ${x.r.desc}`).join('\n')}
Svar som JSON: {"intro":"2–3 setninger om hva som passer i dag og hvorfor","picks":[{"id":"...","why":"én setning"}],"tip":"ett praktisk råd for resten av dagen"}`;
 const out=$('#aiOut');out.innerHTML='<p class="hint">Tenker …</p>';$('#askAi').disabled=true;
 try{const res=await sampleFn.json(prompt,{modelTier:'quick'});const picks=(res.picks||[]).filter(p=>byId(p.id)).slice(0,3);
  out.innerHTML=`<p>${esc(res.intro||'')}</p>${picks.length?`<ul>${picks.map(p=>`<li><a data-ai="${esc(p.id)}">${esc(byId(p.id).name)}</a>: ${esc(p.why||'')}</li>`).join('')}</ul>`:''}${res.tip?`<p class="helps" style="color:var(--accent);font-weight:600">Tips: ${esc(res.tip)}</p>`:''}<p class="hint">Generelle råd, ikke medisinsk vurdering.</p>`;
  out.querySelectorAll('[data-ai]').forEach(a=>a.onclick=()=>openRecipeWith(a.dataset.ai))}
 catch(e){const c=e&&e.code;if(c==='not_granted'){sampleFn=null;$('#aiBox').innerHTML='';return}out.innerHTML=`<p class="hint">${c==='rate_limited'?'Mange spørsmål akkurat nå. Prøv igjen om litt.':'Fikk ikke svar denne gangen. Forslagene over fungerer uansett.'}</p>`}
 finally{const b=$('#askAi');if(b)b.disabled=false}}
function formEntries(){const src=FSAMPLE||FORM.byDate;return Object.entries(src).map(([k,v])=>({k,...v})).sort((a,b)=>a.k<b.k?-1:1)}
function renderTrend(){const es=formEntries();const today=new Date();today.setHours(12,0,0,0);
 const days=[...Array(30)].map((_,i)=>{const d=new Date(today);d.setDate(d.getDate()-29+i);const k=dayKey(d);const e=(FSAMPLE||FORM.byDate)[k];return{d,k,e}});
 const logged=days.filter(x=>x.e);
 if(!logged.length){$('#trend').innerHTML=`<div><h2>Slik har magen hatt det</h2><p class="hidden-note">Sjekk inn hver dag, så ser du trenden her, og hva som går igjen på de dårlige dagene.</p></div><div><button class="btn btn-ghost btn-sm" type="button" id="trendSample">Vis med eksempeldata</button></div>`;$('#trendSample').onclick=()=>{FSAMPLE=makeFormSample();renderTrend()};return}
 const W=600,H=170,L=78,Rr=10,T=10,Bt=26;const x=i=>L+i*(W-L-Rr)/29,y=l=>T+(5-l)*(H-T-Bt)/4;
 const col=l=>l>=5?'var(--ok)':l===4?'color-mix(in srgb,var(--ok) 55%,var(--sun))':l===3?'var(--sun)':l===2?'color-mix(in srgb,var(--tomato) 70%,var(--sun))':'var(--tomato)';
 let path='';days.forEach((dd,i)=>{if(dd.e)path+=(path&&days[i-1]&&days[i-1].e?'L':'M')+x(i).toFixed(1)+' '+y(dd.e.level).toFixed(1)});
 const svg=`<svg class="trend-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Dagsform de siste 30 dagene">
 ${LEVELS.map(([l,n])=>`<line x1="${L}" x2="${W-Rr}" y1="${y(l)}" y2="${y(l)}" style="stroke:var(--line);stroke-width:1"/><text x="${L-8}" y="${y(l)+4}" text-anchor="end" font-size="11" style="fill:var(--muted)">${n}</text>`).join('')}
 <path d="${path}" style="fill:none;stroke:var(--accent);stroke-width:2;stroke-linejoin:round;opacity:.55"/>
 ${days.map((dd,i)=>dd.e?`<circle cx="${x(i)}" cy="${y(dd.e.level)}" r="${i===29?6:4.5}" style="fill:${col(dd.e.level)};stroke:var(--surface);stroke-width:1.5"><title>${dd.d.toLocaleDateString('nb-NO',{weekday:'short',day:'numeric',month:'short'})}: ${LNAME[dd.e.level]}</title></circle>`:'').join('')}
 <text x="${L}" y="${H-6}" font-size="11" style="fill:var(--muted)">${days[0].d.toLocaleDateString('nb-NO',{day:'numeric',month:'short'})}</text><text x="${W-Rr}" y="${H-6}" font-size="11" style="fill:var(--muted)" text-anchor="end">i dag</text></svg>`;
 const avg=a=>a.length?a.reduce((s,e)=>s+e.level,0)/a.length:null;const last7=days.slice(-7).filter(d=>d.e).map(d=>d.e),prev7=days.slice(-14,-7).filter(d=>d.e).map(d=>d.e);
 const a7=avg(last7),p7=avg(prev7);const good=logged.filter(d=>d.e.level>=4).length;
 const sxCount={};logged.forEach(d=>(d.e.sx||[]).forEach(k=>sxCount[k]=(sxCount[k]||0)+1));const topSx=Object.entries(sxCount).sort((a,b)=>b[1]-a[1])[0];
 const ctxRes=CTX.map(([k,n])=>{const w=logged.filter(d=>(d.e.ctx||[]).includes(k)).map(d=>d.e),wo=logged.filter(d=>!(d.e.ctx||[]).includes(k)).map(d=>d.e);return{n,cnt:w.length,a:avg(w),b:avg(wo)}}).filter(c=>c.cnt>=2&&c.b!==null&&c.b-c.a>=.7).sort((a,b)=>(b.b-b.a)-(a.b-a.a));
 const fmt=v=>v.toFixed(1).replace('.',',');const word=v=>LNAME[Math.round(v)]||'';
 $('#trend').innerHTML=`${FSAMPLE?`<div class="banner"><span>Du ser eksempeldata. Ingenting av dette er lagret.</span><button class="btn btn-ghost btn-sm" type="button" id="trendNoSample">Fjern eksempeldata</button></div>`:''}
 <div><h2>Slik har magen hatt det</h2><p class="hidden-note">Dagsformen de siste 30 dagene.</p></div>${svg}
 <div class="trend-stats"><div>Siste 7 dager<b>${a7?`${word(a7)} (${fmt(a7)})`:'Ikke logget'}</b>${a7&&p7?`<span class="hint">${a7-p7>=.3?'Bedre enn uka før':a7-p7<=-.3?'Dårligere enn uka før':'Omtrent som uka før'}</span>`:''}</div>
 <div>Gode dager<b>${good} av ${logged.length}</b><span class="hint">«Bra» eller «Veldig bra»</span></div>
 ${topSx?`<div>Vanligste plage<b>${SXN[topSx[0]]}</b><span class="hint">${topSx[1]} av ${logged.length} dager</span></div>`:''}
 ${ctxRes.length?`<div>Henger sammen med dårligere dager<b>${ctxRes.slice(0,2).map(c=>c.n).join(' og ')}</b><span class="hint">${ctxRes.slice(0,2).map(c=>`${c.n.toLowerCase()}: snitt ${fmt(c.a)} mot ${fmt(c.b)} ellers`).join('. ')}</span></div>`:''}</div>
 <p class="hint">Snitt på skalaen 1 (oppbluss) til 5 (veldig bra). Sammenhenger er hint, ikke bevis. Matgruppene ser du under Dagbok.</p>`;
 const ns=$('#trendNoSample');if(ns)ns.onclick=()=>{FSAMPLE=null;renderTrend()}}
function makeFormSample(){const out={};const today=new Date();for(let i=27;i>=0;i--){const d=new Date(today);d.setDate(d.getDate()-i);const k=dayKey(d);if(i%9===4)continue;
 const sov=i%5===1,str=i%6===2||i%6===3,men=i>=12&&i<=15;let l=4+(i%3===0?1:0);if(sov)l-=1;if(str)l-=1;if(men)l-=2;l=Math.max(1,Math.min(5,l));
 const sx=[];if(l<=3)sx.push('luft');if(str||men)sx.push('smerte');if(men)sx.push('los');if(sov)sx.push('sliten');
 const ctx=[];if(sov)ctx.push('sovn');if(str)ctx.push('stress');if(men)ctx.push('mensen');out[k]={level:l,sx,ctx,note:'',ts:d.getTime()}}return out}
function renderToday(){const d=new Date();const h=d.getHours();
 $('#todayDate').textContent=d.toLocaleDateString('nb-NO',{weekday:'long',day:'numeric',month:'long'});
 $('#todayHello').textContent=(h<10?'God morgen':h<17?'Hei':'God kveld')+'. Hvordan har magen det i dag?';
 const f=curForm();$('#todayStatus').textContent=f&&f.level?`I dag: ${LNAME[f.level].toLowerCase()}${(f.sx||[]).length?' med '+f.sx.map(k=>SXN[k].toLowerCase()).join(', '):''}.${draft?' Ikke lagret ennå.':''}`:'Ingen dagsform registrert i dag.';
 renderCheckin();renderWhy();renderSuggestions();renderTrend()}

/* Rapporten i dagboken tar med dagsformen */
const _report=report;report=function(){const es=formEntries().slice(-30);if(!es.length)return _report();
 return _report()+'\n\nDAGSFORM (1 = oppbluss, 5 = veldig bra)\n'+es.map(e=>`${new Date(e.k+'T12:00').toLocaleDateString('nb-NO',{weekday:'short',day:'numeric',month:'short'})}: ${e.level} ${LNAME[e.level]}${(e.sx||[]).length?' – '+e.sx.map(k=>SXN[k].toLowerCase()).join(', '):''}${(e.ctx||[]).length?' ['+e.ctx.map(k=>CTXN[k].toLowerCase()).join(', ')+']':''}${e.note?' – '+e.note:''}`).join('\n')};
const _onView=onView;onView=function(v){_onView(v);if(v==='idag')renderToday()};
const _onAvoid=onAvoidChange;onAvoidChange=function(){_onAvoid();if(!$('#view-idag').hidden)renderSuggestions()};
$('#crave').addEventListener('input',()=>{clearTimeout(window._cv);window._cv=setTimeout(renderSuggestions,250)});
(async()=>{if(window.claude&&window.claude.use){try{sampleFn=await claude.use('sample')}catch(e){sampleFn=null}if(!$('#view-idag').hidden)renderSuggestions()}})();
cloudReady.then(async()=>{if(!Store.cloud)return;try{const v=await Store.load('form');if(v===undefined)Store.put('form',FORM);else{FORM=v&&v.byDate?v:{byDate:{}};Store.lset('form',FORM)}}catch(e){}if(!$('#view-idag').hidden)renderToday()});
show(location.hash.slice(1));
