import os

from fastapi import APIRouter

from api.routes.festivals import festival_out, for_category
from storage import clients, drafts
from storage import festivals as festival_store
from storage.categories import ALIASES, category, post_type_list, public_list

router = APIRouter(prefix="/api", tags=["status"])


@router.get("/status")
def status():
    rows, errors = festival_store.load()
    client = clients.current()
    cat = category(client["type"])
    return {
        "client": {
            "id": client["id"],
            "name": client["name"],
            "handle": client["handle"],
            "type": ALIASES.get(client["type"], client["type"]),
            "designation": client["designation_lines"],
            "category": cat["label"],
            "features": client["pages"],
            "post_types": client["post_types"],
            "language": client["language"],
            "region": client["region"],
        },
        "categories": public_list(),
        "post_types": post_type_list(),
        "clients": clients.list_clients(),
        "text_ai": any(
            os.getenv(k)
            for k in ("GEMINI_API_KEY", "GOOGLE_API_KEY", "ANTHROPIC_API_KEY")
        ),
        "image_ai": bool(os.getenv("OPENAI_API_KEY")),
        "counts": {
            "waiting": len(drafts.by_status("waiting")),
            "approved": len(drafts.by_status("approved")),
        },
        "due": [festival_out(f) for f in for_category(festival_store.due_now(rows))],
        "calendar_errors": errors,
    }