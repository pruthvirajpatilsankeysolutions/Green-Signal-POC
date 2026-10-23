"""
Make a post from a saved template: fill its slots (texts + logo / photo) and render it.
Returns the PNG path, the filled Fabric JSON (opens in the editor as the same layers) and warnings.
"""
import asyncio
import base64
import json
import sys
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import unquote

from playwright.sync_api import sync_playwright

from config import ASSETS_DIR, OUTPUT_DIR
from design.finish import RENDER_SCALE, finish

HERE = Path(__file__).resolve().parent / "template_fill"


def _to_file(src):
    """/files/assets/... or /files/output/... -> file:// address for the renderer."""
    for prefix, base in (("/files/assets/", ASSETS_DIR), ("/files/output/", OUTPUT_DIR)):
        if src.startswith(prefix):
            return (base / unquote(src[len(prefix):])).resolve().as_uri()
    return src


def _to_files(src):
    """file:// address -> /files/... address the app (and the editor) can load."""
    if not src.startswith("file://"):
        return src
    path = Path(unquote(src[len("file:///"):] if sys.platform.startswith("win") else src[len("file://"):])).resolve()
    for base, prefix in ((ASSETS_DIR.resolve(), "/files/assets/"), (OUTPUT_DIR.resolve(), "/files/output/")):
        try:
            return prefix + path.relative_to(base).as_posix()
        except ValueError:
            continue
    return src


def _page(fonts):
    faces = "".join(f'@font-face{{font-family:"{f["family"]}";src:url("{(ASSETS_DIR / "fonts" / f["file"]).resolve().as_uri()}");font-weight:{f.get("weight", "400")}}}'
                    for f in fonts if (ASSETS_DIR / "fonts" / f["file"]).exists())
    # Rozha One draws Devanagari digits like Latin ones (६ looks like "6"): take its digits from Laila Bold.
    # Declared after Rozha One, so the browser checks it first for these characters only.
    laila = ASSETS_DIR / "fonts" / "Laila-Bold.ttf"
    if laila.exists():
        faces += f'@font-face{{font-family:"Rozha One";src:url("{laila.resolve().as_uri()}");font-weight:400;unicode-range:U+0966-096F}}'
    page = OUTPUT_DIR / "_html" / "template_fill.html"
    page.parent.mkdir(parents=True, exist_ok=True)
    page.write_text(f'<!doctype html><html><head><meta charset="utf-8"><style>{faces}</style>'
                    f'<script src="{(HERE / "fabric.min.js").resolve().as_uri()}"></script>'
                    f'<script src="{(HERE / "engine.js").resolve().as_uri()}"></script></head><body></body></html>', encoding="utf-8")
    return page


def fill(design, slots, pictures, name, edits=None):
    """slots: {slot: text ("" removes the line)}; pictures: {"logo": path, "photo": path};
    edits: the AI layout plan (texts to set / remove / add, by layer position), or None."""
    from api.routes.designs import all_fonts                       # built-in + uploaded fonts
    design = json.loads(json.dumps(design))
    for o in design.get("objects", []):
        if isinstance(o.get("src"), str):
            o["src"] = _to_file(o["src"])
    pics = {k: Path(v).resolve().as_uri() for k, v in (pictures or {}).items() if v and Path(v).exists()}
    page, result = _page(all_fonts()), {}

    def work():
        if sys.platform.startswith("win"):
            asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
        with sync_playwright() as p:
            browser = p.chromium.launch(args=["--allow-file-access-from-files"])
            try:
                pg = browser.new_page()
                pg.goto(page.as_uri())
                pg.wait_for_function("window.__ready === true")
                result["out"] = pg.evaluate("([d, s, p, k, e]) => fillTemplate(d, s, p, k, e)", [design, slots, pics, RENDER_SCALE, edits])
            finally:
                browser.close()

    with ThreadPoolExecutor(max_workers=1) as pool:
        pool.submit(work).result()
    out = result["out"]
    path = OUTPUT_DIR / "posters" / f"{name}_{uuid.uuid4().hex[:6]}_template.png"
    path.parent.mkdir(parents=True, exist_ok=True)
    size = (round(design["size"]["width"]), round(design["size"]["height"]))
    finish(base64.b64decode(out["png"].split(",", 1)[1]), size, path)        # drawn at 2x -> crisp at the real size
    for o in out["json"].get("objects", []):
        if isinstance(o.get("src"), str):
            o["src"] = _to_files(o["src"])
    return str(path), out["json"], out["warnings"]
