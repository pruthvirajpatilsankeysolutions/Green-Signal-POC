from pathlib import Path

from ai.claude import ask_json
from ai.image_gen import generate_backgrounds
from config import ASSETS_DIR
from design.poster import (
    IMAGE_TYPES,
    ai_label,
    file_uri,
    footer_data,
    pick_leader_photo,
    render,
)

from posts import final_hashtags, marathi_digits
from posts.festival.prompts import caption_prompt, scene_prompt
from storage import drafts
from storage.clients import current

TRIBUTE_TONES = ("tribute", "solemn")


def ready_backgrounds(festival):
    """Pictures already saved for this festival, e.g. assets/backgrounds/diwali-2026.png"""
    folder = ASSETS_DIR / "backgrounds"
    return sorted(
        str(p)
        for p in folder.glob(f"{festival['id']}*")
        if p.suffix.lower() in IMAGE_TYPES
    )


def generate_background_options(festival, layout="text_right", count=4):
    """Ask the AI for a scene, then the image model for pictures. Returns list of paths."""
    if festival["tone"] in TRIBUTE_TONES:
        layout = "text_left"  # portrait on the right, text on the left
    scene = ask_json(*scene_prompt(festival, layout))["scene"]
    empty_side = {
        "text_left": "left",
        "text_center": "center",
        "text_corners": "corners",
    }.get(layout, "right")
    paths, _prompt = generate_backgrounds(scene, empty_side=empty_side, count=count)
    return paths


def write_caption(festival):
    """Caption + hashtags; when the calendar has no poster text in the client's language,
    also the poster lines (returned as a dict, else {})."""
    result = ask_json(*caption_prompt(festival))
    poster = result.get("poster") if festival.get("needs_text") else None
    poster = (
        {
            k: marathi_digits(str((poster or {}).get(k, "")).strip())
            for k in ("line_small", "line_big", "line_end")
        }
        if poster
        else {}
    )
    return (
        marathi_digits(result["caption"].strip()),
        final_hashtags(result.get("hashtags")),
        poster,
    )


def make_post(festival, background_path, ai_generated, layout="text_right", plan=None, template_id=""):
    """plan: a post plan with chosen words. Without it, the calendar's standard
    poster text is used and the AI writes the caption."""
    if plan and plan.get("chosen"):
        from posts.festival.planner import final_text, write_body

        chosen = dict(plan["chosen"])
        if not chosen.get(
            "caption", ""
        ).strip():  # month plan: only hook + title were planned
            body, tags = write_body(festival, chosen)
            chosen["caption"] = body
            chosen["hashtags"] = chosen.get("hashtags") or tags
        caption, hashtags, poster = final_text(chosen)
        festival = {
            **festival,
            **{
                k: poster.get(k) or festival[k]
                for k in ("line_small", "line_big", "line_end")
            },
        }
    else:
        caption, hashtags, poster = write_caption(festival)
        festival = {**festival, **{k: v for k, v in poster.items() if v}}
    if festival.get("needs_text") and not (
        festival["line_small"] and festival["line_big"] and festival["line_end"]
    ):
        # planned words without a full poster text (e.g. month plan: title only): fill the missing lines
        _, _, poster = write_caption(festival)
        festival = {
            **festival,
            **{k: v for k, v in poster.items() if v and not festival[k]},
        }
    tone = festival["tone"]

    if template_id:                                        # the user picked a saved template
        from posts import template_post
        return template_post.make_post(
            template_id, {k: festival[k] for k in ("line_small", "line_big", "line_end")},
            title=f"{festival['occasion_mr']} ({festival['date']})", caption=caption, hashtags=hashtags,
            details={"festival_id": festival["id"], "tone": tone, "plan_id": plan["id"] if plan else ""},
            post_type="festival", photo=str(background_path) if background_path else "")

    if tone in TRIBUTE_TONES:
        template, layout = "tribute.html", "text_left"

    elif current()["type"] != "politician":
        template = "business.html"

    elif layout == "text_center":
        template = "festival_center.html"

    elif layout == "text_corners":
        template = "festival_corners.html"
    else:
        template = "festival.html"

    # punyatithi / solemn days: no leader photo (same as the client's posts)
    leader = "" if tone == "solemn" else pick_leader_photo(turn=len(drafts.load_all()))

    data = {
        **footer_data(leader),
        "bg_uri": file_uri(background_path),
        "tone": tone,
        "layout": layout,
        "line_small": festival["line_small"],
        "line_big": festival["line_big"],
        "line_end": festival["line_end"],
        "label": ai_label(ai_generated),
    }
    images, warnings = render(
        template, data, name=festival["id"], sizes=("feed", "story")
    )

    return drafts.create(
        post_type="festival",
        title=f"{festival['occasion_mr']} ({festival['date']})",
        caption=caption,
        hashtags=hashtags,
        images=images,
        details={
            "festival_id": festival["id"],
            "tone": tone,
            "background": str(Path(background_path)),
            "ai_background": ai_generated,
            "layout": layout,
            "plan_id": plan["id"] if plan else "",
        },
        warnings=warnings,
    )