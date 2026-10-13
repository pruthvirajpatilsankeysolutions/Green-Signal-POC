"""
Design editor (Fabric.js): starting layers for a post, and saving the edited design.

GET  /api/drafts/{id}/design   -> saved editor design, or a starting layout built from the post
PUT  /api/drafts/{id}/design   -> save the editor design + the exported PNG (replaces the first image)
"""
import base64
import json
import uuid
from pathlib import Path
from urllib.parse import unquote, urlparse

from fastapi import APIRouter, HTTPException
from PIL import Image
from pydantic import BaseModel

from api.helpers import draft_out, run, to_url
from config import ASSETS_DIR, OUTPUT_DIR, SIZES
from design.poster import measure_existing, prepare_leader_photo
from storage import clients, drafts
from storage import festivals as festival_store

router = APIRouter(prefix="/api/drafts", tags=["designs"])

# Fonts the editor offers. "marathi" fonts were tested to join Marathi letters correctly
# (many Devanagari fonts break them); "english" fonts have no Marathi letters.
# "core" fonts load when the editor opens; the rest load in the background.
FONTS = [
    # --- Marathi (tested) ---
    {"family": "Mukta", "file": "Mukta-Regular.ttf", "weight": "400", "group": "marathi", "core": True},
    {"family": "Mukta", "file": "Mukta-SemiBold.ttf", "weight": "600", "group": "marathi", "core": True},
    {"family": "Mukta", "file": "Mukta-ExtraBold.ttf", "weight": "800", "group": "marathi", "core": True},
    {"family": "Baloo 2", "file": "Baloo2-Variable.ttf", "weight": "400 800", "group": "marathi", "core": True},
    {"family": "Kalam", "file": "Kalam-Regular.ttf", "weight": "400", "group": "marathi", "core": True},
    {"family": "Kalam", "file": "Kalam-Bold.ttf", "weight": "700", "group": "marathi", "core": True},
    {"family": "Rozha One", "file": "RozhaOne-Regular.ttf", "weight": "400", "group": "marathi", "core": True},
    {"family": "Poppins", "file": "Poppins-Regular.ttf", "weight": "400", "group": "marathi"},
    {"family": "Poppins", "file": "Poppins-Bold.ttf", "weight": "700", "group": "marathi"},
    {"family": "Hind", "file": "Hind-Regular.ttf", "weight": "400", "group": "marathi"},
    {"family": "Hind", "file": "Hind-Bold.ttf", "weight": "700", "group": "marathi"},
    {"family": "Noto Sans Devanagari", "file": "NotoSansDevanagari-Variable.ttf", "weight": "100 900", "group": "marathi"},
    {"family": "Yantramanav", "file": "Yantramanav-Bold.ttf", "weight": "700", "group": "marathi"},
    {"family": "Khand", "file": "Khand-Bold.ttf", "weight": "700", "group": "marathi"},
    {"family": "Rajdhani", "file": "Rajdhani-Bold.ttf", "weight": "700", "group": "marathi"},
    {"family": "Modak", "file": "Modak-Regular.ttf", "weight": "400", "group": "marathi"},
    {"family": "Baloo Bhai 2", "file": "BalooBhai2-Variable.ttf", "weight": "400 800", "group": "marathi"},
    {"family": "Laila", "file": "Laila-Bold.ttf", "weight": "700", "group": "marathi"},
    {"family": "Tiro Devanagari Marathi", "file": "TiroDevanagariMarathi-Regular.ttf", "weight": "400", "group": "marathi"},
    {"family": "Noto Serif Devanagari", "file": "NotoSerifDevanagari-Variable.ttf", "weight": "100 900", "group": "marathi"},
    {"family": "Halant", "file": "Halant-Bold.ttf", "weight": "700", "group": "marathi"},
    {"family": "Gotu", "file": "Gotu-Regular.ttf", "weight": "400", "group": "marathi"},
    {"family": "Glegoo", "file": "Glegoo-Bold.ttf", "weight": "700", "group": "marathi"},
    # --- English only (no Marathi letters) ---
    {"family": "Montserrat", "file": "Montserrat-Variable.ttf", "weight": "100 900", "group": "english"},
    {"family": "Playfair Display", "file": "PlayfairDisplay-Variable.ttf", "weight": "400 900", "group": "english"},
    {"family": "Oswald", "file": "Oswald-Variable.ttf", "weight": "200 700", "group": "english"},
    {"family": "Bebas Neue", "file": "BebasNeue-Regular.ttf", "weight": "400", "group": "english"},
    {"family": "Lobster", "file": "Lobster-Regular.ttf", "weight": "400", "group": "english"},
    {"family": "Pacifico", "file": "Pacifico-Regular.ttf", "weight": "400", "group": "english"},
    {"family": "Dancing Script", "file": "DancingScript-Variable.ttf", "weight": "400 700", "group": "english"},
    {"family": "Great Vibes", "file": "GreatVibes-Regular.ttf", "weight": "400", "group": "english"},
]


def _get(draft_id):
    draft = drafts.get(draft_id)
    if not draft:
        raise HTTPException(404, "Post not found.")
    return draft


def _image_size(path):
    with Image.open(path) as im:
        return im.size


def starter_layout(draft):
    """A simple editable starting point built from the post: background, texts, brand images.
    Used only when the poster has no measured layers (e.g. event and news photos)."""
    w, h = SIZES["feed"]
    client = clients.current()
    details = draft.get("details", {})
    items = []

    # background: the festival picture, or the first photo of an event / news post
    bg = details.get("background") or (draft["images"][0] if draft["images"] else "")
    background = {"url": to_url(bg)} if bg and Path(bg).exists() else None

    bottom = h
    if draft["type"] == "festival":
        if client["footer_image"] and Path(client["footer_image"]).exists():
            bw, bh = _image_size(client["footer_image"])
            height = round(w * bh / bw)
            bottom = h - height
            items.append({"type": "image", "name": "Banner", "url": to_url(client["footer_image"]),
                          "left": 0, "top": bottom, "width": w})
        if client["logo"] and not client["footer_image"]:
            items.append({"type": "image", "name": "Logo", "url": to_url(client["logo"]),
                          "left": 30, "top": 30, "width": 130})
        if client["leader_photos"] and details.get("tone") != "solemn" and client["type"] == "politician":
            path, ratio = prepare_leader_photo(client["leader_photos"][0])
            if path:
                ph = 300
                items.append({"type": "image", "name": "Leader photo", "url": to_url(path),
                              "left": w - round(ph * ratio), "top": h - ph, "width": round(ph * ratio)})

        rows, _ = festival_store.load()
        fest = next((f for f in rows if f["id"] == details.get("festival_id")), None)
        if fest:
            texts = [
                ("Small text", fest["line_small"].replace("|", "\n"), 60, 40, "Mukta", "600", "#FFFFFF"),
                ("Title", fest["line_big"], 130, 130, "Baloo 2", "800", "#FFC94A"),
                ("Wishes", fest["line_end"].replace("|", " "), bottom - 120, 56, "Kalam", "700", "#FFFFFF"),
            ]
            for name, text, top, size, font, weight, color in texts:
                if text.strip():
                    items.append({"type": "text", "name": name, "text": text, "left": 90, "top": top,
                                  "width": w - 180, "fontSize": size, "fontFamily": font,
                                  "fontWeight": weight, "fill": color, "textAlign": "center", "shadow": True})

    return {"width": w, "height": h, "background": background, "items": items}


def _file_url(src):
    """file:///.../output/x.png (from the poster renderer) -> URL the browser can load."""
    if not src.startswith("file:"):
        return src
    path = unquote(urlparse(src).path)
    if len(path) > 2 and path[0] == "/" and path[2] == ":":       # Windows: /C:/Users/...
        path = path[1:]
    return to_url(path)


def measured_layout(draft):
    """Exact layers measured when the poster was rendered (same look as the generated post)."""
    if not draft["images"]:
        return None
    layers_file = Path(draft["images"][0]).with_suffix(".layers.json")
    if not layers_file.exists():
        try:                                   # older poster: measure it now from its saved HTML page
            if not measure_existing(draft["images"][0]):
                return None
        except Exception:  # noqa: BLE001 - fall back to the simple starting layout
            return None
    data = json.loads(layers_file.read_text(encoding="utf-8"))
    if not Path(data["base"]).exists():
        return None
    items = []
    for it in data["items"]:
        if it["type"] == "image":
            url = _file_url(it["src"])
            if url:
                items.append({**it, "url": url})
        elif it["text"].strip():
            items.append(it)
    return {"width": data["width"], "height": data["height"], "measured": True,
            "background": {"url": to_url(data["base"])}, "items": items}


@router.get("/{draft_id}/design")
def get_design(draft_id: str):
    draft = _get(draft_id)
    saved = run(drafts.get_design, draft_id)
    client = clients.current()
    brand = [{"name": a["kind"].title(), "url": to_url(a["path"])} for a in client["assets"]]
    fonts = [{**f, "url": f"/files/assets/fonts/{f['file']}"} for f in FONTS
             if (ASSETS_DIR / "fonts" / f["file"]).exists()]          # skip fonts not downloaded yet
    return {"draft": draft_out(draft), "saved": saved.get("feed"),
            "starter": None if saved.get("feed") else (measured_layout(draft) or starter_layout(draft)),
            "brand_assets": brand, "fonts": fonts, "size": {"width": SIZES["feed"][0], "height": SIZES["feed"][1]}}


class DesignIn(BaseModel):
    design: dict          # Fabric.js canvas JSON
    image: str            # exported PNG as a data URL


@router.put("/{draft_id}/design")
def save_design(draft_id: str, body: DesignIn):
    draft = _get(draft_id)
    if not body.image.startswith("data:image/png;base64,"):
        raise HTTPException(400, "The exported image must be a PNG.")
    png = base64.b64decode(body.image.split(",", 1)[1])
    if len(png) > 15 * 1024 * 1024:
        raise HTTPException(400, "The exported image is too large.")
    folder = OUTPUT_DIR / "posters"
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"edited_{draft_id}_{uuid.uuid4().hex[:6]}.png"
    path.write_bytes(png)
    images = [str(path)] + list(draft["images"][1:])        # the edited design replaces the first image
    design = {**(run(drafts.get_design, draft_id) or {}), "feed": body.design}
    return draft_out(run(drafts.save_design, draft_id, design, images))