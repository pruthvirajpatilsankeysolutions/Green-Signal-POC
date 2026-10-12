"""
News reaction posts: check the facts first, then create the post.
"""
import json
import uuid
from typing import List, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from api.helpers import draft_out, run, save_upload
from config import OUTPUT_DIR
from posts.reaction import create as reaction_create

router = APIRouter(prefix="/api/reactions", tags=["reactions"])


class CheckIn(BaseModel):
    team_line: str
    url: str = ""
    pasted: str = ""


@router.post("/check")
def check_reaction(body: CheckIn):
    if not body.team_line.strip() or not (body.url.strip() or body.pasted.strip()):
        raise HTTPException(400, "Add the one-line summary and a news link (or paste the news text).")
    return run(reaction_create.check_facts, body.team_line, body.url.strip(), body.pasted)


@router.post("")
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