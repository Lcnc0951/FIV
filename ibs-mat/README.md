# Magevennlig kjøkken

IBS-vennlige oppskrifter (lav-FODMAP, middelhav, vegetar, sjømat) som tilpasser seg det brukeren ikke tåler.

## Filer
- `app.html` – selve appen (publiseres som artifact). `index.html` er samme app for vanlig nettleser.
- `oppskrifter/*.txt` – alle oppskriftene i et enkelt tekstformat.
- `tools/build.js` – leser oppskriftene, sjekker FODMAP-merkingen og lager `recipes.json`.
- `tools/bundle.js` – bygger `recipes.json` inn i `app.html` og `index.html`.

## Legge til en oppskrift
```
# id | Navn | måltid (f,l,m,s,d,b,t) | kosthold (m,v,s eller -) | minutter | porsjoner | kilde-url (valgfri)
= Kort beskrivelse
- ingrediens uten merking
- ingrediens [fruktan gluten] => bytte når brukeren unngår dette
- ingrediens [fisk]                (ingen bytte: retten skjules)
- fiskekraft [fruktan !fisk] => fiskekraft uten løk   (! = kan ikke byttes bort)
> steg
! magetips
```
Tagger: fruktan, gos, laktose, fruktose, polyol, gluten, egg, notter, fisk, skalldyr, sterkt.

Kjør så `node tools/build.js && node tools/bundle.js`. Byggesteget advarer hvis en ingrediens ser ut til å mangle riktig tagg.

Oppskrifter med kilde-url er skrevet med egne ord og inspirert av den lenkede siden.
