"""
Event post flow:
  1. save uploaded photos
  2. caption (AI)
  3. images:
       EVENT_STYLE = "photo"  -> the real photos only, no banner, no text (default)
       EVENT_STYLE = "banner" -> banner on every photo, title on the first one
  4. save draft
"""
import uuid

from ai.claude import ask_json
from config import EVENT_STYLE, OUTPUT_DIR
from design.photos import prepare_for_instagram
from design.poster import file_uri, footer_data, render
from posts import final_hashtags, marathi_digits
from posts.event.prompts import caption_prompt
from storage import drafts

MAX_PHOTOS = 10


def save_uploads(uploaded_files):
    """Streamlit uploads -> files in output/uploads/<id>/"""
    folder = OUTPUT_DIR / "uploads" / uuid.uuid4().hex[:8]
    folder.mkdir(parents=True, exist_ok=True)
    paths = []
    for i, f in enumerate(uploaded_files[:MAX_PHOTOS], start=1):
        ext = f.name.rsplit(".", 1)[-1].lower() if "." in f.name else "jpg"
        path = folder / f"{i:02d}.{ext}"
        path.write_bytes(f.getvalue())
        paths.append(str(path))
    return paths


def _banner_images(event, title, photo_paths):
    """Old style: banner on every photo, event title on the first one."""
    images, warnings = [], []
    total = len(photo_paths)
    for number, photo in enumerate(photo_paths, start=1):
        data = {
            **footer_data(""),
            "photo_uri": file_uri(photo),
            "is_cover": number == 1,
            "title": title,
            "place": event["place"],
            "date_text": event["date"],
            "number": number,
            "total": total,
            "label": "",
        }
        paths, warns = render("event.html", data, name=f"event_{number:02d}")
        images += paths
        warnings += warns
    return images, warnings


def make_post(event, photo_paths):
    result = ask_json(*caption_prompt(event))
    caption = marathi_digits(result["caption"].strip())
    hashtags = final_hashtags(result.get("hashtags"))
    title = (result.get("poster_title") or event["name"]).strip()

    if EVENT_STYLE == "banner":
        images, warnings = _banner_images(event, title, photo_paths)
    else:
        # client's style for real photos: no banner, no text on the photos
        images, warnings = [prepare_for_instagram(p) for p in photo_paths], []

    confirm = [c for c in result.get("confirm", []) if c]
    warnings += [f"Please confirm: {c}" for c in confirm]

    return drafts.create(
        post_type="event",
        title=f"{event['name']} ({event['place']})",
        caption=caption,
        hashtags=hashtags,
        images=images,
        details={"event": event, "photos": photo_paths, "style": EVENT_STYLE},
        warnings=warnings,
    )