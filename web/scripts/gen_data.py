"""Genererer TypeScript-data fra Swift-kildene, så iOS-appen og nettappen deler én sannhet.

- FIV/Coach/ExerciseLibrary.swift  -> src/data/exercises.ts
- FIV/Coach/CoachKnowledge.swift   -> src/data/knowledge.ts
- FIV/Resources/ExerciseAnimations.json kopieres til src/data/animations.json
"""
import json
import pathlib
import re
import shutil

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "web" / "src" / "data"
OUT.mkdir(parents=True, exist_ok=True)


def enum_list(text: str) -> list[str]:
    return re.findall(r"\.(\w+)", text)


def exercises() -> None:
    src = (ROOT / "FIV/Coach/ExerciseLibrary.swift").read_text()
    pattern = re.compile(
        r'Exercise\(id: "(?P<id>\w+)", name: "(?P<name>[^"]+)", pattern: \.(?P<pattern>\w+), '
        r'primary: \.(?P<primary>\w+), secondary: \[(?P<secondary>[^\]]*)\],\s*'
        r'requires: \[(?P<requires>[^\]]*)\](?P<rest>.*?)cue: "(?P<cue>[^"]*)"\)',
        re.S,
    )
    items = []
    for m in pattern.finditer(src):
        rest = m["rest"]
        any_of = re.search(r"anyOf: \[([^\]]*)\]", rest)
        avoid = re.search(r"avoidWith: \[([^\]]*)\]", rest)
        items.append({
            "id": m["id"], "name": m["name"], "pattern": m["pattern"], "primary": m["primary"],
            "secondary": enum_list(m["secondary"]), "requires": enum_list(m["requires"]),
            "anyOf": enum_list(any_of[1]) if any_of else [],
            "unilateral": "unilateral: true" in rest, "lengthenedBias": "lengthenedBias: true" in rest,
            "avoidWith": enum_list(avoid[1]) if avoid else [], "cue": m["cue"],
        })
    assert len(items) >= 60, f"fant bare {len(items)} øvelser"
    (OUT / "exercises.ts").write_text(
        "// GENERERT fra FIV/Coach/ExerciseLibrary.swift — ikke rediger for hånd (npm run gen).\n"
        "import type { Exercise } from '../engine/types'\n\n"
        f"export const EXERCISES: Exercise[] = {json.dumps(items, ensure_ascii=False, indent=1)} as Exercise[]\n")
    print(f"exercises: {len(items)}")


def knowledge() -> None:
    src = (ROOT / "FIV/Coach/CoachKnowledge.swift").read_text()
    def strings(block: str) -> list[str]:
        return [s.replace('\\"', '"') for s in re.findall(r'"((?:[^"\\]|\\.)*)"', block)]
    arts = []
    for m in re.finditer(r'KnowledgeArticle\((.*?)symbol: "([^"]+)"\)', src, re.S):
        body = m[1]
        def field(name: str) -> str:
            return re.search(name + r': "((?:[^"\\]|\\.)*)"', body)[1]
        arts.append({
            "id": field("id"), "category": field("category"), "title": field("title"), "summary": field("summary"),
            "body": strings(re.search(r"body: \[(.*?)\],\s*sources", body, re.S)[1]),
            "sources": strings(re.search(r"sources: \[(.*?)\]", body, re.S)[1]),
            "symbol": m[2],
        })
    tips = strings(re.search(r"dailyTips: \[String\] = \[(.*?)\]", src, re.S)[1])
    (OUT / "knowledge.ts").write_text(
        "// GENERERT fra FIV/Coach/CoachKnowledge.swift — ikke rediger for hånd (npm run gen).\n"
        "export interface KnowledgeArticle { id: string; category: string; title: string; summary: string; body: string[]; sources: string[]; symbol: string }\n\n"
        f"export const ARTICLES: KnowledgeArticle[] = {json.dumps(arts, ensure_ascii=False, indent=1)}\n\n"
        f"export const DAILY_TIPS: string[] = {json.dumps(tips, ensure_ascii=False, indent=1)}\n")
    print(f"articles: {len(arts)}, tips: {len(tips)}")


def animations() -> None:
    shutil.copy(ROOT / "FIV/Resources/ExerciseAnimations.json", OUT / "animations.json")
    print("animations copied")


exercises()
knowledge()
animations()
