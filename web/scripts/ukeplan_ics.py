"""Lager FIV-ukeplan.ics: faste økter man–lør + leggetidspåminnelse søn–tor. Kjør: python3 web/scripts/ukeplan_ics.py"""
import pathlib
import uuid

APP = "https://claude.ai/artifact/EeEuVHPSc2zB8GLTHTwLCp"
OUT = pathlib.Path(__file__).resolve().parents[2] / "FIV-ukeplan.ics"
FIRST = {"MO": "20261116", "TU": "20261117", "WE": "20261118", "TH": "20261119", "FR": "20261120", "SA": "20261121", "SU": "20261115"}

EVENTS = [
    ("MO", "061000", "065000", "FIV · Styrke A", "Helkropp A i appen. Ta dagsform-innsjekken først. Spilleliste: Styrketrening Gym Motivasjon https://open.spotify.com/playlist/2uuDbJqzRKPc2Nfn59PP9E", 10),
    ("TU", "061000", "065000", "FIV · Intervaller (4×4 / 45/20)", "Annenhver uke 4×4 og 45/20. Bruk intervalltimeren i appen. Spilleliste: Energisk Intervalltrening 4x4 https://open.spotify.com/playlist/03X6wdMOLNtsztFwx8kCMS", 10),
    ("WE", "061000", "065000", "FIV · Styrke B", "Helkropp B i appen. Ta dagsform-innsjekken først.", 10),
    ("TH", "061000", "065000", "FIV · Terskelløp 20 min", "5 min oppvarming, 20 min komfortabelt hardt, 5 min ned. Spilleliste: Løping 160-180 bpm https://open.spotify.com/playlist/117yotp0p5w6QxQtZ5Y0SC", 10),
    ("FR", "061000", "065000", "FIV · Styrke C", "Helkropp C i appen. Vei deg og logg vekt.", 10),
    ("SA", "090000", "094500", "FIV · Valgfritt rolig løp ute", "30–45 min sone 2, gjerne ute i dagslys. Logg som «Løping utendørs» på klokka, så oppdateres kondisjonstallet.", 10),
]
BEDTIME_DAYS = ["SU", "MO", "TU", "WE", "TH"]


def esc(t: str) -> str:
    return t.replace("\\", "\\\\").replace(",", "\\,").replace(";", "\\;").replace("\n", "\\n")


def fold(line: str) -> list[str]:
    if len(line.encode()) <= 75:
        return [line]
    chunks, cur = [], ""
    for ch in line:
        if len((cur + ch).encode()) > (75 if not chunks else 74):
            chunks.append(cur)
            cur = ch
        else:
            cur += ch
    chunks.append(cur)
    return [chunks[0]] + [" " + c for c in chunks[1:]]


def vevent(day: str, start: str, end: str, title: str, desc: str, alarm_min: int, rrule: str) -> list[str]:
    d = FIRST[day]
    return [
        "BEGIN:VEVENT", f"UID:fiv-{uuid.uuid4()}@fiv", "DTSTAMP:20261115T120000Z",
        f"DTSTART;TZID=Europe/Oslo:{d}T{start}", f"DTEND;TZID=Europe/Oslo:{d}T{end}", rrule,
        f"SUMMARY:{esc(title)}", f"DESCRIPTION:{esc(desc + ' · Appen: ' + APP)}", f"URL:{APP}",
        "BEGIN:VALARM", "ACTION:DISPLAY", f"DESCRIPTION:{esc(title)}", f"TRIGGER:-PT{alarm_min}M", "END:VALARM", "END:VEVENT",
    ]


lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//FIV//Ukeplan//NO", "CALSCALE:GREGORIAN", "X-WR-CALNAME:FIV trening",
    "BEGIN:VTIMEZONE", "TZID:Europe/Oslo",
    "BEGIN:DAYLIGHT", "TZOFFSETFROM:+0100", "TZOFFSETTO:+0200", "TZNAME:CEST", "DTSTART:19700329T020000", "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU", "END:DAYLIGHT",
    "BEGIN:STANDARD", "TZOFFSETFROM:+0200", "TZOFFSETTO:+0100", "TZNAME:CET", "DTSTART:19701025T030000", "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU", "END:STANDARD",
    "END:VTIMEZONE",
]
for day, s, e, title, desc, alarm in EVENTS:
    lines += vevent(day, s, e, title, desc, alarm, f"RRULE:FREQ=WEEKLY;BYDAY={day}")
lines += vevent("SU", "221500", "223000", "FIV · Legg deg — trening 06:10 i morgen",
                "Skjermen bort, kjølig soverom. Legger du deg 22:30 får du ca. 7 timer før økta.", 0,
                "RRULE:FREQ=WEEKLY;BYDAY=" + ",".join(BEDTIME_DAYS))
lines.append("END:VCALENDAR")
out = [x for line in lines for x in fold(line)]
OUT.write_text("\r\n".join(out) + "\r\n", newline="")
print(f"{OUT.name}: {sum(1 for l in lines if l == 'BEGIN:VEVENT')} hendelser")
