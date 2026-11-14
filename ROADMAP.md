# FIV – veien fra MVP til fullverdig app

Status per november 2026. ✅ = ferdig i koden, men ikke kompilert eller testet på telefon. ⬜ = gjenstår.
**Fett** markerer det som blokkerer at appen virker i det hele tatt.

---

## Nettapp (ingen Mac nødvendig) — ✅ publisert

Nettappen i `web/` har samme PT-motor (TypeScript-port, 18 tester) og skanner med kamera + AI (MediaPipe) og høyden som målestokk. LiDAR-modus ligger klar (Profil → Skannemetode), og skann fra iPhone-appen kan importeres som JSON. Neste steg her: validere kameramålene mot målebånd (som 1.1) og legge til dra-og-juster av målepunkter på bildet.

## Fase 0 – Få iPhone-appen til å kjøre (blokkerende for LiDAR)

| # | Oppgave | Hvem | Status |
|---|---|---|---|
| 0.1 | **Koble GitHub** til Claude, så koden ligger trygt i repoet | Du | ⬜ |
| 0.2 | **Bygge i Xcode 26 og rette kompileringsfeil.** Koden er skrevet uten kompilator, så det vil komme noen feil. | Du bygger, Claude retter | ⬜ |
| 0.3 | **Kjøre enhetstestene (⌘U)**: PT-motor, fettplan, muskel- og holdningsanalyse | Du + Claude | ⬜ |
| 0.4 | **Første skann på iPhone 17 Pro.** Bekreft at kroppssporing + LiDAR-dybde + personmaske kan kjøre samtidig. Hvis ikke, faller appen tilbake til estimert dybde, med lavere nøyaktighet. | Du | ⬜ |
| 0.5 | **Kontrollere ARKit-detaljer på enheten:** kameraakser i portrett, leddnavn (`left_toes_joint`, `spine_4_joint`, `spine_7_joint`) og at skjelettet er i meter | Claude, med logg fra deg | ⬜ |

## Fase 1 – Gjøre målingene pålitelige (kjernen i appen)

| # | Oppgave | Status |
|---|---|---|
| 1.1 | **Valideringsstudie:** skann 10–20 personer og sammenlign med målebånd (helst også InBody/DEXA). Finn systematiske avvik per mål. | ⬜ |
| 1.2 | **Korreksjonsfaktorer per mål** (midje, hofte, bryst, lår, arm) fra 1.1, bygget inn i `BodyScanner` | ⬜ |
| 1.3 | **Personlig kalibrering:** én måling med målebånd gir en faktor som lagres og brukes på alle senere skann | ⬜ |
| 1.4 | **Kvalitetsscore på hvert skann:** stillhet, avstand, lys, hvor mange gyldige målinger. Dårlige skann avvises med tydelig beskjed. | ⬜ |
| 1.5 | **Holdningsmål fra dybdekonturen** i stedet for bare ARKit-skjelettet (ryggkurve, bekkenvipp/svairygg). Skjelettet er en modell og kan glatte ut ekte holdning. | ⬜ |
| 1.6 | **Bedre fettestimat:** kombiner Navy-formelen med 3D-form (eventuelt en ML-modell trent på DEXA-data) | ⬜ |
| 1.7 | Skanneveiledning for like forhold hver gang: samme avstand, tid på døgnet og klær | ✅ delvis |

## Fase 2 – Fullverdig 3D-kroppsskanning

| # | Oppgave | Status |
|---|---|---|
| 2.1 | **360°-skann:** brukeren snur seg sakte rundt, og dybdebildene settes sammen til en 3D-modell (mesh) | ⬜ |
| 2.2 | Ekte omkretser målt direkte på 3D-modellen, med mange flere mål (legger, underarm, skuldre) | ⬜ |
| 2.3 | **Før/etter i 3D med fargekart** som viser hvor kroppen har endret seg | ⬜ |
| 2.4 | Valgfrie fremgangsbilder side om side, lagret kryptert på telefonen | ⬜ |

## Fase 3 – Analyse og PT-motor

| # | Oppgave | Status |
|---|---|---|
| 3.1 | Fettanalyse: hvor mye fett, hvor det sitter, plan for fettap | ✅ |
| 3.2 | Muskelbalanse mot ønsket kroppsform (6 kroppsformer) | ✅ |
| 3.3 | Holdningsanalyse og holdningsrutine (hode, skuldre, øvre rygg, korsrygg, bekken, bevegelighet) | ✅ |
| 3.4 | Utstyr og vekter per treningssted, ett program per sted | ✅ |
| 3.5 | **Programmet skal ikke lages på nytt midt i en treningsperiode.** Det trengs en ukesteller (uke 1–5 + deload) og nytt program først ved periodeslutt. | ⬜ |
| 3.6 | **Autoregulering fra loggen:** stagnasjon, fall i prestasjon eller høy RIR skal gi automatisk justering av volum, vekt eller deload | ⬜ |
| 3.7 | Ukentlig innsjekk: vektsnitt, midje og styrke gir automatisk justering av kalorier og program | ⬜ |
| 3.8 | Flere øvelser (100+) og flere holdnings- og mobilitetsøvelser | ⬜ |

## Fase 4 – Brukeropplevelse

| # | Oppgave | Status |
|---|---|---|
| 4.1 | Animerte øvelser for alle øvelser + støtte for video (`<id>.mp4`) | ✅ |
| 4.2 | **Ekte videoer eller AI-videoer** for alle øvelser, enten filmet eller generert med Sora, Veo eller Runway | ⬜ |
| 4.3 | Profesjonelle 3D-animasjoner (RealityKit-modell eller Rive) i stedet for strekfigur | ⬜ |
| 4.4 | **Øktmodus:** én øvelse om gangen, store knapper, pausetimer på låseskjermen og i Dynamic Island (Live Activity), vibrasjon | ⬜ |
| 4.5 | **Design for iOS 26** (Liquid Glass) og iOS 26 som minste versjon | ⬜ |
| 4.6 | Onboarding som avsluttes med første skann | ⬜ |
| 4.7 | Tilgjengelighet: VoiceOver, Dynamic Type og kontrast | ⬜ |
| 4.8 | Engelsk språkversjon (lokalisering) | ⬜ |
| 4.9 | App-ikon, oppstartsskjerm, tomme tilstander og feilmeldinger | ⬜ |

## Fase 5 – Integrasjoner

| # | Oppgave | Status |
|---|---|---|
| 5.1 | **Apple Helse (HealthKit):** vekt, skritt, puls, VO₂maks og søvn inn, økter ut | ⬜ |
| 5.2 | **Apple Watch-app:** logging, puls og 4×4-intervaller | ⬜ |
| 5.3 | **Formsjekk med kamera:** teller reps og gir beskjed om dybde og tempo via kroppssporing | ⬜ |
| 5.4 | **AI-PT-chat** (Claude API) med skann og logg som kontekst. Krever en liten server for API-nøkkelen. | ⬜ |
| 5.5 | Matlogging med strekkode (f.eks. Matvaretabellen og Kassalapp) | ⬜ |
| 5.6 | Påminnelser: økt, skann hver 4. uke, protein og søvn | ⬜ |
| 5.7 | iCloud-synk (CloudKit) og sikkerhetskopi | ⬜ |

## Fase 6 – Kvalitet, personvern og lansering

| # | Oppgave | Status |
|---|---|---|
| 6.1 | Flere tester: UI-tester og test av skannelogikk med innspilte ARKit-sesjoner | ⬜ |
| 6.2 | Automatisk bygg og test (Xcode Cloud eller GitHub Actions) | ⬜ |
| 6.3 | **Personvern og GDPR:** helsedata er en særlig kategori. Det trengs personvernerklæring, samtykke, eksport og sletting av data. | ⬜ |
| 6.4 | **Medisinsk grense:** formuleringer må holde seg til «trening og velvære», ikke diagnose. Ellers kan appen regnes som medisinsk utstyr (MDR). | ✅ delvis |
| 6.5 | Krasjrapportering og ytelsesmåling (ARKit på bakgrunnskø, batteri, varme) | ⬜ |
| 6.6 | Apple Developer Program, TestFlight-beta med 10–20 testere | ⬜ |
| 6.7 | App Store: skjermbilder, beskrivelse, retningslinjer for helseapper | ⬜ |
| 6.8 | Forretningsmodell: gratis eller abonnement (StoreKit 2) | ⬜ |

---

## Anbefalt rekkefølge

1. **Fase 0** (denne uka): koble GitHub, bygg, rett feil, første skann.
2. **Fase 1.1–1.4**: gjør målingene pålitelige. Uten dette er resten bygget på sand.
3. **3.5–3.7 og 4.4**: stabilt program, autoregulering og god øktmodus. Det er dette som gjør appen nyttig hver dag.
4. **5.1 og 4.5**: HealthKit og iOS 26-design.
5. **4.2**: videoer for øvelsene.
6. **Fase 2**: 360°-skann og 3D-modell.
7. **Fase 6**: TestFlight og lansering.
