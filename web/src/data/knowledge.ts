// GENERERT fra FIV/Coach/CoachKnowledge.swift — ikke rediger for hånd (npm run gen).
export interface KnowledgeArticle { id: string; category: string; title: string; summary: string; body: string[]; sources: string[]; symbol: string }

export const ARTICLES: KnowledgeArticle[] = [
 {
  "id": "volume",
  "category": "Styrke & muskelvekst",
  "title": "Hvor mye bør du trene?",
  "summary": "10–20 harde sett per muskel per uke er sweet spot for de fleste.",
  "body": [
   "Det er en klar dose-respons mellom antall harde sett og muskelvekst, men med avtagende gevinst. Den største metaanalysen (Pelland et al. 2024, 67 studier) viser at hvert ekstra sett gir litt mindre enn det forrige.",
   "Tell sett fraksjonelt: et sett benkpress teller 1 for bryst og 0,5 for triceps. Det er slik FIV regner ukevolumet ditt.",
   "Styrke trenger mindre volum enn muskelvekst — selv 1–3 tunge sett per løft gir god styrkeutvikling.",
   "Mer er ikke alltid bedre: hvis prestasjonen faller uke etter uke, eller du er støl i neste økt for samme muskel, trenger du mindre — ikke mer."
  ],
  "sources": [
   "Schoenfeld et al. 2017, J Sports Sci",
   "Pelland et al. 2024, SportRxiv (metaregresjon)",
   "Baz-Valle et al. 2022"
  ],
  "symbol": "chart.bar.fill"
 },
 {
  "id": "effort",
  "category": "Styrke & muskelvekst",
  "title": "Tren nær failure (RIR)",
  "summary": "De siste 0–3 repsene før du ikke klarer flere er de som teller mest.",
  "body": [
   "RIR = reps i reserve. RIR 2 betyr at du kunne tatt 2 til. FIV angir RIR for hver øvelse.",
   "Muskelvekst øker jo nærmere failure du går (Robinson 2024), men gevinsten for styrke er liten, og trettheten øker. Derfor: basisløft med 1–3 RIR, isolasjon 0–1 RIR.",
   "Nybegynnere bommer ofte med 4–6 reps på hvor nær failure de er. Test deg selv av og til på siste sett av en trygg øvelse (maskin, manual)."
  ],
  "sources": [
   "Robinson et al. 2024, Sports Med",
   "Refalo et al. 2023, Sports Med"
  ],
  "symbol": "flame.fill"
 },
 {
  "id": "lengthened",
  "category": "Styrke & muskelvekst",
  "title": "Tren i strukket posisjon",
  "summary": "Øvelser som belaster muskelen når den er lang gir mer vekst.",
  "body": [
   "En av de viktigste nyere oppdagelsene: muskler vokser mer når de belastes i forlenget posisjon. Sittende lårcurl gir mer vekst enn liggende (Maeo 2021), triceps overhead ~40 % mer enn pushdowns (Maeo 2023).",
   "«Lengthened partials» — delvise reps i den strukne halvdelen — ser ut til å være minst like effektive som full bevegelse (Pedrosa 2022, Wolf 2023).",
   "FIV prioriterer derfor øvelser som skråbenk-curl, overhead triceps, bulgarske utfall, rumensk markløft og kabel-sidehev bak kroppen."
  ],
  "sources": [
   "Maeo et al. 2021, MSSE",
   "Maeo et al. 2023, Eur J Sport Sci",
   "Pedrosa et al. 2022",
   "Wolf et al. 2023, meta-analyse"
  ],
  "symbol": "arrow.left.and.right"
 },
 {
  "id": "frequency",
  "category": "Styrke & muskelvekst",
  "title": "Frekvens og splitt",
  "summary": "Tren hver muskel minst 2× i uka — splitten er mindre viktig enn totalvolumet.",
  "body": [
   "Når volumet er likt, gir frekvens liten forskjell. Men å fordele volumet på 2–3 økter gjør hvert sett av høyere kvalitet.",
   "Over ~6–8 harde sett for én muskel i én økt gir avtagende effekt — derfor fordeler FIV volumet utover uka.",
   "2–3 dager: helkropp. 4 dager: over-/underkropp. 5–6 dager: hybrid eller press/drag/bein."
  ],
  "sources": [
   "Schoenfeld et al. 2019, J Sports Sci",
   "Pelland et al. 2024"
  ],
  "symbol": "calendar"
 },
 {
  "id": "progression",
  "category": "Styrke & muskelvekst",
  "title": "Progressiv overbelastning",
  "summary": "Dobbel progresjon: først flere reps, så mer vekt.",
  "body": [
   "Eksempel: 3 × 8–12. Start med en vekt du klarer 8 med. Øk reps økt for økt. Når alle sett er på 12 → øk vekten og start på 8 igjen.",
   "FIV foreslår vekt og reps automatisk ut fra forrige logg.",
   "Hver 4.–6. uke: deload med halvparten av settene. Det fjerner akkumulert tretthet og gjør neste syklus bedre."
  ],
  "sources": [
   "Plotkin et al. 2022, PeerJ",
   "Bell et al. 2023, deload-konsensus"
  ],
  "symbol": "arrow.up.right"
 },
 {
  "id": "rest",
  "category": "Styrke & muskelvekst",
  "title": "Pauser mellom sett",
  "summary": "2–3 min på tunge basisløft, 1–2 min på isolasjon.",
  "body": [
   "Lengre pauser gir både mer muskelvekst og styrke, fordi du klarer flere reps i neste sett (Schoenfeld 2016). Nyere metaanalyse (Singer 2024) viser en liten fordel for pauser over 60 sek.",
   "Har du dårlig tid: bruk supersett av ikke-konkurrerende øvelser (f.eks. bryst + rygg) — det sparer ~30 % tid uten å tape effekt."
  ],
  "sources": [
   "Schoenfeld et al. 2016, JSCR",
   "Singer et al. 2024, Front Sports Act Living",
   "Iversen et al. 2021"
  ],
  "symbol": "timer"
 },
 {
  "id": "protein",
  "category": "Ernæring",
  "title": "Protein",
  "summary": "1,6–2,2 g per kg kroppsvekt, fordelt på 3–5 måltider.",
  "body": [
   "1,6 g/kg dekker det meste av effekten for muskelvekst (Morton 2018). I kaloriunderskudd beskytter 2,0–2,4 g/kg muskelmassen bedre.",
   "Total mengde per dag er viktigst. Store måltider (opp mot 100 g) utnyttes også (Trommelen 2023) — men 3–5 måltider med 30–50 g er praktisk.",
   "Gode kilder: kylling, fisk, egg, skyr/kesam, cottage cheese, magert kjøtt, bønner/linser, tofu."
  ],
  "sources": [
   "Morton et al. 2018, BJSM",
   "Trommelen et al. 2023, Cell Rep Med",
   "Helms et al. 2014"
  ],
  "symbol": "fork.knife"
 },
 {
  "id": "fatloss",
  "category": "Ernæring",
  "title": "Fettap uten muskeltap",
  "summary": "0,5–1 % av kroppsvekten per uke, tung styrketrening og høyt protein.",
  "body": [
   "Raskere vekttap øker andelen muskelmasse du mister. Hold deg rundt 0,5–1 % per uke.",
   "Styrketrening er signalet som beholder musklene. Ikke bytt til «lette vekter, mange reps» når du slanker deg.",
   "Hverdagsaktivitet (NEAT) er ofte større enn treningen: skritt teller. Mål vekten daglig og se på ukesnittet.",
   "Bruker du GLP-1-medisin (f.eks. semaglutid eller tirzepatid), er styrketrening og høyt protein ekstra viktig — opptil 25–40 % av vekttapet kan ellers være fettfri masse."
  ],
  "sources": [
   "Helms et al. 2014, JISSN",
   "Garthe et al. 2011 (Olympiatoppen)",
   "Neeland et al. 2024, Lancet Diabetes Endocrinol"
  ],
  "symbol": "scalemass"
 },
 {
  "id": "creatine",
  "category": "Ernæring",
  "title": "Kreatin",
  "summary": "3–5 g daglig. Trygt, billig og godt dokumentert.",
  "body": [
   "Kreatin monohydrat øker styrke og muskelvekst i kombinasjon med trening, og har lovende effekter på kognisjon, særlig ved søvnmangel.",
   "Ingen lading nødvendig. Ta det når som helst på dagen. 1–2 kg vektøkning første uker er vann i musklene, ikke fett."
  ],
  "sources": [
   "Kreider et al. 2017, ISSN Position Stand",
   "Gordji-Nejad et al. 2024, Sci Rep"
  ],
  "symbol": "pills.fill"
 },
 {
  "id": "vo2max",
  "category": "Kondisjon & helse",
  "title": "VO₂maks og 4×4",
  "summary": "Kondisjon er en av de sterkeste prediktorene for et langt liv.",
  "body": [
   "Lav kondisjon er assosiert med høyere dødelighet enn røyking og diabetes (Mandsager 2018). Å gå fra «lav» til «under middels» gir stor helsegevinst.",
   "4×4-intervaller (NTNU): 4 min på 85–95 % av makspuls, 3 min aktiv pause, 4 ganger. Én økt i uka i tillegg til rolig trening.",
   "FIV beregner makspuls med HUNT-formelen: 211 − 0,64 × alder (Nes 2013)."
  ],
  "sources": [
   "Helgerud et al. 2007, MSSE",
   "Mandsager et al. 2018, JAMA Netw Open",
   "Nes et al. 2013, Scand J Med Sci Sports",
   "Generation 100 (Stensvold 2020, BMJ)"
  ],
  "symbol": "heart.fill"
 },
 {
  "id": "zone2",
  "category": "Kondisjon & helse",
  "title": "Sone 2 og skritt",
  "summary": "150–300 min moderat aktivitet per uke + daglige skritt.",
  "body": [
   "Sone 2 ≈ 60–70 % av makspuls — du kan prate i hele setninger. Bygger aerob base og fettforbrenningskapasitet, og forstyrrer i liten grad muskelveksten.",
   "Skritt: risikoen for tidlig død faller frem til ca. 6–8 000 skritt/dag for eldre og 8–10 000 for yngre (Paluch 2022). Alt over er bonus.",
   "Kombinert trening (styrke + kondisjon) gir minimal «interferens» for muskelvekst, særlig hvis du skiller øktene med noen timer eller kjører sykkel i stedet for løping (Schumann 2022)."
  ],
  "sources": [
   "WHO 2020 Guidelines",
   "Paluch et al. 2022, Lancet Public Health",
   "Schumann et al. 2022, Sports Med"
  ],
  "symbol": "figure.walk"
 },
 {
  "id": "sleep",
  "category": "Restitusjon",
  "title": "Søvn",
  "summary": "7–9 timer. Den billigste prestasjonsfremmeren som finnes.",
  "body": [
   "Søvnmangel reduserer muskelproteinsyntese (~18 % etter én natt, Lamon 2021) og øker sult og tap av muskelmasse i underskudd (Nedeltcheva 2010).",
   "Fast leggetid, mørkt og kjølig soverom, ingen koffein etter kl. 14, og dagslys tidlig på dagen."
  ],
  "sources": [
   "Lamon et al. 2021, Physiol Rep",
   "Nedeltcheva et al. 2010, Ann Intern Med"
  ],
  "symbol": "moon.zzz.fill"
 },
 {
  "id": "posture",
  "category": "Restitusjon",
  "title": "Holdning — hva sier forskningen?",
  "summary": "Holdning henger svakere sammen med smerte enn de fleste tror.",
  "body": [
   "Det finnes ingen «perfekt» holdning. Studier finner svak sammenheng mellom f.eks. fremoverhode og nakkesmerte (Richards 2016).",
   "Det som hjelper: variasjon i stillinger, sterk øvre rygg, og å bevege seg ofte. Derfor legger FIV til roing, face pulls og chin tucks når skannet viser fremoverlent hode — ikke fordi du er «skadet».",
   "Skjeve skuldre/hofter på 2–4° er vanlig og oftest funksjonelt. Ettsidig trening og bæring jevner ut styrkeforskjeller."
  ],
  "sources": [
   "Richards et al. 2016, Musculoskelet Sci Pract",
   "Swain et al. 2020, Br J Sports Med"
  ],
  "symbol": "figure.stand"
 },
 {
  "id": "injury",
  "category": "Restitusjon",
  "title": "Trening med vondt",
  "summary": "Smerte opp til 3/10 som roer seg innen 24 timer er stort sett OK.",
  "body": [
   "Belastning er ofte en del av behandlingen — særlig for kne-, sene- og ryggplager. Total hvile er sjelden beste løsning.",
   "Smertemonitoreringsmodellen: smerte ≤ 3/10 under trening, og ikke verre neste morgen → fortsett. Verre → reduser belastningen.",
   "Nordic hamstring curls halverer risikoen for strekkskader i baksiden av låret.",
   "Oppsøk lege eller fysioterapeut ved nummenhet, utstrålende smerter, nattsmerter eller smerte etter fall/traume."
  ],
  "sources": [
   "Silbernagel et al. 2007",
   "van der Horst et al. 2015, Am J Sports Med"
  ],
  "symbol": "cross.case.fill"
 },
 {
  "id": "scanning",
  "category": "Om skanningen",
  "title": "Slik måler FIV kroppen din",
  "summary": "LiDAR + kroppssporing fra to vinkler gir omkretsmål på noen centimeters nøyaktighet.",
  "body": [
   "iPhone-ens LiDAR måler avstand til hvert punkt på kroppen. ARKit finner 91 ledd i skjelettet ditt. FIV kombinerer disse: bredden på silhuetten forfra og dybden fra siden gir en ellipse som anslår omkretsen.",
   "Fettprosent beregnes med U.S. Navy-formelen fra hals, midje (og hofte for kvinner) — feilmargin rundt ±3–4 %-poeng, omtrent som en kroppsanalysevekt.",
   "Tips for presise skann: samme tidspunkt (morgen, før frokost), tettsittende klær, godt lys, telefonen stående i hoftehøyde 2,5–3 m unna. Korriger gjerne med målebånd første gang.",
   "Følg trenden over tid — ett enkelt skann er et estimat, men ti skann viser retningen tydelig."
  ],
  "sources": [
   "Hodgdon & Beckett 1984 (Navy-metoden)",
   "Apple ARKit dokumentasjon"
  ],
  "symbol": "camera.metering.matrix"
 }
]

export const DAILY_TIPS: string[] = [
 "Det beste programmet er det du faktisk følger. Konsistens over tid slår perfeksjon.",
 "Logg hver økt — det du måler, forbedrer du.",
 "Gå en tur etter middag: 10–15 minutter senker blodsukkertoppen merkbart.",
 "Siste sett av isolasjonsøvelser kan gå helt til failure — det er trygt og effektivt.",
 "Sov 7–9 timer. Musklene vokser når du hviler, ikke når du trener.",
 "Protein i hvert måltid: sikt på 30–50 g.",
 "Dårlig dag? Gjør en kortere økt i stedet for å hoppe over. Noe slår alltid ingenting.",
 "Kontroller nedfasen: 2–3 sekunder ned gir mer kvalitet i hver rep.",
 "Kreatin hver dag — også på hviledager.",
 "Skann deg hver 4. uke, samme tid på døgnet, for å se ekte endringer.",
 "Én 4×4-økt i uka kan øke VO₂maks med 10 % på 8–10 uker.",
 "Stølhet er ikke et mål på en god økt. Fremgang i vekter og reps er det."
]
