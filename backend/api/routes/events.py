"""
Event posts: details + photos -> caption and images.
"""
import uuid
from typing import List

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from api.helpers import draft_out, run, save_upload
from config import OUTPUT_DIR
from posts.event import create as event_create

router = APIRouter(prefix="/api/events", tags=["events"])


@router.post("")
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