// Bygger recipes.json inn i app.html og lager index.html for vanlig nettleser
const fs=require('fs'),path=require('path');const d=path.join(__dirname,'..');
const data=fs.readFileSync(path.join(d,'recipes.json'),'utf8').replace(/<\//g,'<\\/');
let app=fs.readFileSync(path.join(d,'app.html'),'utf8');
app=app.replace(/\/\*EXTRA_START\*\/[\s\S]*?\/\*EXTRA_END\*\//,()=>`/*EXTRA_START*/${data}/*EXTRA_END*/`);
const feat=(fs.readFileSync(path.join(d,'features.js'),'utf8')+'\n'+fs.readFileSync(path.join(d,'dagsform.js'),'utf8')).replace(/<\//g,'<\\/');
app=app.replace(/\/\*FEATURES_START\*\/[\s\S]*?\/\*FEATURES_END\*\//,()=>`/*FEATURES_START*/\n${feat}\n/*FEATURES_END*/`);
fs.writeFileSync(path.join(d,'app.html'),app);
fs.writeFileSync(path.join(d,'index.html'),`<!doctype html>\n<html lang="nb">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n</head>\n<body>\n${app}\n</body>\n</html>\n`);
console.log('app.html',Math.round(app.length/1024),'KB');
