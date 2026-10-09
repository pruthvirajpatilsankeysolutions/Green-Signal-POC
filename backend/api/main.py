"""
REST API for the React UI. It only wraps the existing Python modules
(posts/, design/, storage/, ai/) - no business logic lives here.

Run from the project folder:
    uvicorn api.main:app --reload --port 8000
"""
import json
import os
import uuid
from pathlib import Path
from typing import List, Optional
from urllib.parse import quote

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from config import ASSETS_DIR, CLIENT, OUTPUT_DIR, ROOT
from design.poster import IMAGE_TYPES
from posts.event import create as event_create
from posts.festival import create as festival_create
from posts.reaction import create as reaction_create
from posts.rewrite import rewrite
from storage import drafts
from storage import festivals as festival_store

app = FastAPI(title="Social post assistant API")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173"],
                   allow_methods=["*"], allow_headers=["*"])

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/files/output", StaticFiles(directory=OUTPUT_DIR), name="output")
app.mount("/files/assets", StaticFiles(directory=ASSETS_DIR), name="assets")

LAYOUT_FROM_CSV = {"right": "text_right", "left": "text_left", "center": "text_center"}


# ---------------------------------------------------------------- helpers
def to_url(path):
    """Server file path -> URL the browser can load ('' if outside output/assets)."""
    p = Path(path).resolve()
    for base, prefix in ((OUTPUT_DIR.resolve(), "/files/output"), (ASSETS_DIR.resolve(), "/files/assets")):
        try:
            return f"{prefix}/{quote(p.relative_to(base).as_posix())}"
        except ValueError:
            continue
    return ""


def draft_out(draft):
    out = dict(draft)
    out["image_urls"] = [to_url(p) for p in draft.get("images", [])]
    return out


def safe_path(path):
    """Only allow files inside the project folder."""
    p = Path(path).resolve()
    if ROOT.resolve() not in p.parents or not p.exists():
        raise HTTPException(400, "File not found in the project folder.")
    return str(p)


def save_upload(upload: UploadFile, folder: Path, name: str = ""):
    folder.mkdir(parents=True, exist_ok=True)
    ext = Path(upload.filename or "").suffix.lower() or ".jpg"
    if ext not in IMAGE_TYPES:
        raise HTTPException(400, f"{upload.filename}: only JPG, PNG or WEBP images are allowed.")
    path = folder / f"{name or uuid.uuid4().hex[:8]}{ext}"
    path.write_bytes(upload.file.read())
    return str(path)


def run(fn, *args, **kwargs):
    """Call the post logic and turn any error into a readable API error."""
    try:
        return fn(*args, **kwargs)
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001 - show the real reason in the UI
        raise HTTPException(500, str(e)) from e


def get_festival(fid):
    rows, _ = festival_store.load()
    for f in rows:
        if f["id"] == fid:
            return f
    raise HTTPException(404, f"Occasion '{fid}' not found in festivals.csv")


def festival_out(f):
    out = {k: v for k, v in f.items() if k != "date_obj"}
    out["due"] = 0 <= f["days_left"] <= f["lead_days"]
    out["default_layout"] = LAYOUT_FROM_CSV.get((f.get("layout") or "").lower(), "text_right")
    return out


# ---------------------------------------------------------------- status
@app.get("/api/status")
def status():
    rows, errors = festival_store.load()
    return {
        "client": {"name": CLIENT["name"], "handle": CLIENT.get("handle", ""),
                   "designation": CLIENT.get("designation_lines", [])},
        "text_ai": any(os.getenv(k) for k in ("GEMINI_API_KEY", "GOOGLE_API_KEY", "ANTHROPIC_API_KEY")),
        "image_ai": bool(os.getenv("OPENAI_API_KEY")),
        "counts": {"waiting": len(drafts.by_status("waiting")),
                   "approved": len(drafts.by_status("approved"))},
        "due": [festival_out(f) for f in festival_store.due_now(rows)],
        "calendar_errors": errors,
    }


# ---------------------------------------------------------------- festivals
@app.get("/api/festivals")
def list_festivals():
    rows, errors = festival_store.load()
    return {"festivals": [festival_out(f) for f in rows], "errors": errors}


@app.get("/api/festivals/{fid}/backgrounds")
def list_backgrounds(fid: str):
    fest = get_festival(fid)
    items = [{"path": p, "source": "ready"} for p in festival_create.ready_backgrounds(fest)]
    for folder, source in ((OUTPUT_DIR / "uploads" / "bg" / fid, "uploaded"),
                           (OUTPUT_DIR / "candidates" / fid, "ai")):
        if folder.exists():
            files = sorted(folder.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True)
            items += [{"path": str(p), "source": source} for p in files if p.suffix.lower() in IMAGE_TYPES]
    for item in items:
        item["url"] = to_url(item["path"])
    return {"backgrounds": items}


@app.post("/api/festivals/{fid}/backgrounds")
def upload_background(fid: str, file: UploadFile = File(...)):
    get_festival(fid)
    path = save_upload(file, OUTPUT_DIR / "uploads" / "bg" / fid)
    return {"path": path, "url": to_url(path), "source": "uploaded"}


class GenerateIn(BaseModel):
    layout: str = "text_right"


@app.post("/api/festivals/{fid}/backgrounds/generate")
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
    background: str
    layout: str = "text_right"
    ai_generated: bool = False


@app.post("/api/festivals/{fid}/posts")
def create_festival_post(fid: str, body: FestivalPostIn):
    fest = get_festival(fid)
    draft = run(festival_create.make_post, fest, safe_path(body.background),
                body.ai_generated, body.layout)
    return draft_out(draft)


# ---------------------------------------------------------------- events
@app.post("/api/events")
def create_event(name: str = Form(...), place: str = Form(...), date: str = Form(...),
                 points: str = Form(...), guests: str = Form(""), thanks: str = Form(""),
                 photos: List[UploadFile] = File(...)):
    if not photos:
        raise HTTPException(400, "Upload at least one photo.")
    folder = OUTPUT_DIR / "uploads" / uuid.uuid4().hex[:8]
    paths = [save_upload(p, folder, f"{i:02d}") for i, p in enumerate(photos[:10], start=1)]
    event = {"name": name.strip(), "place": place.strip(), "date": date.strip(),
             "guests": guests.strip(), "points": points.strip(), "thanks": thanks.strip()}
    return draft_out(run(event_create.make_post, event, paths))


# ---------------------------------------------------------------- reactions
class CheckIn(BaseModel):
    team_line: str
    url: str = ""
    pasted: str = ""


@app.post("/api/reactions/check")
def check_reaction(body: CheckIn):
    if not body.team_line.strip() or not (body.url.strip() or body.pasted.strip()):
        raise HTTPException(400, "Add the one-line summary and a news link (or paste the news text).")
    return run(reaction_create.check_facts, body.team_line, body.url.strip(), body.pasted)


@app.post("/api/reactions")
def create_reaction(team_line: str = Form(...), tone: str = Form(...), checked: str = Form(...),
                    mention: str = Form(""), memories: str = Form(""),
                    photos: Optional[List[UploadFile]] = File(None)):
    if tone not in reaction_create.TONES:
        raise HTTPException(400, f"Type must be one of: {', '.join(reaction_create.TONES)}")
    checked_data = json.loads(checked)
    if checked_data.get("blocked"):
        raise HTTPException(400, f"Blocked: {checked_data['blocked']}")
    paths = []
    if photos:
        folder = OUTPUT_DIR / "uploads" / f"reaction_{uuid.uuid4().hex[:6]}"
        paths = [save_upload(p, folder, f"{i:02d}") for i, p in enumerate(photos[:10], start=1)]
    draft = run(reaction_create.make_post, team_line, tone, mention, checked_data, paths, memories)
    return draft_out(draft)


# ---------------------------------------------------------------- drafts
@app.get("/api/drafts")
def list_drafts(status: Optional[str] = None):
    items = drafts.by_status(status) if status else drafts.load_all()
    return {"drafts": [draft_out(d) for d in items]}


def _get_draft(draft_id):
    draft = drafts.get(draft_id)
    if not draft:
        raise HTTPException(404, "Post not found.")
    return draft


@app.post("/api/drafts/{draft_id}/approve")
def approve(draft_id: str):
    _get_draft(draft_id)
    return draft_out(drafts.approve(draft_id))


@app.post("/api/drafts/{draft_id}/reject")
def reject(draft_id: str):
    _get_draft(draft_id)
    return draft_out(drafts.reject(draft_id))


class RewriteIn(BaseModel):
    instruction: str


@app.post("/api/drafts/{draft_id}/rewrite")
def rewrite_caption(draft_id: str, body: RewriteIn):
    if not body.instruction.strip():
        raise HTTPException(400, "Type what should change first.")
    draft = _get_draft(draft_id)
    return draft_out(run(rewrite, draft, body.instruction.strip()))


# ---------------------------------------------------------------- React app (after `npm run build`)
DIST = ROOT.parent / "frontend" / "dist"
if DIST.exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="web-assets")

    @app.get("/{full_path:path}")
    def spa(full_path: str):
        file = DIST / full_path
        return FileResponse(file if full_path and file.is_file() else DIST / "index.html")