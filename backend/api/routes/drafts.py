"""
Drafts (all posts): list, approve, reject, rewrite caption.
"""

from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from api.helpers import draft_out, run
from posts import template_post
from posts.rewrite import rewrite
from storage import drafts

router = APIRouter(prefix="/api/drafts", tags=["drafts"])


def _get_draft(draft_id):
    draft = drafts.get(draft_id)
    if not draft:
        raise HTTPException(404, "Post not found.")
    return draft


@router.get("")
def list_drafts(status: Optional[str] = None):
    items = drafts.by_status(status) if status else drafts.load_all()
    return {"drafts": [draft_out(d) for d in items]}


@router.post("/{draft_id}/approve")
def approve(draft_id: str):
    _get_draft(draft_id)
    return draft_out(drafts.approve(draft_id))


@router.post("/{draft_id}/reject")
def reject(draft_id: str):
    _get_draft(draft_id)
    return draft_out(drafts.reject(draft_id))


class RewriteIn(BaseModel):
    instruction: str


@router.post("/{draft_id}/rewrite")
def rewrite_caption(draft_id: str, body: RewriteIn):
    if not body.instruction.strip():
        raise HTTPException(400, "Type what should change first.")
    draft = _get_draft(draft_id)
    return draft_out(run(rewrite, draft, body.instruction.strip()))


class FrameIn(BaseModel):
    frame: str                      # "none" | "banner" | "photo_banner"


@router.post("/{draft_id}/frame")
def change_banner(draft_id: str, body: FrameIn):
    """Draw a template post again with another banner option: same words, same post."""
    if not drafts.get(draft_id):
        raise HTTPException(404, "Post not found.")
    return draft_out(run(template_post.rerender, draft_id, body.frame))      # a wrong option or no banner -> 400 with the reason
