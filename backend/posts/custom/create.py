"""
Create-post flow for the new post types (announcement, offer, achievement, person spotlight):
  1. check the form          (facts come only from here)
  2. word options (AI)        3 headlines + 3 captions + hashtags, in the client's style
  3. poster                   type template, client's colours and banner, feed + story
  4. save draft               waits for approval like every other post
"""

from PIL import Image

from ai.claude import ask_json
from design.poster import file_uri, footer_data, render
from posts import COMMON_RULES, client_intro, final_hashtags, marathi_digits
from posts.custom.types import POSTER_TEXT, TYPES, kind_label, occasion_label, text_in
from storage import drafts
from storage.clients import current
from storage.languages import get as language

HEADLINE_MAX = 40

TYPE_RULES = {
    "announcement": "- This is an announcement. Every date, time, place and contact must be copied exactly from the facts.\n",
    "offer": (
        "- This is an offer post. NEVER invent or change a price, discount, date or condition. "
        "Do not put the price or discount in the headline (they are printed separately on the poster).\n"
    ),
    "achievement": (
        "- This is an achievement post. NEVER change, round or add numbers. "
        "Do not put numbers in the headline (they are printed separately on the poster).\n"
    ),
    "spotlight": (
        "- This post features a real person. Use only what is written about them; "
        "never invent qualities, history or quotes.\n"
    ),
}


def check_form(ptype, form):
    """Clean the form and make sure required fields are filled. Raises ValueError for the user to fix."""
    if ptype not in TYPES:
        raise ValueError("Unknown post type.")
    clean, missing = {}, []
    for f in TYPES[ptype]["fields"]:
        value = form.get(f["key"])
        if f["kind"] == "stats":
            rows = [
                {
                    "value": str(r.get("value", "")).strip(),
                    "label": str(r.get("label", "")).strip(),
                }
                for r in (value or [])
                if str(r.get("value", "")).strip()
            ][:3]
            if f.get("required") and not rows:
                missing.append(f["label"])
            clean[f["key"]] = rows
        elif f["kind"] == "checkbox":
            clean[f["key"]] = bool(value)
            if f.get("required") and not value:
                missing.append(f["label"])
        else:
            text = str(value or "").strip()
            if f["kind"] == "select" and text not in f.get("options", {}):
                text = next(iter(f["options"])) if f.get("options") else text
            if f.get("required") and not text:
                missing.append(f["label"])
            clean[f["key"]] = text
    if missing:
        raise ValueError("Please fill in: " + ", ".join(missing))
    return clean


def _facts(ptype, form):
    lines = []
    for f in TYPES[ptype]["fields"]:
        v = form.get(f["key"])
        if f["kind"] == "stats":
            v = "; ".join(f"{r['value']} {r['label']}".strip() for r in v)
        elif f["kind"] == "select":
            v = text_in(f["options"].get(v, {}), current()["language"]) or v
        elif f["kind"] == "checkbox":
            continue
        if v:
            lines.append(f"- {f['label']}: {v}")
    client = current()
    if (
        ptype in ("offer", "announcement")
        and client.get("phone")
        and not form.get("contact")
    ):
        lines.append(f"- Phone: {client['phone']}")
    return "\n".join(lines)


def word_options(ptype, form):
    """3 headlines + 3 captions + hashtags. Returns dict."""
    form = check_form(ptype, form)
    t = TYPES[ptype]
    system = client_intro(ptype) + COMMON_RULES + TYPE_RULES[ptype] + f"""
You write a {t['label'].lower()} post ({t['description'].lower()}).
- headline: printed big on the poster, max {HEADLINE_MAX} letters, catchy, in {language(current()["language"])["name"]}.
- caption: 2 to 4 short paragraphs for Instagram, using the facts below exactly. End with a clear next step
  (visit, call, apply, wish) when the facts give one.
- hashtags: 5 to 8, {language(current()["language"])["name"]} ones (words joined with _) and a few English ones.
Write 3 clearly different versions."""
    user = (
        f"Facts (use only these):\n{_facts(ptype, form)}\n\n"
        'Return JSON: {"headlines": ["...", "...", "..."], "captions": ["...", "...", "..."], "hashtags": ["#..."]}'
    )
    r = ask_json(system, user, max_tokens=3000)
    headlines = [
        marathi_digits(str(h).strip()) for h in r.get("headlines", []) if str(h).strip()
    ][:3]
    captions = [
        marathi_digits(str(c).strip()) for c in r.get("captions", []) if str(c).strip()
    ][:3]
    if not headlines or not captions:
        raise ValueError("The AI did not return options. Please try again.")
    tags = []
    for tag in r.get("hashtags", []):
        tag = "#" + str(tag).strip().lstrip("#").replace(" ", "_")
        if len(tag) > 1 and tag.lower() not in [x.lower() for x in tags]:
            tags.append(tag)
    return {
        "headlines": [
            {"text": h, "too_long": len(h) > HEADLINE_MAX} for h in headlines
        ],
        "captions": captions,
        "hashtags": tags[:15],
        "headline_max": HEADLINE_MAX,
    }


def photo_shape(path):
    """portrait / square / landscape, so the poster can pick the layout that shows the photo best."""
    if not path:
        return ""
    try:
        with Image.open(path) as im:
            w, h = im.size
    except OSError:
        return "landscape"
    ratio = w / h
    return "portrait" if ratio < 0.85 else "landscape" if ratio > 1.25 else "square"


def make_post(ptype, form, chosen, photo_path="", template_id=""):
    """Poster + caption from the form and the chosen words. Returns the draft."""
    form = check_form(ptype, form)
    if TYPES[ptype]["photo"] == "required" and not photo_path:
        raise ValueError("Please add a photo for this post.")
    headline = marathi_digits(str(chosen.get("headline", "")).strip())
    caption = marathi_digits(str(chosen.get("caption", "")).strip())
    if not headline or not caption:
        raise ValueError("Choose or write a headline and a caption first.")

    md = marathi_digits
    if template_id:                                        # the user picked a saved template
        from posts import template_post
        lang = current()["language"]
        first = next((line.strip() for key in ("details", "offer", "about", "note", "title")
                      for line in str(form.get(key) or "").splitlines() if line.strip()), "")
        small = kind_label(form.get("kind"), lang) or occasion_label(form.get("occasion"), lang) or form.get("product") or ""
        return template_post.make_post(
            template_id, {"line_small": md(small), "line_big": headline, "line_end": md(first)},
            title=f"{TYPES[ptype]['label']}: {headline}", caption=caption, hashtags=final_hashtags(chosen.get("hashtags")),
            details={"post_type": ptype, "form": form, "photo": photo_path, "headline": headline},
            post_type="custom", photo=photo_path)
    poster = {k: (md(v) if isinstance(v, str) else v) for k, v in form.items()}
    if ptype == "achievement":
        poster["stats"] = [
            {"value": md(r["value"]), "label": md(r["label"])} for r in form["stats"]
        ]
    for key in ("details", "about", "note"):
        if key in poster:
            poster[key + "_lines"] = [
                line.strip() for line in poster[key].splitlines() if line.strip()
            ][:4]
    client = current()
    data = {
        **footer_data(""),
        "ptype": ptype,
        "headline": headline,
        "f": poster,
        "kind_label": kind_label(form.get("kind"), client["language"]),
        "occasion_label": occasion_label(form.get("occasion"), client["language"]),
        "valid_text": text_in(POSTER_TEXT["offer_until"], client["language"]).format(
            date=poster.get("valid_till", "")
        ),
        "photo_uri": file_uri(photo_path) if photo_path else "",
        "photo_shape": photo_shape(photo_path),
        "phone": md(form.get("contact") or client.get("phone") or ""),
        "address": client.get("address", ""),
        "label": "",
    }
    images, warnings = render(
        TYPES[ptype]["template"], data, name=ptype, sizes=("feed", "story")
    )
    return drafts.create(
        post_type="custom",
        title=f"{TYPES[ptype]['label']}: {headline}",
        caption=caption,
        hashtags=final_hashtags(chosen.get("hashtags")),
        images=images,
        details={
            "post_type": ptype,
            "form": form,
            "photo": photo_path,
            "headline": headline,
        },
        warnings=warnings,
    )