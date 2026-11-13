# FIV – din personlige PT med LiDAR-kroppsskanning

iPhone-app (SwiftUI, iOS 18+, laget for iPhone 17 Pro) som skanner kroppen din med LiDAR og ARKit, analyserer proporsjoner, ubalanser og holdning, og lager et målrettet treningsprogram basert på oppdatert treningsforskning.

## Funksjoner

| | |
|---|---|
| **Kroppsskanning** | To-posisjons skann (forfra + fra siden) med ARKit body tracking (91 ledd) + LiDAR-dybde. Norsk taleveiledning, så du kan stå 3 m unna. |
| **Mål** | Hals, bryst, midje, hofte, overarmer V/H, lår V/H, arm- og beinlengder, skulderbredde, skulder-/bekkenskjevhet, fremoverlent hode. Kan korrigeres med målebånd. |
| **Analyse** | Fettprosent (U.S. Navy), fettfri masse, FFMI, midje/høyde-ratio, over-/underkropp-balanse, V-form, venstre/høyre-asymmetri, fremgang siden forrige skann. |
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

## Personvern

Alt behandles og lagres lokalt på telefonen (SwiftData). Ingen bilder eller mål sendes noe sted.

## Neste steg (forslag)

- HealthKit: hent vekt, skritt, puls og VO₂maks automatisk; skriv økter tilbake.
- Apple Watch-app for logging og pulssoner under 4×4.
- 3D-mesh av kroppen (`ARWorldTrackingConfiguration` + scene reconstruction) for fullstendig volummodell.
- AI-chat med PT (f.eks. Claude API) med skann- og loggdata som kontekst.
- Video-formsjekk av øvelser med kroppssporing.

> FIV gir generelle treningsråd og er ikke medisinsk rådgivning.
