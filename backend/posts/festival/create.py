"""
Festival post flow:
  1. background picture  (ready one from assets/backgrounds, or 4 new AI options)
  2. caption             (AI)
  3. poster              (template -> PNG, square feed + story size)
  4. save draft          (waits for approval)

Design rules (from the client's real posts):
  greeting, layout Right/Left       -> festival.html, picture with text on one side
  greeting, layout Centre           -> festival_center.html, light design, all text centred
  tribute  (jayanti)                -> tribute.html,  banner + leader photo
  solemn   (punyatithi)             -> tribute.html,  banner, NO leader photo
"""
from pathlib import Path

from ai.claude import ask_json
from ai.image_gen import generate_backgrounds
from config import ASSETS_DIR
from design.poster import IMAGE_TYPES, ai_label, file_uri, footer_data, pick_leader_photo, render
from posts import final_hashtags, marathi_digits
from posts.festival.prompts import caption_prompt, scene_prompt
from storage import drafts

TRIBUTE_TONES = ("tribute", "solemn")


def ready_backgrounds(festival):
    """Pictures already saved for this festival, e.g. assets/backgrounds/diwali-2026.png"""
    folder = ASSETS_DIR / "backgrounds"
    return sorted(str(p) for p in folder.glob(f"{festival['id']}*")
                  if p.suffix.lower() in IMAGE_TYPES)


def generate_background_options(festival, layout="text_right", count=4):
    """Ask the AI for a scene, then the image model for pictures. Returns list of paths."""
    if festival["tone"] in TRIBUTE_TONES:
        layout = "text_left"          # portrait on the right, text on the left
    scene = ask_json(*scene_prompt(festival, layout))["scene"]
    empty_side = {"text_left": "left", "text_center": "center"}.get(layout, "right")
    paths, _prompt = generate_backgrounds(scene, empty_side=empty_side, count=count)
    return paths


def write_caption(festival):
    result = ask_json(*caption_prompt(festival))
    return marathi_digits(result["caption"].strip()), final_hashtags(result.get("hashtags"))


def make_post(festival, background_path, ai_generated, layout="text_right"):
    caption, hashtags = write_caption(festival)
    tone = festival["tone"]

    if tone in TRIBUTE_TONES:
        template, layout = "tribute.html", "text_left"
    elif layout == "text_center":
        template = "festival_center.html"
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
    images, warnings = render(template, data, name=festival["id"], sizes=("feed", "story"))

    return drafts.create(
        post_type="festival",
        title=f"{festival['occasion_mr']} ({festival['date']})",
        caption=caption,
        hashtags=hashtags,
        images=images,
        details={"festival_id": festival["id"], "tone": tone,
                 "background": str(Path(background_path)),
                 "ai_background": ai_generated, "layout": layout},
        warnings=warnings,
    )