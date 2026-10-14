from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from api.helpers import to_url
from api.routes.festivals import festival_out, for_category
from posts.festival import planner
from storage import drafts, plans
from storage import festivals as festival_store

router = APIRouter(prefix="/api/plans", tags=["month plan"])


def _month_occasions(month):
    if len(month) != 7 or month[4] != "-":
        raise HTTPException(400, "Month must look like 2026-11.")
    rows, _ = festival_store.load()
    return sorted(
        [f for f in for_category(rows) if f["date"].startswith(month)],
        key=lambda f: f["date"],
    )


def _row_status(plan):
    """todo / options / words_approved / poster_made / approved / rejected"""
    if not plan:
        return "todo", None
    if plan["status"] != "used":
        return ("words_approved" if plan["status"] == "approved" else "options"), None
    draft = drafts.get(plan["draft_id"]) if plan["draft_id"] else None
    if not draft:
        return "poster_made", None
    state = {"approved": "approved", "rejected": "rejected"}.get(
        draft["status"], "poster_made"
    )
    return state, (to_url(draft["images"][0]) if draft["images"] else "")


@router.get("/month")
def month_plan(month: str):
    occasions = _month_occasions(month)
    by_id = plans.latest_many([f["id"] for f in occasions])
    rows = []
    for f in occasions:
        plan = by_id.get(f["id"])
        status, thumb = _row_status(plan)
        rows.append(
            {
                "festival": festival_out(f),
                "plan": plan,
                "status": status,
                "thumb": thumb or "",
            }
        )
    return {"month": month, "rows": rows, "limits": planner.LIMITS}


class MonthIn(BaseModel):
    month: str
    only_missing: bool = (
        True  # skip occasions already planned (never overwrite team edits)
    )


@router.post("/month/generate")
def generate_month(body: MonthIn):
    occasions = _month_occasions(body.month)
    by_id = plans.latest_many([f["id"] for f in occasions])
    todo = [f for f in occasions if not (body.only_missing and by_id.get(f["id"]))]
    if not todo:
        return {
            "planned": 0,
            "errors": {},
            "message": "Every occasion in this month is already planned.",
        }
    notes = {fid: (p.get("chosen") or {}).get("notes", "") for fid, p in by_id.items()}
    results, errors = planner.plan_month(todo, notes)
    for fid, (options, chosen) in results.items():
        plans.save_new(fid, options, chosen)
    return {"planned": len(results), "errors": errors}


@router.post("/month/approve")
def approve_month(body: MonthIn):
    occasions = _month_occasions(body.month)
    count = 0
    for f in occasions:
        plan = plans.active(f["id"])
        if (
            plan
            and plan["status"] == "options"
            and plan["chosen"].get("hook")
            and plan["chosen"].get("poster", {}).get("line_big")
        ):
            plans.update(plan["id"], status="approved")
            count += 1
    return {"approved": count}
