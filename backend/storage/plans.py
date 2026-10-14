"""
Post plans: the words for an upcoming post, chosen before the poster is made.

Status: options  -> AI options ready, the team is picking and editing
        approved -> words approved, ready for the poster
        used     -> a post was made from it (a new plan starts for the next post)
"""

import uuid

from sqlalchemy import select

from storage.clients import current_id
from storage.db import PostPlan, Session, now_text


def _out(p):
    return {
        "id": p.id,
        "festival_id": p.festival_id,
        "status": p.status,
        "options": p.options or {},
        "chosen": p.chosen or {},
        "draft_id": p.draft_id,
        "created_at": p.created_at,
        "updated_at": p.updated_at,
    }


def active(festival_id):
    """The plan being worked on for this occasion (not yet used for a post), or None."""
    with Session() as s:
        p = s.scalars(
            select(PostPlan)
            .where(
                PostPlan.client_id == current_id(),
                PostPlan.festival_id == festival_id,
                PostPlan.status != "used",
            )
            .order_by(PostPlan.created_at.desc())
        ).first()
        return _out(p) if p else None


def latest_many(festival_ids):
    """The newest plan (any status) for each occasion: {festival_id: plan}."""
    if not festival_ids:
        return {}
    with Session() as s:
        rows = s.scalars(
            select(PostPlan)
            .where(
                PostPlan.client_id == current_id(),
                PostPlan.festival_id.in_(festival_ids),
            )
            .order_by(PostPlan.created_at)
        ).all()
    out = {}
    for p in rows:  # oldest first, so the newest wins
        out[p.festival_id] = _out(p)
    return out


def save_new(festival_id, options, chosen):
    """Store fresh AI options, replacing an unused plan for the same occasion."""
    with Session() as s:
        old = s.scalars(
            select(PostPlan).where(
                PostPlan.client_id == current_id(),
                PostPlan.festival_id == festival_id,
                PostPlan.status != "used",
            )
        ).all()
        for p in old:
            s.delete(p)
        p = PostPlan(
            id=uuid.uuid4().hex[:10],
            client_id=current_id(),
            festival_id=festival_id,
            status="options",
            options=options,
            chosen=chosen,
            created_at=now_text(),
            updated_at=now_text(),
        )
        s.add(p)
        s.commit()
        return _out(p)


def update(plan_id, **fields):
    with Session() as s:
        p = s.get(PostPlan, plan_id)
        if not p or p.client_id != current_id():
            raise KeyError("Plan not found")
        for k, v in fields.items():
            setattr(p, k, v)
        p.updated_at = now_text()
        s.commit()
        return _out(p)
