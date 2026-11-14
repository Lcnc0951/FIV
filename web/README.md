# FIV – nettappen

Samme PT-motor som iPhone-appen, men den kjører i nettleseren. Du trenger ingen Mac.

- **Kroppsskann med kamera og AI.** MediaPipe Pose kjører lokalt på telefonen. To bilder (forfra og fra siden) og høyden din som målestokk gir omkretser, symmetri og holdning. Bildene lagres ikke.
- **Fett, muskler og holdning.** Fettprosent og plan for fettap, muskelbalanse mot ønsket kroppsform, og holdningsrutine.
- **Treningsprogram per treningssted**, ut fra utstyret og manualvektene du har. Inkluderer bytte av øvelse, animerte øvelser, øktlogging med vektforslag og kondisjonsplan.
- **LiDAR er klar, men av.** Den aktiveres under Profil → Skannemetode. Skann fra iPhone-appen kan importeres som JSON nå. Når iPhone-appen åpner nettappen i en WebView med `window.webkit.messageHandlers.fivLidar`, kan nettappen starte LiDAR-skann direkte (`src/scan/providers.ts`).

## Utvikling

```bash
cd web
npm install
npm run setup      # kopierer MediaPipe wasm og henter AI-modellen (ca. 23 MB)
npm run dev        # http://localhost:5173
npm test           # PT-motor og målelogikk
npm run artifact   # bygger web/artifact/ for publisering
```

Øvelser, kunnskapsartikler og animasjoner genereres fra Swift-kildene (`npm run gen`), så iOS og web deler én sannhet.

## Struktur

```
src/engine/   PT-motoren (TypeScript-port av FIV/Coach): analyse, program, fett, progresjon
src/scan/     MediaPipe, måling fra maske + landemerker, skannemetoder (kamera / LiDAR)
src/data/     lagring (privat sky i Claude, ellers localStorage) + genererte data
src/ui/       skjermer
```

## Lagring

Som Claude-artifact lagres data privat på kontoen din (`data/users/<id>/fiv`), og ingen andre kan lese dem. Andre steder, for eksempel lokalt eller på egen server, brukes nettleserens localStorage. Sikkerhetskopi finnes under Profil → Data.
