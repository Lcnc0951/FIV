# FIV – din personlige PT med LiDAR-kroppsskanning

iPhone-app (SwiftUI, iOS 18+, laget for iPhone 17 Pro) som skanner kroppen din med LiDAR og ARKit, analyserer proporsjoner, ubalanser og holdning, og lager et målrettet treningsprogram basert på oppdatert treningsforskning.

## Funksjoner

| | |
|---|---|
| **Kroppsskanning** | To-posisjons skann (forfra + fra siden) med ARKit body tracking (91 ledd) + LiDAR-dybde. Norsk taleveiledning, så du kan stå 3 m unna. |
| **Mål** | Hals, bryst, midje, hofte, overarmer V/H, lår V/H, arm- og beinlengder, skulderbredde, skulder-/bekkenskjevhet, fremoverlent hode. Kan korrigeres med målebånd. |
| **Analyse** | Fettprosent (U.S. Navy), fettfri masse, FFMI, midje/høyde-ratio, over-/underkropp-balanse, V-form, venstre/høyre-asymmetri, fremgang siden forrige skann. |
| **Fett & plan** | Fettprosent, fettmasse og fettfri masse, kategori (ACE), *hvor* fettet sitter (midje/hofte, midje/høyde), risiko for bukfett (visceralt fett). Velg målfettprosent → fett som skal bort, målvekt, antall uker, kalorier, protein og skritt, graf med forventet utvikling, ukentlig justeringsregel. Fungerer uten skann (grovt BMI-anslag). |
| **Utstyr & steder** | Legg inn treningssteder (hjemme, senteret, hytta) med nøyaktig hvilke apparater og hvilke manual- og kettlebellvekter du har. Hvert sted får eget program. Vektforslag rundes til manualene du faktisk har. Med lette vekter får du flere reps, ettsidige varianter og lengre nedfase. |
| **Øvelsesvisning** | Hver øvelse vises som en animert figur der musklene som trenes er markert. Ligger det en ekte video eller AI-video i appen, brukes den i stedet. Du kan bytte øvelse til alternativer som passer utstyret ditt. |
| **Program** | Splitt etter antall dager (helkropp / over-under / PPL), ukentlig volum per muskel med fraksjonell telling, ekstra volum til muskler som henger etter, ettsidige øvelser (svakeste side først) ved ubalanse, korrektiv oppvarming ved holdningsfunn, øvelsesbytte ved kne-/rygg-/skulderplager. |
| **Progresjon** | Dobbel progresjon med automatiske vekt-/repsforslag, RIR-styring, mesosyklus med deload, pausetimer, estimert 1RM. |
| **Kondisjon** | Sone 2 og norske 4×4-intervaller med pulssoner fra HUNT-formelen (211 − 0,64 × alder), daglig skrittmål. |
| **Ernæring** | Kalorier (Katch-McArdle når fettprosent er kjent), protein 1,6–2,2 g/kg etter mål, makroer, fiber, tilskudd. |
| **PT-kunnskap** | 15 artikler med kilder: volum, RIR, trening i strukket posisjon, frekvens, progresjon, pauser, protein, fettap (inkl. GLP-1), kreatin, VO₂maks, sone 2/skritt, søvn, holdning, trening med vondt, og hvordan skannet fungerer. |

## Slik bygger du appen

Krever Mac med Xcode 16 eller nyere og en fysisk iPhone med LiDAR (kroppsskanning virker ikke i simulatoren).

```bash
brew install xcodegen
cd FIV
xcodegen generate
open FIV.xcodeproj
```

1. Velg ditt Apple-utviklerteam under *Signing & Capabilities* for target `FIV`.
2. Koble til iPhonen, velg den som mål og trykk ▶︎.
3. Kjør testene med ⌘U (PT-motoren er ren Swift og testes uten kamera).

## 3D-skann fra gratis LiDAR-apper (uten egen app)

Nettappen kan importere en 3D-modell av kroppen og måle omkretsene direkte på den (Skann → *3D-skann med LiDAR*). Da trengs ingen egen app:

1. Last ned **Scaniverse** (gratis) på en iPhone Pro. Velg LiDAR-modus og en modus som lager mesh.
2. Stå stille i A-stilling mens noen går en runde rundt deg. Beskjær bort rommet.
3. Eksporter som PLY eller OBJ til Filer, og importer filen i FIV.

Støttede formater: PLY (ascii/binær), OBJ, GLB, STL og ZIP med en av disse. USDZ kan ikke leses i nettleseren. Målingen tar 1–2 sekunder for et skann med rundt én million trekanter.

## FIV LiDAR – egen app for LiDAR-opptak

`FIVLidar/` er en egen, enklere iPhone-app (target `FIVLidar`, vises som **FIV LiDAR**) som bruker LiDAR-sensoren og lagrer alt som vanlige filer. Den gjenbruker skannemotoren fra FIV (`FIV/Scanning`), så kroppsmålene blir de samme.

| Fane | Hva den gjør | Filer som lagres |
|---|---|---|
| **Kroppsmål** | Samme to-posisjons skann som FIV (forfra + fra siden, med taleveiledning) | `FIV-skann <dato>.json` (kan importeres i FIV), `forfra.jpg`, `fra-siden.jpg` |
| **Dybdekamera** | Live dybdekart i farger (rødt = nært, blått = langt), avstand til midten av bildet, visning Blandet / Dybde / Kamera | Bilde: `foto.jpg`, `dybde-farger.jpg`, `dybde-blandet.jpg`, `dybde-mm.png` (rå 16-bit dybde i mm), `punktsky.ply`, `info.json`. Video: `dybdevideo.mov` (1080×1440, det du ser på skjermen) |
| **3D-skann** | Scenerekonstruksjon med LiDAR. Gå sakte rundt en person, gjenstand eller et rom | `modell.usdz` (åpnes rett på iPhone/Mac), `modell.obj`, `modell.ply`, `forhandsvisning.jpg` |
| **Filer** | Alle opptak, forhåndsvisning (Quick Look) og deling | – |

Bilder og videoer kan også lagres i Bilder-appen (bryter i hver fane). Alle mapper ligger i Filer-appen under *På min iPhone → FIV LiDAR*.

**Få kroppsmålene inn i FIV:** del JSON-filen til *Lagre i Filer* (eller AirDrop), åpne FIV og gå til *Kropp → Skann → Importer skann fra iPhone-appen (JSON)*. Nettappen godtar filen uansett hvilken skannemetode som er valgt.

Filformatet:

```json
{
  "format": "fiv-scan", "version": 1, "app": "FIV LiDAR",
  "date": "2026-11-19T16:40:12Z", "weightKg": 82.4,
  "measurements": { "waistCm": 86.2, "hipCm": 99.1, "neckCm": 38.5, "usedLiDAR": true, "sampleCount": 60 }
}
```

`measurements` har de samme feltnavnene som `ScanMeasurements` i Swift og i nettappen.

**Bygg:** `xcodegen generate`, åpne `FIV.xcodeproj`, velg skjemaet **FIVLidar**, velg utviklerteam under *Signing & Capabilities* og kjør på en iPhone Pro (12 Pro eller nyere). LiDAR virker ikke i simulatoren.

## Arkitektur

```
FIV/
├── App/        FIVApp, faner, CoachService (kobler lagring ↔ PT-motor)
├── Models/     Domenetyper + SwiftData-modeller (profil, skann, program, logg)
├── Coach/      PT-motoren – ren Swift, uten UI/kamera
│   ├── ExerciseLibrary     ~60 øvelser, merket med mønster, muskler, utstyr, strekk-bias, kontraindikasjoner
│   ├── BodyAnalyzer        skann → funn + muskelprioriteringer
│   ├── ProgramGenerator    profil + analyse → ukeprogram
│   ├── ProgressionEngine   dobbel progresjon, 1RM
│   ├── NutritionCalculator
│   ├── BodyComposition     Navy, FFMI, ellipse-omkrets, makspuls
│   └── CoachKnowledge      artikler og daglige tips
├── Scanning/   ARKit + LiDAR
│   ├── BodyScanner         tilstandsmaskin: nedtelling → forfra → snu → side → resultat
│   ├── FrameGeometry       personmaske + dybdekart → silhuettbredde i meter
│   ├── VoiceCoach          norsk tale (nb-NO)
│   └── ARScanContainer
└── Views/      SwiftUI-skjermer
```

### Hvordan målingen fungerer

1. `ARBodyTrackingConfiguration` gir 3D-skjelettet; `personSegmentationWithDepth` gir en personmaske, og `smoothedSceneDepth` gir LiDAR-dybde.
2. For hvert målepunkt (f.eks. midje = 22 % opp fra hofteleddet mot nakken) projiseres punktet inn i kamerabildet, og vi går vinkelrett på kroppsaksen til begge kanter av silhuetten.
3. Kantene løftes tilbake til 3D med kameraets intrinsikk og median LiDAR-dybde → bredde i meter.
4. Bredde forfra + dybde fra siden gir omkrets via Ramanujans ellipseformel. Lemmer antas tilnærmet sirkulære.
5. ~60 målinger per skann; trimmet median fjerner støy.

Forventet nøyaktighet er noen centimeter på omkretser. Trenden over flere skann tatt under like forhold er det som teller. Første gang kan du kalibrere med målebånd i resultatskjermen.

## Legge til ekte eller AI-genererte øvelsesvideoer

Appen viser animasjoner for alle 67 øvelsene (definert i `FIV/Resources/ExerciseAnimations.json`).
Slik legger du inn ekte videoer:

1. Film øvelsen eller lag den med et AI-videoverktøy (f.eks. Sora, Veo eller Runway). Bruk korte klipp på 3–6 sekunder som går i løkke, filmet fra siden.
2. Gi filen navn etter øvelsens id, for eksempel `back_squat.mp4`. Id-ene står i `ExerciseLibrary.swift`.
3. Legg filen i `FIV/Resources/ExerciseVideos/` og kjør `xcodegen generate` på nytt.

Appen viser videoen automatisk der den finnes og animasjonen ellers. Animasjonene kan justeres i JSON-filen. Vinklene er forklart øverst i filen.

## Personvern

Alt behandles og lagres lokalt på telefonen (SwiftData). Ingen bilder eller mål sendes noe sted.

## Neste steg (forslag)

- HealthKit: hent vekt, skritt, puls og VO₂maks automatisk; skriv økter tilbake.
- Apple Watch-app for logging og pulssoner under 4×4.
- 3D-mesh av kroppen (`ARWorldTrackingConfiguration` + scene reconstruction) for fullstendig volummodell.
- AI-chat med PT (f.eks. Claude API) med skann- og loggdata som kontekst.
- Video-formsjekk av øvelser med kroppssporing.

> FIV gir generelle treningsråd og er ikke medisinsk rådgivning.
