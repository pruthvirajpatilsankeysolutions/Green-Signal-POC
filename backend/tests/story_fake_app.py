"""The real backend with the stand-in model, for browser tests:  uvicorn tests.story_fake_app:app --port 8000
POST /__fake/control sets what the stand-in does (see tests/fake_story_llm.py)."""
import os

from fastapi import Request

from api.main import app
from story import llm
from tests import fake_story_llm as fake

llm.complete = fake.complete
fake.CONTROL["delay"] = float(os.getenv("STORY_FAKE_DELAY", "0.5"))


@app.post("/__fake/control")
async def control(request: Request):
    body = await request.json()
    if body.get("reset"):
        fake.reset()
        fake.CONTROL["delay"] = float(os.getenv("STORY_FAKE_DELAY", "0.5"))
    for key in ("reports", "conflicts", "fail"):
        if key in body:
            fake.CONTROL[key] = body[key]
    for key in ("repair_short", "revise_short", "many_facts", "delay"):
        if key in body:
            fake.CONTROL[key] = body[key]
    return {"ok": True}
