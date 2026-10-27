"""
REST API for the React UI. Each category of endpoints lives in its own file
in api/routes/; this file only creates the app and plugs them in.

Run from the backend folder:
    uvicorn api.main:app --reload --port 8000
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from api.middleware import ClientMiddleware
from api.routes import clients as clients_routes
from api.routes import designs as designs_routes
from api.routes import templates as templates_routes
from api.routes import drafts as drafts_routes
from api.routes import events as events_routes
from api.routes import festivals as festivals_routes
from api.routes import custom_posts as custom_routes
from api.routes import month_plan as month_plan_routes
from api.routes import plans as plans_routes
from api.routes import reactions as reactions_routes
from api.routes import status as status_routes
from api.routes import studio as studio_routes
from config import ASSETS_DIR, OUTPUT_DIR, ROOT
from storage import clients

app = FastAPI(title="Social post assistant API")

app.add_middleware(ClientMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

clients.ensure_ready()  # create tables / first client on first start

# ---------------------------------------------------------------- API routes, one file per category
app.include_router(status_routes.router)
app.include_router(clients_routes.router)
app.include_router(festivals_routes.router)
app.include_router(plans_routes.router)
app.include_router(month_plan_routes.router)
app.include_router(custom_routes.router)
app.include_router(events_routes.router)
app.include_router(reactions_routes.router)
app.include_router(drafts_routes.router)
app.include_router(templates_routes.router)
app.include_router(designs_routes.router)
app.include_router(studio_routes.public)
app.include_router(studio_routes.router)


@app.on_event("startup")
def start_story_studio():
    """Housekeeping for Story Studio at start-up."""
    from story import jobs as story_jobs, migrate as story_migrate
    story_migrate.copy_legacy()               # stories made before Story Studio became its own tool are copied across, once
    story_jobs.recover()                      # a Story Studio step that was running when the server stopped is marked failed

# ---------------------------------------------------------------- unknown API routes: a clear 404
# (without this, the React catch-all below answers a POST to a missing API route with a confusing 405)
@app.api_route("/api/{rest:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"], include_in_schema=False)
def api_not_found(rest: str):
    raise HTTPException(404, f"API route /api/{rest} not found. If the code was just updated, restart the backend.")


# ---------------------------------------------------------------- files (posters, uploads, assets)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/files/output", StaticFiles(directory=OUTPUT_DIR), name="output")
app.mount("/files/assets", StaticFiles(directory=ASSETS_DIR), name="assets")

# ---------------------------------------------------------------- React app (after `npm run build`)
DIST = ROOT.parent / "frontend" / "dist"
if DIST.exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="web-assets")

    @app.get("/studio")
    @app.get("/studio/{full_path:path}")
    def studio_spa(full_path: str = ""):
        """Story Studio is its own page (studio.html), not part of the client app."""
        file = DIST / "studio.html"
        return FileResponse(file) if file.exists() else FileResponse(DIST / "index.html")

    @app.get("/{full_path:path}")
    def spa(full_path: str):
        file = DIST / full_path
        return FileResponse(
            file if full_path and file.is_file() else DIST / "index.html"
        )