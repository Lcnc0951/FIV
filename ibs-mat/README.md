# Magevennlig kjøkken

IBS-vennlige oppskrifter (lav-FODMAP, middelhav, vegetar, sjømat) som tilpasser seg det brukeren ikke tåler.

## Funksjoner
- **Oppskrifter (400)** som tilpasser seg det brukeren ikke tåler, med porsjonsskalering, kokemodus, «Legg i ukeplan» og «Jeg spiste dette».
- **Ukeplan og handleliste**: fyll uka automatisk (fisk 3 ganger og vegetar 2 ganger), og få en handleliste med byttene innbakt.
- **Magedagbok**: måltider, symptomer, Bristol-skala og stress. Viser en 14-dagersoversikt, mulige utløsere (2–24 timer etter måltid) og en rapport til ernæringsfysiolog.
- **Testfase**: guidet reintroduksjon av 8 FODMAP-undergrupper over 3 dager. Resultatene kan oppdatere «tåler ikke».
- **Verktøy**: etikettsjekk for ingredienslister, en guide til å spise ute, og pusteøvelsen «Ro i magen».
- **Lagring**: privat per bruker i Claude-kontoen (`db`, under `data/users/<id>/`). Den frittstående `index.html` bruker nettleserens lagring.

## Filer
- `app.html` – selve appen (publiseres som artifact). `index.html` er samme app for vanlig nettleser.
- `oppskrifter/*.txt` – alle oppskriftene i et enkelt tekstformat.
- `tools/build.js` – leser oppskriftene, sjekker FODMAP-merkingen og lager `recipes.json`.
- `features.js` – ukeplan, dagbok, testfase og verktøy.
- `tools/bundle.js` – bygger `recipes.json` og `features.js` inn i `app.html` og `index.html`.

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
