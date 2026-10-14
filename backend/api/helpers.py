"""
Small helpers shared by all API routes.
"""

import uuid
from pathlib import Path
from urllib.parse import quote

from fastapi import HTTPException, UploadFile

from config import ASSETS_DIR, OUTPUT_DIR, ROOT
from design.poster import IMAGE_TYPES


def to_url(path):
    """Server file path -> URL the browser can load ('' if outside output/assets)."""
    p = Path(path).resolve()
    for base, prefix in (
        (OUTPUT_DIR.resolve(), "/files/output"),
        (ASSETS_DIR.resolve(), "/files/assets"),
    ):
        try:
            return f"{prefix}/{quote(p.relative_to(base).as_posix())}"
        except ValueError:
            continue
    return ""


def draft_out(draft):
    """A draft plus browser URLs for its images."""
    out = dict(draft)
    out["image_urls"] = [to_url(p) for p in draft.get("images", [])]
    return out


def safe_path(path):
    """Only allow files inside the project folder."""
    p = Path(path).resolve()
    if ROOT.resolve() not in p.parents or not p.exists():
        raise HTTPException(400, "File not found in the project folder.")
    return str(p)


def save_upload(upload: UploadFile, folder: Path, name: str = ""):
    """Save an uploaded image into folder; only JPG, PNG or WEBP."""
    folder.mkdir(parents=True, exist_ok=True)
    ext = Path(upload.filename or "").suffix.lower() or ".jpg"
    if ext not in IMAGE_TYPES:
        raise HTTPException(
            400, f"{upload.filename}: only JPG, PNG or WEBP images are allowed."
        )
    path = folder / f"{name or uuid.uuid4().hex[:8]}{ext}"
    path.write_bytes(upload.file.read())
    return str(path)


def run(fn, *args, **kwargs):
    """Call the post logic and turn any error into a readable API error."""
    try:
        return fn(*args, **kwargs)
    except HTTPException:
        raise

    except ValueError as e:  # wrong input (e.g. unknown category): the user can fix it
        raise HTTPException(400, str(e)) from e

    except Exception as e:  # noqa: BLE001 - show the real reason in the UI
        raise HTTPException(500, str(e)) from e
