"""Story Studio: the agency's own tool for developing stories one stage at a time, the writer approving each stage (see story/).
It is separate from the client app: no client is selected and nothing here belongs to a client. An access key (STUDIO_ACCESS_KEY)
can protect it; without a key it is open to anyone who can reach the server."""
import hmac
import time
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

import config
from story import engine, jobs, options, store
from story.engine import StoryError

public = APIRouter(prefix="/api/studio", tags=["studio"])


def require_key(x_studio_key: str = Header(default="")):
    if config.STUDIO_ACCESS_KEY and not hmac.compare_digest(x_studio_key.encode(), config.STUDIO_ACCESS_KEY.encode()):
        time.sleep(0.4)                                            # slows down guessing
        raise HTTPException(401, "Enter the Story Studio access key.")


router = APIRouter(prefix="/api/studio", tags=["studio"], dependencies=[Depends(require_key)])


@public.get("/status")
def status():
    """Does the page need to ask for the access key? (No key needed to ask.)"""
    return {"protected": bool(config.STUDIO_ACCESS_KEY)}


@router.get("/session")
def session():
    """Used by the sign-in screen to check a key: it answers 200 only with the right one."""
    return {"ok": True}


def _get(story_id):
    p = store.get(story_id)
    if not p:
        raise HTTPException(404, "Story not found.")
    return p


def _view(story_id):
    return engine.view(store.get(story_id))


def _guard(fn, *args):
    """Problems the writer can fix come back as a plain 400 (or 409 when a step is already running)."""
    try:
        return fn(*args)
    except jobs.Busy as e:
        raise HTTPException(409, str(e))
    except (StoryError, ValueError) as e:
        raise HTTPException(400, str(e))


def _stage(stage):
    if stage not in options.STAGES:
        raise HTTPException(404, "Unknown stage.")
    return stage


@router.get("/options")
def get_options():
    return {"content_types": options.OFFERED_FORMATS, "formats": options.format_info(), "genres": options.GENRES, "tones": options.TONES, "languages": options.LANGUAGES,
            "lengths": options.LENGTHS, "audiences": [{"key": k, "label": l, "hint": h} for k, l, h in options.AUDIENCES],
            "endings": options.ENDINGS, "revisions": options.REVISIONS, "stages": [{"key": s, "title": options.STAGE_TITLES[s]} for s in options.STAGES]}


@router.get("/stories")
def list_stories():
    return {"stories": [engine.summary(p) for p in store.list_all()]}


class BriefIn(BaseModel):
    content_type: str = "Short Story"
    idea: str = ""
    genres: list = []
    tones: list = []
    language: str = "English"
    length: str = "Medium"
    characters: Optional[str] = None
    setting: Optional[str] = None
    audience: Optional[str] = None
    brand: Optional[str] = None
    preferred_ending: Optional[str] = None
    protagonist_type: Optional[str] = None
    avoid_themes: Optional[str] = None
    notes: Optional[str] = None


@router.post("/stories")
def create_story(body: BriefIn):
    return engine.view(_guard(engine.create, body.dict()))


@router.get("/stories/{story_id}")
def get_story(story_id: str):
    _get(story_id)
    return _view(story_id)


@router.delete("/stories/{story_id}")
def delete_story(story_id: str):
    _get(story_id)
    store.delete(story_id)
    return {"ok": True}


# ---------------------------------------------------------------- stages 1-8
class GenerateIn(BaseModel):
    direction: str = ""
    retry: bool = False


@router.post("/stories/{story_id}/stages/{stage}/generate")
def generate(story_id: str, stage: str, body: GenerateIn):
    """Write (or retry) a stage. Only when the stage before it is approved. Runs in the background; the page polls the story."""
    p = _get(story_id)
    stage = _stage(stage)
    if stage == "story":
        raise HTTPException(400, "Use 'Write the story' for the final story.")
    _guard(engine._ensure_ready, p, stage)
    _guard(jobs.run, story_id, f"stage:{stage}", lambda progress: engine.generate_stage(story_id, stage, body.direction, body.retry, progress))
    return _view(story_id)


class AcceptIn(BaseModel):
    content: Optional[str] = None            # given = the writer's own edit, which becomes canon exactly as written


@router.post("/stories/{story_id}/stages/{stage}/accept")
def accept(story_id: str, stage: str, body: AcceptIn):
    _get(story_id)
    _guard(engine.accept_stage, story_id, _stage(stage), body.content)
    return _view(story_id)


@router.post("/stories/{story_id}/stages/{stage}/facts")
def facts(story_id: str, stage: str):
    _get(story_id)
    _guard(engine.refresh_facts, story_id, _stage(stage))
    return _view(story_id)


# ---------------------------------------------------------------- the story
def _job(story_id, kind, work):
    _guard(jobs.run, story_id, kind, work)
    return _view(story_id)


@router.post("/stories/{story_id}/story/generate")
def write_story(story_id: str):
    _guard(engine._require_outline, _get(story_id))
    return _job(story_id, "story", lambda progress: engine.write_story(story_id, progress))


@router.post("/stories/{story_id}/story/validate")
def validate(story_id: str):
    _guard(engine._require_story, _get(story_id))
    return _job(story_id, "validate", lambda progress: engine.validate_story(story_id, progress))


class ReviseIn(BaseModel):
    instruction: str


@router.post("/stories/{story_id}/story/revise")
def revise(story_id: str, body: ReviseIn):
    _guard(engine._require_story, _get(story_id))
    if len(body.instruction.strip()) < 3:
        raise HTTPException(400, "Say what should change.")
    return _job(story_id, "revise", lambda progress: engine.revise_story(story_id, body.instruction, progress))


@router.post("/stories/{story_id}/story/undo")
def undo(story_id: str):
    _get(story_id)
    _guard(engine.undo_story, story_id)
    return _view(story_id)


@router.post("/stories/{story_id}/story/accept")
def accept_story(story_id: str):
    _get(story_id)
    _guard(engine.accept_story, story_id)
    return _view(story_id)


# ---------------------------------------------------------------- screenplay and files
class ScreenplayIn(BaseModel):
    restart: bool = False


@router.post("/stories/{story_id}/screenplay/generate")
def screenplay(story_id: str, body: ScreenplayIn):
    p = _get(story_id)
    _guard(engine._require_outline, p)
    _guard(engine._require_story, p)
    return _job(story_id, "screenplay", lambda progress: engine.write_screenplay(story_id, progress, body.restart))


FILES = {"story.md": ("story.md", "text/markdown"), "story_bible.md": ("story_bible.md", "text/markdown"),
         "screenplay.fountain": ("screenplay/screenplay.fountain", "text/plain")}


@router.get("/stories/{story_id}/files/{name}")
def file(story_id: str, name: str):
    p = _get(story_id)
    if name not in FILES:
        raise HTTPException(404, "Unknown file.")
    path, kind = FILES[name]
    content = engine.export_files(p).get(path)
    if not content:
        raise HTTPException(404, "That file doesn't exist yet.")
    return Response(content.encode("utf-8"), media_type=f"{kind}; charset=utf-8", headers={"Content-Disposition": f'attachment; filename="{name}"'})


@router.get("/stories/{story_id}/export")
def export(story_id: str):
    p = _get(story_id)
    return Response(engine.export_zip(p), media_type="application/zip", headers={"Content-Disposition": 'attachment; filename="story-project.zip"'})
