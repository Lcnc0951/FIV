"""Lager en publiserbar artifact-versjon av nettappen i web/artifact/.

Siden (index.html) får CSS og JS inline. MediaPipe-filene (wasm + modell) publiseres ved siden av som egne filer.
Kjør etter `npm run build`.
"""
import pathlib
import re
import shutil

WEB = pathlib.Path(__file__).resolve().parents[1]
DIST = WEB / "dist"
OUT = WEB / "artifact"

shutil.rmtree(OUT, ignore_errors=True)
(OUT / "mediapipe").mkdir(parents=True)

html = (DIST / "index.html").read_text()
css = (DIST / "app.css").read_text()
js = (DIST / "app.js").read_text()
assert "</script" not in js.lower(), "bundlen inneholder </script — kan ikke inlines"

title = re.search(r"<title>.*?</title>", html, re.S)[0]
fonts = re.search(r'<link rel="stylesheet" href="https://fonts\.googleapis\.com[^"]*">', html)[0]
page = "\n".join([
    title,
    '<meta name="claude:viewport-fit-sides" content="cover">',
    '<link rel="preconnect" href="https://fonts.googleapis.com">',
    fonts,
    f"<style>{css}</style>",
    '<div id="root"></div>',
    f'<script type="module">{js}</script>',
    "",
])
(OUT / "index.html").write_text(page)
import base64
for f in ["vision_wasm_internal.js", "vision_wasm_internal.wasm"]:
    shutil.copy(DIST / "mediapipe" / f, OUT / "mediapipe" / f)
# Artifacts serverer ikke .task — modellen legges ved som base64-tekst
(OUT / "mediapipe" / "pose_landmarker_full.task.txt").write_bytes(base64.b64encode((DIST / "mediapipe" / "pose_landmarker_full.task").read_bytes()))
print(f"artifact/index.html {len(page) / 1024:.0f} KB")
