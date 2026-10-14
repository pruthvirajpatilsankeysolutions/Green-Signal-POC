import contextvars
import re
import uuid
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.exc import OperationalError

from config import ASSETS_DIR, ROOT
from storage.db import Asset, Client, Session, StyleExample, init_db
from storage.categories import ALIASES, CATEGORIES, access, clean_post_types

CLIENT_TYPES = list(CATEGORIES) + list(ALIASES)
STYLE_KINDS = ["tribute", "solemn", "greeting", "congratulate", "condolence", "event"]
ASSET_KINDS = ["banner", "logo", "leader"]
IMAGE_TYPES = [".png", ".jpg", ".jpeg", ".webp"]
MAX_EXAMPLES = 8

_current = contextvars.ContextVar("current_client_id", default=None)
_ready = False


def ensure_ready():
    """Create tables and, on an empty database, add the client from config.py."""
    global _ready
    if _ready:
        return
    try:
        init_db()
    except OperationalError as e:
        raise RuntimeError(
            "Can't connect to PostgreSQL. Check that it is running and that DB_HOST, DB_PORT, "
            f"DB_NAME, DB_USER and DB_PASSWORD in .env are correct. ({str(e.orig).splitlines()[0]})"
        ) from None
    with Session() as s:
        has_client = s.scalars(select(Client.id).limit(1)).first()
    if not has_client:
        _migrate_from_config()
    _ready = True


def make_id(text):
    code = re.sub(r"[^a-z0-9]+", "-", str(text).lower()).strip("-")
    return code[:50] or f"client-{uuid.uuid4().hex[:6]}"


def _migrate_from_config():
    try:
        from config import CLIENT as OLD
    except ImportError:
        return
    from config import SHOW_AI_LABEL as OLD_LABEL

    cid = make_id(OLD.get("handle") or OLD.get("name"))
    with Session() as s:
        s.add(
            Client(
                id=cid,
                name=OLD["name"],
                client_type="politician",
                handle=OLD.get("handle", ""),
                designation_lines=OLD.get("designation_lines", []),
                accent_color=OLD.get("accent_color", "#F26B0F"),
                fixed_hashtags=OLD.get("fixed_hashtags", []),
                show_ai_label=bool(OLD_LABEL),
            )
        )
        s.commit()

    def copy_in(src, kind):
        p = ROOT / src if src and not Path(src).is_absolute() else Path(src or "")
        if src and p.is_file():
            add_asset(cid, kind, p.name, p.read_bytes())

    copy_in(OLD.get("footer_image"), "banner")
    copy_in(OLD.get("logo"), "logo")
    leader_dir = ROOT / OLD.get("leader_photos_dir", "assets/leader")
    if leader_dir.is_dir():
        for p in sorted(leader_dir.iterdir()):
            if p.suffix.lower() in IMAGE_TYPES:
                copy_in(str(p), "leader")

    examples = OLD.get("style_examples", {})
    if isinstance(examples, dict):
        for kind, texts in examples.items():
            for text in texts:
                add_style(cid, kind if kind in STYLE_KINDS else "event", text)


def set_current(client_id):
    _current.set(client_id or None)


def current_id():
    ensure_ready()
    cid = _current.get()
    with Session() as s:
        if cid and s.get(Client, cid):
            return cid
        first = s.scalars(select(Client.id).order_by(Client.created_at)).first()
    if not first:
        raise RuntimeError(
            "No clients found in the database. Please add a client first."
        )
    return first


def current():
    return profile(current_id())


def list_clients():
    ensure_ready()
    with Session() as s:
        rows = s.scalars(select(Client).order_by(Client.created_at)).all()

    return [
        {"id": c.id, "name": c.name, "type": c.client_type, "handle": c.handle}
        for c in rows
    ]


def profile(client_id):
    """Everything the poster and caption code need about one client."""
    ensure_ready()
    with Session() as s:
        c = s.get(Client, client_id)
        if not c:
            raise KeyError(f"Client '{client_id}' not found")
        assets = s.scalars(
            select(Asset).where(Asset.client_id == client_id).order_by(Asset.id)
        ).all()
        styles = s.scalars(
            select(StyleExample)
            .where(StyleExample.client_id == client_id)
            .order_by(StyleExample.id)
        ).all()

    def full(path):
        return str(ROOT / path)

    banner = next((a for a in reversed(assets) if a.kind == "banner"), None)
    logo = next((a for a in reversed(assets) if a.kind == "logo"), None)

    grouped = {}
    for kind in STYLE_KINDS:
        manual = [e.text for e in styles if e.kind == kind and e.source == "manual"]
        approved = [
            e.text
            for e in reversed(styles)
            if e.kind == kind and e.source == "approved"
        ]
        grouped[kind] = (manual + approved)[
            :MAX_EXAMPLES
        ]  # his own picks first, then newest approved

    return {
        "id": c.id,
        "name": c.name,
        "type": c.client_type,
        "handle": c.handle,
        "designation_lines": c.designation_lines or [],
        "accent_color": c.accent_color,
        "fixed_hashtags": c.fixed_hashtags or [],
        "show_ai_label": c.show_ai_label,
        "phone": c.phone or "",
        "address": c.address or "",
        **access({"type": c.client_type, "post_types": c.post_types}),
        "footer_image": full(banner.path) if banner else "",
        "logo": full(logo.path) if logo else "",
        "leader_photos": [full(a.path) for a in assets if a.kind == "leader"],
        "style_examples": grouped,
        "assets": [
            {
                "id": a.id,
                "kind": a.kind,
                "path": full(a.path),
                "original_name": a.original_name,
            }
            for a in assets
        ],
        "styles": [
            {
                "id": e.id,
                "kind": e.kind,
                "text": e.text,
                "source": e.source,
                "created_at": e.created_at,
            }
            for e in styles
        ],
    }


# ---------------------------------------------------------------- write
def create_client(name, client_type="politician", handle="", client_id="", post_types=None):
    ensure_ready()
    if client_type not in CLIENT_TYPES:
        raise ValueError(f"Type must be one of: {', '.join(CLIENT_TYPES)}")
    if post_types is not None and not clean_post_types(post_types):
        raise ValueError("Pick at least one post type for this client.")
    cid = make_id(client_id or handle or name)
    with Session() as s:
        if s.get(Client, cid):
            cid = f"{cid}-{uuid.uuid4().hex[:4]}"
        s.add(
            Client(
                id=cid,
                name=name.strip(),
                client_type=client_type,
                handle=handle.strip(),
                post_types=clean_post_types(post_types),
            )
        )
        s.commit()
    return profile(cid)

EDITABLE = {
    "name": "name",
    "type": "client_type",
    "handle": "handle",
    "designation_lines": "designation_lines",
    "accent_color": "accent_color",
    "fixed_hashtags": "fixed_hashtags",
    "show_ai_label": "show_ai_label",
    "phone": "phone",
    "address": "address",
    "post_types": "post_types",
}


def update_client(client_id, **fields):
    with Session() as s:
        c = s.get(Client, client_id)
        if not c:
            raise KeyError(f"Client '{client_id}' not found")
        for key, column in EDITABLE.items():
            if key in fields and fields[key] is not None:
                if key == "type" and fields[key] not in CLIENT_TYPES:
                    raise ValueError(f"Type must be one of: {', '.join(CLIENT_TYPES)}")
                value = fields[key]
                if key == "post_types":
                    value = clean_post_types(value)
                    if not value:
                        raise ValueError("Pick at least one post type for this client.")
                setattr(c, column, value)
        s.commit()
    return profile(client_id)


def add_asset(client_id, kind, filename, data):
    """Save an uploaded file under assets/clients/<client>/<kind>/ and record it."""
    if kind not in ASSET_KINDS:
        raise ValueError(f"Kind must be one of: {', '.join(ASSET_KINDS)}")
    ext = Path(filename).suffix.lower()
    if ext not in IMAGE_TYPES:
        raise ValueError("Only PNG, JPG or WEBP images are allowed.")
    folder = ASSETS_DIR / "clients" / client_id / kind
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"{uuid.uuid4().hex[:10]}{ext}"
    path.write_bytes(data)
    with Session() as s:
        if kind in ("banner", "logo"):  # only one banner / logo: replace the old one
            for old in s.scalars(
                select(Asset).where(Asset.client_id == client_id, Asset.kind == kind)
            ):
                _remove_file(old.path)
                s.delete(old)
        s.add(
            Asset(
                client_id=client_id,
                kind=kind,
                path=path.relative_to(ROOT).as_posix(),
                original_name=filename,
            )
        )
        s.commit()
    return profile(client_id)


def delete_asset(client_id, asset_id):
    with Session() as s:
        a = s.get(Asset, asset_id)
        if not a or a.client_id != client_id:
            raise KeyError("Asset not found")
        _remove_file(a.path)
        s.delete(a)
        s.commit()
    return profile(client_id)


def _remove_file(rel_path):
    p = ROOT / rel_path
    if p.is_file() and (ASSETS_DIR / "clients") in p.parents:
        p.unlink()


def add_style(client_id, kind, text, source="manual"):
    if kind not in STYLE_KINDS:
        raise ValueError(f"Kind must be one of: {', '.join(STYLE_KINDS)}")
    text = text.strip()
    if not text:
        raise ValueError("The caption is empty.")
    with Session() as s:
        exists = s.scalars(
            select(StyleExample.id).where(
                StyleExample.client_id == client_id,
                StyleExample.kind == kind,
                StyleExample.text == text,
            )
        ).first()
        if not exists:
            s.add(
                StyleExample(client_id=client_id, kind=kind, text=text, source=source)
            )
            s.commit()


def delete_style(client_id, style_id):
    with Session() as s:
        e = s.get(StyleExample, style_id)
        if not e or e.client_id != client_id:
            raise KeyError("Example not found")
        s.delete(e)
        s.commit()
    return profile(client_id)
