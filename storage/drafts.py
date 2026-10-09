"""
Saves every post (draft) in data/drafts.json.

Status flow:  waiting  ->  approved
                      ->  rejected
"""
import json
import os
import uuid
from datetime import datetime

from config import DATA_DIR

DRAFTS_FILE = DATA_DIR / "drafts.json"


def _now():
    return datetime.now().strftime("%Y-%m-%d %H:%M")


def load_all():
    if not DRAFTS_FILE.exists():
        return []
    try:
        return json.loads(DRAFTS_FILE.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []


def _save_all(drafts):
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    tmp = DRAFTS_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(drafts, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp, DRAFTS_FILE)   # safe write: never leaves a half-written file


def create(post_type, title, caption, hashtags, images, details=None, warnings=None):
    draft = {
        "id": uuid.uuid4().hex[:8],
        "type": post_type,             # festival / event / reaction
        "title": title,
        "caption": caption,
        "hashtags": hashtags,
        "images": images,
        "details": details or {},
        "warnings": warnings or [],
        "status": "waiting",
        "version": 1,
        "created_at": _now(),
        "approved_at": "",
        "history": [{"at": _now(), "event": "created"}],
    }
    drafts = load_all()
    drafts.insert(0, draft)
    _save_all(drafts)
    return draft


def get(draft_id):
    return next((d for d in load_all() if d["id"] == draft_id), None)


def by_status(status):
    return [d for d in load_all() if d["status"] == status]


def update(draft_id, event, **fields):
    drafts = load_all()
    for d in drafts:
        if d["id"] == draft_id:
            d.update(fields)
            d["history"].append({"at": _now(), "event": event})
            _save_all(drafts)
            return d
    raise KeyError(f"Draft {draft_id} not found")


def approve(draft_id):
    return update(draft_id, "approved", status="approved", approved_at=_now())


def reject(draft_id):
    return update(draft_id, "rejected", status="rejected")
