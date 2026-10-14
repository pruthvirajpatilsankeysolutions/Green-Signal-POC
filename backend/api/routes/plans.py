"""
Post planner: AI word options for an occasion; the team picks, edits and approves them.

GET  /api/festivals/{fid}/plan            the plan being worked on (or null) + the angles
POST /api/festivals/{fid}/plan/generate   AI writes 4 versions (replaces an unused plan)
POST /api/festivals/{fid}/plan/rewrite    one more option for one part (hook / poster / caption / hashtags / title)
PUT  /api/festivals/{fid}/plan            save the picked and edited words
PUT  /api/festivals/{fid}/plan/pick       save one cell of the month table (hook / title / notes)
POST /api/festivals/{fid}/plan/captions   caption + hashtag options that follow the chosen hook and title
POST /api/festivals/{fid}/plan/approve    approve the words (ready for the poster)
"""

from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from api.helpers import run
from api.routes.festivals import get_festival
from posts.festival import planner
from storage import clients, plans

router = APIRouter(prefix="/api/festivals", tags=["planner"])


def _active_or_404(fid):
    plan = plans.active(fid)
    if not plan:
        raise HTTPException(404, "No plan yet. Click 'Write options with AI' first.")
    return plan


@router.get("/{fid}/plan")
def get_plan(fid: str):
    fest = get_festival(fid)
    return {
        "plan": plans.active(fid),
        "angles": planner.angles_for(fest),
        "limits": planner.LIMITS,
        "max_hashtags": planner.MAX_HASHTAGS,
        "fixed_hashtags": clients.current()["fixed_hashtags"],
    }


@router.post("/{fid}/plan/generate")
def generate_plan(fid: str):
    fest = get_festival(fid)
    options, chosen = run(planner.generate, fest)
    return {"plan": plans.save_new(fid, options, chosen)}


class RewriteIn(BaseModel):
    part: str  # hook / poster / caption / hashtags / title
    instruction: str = ""


@router.post("/{fid}/plan/rewrite")
def rewrite_part(fid: str, body: RewriteIn):
    fest = get_festival(fid)
    plan = _active_or_404(fid)
    key, option = run(
        planner.rewrite, fest, body.part, plan["options"], body.instruction
    )
    options = {**plan["options"], key: [*plan["options"].get(key, []), option]}
    return {"plan": plans.update(plan["id"], options=options, status="options")}


class PosterIn(BaseModel):
    line_small: str = ""
    line_big: str = ""
    line_end: str = ""


class ChosenIn(BaseModel):
    hook: str = ""
    poster: PosterIn
    caption: str = ""
    hashtags: List[str] = []
    notes: str = ""
    picked: Optional[dict] = None


@router.put("/{fid}/plan")
def save_plan(fid: str, body: ChosenIn):
    get_festival(fid)
    plan = _active_or_404(fid)
    if not body.poster.line_big.strip():
        raise HTTPException(400, "The poster needs a title.")
    if len(body.hashtags) > 30:
        raise HTTPException(400, "Instagram allows at most 30 hashtags.")
    # editing approved words sends them back to "options" until approved again
    return {
        "plan": plans.update(plan["id"], chosen=body.model_dump(), status="options")
    }


class PickIn(BaseModel):
    hook: Optional[str] = None
    title: Optional[str] = None
    notes: Optional[str] = None
    picked_hook: Optional[int] = None
    picked_title: Optional[int] = None


@router.put("/{fid}/plan/pick")
def pick_cell(fid: str, body: PickIn):
    """One cell of the month table. Changing a hook or title of approved words needs approving again."""
    get_festival(fid)
    plan = _active_or_404(fid)
    chosen = {
        **plan["chosen"],
        "poster": dict(plan["chosen"].get("poster", {})),
        "picked": dict(plan["chosen"].get("picked") or {}),
    }
    words_changed = False
    if body.hook is not None and body.hook != chosen.get("hook"):
        chosen["hook"], words_changed = body.hook, True
    if body.title is not None:
        if not body.title.strip():
            raise HTTPException(400, "The title can't be empty.")
        if body.title != chosen["poster"].get("line_big"):
            chosen["poster"]["line_big"], words_changed = body.title, True
    if body.notes is not None:
        chosen["notes"] = body.notes
    if body.picked_hook is not None:
        chosen["picked"]["hook"] = body.picked_hook
    if body.picked_title is not None:
        chosen["picked"]["title"] = body.picked_title
    status = "options" if words_changed else plan["status"]
    return {"plan": plans.update(plan["id"], chosen=chosen, status=status)}


@router.post("/{fid}/plan/captions")
def caption_options(fid: str):
    """For a month plan (hook + title only): caption and hashtag options that follow them."""
    fest = get_festival(fid)
    plan = _active_or_404(fid)
    captions, hashtags = run(planner.caption_options, fest, plan["chosen"])
    options = {**plan["options"], "captions": captions, "hashtags": hashtags}
    chosen = {
        **plan["chosen"],
        "caption": captions[0]["text"],
        "hashtags": hashtags[0]["tags"],
        "picked": {**(plan["chosen"].get("picked") or {}), "caption": 0, "hashtags": 0},
    }
    return {"plan": plans.update(plan["id"], options=options, chosen=chosen)}


@router.post("/{fid}/plan/approve")
def approve_plan(fid: str):
    get_festival(fid)
    plan = _active_or_404(fid)
    if not plan["chosen"].get("poster", {}).get("line_big", "").strip():
        raise HTTPException(
            400, "The poster needs a title before the words can be approved."
        )
    return {"plan": plans.update(plan["id"], status="approved")}
