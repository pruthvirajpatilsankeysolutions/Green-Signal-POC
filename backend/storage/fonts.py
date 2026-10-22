"""Fonts added from the Templates page (stored in assets/fonts/added/), on top of the built-in list."""
import json
import re

from config import ASSETS_DIR, DATA_DIR

REGISTRY = DATA_DIR / "added_fonts.json"
FOLDER = ASSETS_DIR / "fonts" / "added"


def added():
    return json.loads(REGISTRY.read_text(encoding="utf-8")) if REGISTRY.exists() else []


def add(family, weight, filename, data):
    FOLDER.mkdir(parents=True, exist_ok=True)
    safe = re.sub(r"[^A-Za-z0-9._-]", "_", filename)
    (FOLDER / safe).write_bytes(data)
    fonts = [f for f in added() if not (f["family"] == family and f["weight"] == weight)]
    fonts.append({"family": family, "file": f"added/{safe}", "weight": weight, "group": "added", "core": False})
    REGISTRY.parent.mkdir(parents=True, exist_ok=True)
    REGISTRY.write_text(json.dumps(fonts, ensure_ascii=False, indent=1), encoding="utf-8")
    return fonts[-1]