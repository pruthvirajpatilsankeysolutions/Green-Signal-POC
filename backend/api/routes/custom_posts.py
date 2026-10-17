
import json
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from api.helpers import draft_out, run, save_upload
from config import OUTPUT_DIR
from posts.custom import create as custom
from posts.custom.types import TYPES, public
from storage import clients

router = APIRouter(prefix="/api/custom", tags=["create post"])


def _allowed(ptype):
    if ptype not in TYPES:
        raise HTTPException(404, "Unknown post type.")
    if ptype not in clients.current()["post_types"]:
        raise HTTPException(
            400,
            f"{TYPES[ptype]['label']} posts are not switched on for this client. "
            "Tick it under post types on the Clients page.",
        )


@router.get("/types")
def list_types():
    mine = clients.current()["post_types"]
    return {
        "types": [public(t) for t in TYPES if t in mine],
        "all": [public(t) for t in TYPES],
    }


class OptionsIn(BaseModel):
    form: dict


@router.post("/{ptype}/options")
def options(ptype: str, body: OptionsIn):
    _allowed(ptype)
    return run(custom.word_options, ptype, body.form)


@router.post("/{ptype}/posts")
def create_post(
    ptype: str,
    form: str = Form(...),
    chosen: str = Form(...),
    photo: Optional[UploadFile] = File(None),
):
    _allowed(ptype)
    try:
        form_data, chosen_data = json.loads(form), json.loads(chosen)
    except json.JSONDecodeError as e:
        raise HTTPException(400, "The form could not be read.") from e
    photo_path = (
        save_upload(photo, OUTPUT_DIR / "uploads" / "custom")
        if photo and photo.filename
        else ""
    )
    return draft_out(run(custom.make_post, ptype, form_data, chosen_data, photo_path))
