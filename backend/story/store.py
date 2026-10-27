"""Database access for Story Studio stories. `mutate` changes a story under a row lock, so two steps never overwrite each other."""
import copy
import time
import uuid

from sqlalchemy import select

from storage.db import Session, StudioStory

FIELDS = ("title", "brief", "notes", "directions", "stages", "story", "story_prev", "checks", "validation", "screenplay", "job")


def _out(p):
    return None if p is None else {
        "id": p.id, "title": p.title, "brief": p.brief or {}, "notes": p.notes or "", "directions": p.directions or [],
        "stages": p.stages or {}, "story": p.story or "", "story_prev": p.story_prev or "", "checks": p.checks or [], "validation": p.validation or {},
        "screenplay": p.screenplay or {}, "job": p.job or {}, "created_at": p.created_at, "updated_ts": p.updated_ts}


def create(brief, title):
    with Session() as s:
        p = StudioStory(id=uuid.uuid4().hex[:12], brief=brief, title=title)
        s.add(p)
        s.commit()
        return _out(p)


def get(story_id):
    with Session() as s:
        return _out(s.get(StudioStory, story_id))


def list_all():
    with Session() as s:
        return [_out(p) for p in s.scalars(select(StudioStory).order_by(StudioStory.updated_ts.desc())).all()]


def mutate(story_id, fn):
    """fn(story dict) changes the dict in place (and may return a value); the changes are saved. Returns (story, fn's value)."""
    with Session() as s:
        p = s.execute(select(StudioStory).where(StudioStory.id == story_id).with_for_update()).scalar_one_or_none()
        if p is None:
            raise KeyError(story_id)
        data = copy.deepcopy(_out(p))
        result = fn(data)
        for key in FIELDS:
            setattr(p, key, data[key])
        p.updated_ts = time.time()
        s.commit()
        return _out(p), result


def delete(story_id):
    with Session() as s:
        p = s.get(StudioStory, story_id)
        if p:
            s.delete(p)
            s.commit()
