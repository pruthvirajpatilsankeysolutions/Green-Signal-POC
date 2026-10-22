"""Make a post from a saved template: the client's details + the post's words + optional photo."""

from design import template_fill
from posts import marathi_digits
from storage import drafts, templates
from storage.clients import current


def client_slots():
    c = current()
    handle = (c.get("handle") or "").strip()
    if handle and not handle.startswith("@") and "." not in handle:
        handle = "@" + handle
    return {
        "client_name": c.get("name", ""),
        "phone": marathi_digits(c.get("phone") or ""),
        "contact": "  |  ".join(
            x for x in (handle, (c.get("address") or "").strip()) if x
        ),
        "address": c.get("address") or "",
    }


def make_post(
    template_id, words, title, caption, hashtags, details, post_type, photo=""
):
    """words: {line_small, line_big, line_end} (| = new line). Returns the draft (it opens in the editor)."""
    t = templates.get(template_id)
    if not t or not t.get("ready"):
        raise ValueError(
            "That template isn't saved yet. Open it on the Templates page and save it first."
        )
    slots = {
        **client_slots(),
        **{k: str(v).replace("|", "\n") for k, v in words.items() if v is not None},
    }
    logo = current().get("logo") or ""
    png, design, warnings = template_fill.fill(
        t["design"], slots, {"logo": logo, "photo": photo}, name=template_id
    )
    draft = drafts.create(
        post_type=post_type,
        title=title,
        caption=caption,
        hashtags=hashtags,
        images=[png],
        details={**details, "template_id": template_id},
        warnings=warnings,
    )
    return drafts.update(
        draft["id"], "made from a template", design={"feed": design}
    )  # Edit design opens these layers
