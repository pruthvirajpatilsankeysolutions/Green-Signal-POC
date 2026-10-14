from typing import List, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from pydantic import BaseModel

from api.helpers import run, to_url
from storage import clients
from storage.categories import ALIASES, post_type_list, public_list

router = APIRouter(prefix="/api/clients", tags=["clients"])


def client_out(profile):
    out = {
        k: v
        for k, v in profile.items()
        if k not in ("footer_image", "logo", "leader_photos")
    }
    out["assets"] = [{**a, "url": to_url(a["path"])} for a in profile["assets"]]
    out["type"] = ALIASES.get(out["type"], out["type"])
    out["types"] = [c["id"] for c in public_list()]
    out["categories"] = public_list()
    out["all_post_types"] = post_type_list()
    out["style_kinds"] = clients.STYLE_KINDS
    return out


def _client(client_id):
    try:
        return clients.profile(client_id)
    except KeyError:
        raise HTTPException(404, f"Client {client_id} not found")


@router.get("")
def list_clients():
    return {
        "clients": clients.list_clients(),
        "types": [c["id"] for c in public_list()],
        "categories": public_list(),
        "post_types": post_type_list(),
    }


class ClientIn(BaseModel):
    name: str
    type: str = "politician"
    handle: str = ""
    post_types: Optional[List[str]] = None


@router.post("")
def create_client(body: ClientIn):
    if not body.name.strip():
        raise HTTPException(400, "Name is required")
    return client_out(
        run(
            clients.create_client,
            body.name.strip(),
            body.type,
            body.handle.strip(),
            "",
            body.post_types,
        )
    )


@router.get("/{client_id}")
def get_client(client_id: str):
    return client_out(_client(client_id))


class ClientUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    handle: Optional[str] = None
    designation_lines: Optional[List[str]] = None
    accent_color: Optional[str] = None
    fixed_hashtags: Optional[List[str]] = None
    show_ai_label: Optional[bool] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    post_types: Optional[List[str]] = None


@router.put("/{client_id}")
def update_client(client_id: str, body: ClientUpdate):
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
