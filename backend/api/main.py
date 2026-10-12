"""
REST API for the React UI. Each category of endpoints lives in its own file
in api/routes/; this file only creates the app and plugs them in.

Run from the backend folder:
    uvicorn api.main:app --reload --port 8000
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from api.middleware import ClientMiddleware
from api.routes import clients as clients_routes
from api.routes import drafts as drafts_routes
from api.routes import events as events_routes
from api.routes import festivals as festivals_routes
from api.routes import reactions as reactions_routes
from api.routes import status as status_routes
from config import ASSETS_DIR, OUTPUT_DIR, ROOT
from storage import clients

app = FastAPI(title="Social post assistant API")

app.add_middleware(ClientMiddleware)
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173"],
                   allow_methods=["*"], allow_headers=["*"])

clients.ensure_ready()          # create tables / first client on first start

# ---------------------------------------------------------------- API routes, one file per category
app.include_router(status_routes.router)
app.include_router(clients_routes.router)
app.include_router(festivals_routes.router)
app.include_router(events_routes.router)
app.include_router(reactions_routes.router)
app.include_router(drafts_routes.router)

# ---------------------------------------------------------------- files (posters, uploads, assets)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/files/output", StaticFiles(directory=OUTPUT_DIR), name="output")
app.mount("/files/assets", StaticFiles(directory=ASSETS_DIR), name="assets")

# ---------------------------------------------------------------- React app (after `npm run build`)
DIST = ROOT.parent / "frontend" / "dist"
if DIST.exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="web-assets")

    @app.get("/{full_path:path}")
    def spa(full_path: str):
        file = DIST / full_path
        return FileResponse(file if full_path and file.is_file() else DIST / "index.html")