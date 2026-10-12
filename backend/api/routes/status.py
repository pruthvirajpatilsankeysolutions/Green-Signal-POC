import os

from fastapi import APIRouter

from api.routes.festivals import festival_out
from storage import clients, drafts
from storage import festivals as festival_store

router = APIRouter(prefix="/api", tags=["status"])


@router.get("/status")
def status():
    rows, errors = festival_store.load()
    client = clients.current()

    return {
        "client": {
            "id": client["id"],
            "name": client["name"],
            "handle": client["handle"],
            "type": client["type"],
            "designation": client["designation_lines"],
        },
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
        "due": [festival_out(f) for f in festival_store.due_now(rows)],
        "calendar_errors": errors,
    }
