"""
Client frame for template posts (politicians' posts): the client's banner (logo + name + designations) along
the bottom and, optionally, the leader's photo rising above it on the right, like the standard posters.
The engine scales the template's design into the space above the banner, adds the frame as normal layers,
and moves or shrinks any text the photo would cover.
"""

from design.poster import pick_leader_photo, prepare_footer_image, prepare_leader_photo
from storage.clients import current

FRAMES = ("photo_banner", "banner", "none")


def available():
    """Which frames this client can use (needs a banner; the photo needs a leader photo too)."""
    c = current()
    has_banner = bool(c.get("footer_image"))
    has_photo = bool(c.get("leader_photos"))
    return {"banner": has_banner, "photo_banner": has_banner and has_photo}


def assets(kind, turn=0):
    """Files and colours for the engine, or None for no frame."""
    if kind not in ("photo_banner", "banner") or not available().get(kind):
        return None
    c = current()
    banner = prepare_footer_image()
    leader, ratio = (
        prepare_leader_photo(pick_leader_photo(turn))
        if kind == "photo_banner"
        else ("", 1)
    )
    return {
        "kind": kind,
        "accent": c.get("accent_color") or "#F26B0F",
        "bg": banner.get("bg", "#ffffff"),
        "full": banner.get("full", ""),
        "logo": banner.get("logo", ""),
        "text": banner.get("text", ""),
        "leader": leader,
        "leader_ratio": ratio,
    }
