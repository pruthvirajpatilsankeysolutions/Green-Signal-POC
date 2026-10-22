"""
Templates: upload a PowerPoint -> converted to a Fabric template -> edited in the design editor
(choose what the app fills: "Fill with") -> saved. When creating a post, the user picks a template.
"""

import base64
import io
import re
import uuid
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from PIL import Image
from pydantic import BaseModel

from api.helpers import run, to_url
from api.routes.designs import all_fonts
from config import ASSETS_DIR
from design import pptx_to_fabric
from storage import clients, fonts, templates
from storage import festivals as festival_store
from storage.categories import public_list as categories

router = APIRouter(prefix="/api/templates", tags=["templates"])

# the post types a template can be used for (the "Use for" choices in the save dialog)
POST_TYPES = [
    {"id": "festival", "label": "Festival greetings (any festival)"},
    {"id": "announcement", "label": "Announcement"},
    {"id": "offer", "label": "Offer"},
    {"id": "achievement", "label": "Achievement"},
    {"id": "spotlight", "label": "Person spotlight"},
]

# what the app can put into a slot (shown as "Fill with" in the editor)
SLOTS = [
    {"id": "client_name", "label": "Client name", "kind": "text"},
    {"id": "line_small", "label": "Poster: small line", "kind": "text"},
    {"id": "line_big", "label": "Poster: title", "kind": "text"},
    {"id": "line_end", "label": "Poster: closing line / message", "kind": "text"},
    {"id": "phone", "label": "Phone", "kind": "text"},
    {"id": "contact", "label": "Handle / address", "kind": "text"},
    {"id": "address", "label": "Address", "kind": "text"},
    {"id": "logo", "label": "Client logo", "kind": "image"},
    {"id": "photo", "label": "Post photo", "kind": "image"},
]


def _fonts():
    return [
        {**f, "url": f"/files/assets/fonts/{f['file']}"}
        for f in all_fonts()
        if (ASSETS_DIR / "fonts" / f["file"]).exists()
    ]


def _missing(design):
    have = {f["family"] for f in _fonts()}
    return sorted(
        {
            o["fontFamily"]
            for o in design.get("objects", [])
            if str(o.get("type", "")).lower() == "textbox"
            and o.get("fontFamily") not in have
        }
    )


def _card(t):
    if not t:
        raise HTTPException(404, "Template not found")
    slots = (
        sorted(
            {o["slot"] for o in t.get("design", {}).get("objects", []) if o.get("slot")}
        )
        if t.get("design")
        else t.get("slots", [])
    )
    return {k: v for k, v in t.items() if k != "design"} | {
        "thumbnail_url": to_url(t["thumbnail"]) if t.get("thumbnail") else "",
        "slots": slots,
    }


@router.get("")
def list_templates():
    return {
        "templates": [
            _card(run(templates.get, t["id"])) for t in run(templates.list_all)
        ],
        "slots": SLOTS,
    }


@router.get("/for-post")
def templates_for_post(occasion: str = "", post_type: str = ""):
    """Saved templates this client may use for this post (occasion / client type / this client only)."""
    client = clients.current()
    kinds = {client.get("type", ""), client.get("category", "")} - {""}
    out = []
    for t in run(templates.list_all):
        if not t["ready"] or (t["client_id"] and t["client_id"] != client["id"]):
            continue
        if t["client_types"] and not kinds & set(t["client_types"]):
            continue
        if (
            t["occasions"]
            and occasion not in t["occasions"]
            and post_type not in t["occasions"]
        ):
            continue
        out.append(_card(run(templates.get, t["id"])))
    return {"templates": out}


@router.post("/import")
async def import_pptx(file: UploadFile = File(...)):
    """Upload a PowerPoint: it is converted and opened in the editor."""
    if not (file.filename or "").lower().endswith(".pptx"):
        raise HTTPException(400, "Please choose a PowerPoint file (.pptx).")
    stem = (
        re.sub(r"[^a-z0-9]+", "_", Path(file.filename).stem.lower()).strip("_")[:40]
        or "template"
    )
    template_id = f"{stem}_{uuid.uuid4().hex[:5]}"
    folder = ASSETS_DIR / "templates" / template_id
    folder.mkdir(parents=True, exist_ok=True)
    source = folder / "source.pptx"
    source.write_bytes(await file.read())
    try:
        design, width, height = run(pptx_to_fabric.convert, source, template_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, f"Couldn't read this PowerPoint file: {e}")
    if not design["objects"]:
        raise HTTPException(400, "No texts or pictures found on the first slide.")
    design = pptx_to_fabric.guess_slots(design, width, height)
    run(
        templates.create,
        template_id,
        Path(file.filename).stem.replace("_", " "),
        width,
        height,
        design,
        file.filename,
    )
    return {"id": template_id, "missing_fonts": _missing(design)}


@router.get("/{template_id}/design")
def template_design(template_id: str):
    """The template in the editor's format (the same shape as a post's design)."""
    t = run(templates.get, template_id)
    if not t:
        raise HTTPException(404, "Template not found")
    client = clients.current()
    brand = [
        {"name": a["kind"].title(), "url": to_url(a["path"])} for a in client["assets"]
    ]
    fests, _ = festival_store.load()
    return {
        "draft": {
            "id": template_id,
            "title": t["name"],
            "images": [],
            "image_urls": [],
        },
        "template": {
            "id": template_id,
            "name": t["name"],
            "missing_fonts": _missing(t["design"]),
            "occasions": t["occasions"],
            "client_types": t["client_types"],
            "only_this_client": bool(t["client_id"]),
            "client_name": client["name"],
        },
        # choices for the "Save template" dialog
        "choices": {
            "post_types": POST_TYPES,
            "festivals": [
                {
                    "id": f["id"],
                    "name": f.get("occasion_en") or f["occasion_mr"],
                    "date": f["date"],
                }
                for f in fests
            ],
            "client_types": [
                {"id": c["id"], "label": c["label"]} for c in categories()
            ],
        },
        "saved": t["design"],
        "starter": None,
        "brand_assets": brand,
        "fonts": _fonts(),
        "slots": SLOTS,
        "size": t["design"].get("size") or {"width": t["width"], "height": t["height"]},
    }


class DesignIn(BaseModel):
    design: dict  # Fabric JSON from the editor (with "slot" on the parts the app fills)
    image: str  # the exported PNG (becomes the thumbnail)
    # options from the "Save template" dialog (left out = unchanged)
    name: Optional[str] = None
    occasions: Optional[List[str]] = (
        None  # post types and/or festival ids; [] = all posts
    )
    client_types: Optional[List[str]] = None  # [] = all client types
    only_this_client: Optional[bool] = None


@router.put("/{template_id}/design")
def save_template_design(template_id: str, body: DesignIn):
    t = run(templates.get, template_id)
    if not t:
        raise HTTPException(404, "Template not found")
    design = {
        **body.design,
        "size": body.design.get("size")
        or t["design"].get("size")
        or {"width": t["width"], "height": t["height"]},
    }
    fields = {"design": design, "ready": True}
    if body.name is not None:
        fields["name"] = body.name.strip() or t["name"]
    if body.occasions is not None:
        fields["occasions"] = body.occasions
    if body.client_types is not None:
        fields["client_types"] = body.client_types
    if body.only_this_client is not None:
        fields["client_id"] = clients.current()["id"] if body.only_this_client else ""
    if body.image.startswith("data:image/png;base64,"):
        thumb = ASSETS_DIR / "templates" / template_id / "thumbnail.png"
        im = Image.open(
            io.BytesIO(base64.b64decode(body.image.split(",", 1)[1]))
        ).convert("RGB")
        im.thumbnail((360, 480))
        im.save(thumb)
        fields["thumbnail"] = str(thumb)
    saved = run(lambda: templates.save(template_id, **fields))
    return {**_card(saved), "missing_fonts": _missing(design)}


class SettingsIn(BaseModel):
    name: str
    occasions: List[str] = []  # festival ids or post types; empty = any
    client_types: List[str] = []  # empty = all
    only_this_client: bool = False


@router.put("/{template_id}")
def save_settings(template_id: str, body: SettingsIn):
    if not run(templates.get, template_id):
        raise HTTPException(404, "Template not found")
    t = run(
        lambda: templates.save(
            template_id,
            name=body.name.strip() or template_id,
            occasions=body.occasions,
            client_types=body.client_types,
            client_id=clients.current()["id"] if body.only_this_client else "",
        )
    )
    return _card(t)


@router.delete("/{template_id}")
def delete_template(template_id: str):
    run(templates.delete, template_id)
    return {"deleted": template_id}


@router.post("/fonts")
async def add_font(
    file: UploadFile = File(...),
    family: str = Form(...),
    weight: Optional[str] = Form("400"),
):
    """Add a font a template needs (a .ttf / .otf / .woff2 file you're allowed to use)."""
    if not (file.filename or "").lower().endswith((".ttf", ".otf", ".woff2", ".woff")):
        raise HTTPException(
            400, "Please choose a font file (.ttf, .otf, .woff or .woff2)."
        )
    return run(
        fonts.add,
        family.strip(),
        (weight or "400").strip(),
        file.filename,
        await file.read(),
    )
