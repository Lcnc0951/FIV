// Leser oppskrifter/*.txt, sjekker FODMAP-merking og skriver recipes.json
// Format:
// # id | Navn | måltid | kosthold (m,v,s eller -) | minutter | porsjoner | kilde-url (valgfri)
// = Kort beskrivelse
// - ingrediens
// - ingrediens [tag tag] => bytte
// > steg
// ! tips
const fs=require('fs'),path=require('path');
const dir=path.join(__dirname,'..','oppskrifter');
const MEAL={f:'frokost',l:'lunsj',m:'middag',s:'mellom',d:'dessert',b:'bakst',t:'tilbehor'};
const DIET={m:'middelhav',v:'vegetar',s:'sjomat'};
const TAGS=['fruktan','gos','laktose','fruktose','polyol','gluten','egg','notter','fisk','skalldyr','sterkt'];
const out=[],errs=[],warn=[];let cur=null;
for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.txt')).sort()){
 fs.readFileSync(path.join(dir,f),'utf8').split('\n').forEach((raw,n)=>{const l=raw.trim();if(!l)return;const where=`${f}:${n+1}`;
  const k=l[0],v=l.slice(1).trim();
  if(k==='#'){const p=v.split('|').map(s=>s.trim());const[id,name,meal,diets,time,serv,src]=p;
   if(!MEAL[meal])errs.push(`${where} ukjent måltid ${meal}`);
   cur={id,name,meal:MEAL[meal],diets:diets==='-'?[]:diets.split(',').map(d=>{if(!DIET[d])errs.push(`${where} ukjent kosthold ${d}`);return DIET[d]}),time:+time,serv:+serv,desc:'',ingr:[],steps:[],tip:'',where};if(src)cur.src=src;out.push(cur)}
  else if(!cur)errs.push(`${where} linje før første #`);
  else if(k==='=')cur.desc=v;
  else if(k==='-'){const m=v.match(/^(.*?)\s*\[([^\]]+)\]\s*(?:=>\s*(.*))?$/);if(m){const all=m[2].trim().split(/\s+/);all.forEach(t=>{if(!TAGS.includes(t.replace('!','')))errs.push(`${where} ukjent tag ${t}`)});const o={t:m[1],g:all.filter(t=>t[0]!=='!').join(' ')};const h=all.filter(t=>t[0]==='!').map(t=>t.slice(1));if(h.length)o.h=h.join(' ');if(m[3])o.s=m[3];cur.ingr.push(o)}else cur.ingr.push(v)}
  else if(k==='>')cur.steps.push(v);
  else if(k==='!')cur.tip=v;
  else errs.push(`${where} ukjent linje: ${l}`)})}
// Kontroll av merking
const W='(?<![a-zæøå])';
const RULES=[
 ['fruktan',new RegExp(`${W}(løk|rødløk|hvitløk(?!solje)|sjalottløk|purre(?!, (bare )?(den )?grønn)|hvete|rug|couscous|bulgur|tortilla|lompe|hvetemel|byggryn)`,'i'),/vårløk|gressløk|grønn del|grønne del|det grønne|hvitløksolje|glutenfri|spelt|surdeig|uten løk|uten hvitløk/i],
 ['laktose',new RegExp(`${W}(melk|yoghurt|fløte|rømme|crème fraîche|creme fraiche|kremost|cottage|ricotta|kesam|kvarg|iskrem|brunost|prim|matfløte|kulturmelk)`,'i'),/laktosefri|mandelmelk|kokosmelk|havremelk|rismelk|soyamelk|kokosfløte|kokosyoghurt|havrefløte/i],
 ['gluten',new RegExp(`${W}(hvete|spelt|rug|bygg|pasta|spagetti|spaghetti|lasagneplater|brød|soyasaus|havre|couscous|tortilla|panko|griljermel|hvetemel|speltmel|eggnudler|rundstykke|pitabrød|knekkebrød|lompe|wrap|pizzadeig|pizzabunn|nudler)`,'i'),/glutenfri|tamari|risnudler|risnudl|ris-|maistortilla|rispapir|bokhvete|maismel|rismel/i],
 ['egg',new RegExp(`${W}egg(?!plante)`,'i'),/chiaegg|linfrøegg/i],
 ['fisk',new RegExp(`${W}(laks|torsk|sei|makrell|tunfisk|ørret|hyse|lange|kveite|sardin|ansjos|fisk|steinbit|rødspette|røkelaks|fiskekraft|fiskesaus|kaviar|sild|breiflabb|klippfisk)`,'i'),/fiskefri/i],
 ['skalldyr',new RegExp(`${W}(reker|scampi|krabbe|blåskjell|hummer|kamskjell|skjell|kreps|sjøkreps)`,'i'),null],
 ['notter',new RegExp(`${W}(nøtt|peanøtt|mandel|mandler|valnøtt|cashew|pistasj|hasselnøtt|pekan|macadamia|nøtter|pinjekjerner)`,'i'),null],
 ['sterkt',new RegExp(`${W}(chili|cayenne|sriracha|jalapeño|jalapeno|harissa|tabasco|sambal)`,'i'),/sløyf|dropp/i],
 ['fruktose',new RegExp(`${W}(honning|agave|mango|eple(?!cider)|epler|pære|eplejuice)`,'i'),/honningmelon/i],
 ['polyol',new RegExp(`${W}(sopp|champignon|blomkål|avokado|sukkererter|plomme|fersken|nektarin|aprikos|kirsebær|xylitol|sorbitol|søtpotet)`,'i'),/østerssopp/i],
 ['gos',new RegExp(`${W}(bønner|linser|kikerter|hummus|silketofu|erter|cashew|kidney)`,'i'),/grønne bønner|aspargesbønner/i]
];
const MEAT=/(?<![a-zæøå])(kylling|kalkun|kjøtt|bacon|skinke|svin|storfe|lam|biff|pølse|karbonade|entrecôte|indrefilet|ytrefilet|spekeskinke|chorizo|salami|kjøttdeig)/i;
for(const r of out){
 if(!r.desc)warn.push(`${r.where} ${r.id}: mangler beskrivelse`);
 if(r.ingr.length<3)warn.push(`${r.where} ${r.id}: få ingredienser`);
 if(r.steps.length<1)warn.push(`${r.where} ${r.id}: få steg`);
 for(const i of r.ingr){const text=typeof i==='string'?i:i.t;const tags=typeof i==='string'?[]:(i.g+' '+(i.h||'')).trim().split(/\s+/);const soft=typeof i==='string'?[]:i.g.split(' ');
  for(const[t,re,ok]of RULES){if(re.test(text)&&!(ok&&ok.test(text))&&!tags.includes(t))warn.push(`${r.where} ${r.id}: «${text}» mangler [${t}]?`)}
  if(typeof i!=='string'&&i.s){for(const[t,re,ok]of RULES){if(soft.includes(t)&&re.test(i.s)&&!(ok&&ok.test(i.s)))warn.push(`${r.where} ${r.id}: bytte «${i.s}» inneholder fortsatt ${t}?`)}}
  if(r.diets.includes('vegetar')&&(MEAT.test(text)||RULES[4][1].test(text)&&!/fiskefri/.test(text)||RULES[5][1].test(text))&&!(typeof i!=='string'&&i.s&&!MEAT.test(i.s)))warn.push(`${r.where} ${r.id}: vegetar, men «${text}»`)}
 if(r.diets.includes('sjomat')&&!r.ingr.some(i=>{const tg=typeof i==='string'?'':i.g+' '+(i.h||'');return /fisk|skalldyr/.test(tg)}))warn.push(`${r.where} ${r.id}: sjømat uten fisk/skalldyr-tag`);
 delete r.where}
const ids=new Set();for(const r of out){if(ids.has(r.id))errs.push(`dobbel id ${r.id}`);ids.add(r.id)}
const byMeal={};out.forEach(r=>byMeal[r.meal]=(byMeal[r.meal]||0)+1);
console.log(`${out.length} oppskrifter`,byMeal);
if(warn.length)console.log('ADVARSLER:\n'+warn.join('\n'));
if(errs.length){console.log('FEIL:\n'+errs.join('\n'));process.exit(1)}
fs.writeFileSync(path.join(__dirname,'..','recipes.json'),JSON.stringify(out));
