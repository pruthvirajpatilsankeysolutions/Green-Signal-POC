from typing import List, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from pydantic import BaseModel

from api.helpers import run, to_url
from storage import clients

router = APIRouter(prefix="/api/clients", tags=["clients"])


def client_out(profile):
    out = {
        k: v
        for k, v in profile.items()
        if k not in ("footer_image", "logo", "leader_photos")
    }
    out["assets"] = [{**a, "url": to_url(a["path"])} for a in profile["assets"]]
    out["types"] = clients.CLIENT_TYPES
    out["style_kinds"] = clients.STYLE_KINDS
    return out


def _client(client_id):
    try:
        return clients.profile(client_id)
    except KeyError:
        raise HTTPException(404, f"Client {client_id} not found")


@router.get("")
def list_clients():
    return {"clients": clients.list_clients(), "types": clients.CLIENT_TYPES}


class ClientIn(BaseModel):
    name: str
    type: str = "politician"
    handle: str = ""


@router.post("")
def create_client(body: ClientIn):
    if not body.name.strip():
        raise HTTPException(400, "Name is required")
    return client_out(
        run(clients.create_client, body.name.strip(), body.type, body.handle.strip())
    )


@router.get("/{client_id}")
def get_client(client_id: str):
    return client_out(_client(client_id))


class ClientUpdate(BaseModel):
    name: Optional[str]
    type: Optional[str]
    handle: Optional[str]
    designation_lines: Optional[List[str]]
    accent_color: Optional[str]
    fixed_hashtag: Optional[List[str]]
    show_ai_label: Optional[bool]


@router.put("/{client_id}")
def update_client(client_id: str, body: ClienUpdate):
    _client(client_id)  # ensure exists
    return client_out(run(clients.update_client, client_id, **body.model_dump()))


@router.post("/{client_id}/assets")
def upload_asset(
    client_id: str, kind: str = Form(...), files: List[UploadFile] = File(...)
):
    _client(client_id)
    profile = None
    for f in files:
        profile = run(
            clients.add_asset,
            client_id,
            kind,
            f.filename or "upload.png",
            f.file.read(),
        )
    return client_out(profile)


@router.delete("/{client_id}/assets/{asset_id}")
def delete_asset(client_id: str, asset_id: int):
    return client_out(run(clients.delete_asset, client_id, asset_id))


class StyleIn(BaseModel):
    kind: str
    text: str


@router.post("/{client_id}/styles")
def add_style(client_id: str, body: StyleIn):
    _client(client_id)
    run(clients.add_style, client_id, body.kind, body.text)
    return client_out(clients.profile(client_id))


@router.delete("/{client_id}/styles/{style_id}")
def delete_style(client_id: str, style_id: int):
    return client_out(run(clients.delete_style, client_id, style_id))
