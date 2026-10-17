"""
Saves every post (draft) in the database, for the current client only.

Status flow:  waiting  ->  approved   (the approved caption also becomes a style example)
                      ->  rejected
"""

import time
import uuid

from sqlalchemy import select

from storage.clients import add_style, current_id
from storage.db import Draft, Session, now_text


def _out(d):
    return {
        "id": d.id,
        "client_id": d.client_id,
        "type": d.type,
        "title": d.title,
        "caption": d.caption,
        "hashtags": d.hashtags or [],
        "images": d.images or [],
        "details": d.details or {},
        "warnings": d.warnings or [],
        "status": d.status,
        "version": d.version,
        "created_at": d.created_at,
        "approved_at": d.approved_at or "",
        "history": d.history or [],
    }


def load_all():
    with Session() as s:
        rows = s.scalars(
            select(Draft)
            .where(Draft.client_id == current_id())
            .order_by(Draft.created_ts.desc())
        ).all()
    return [_out(d) for d in rows]


def by_status(status):
    with Session() as s:
        rows = s.scalars(
            select(Draft)
            .where(Draft.client_id == current_id(), Draft.status == status)
            .order_by(Draft.created_ts.desc())
        ).all()
    return [_out(d) for d in rows]


def get(draft_id):
    with Session() as s:
        d = s.get(Draft, draft_id)
        return _out(d) if d and d.client_id == current_id() else None


def create(post_type, title, caption, hashtags, images, details=None, warnings=None):
    d = Draft(
        id=uuid.uuid4().hex[:8],
        client_id=current_id(),
        type=post_type,
        title=title,
        caption=caption,
        hashtags=hashtags,
        images=images,
        details=details or {},
        warnings=warnings or [],
        status="waiting",
        version=1,
        created_at=now_text(),
        created_ts=time.time(),
        approved_at="",
        history=[{"at": now_text(), "event": "created"}],
    )
    with Session() as s:
        s.add(d)
        s.commit()
    return _out(d)


def update(draft_id, event, **fields):
    with Session() as s:
        d = s.get(Draft, draft_id)
        if not d or d.client_id != current_id():
            raise KeyError(f"Draft {draft_id} not found")
        for key, value in fields.items():
            setattr(d, key, value)
        d.history = (d.history or []) + [{"at": now_text(), "event": event}]
        s.commit()
        return _out(d)


def approve(draft_id):
    draft = update(draft_id, "approved", status="approved", approved_at=now_text())
    # every approved caption teaches the AI this client's style for next time
    from posts import style_kind

    details = draft["details"]
    kind = style_kind(draft["type"], details.get("tone") or details.get("post_type", ""))
    text = draft["caption"] + (
        "\n\n" + " ".join(draft["hashtags"]) if draft["hashtags"] else ""
    )
    add_style(draft["client_id"], kind, text, source="approved")
    return draft


def reject(draft_id):
    return update(draft_id, "rejected", status="rejected")


def get_design(draft_id):
    """The saved editor layers of a post ({} if never edited)."""
    with Session() as s:
        d = s.get(Draft, draft_id)
        if not d or d.client_id != current_id():
            raise KeyError(f"Draft {draft_id} not found")
        return d.design or {}


def save_design(draft_id, design, images):
    """Save edited layers + new images. Editing sends the post back for approval."""
    with Session() as s:
        d = s.get(Draft, draft_id)
        if not d or d.client_id != current_id():
            raise KeyError(f"Draft {draft_id} not found")
        d.design = design
        d.images = images
        d.version = (d.version or 1) + 1
        d.status = "waiting"
        d.approved_at = ""
        d.history = (d.history or []) + [{"at": now_text(), "event": "design edited"}]
        s.commit()
        return _out(d)