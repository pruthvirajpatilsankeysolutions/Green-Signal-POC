"""
Festival, jayanti and punyatithi posts: calendar, background pictures, posters.
"""

from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

from api.helpers import draft_out, run, safe_path, save_upload, to_url
from config import OUTPUT_DIR
from design.poster import IMAGE_TYPES
from posts.festival import create as festival_create
from storage import clients, plans
from storage import festivals as festival_store

router = APIRouter(prefix="/api/festivals", tags=["festivals"])

LAYOUT_FROM_CSV = {
    "right": "text_right",
    "left": "text_left",
    "center": "text_center",
    "corners": "text_corners",
}


def get_festival(fid):
    rows, _ = festival_store.load()
    for f in rows:
        if f["id"] == fid:
            return f
    raise HTTPException(404, f"Occasion '{fid}' not found in festivals.csv")


def for_category(rows):
    """Only the occasions this client posts (from its ticked post types)."""
    client = clients.current()
    tones, region = client["tones"], client["region"]
    return [
        f
        for f in rows
        if f["tone"] in tones and (not f.get("regions") or region in f["regions"])
    ]


def festival_out(f):
    out = {k: v for k, v in f.items() if k != "date_obj"}
    out["due"] = 0 <= f["days_left"] <= f["lead_days"]
    out["default_layout"] = LAYOUT_FROM_CSV.get(
        (f.get("layout") or "").lower(), "text_right"
    )
    return out


@router.get("")
def list_festivals():
    rows, errors = festival_store.load()
    return {
        "festivals": [festival_out(f) for f in for_category(rows)],
        "errors": errors,
    }


@router.get("/{fid}/backgrounds")
def list_backgrounds(fid: str):
    fest = get_festival(fid)
    items = [
        {"path": p, "source": "ready"} for p in festival_create.ready_backgrounds(fest)
    ]
    for folder, source in (
        (OUTPUT_DIR / "uploads" / "bg" / fid, "uploaded"),
        (OUTPUT_DIR / "candidates" / fid, "ai"),
    ):
        if folder.exists():
            files = sorted(
                folder.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True
            )
            items += [
                {"path": str(p), "source": source}
                for p in files
                if p.suffix.lower() in IMAGE_TYPES
            ]
    for item in items:
        item["url"] = to_url(item["path"])
    return {"backgrounds": items}


@router.post("/{fid}/backgrounds")
def upload_background(fid: str, file: UploadFile = File(...)):
    get_festival(fid)
    path = save_upload(file, OUTPUT_DIR / "uploads" / "bg" / fid)
    return {"path": path, "url": to_url(path), "source": "uploaded"}


class GenerateIn(BaseModel):
    layout: str = "text_right"


@router.post("/{fid}/backgrounds/generate")
def generate_backgrounds(fid: str, body: GenerateIn):
    fest = get_festival(fid)
    paths = run(festival_create.generate_background_options, fest, body.layout)
    folder = OUTPUT_DIR / "candidates" / fid
    folder.mkdir(parents=True, exist_ok=True)
    moved = []
    for p in paths:
        target = folder / Path(p).name
        Path(p).replace(target)
        moved.append({"path": str(target), "url": to_url(target), "source": "ai"})
    return {"backgrounds": moved}


class FestivalPostIn(BaseModel):
    background: str = ""                   # optional with a template (its own picture)
    layout: str = "text_right"
    template_id: str = ""
    ai_generated: bool = False
    use_plan: bool = True


@router.post("/{fid}/posts")
def create_festival_post(fid: str, body: FestivalPostIn):
    fest = get_festival(fid)
    plan = plans.active(fid) if body.use_plan else None
    draft = run(
        festival_create.make_post,
        fest,
        safe_path(body.background) if body.background else "",
        body.ai_generated,
        body.layout,
        plan,
        body.template_id,
    )
    if plan:
        plans.update(
            plan["id"], status="used", draft_id=draft["id"]
        )  # the next post starts a new plan
    return draft_out(draft)