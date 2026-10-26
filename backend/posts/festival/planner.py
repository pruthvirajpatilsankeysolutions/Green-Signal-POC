"""
Post planner: the AI writes several versions of the words for an occasion, each from a
different angle. The team picks the hook, poster text, caption and hashtags (from any
version), edits them, and the poster is then made with the chosen words.
Month plan: hooks and titles only, for every occasion of a month at once.
"""

import contextvars
from concurrent.futures import ThreadPoolExecutor

from ai.claude import ask_json
from posts import COMMON_RULES, client_intro, final_hashtags, marathi_digits, poster_line, style_kind
from posts.festival.prompts import formats
from storage.languages import get as language
from storage.clients import current

# angles per client category: the 4 versions really differ
ANGLES = {
    "politician": [
        "Traditional",
        "Emotional",
        "Saying / quote",
        "People and Maharashtra pride",
    ],
    "business": ["Traditional", "Warm family", "Offer / product", "Fun"],
    "school": ["Traditional", "Values for students", "Proud institution", "Playful"],
    "hospital": ["Traditional", "Health tip for the festival", "Caring", "Community"],
    "ngo": ["Traditional", "Cause-linked", "Gratitude", "Call to help"],
    "personal": ["Traditional", "Personal story", "Saying / quote", "Gratitude"],
}
TRIBUTE_ANGLES = ["Respectful", "Life and work", "Saying / quote", "Inspiration"]

# length limits so the words always fit the poster (letters counted as written)
LIMITS = {"hook": 80, "line_small": 45, "line_big": 18, "line_end": 45}
PARTS = ("hook", "poster", "caption", "hashtags", "title")
MAX_HASHTAGS = 15  # Instagram allows 30; 5 to 15 works best


def angles_for(festival):
    if festival["tone"] in ("tribute", "solemn"):
        return TRIBUTE_ANGLES
    client_type = current()["type"]
    return ANGLES.get(
        "school" if client_type == "institution" else client_type, ANGLES["politician"]
    )


def _system(festival):
    tone = festival["tone"]
    return (
        client_intro(style_kind("festival", tone)) + COMMON_RULES + formats(tone) + f"""
Parts of a post:
- hook: the FIRST line of the caption, short and catchy, max {LIMITS['hook']} letters, no hashtags.
- poster: the words printed ON the poster image:
    line_small: a short line above the title, max {LIMITS['line_small']} letters (use | for a line break)
    line_big: the big title naming the occasion (e.g. "Makar Sankranti"), 1 or 2 words, max {LIMITS['line_big']} letters
    line_end: the closing wishes line, max {LIMITS['line_end']} letters (use | for a line break)
    Poster lines are plain words only: no hashtags, no @handles, no emojis (those belong in the caption).
- caption: the rest of the caption AFTER the hook (2 to 4 short paragraphs). Do not repeat the hook.
- hashtags: 5 to 8 hashtags as a list: {language(current()["language"])["name"]} ones (words joined with _) and a few English ones.
- picture: ONE English sentence describing a background picture for this post, with NO text in it.
"""
    )


def _clean(text, limit=None):
    text = marathi_digits(str(text or "").strip())
    return text[:limit].rstrip() if limit else text


def _tags(tags):
    """Clean hashtags (no client fixed ones here; those are always added to the post)."""
    out = []
    for t in tags or []:
        t = "#" + str(t).strip().lstrip("#").replace(" ", "_")
        if len(t) > 1 and t.lower() not in [x.lower() for x in out]:
            out.append(t)
    return out[:MAX_HASHTAGS]


def _too_long(version):
    poster = version["poster"]
    return [
        k
        for k in ("line_small", "line_big", "line_end")
        if len(poster[k].replace("|", "")) > LIMITS[k]
    ] + (["hook"] if len(version["hook"]) > LIMITS["hook"] else [])


def generate(festival):
    """4 versions (one per angle). Returns (options, chosen)."""
    angles = angles_for(festival)
    user = (
        f"Occasion: {festival['occasion_mr']} ({festival.get('occasion_en', '')})\n"
        f"Date: {festival['date']}\n"
        f"Standard poster text (for reference only): {festival['line_small']} / {festival['line_big']} / {festival['line_end']}\n"
        f"Write {len(angles)} different versions, one for each angle, in this order: {', '.join(angles)}.\n"
        'Return JSON: {"versions": [{"angle": "...", "hook": "...", "poster": {"line_small": "...", '
        '"line_big": "...", "line_end": "..."}, "caption": "...", "hashtags": ["#..."], "picture": "..."}]}'
    )
    result = ask_json(_system(festival), user, max_tokens=3500)

    options = {
        "hooks": [],
        "posters": [],
        "captions": [],
        "hashtags": [],
        "pictures": [],
    }
    for i, v in enumerate(result.get("versions", [])[: len(angles)]):
        angle = str(v.get("angle") or angles[min(i, len(angles) - 1)])
        poster = v.get("poster") or {}
        clean = {
            "hook": _clean(v.get("hook")),
            "poster": {
                k: _clean(poster_line(poster.get(k))) for k in ("line_small", "line_big", "line_end")
            },
        }
        warn = _too_long(clean)
        options["hooks"].append(
            {"angle": angle, "text": clean["hook"], "too_long": "hook" in warn}
        )
        options["posters"].append(
            {
                "angle": angle,
                **clean["poster"],
                "too_long": [k for k in warn if k != "hook"],
            }
        )
        options["captions"].append({"angle": angle, "text": _clean(v.get("caption"))})
        options["hashtags"].append({"angle": angle, "tags": _tags(v.get("hashtags"))})
        options["pictures"].append(
            {"angle": angle, "text": str(v.get("picture") or "").strip()}
        )
    if not options["hooks"]:
        raise ValueError("The AI did not return any versions. Please try again.")

    # the calendar's own text stays available as the "Standard" poster option (when it has text in this language)
    if festival["line_big"]:
        options["posters"].append(
            {
                "angle": "Standard",
                "line_small": festival["line_small"],
                "line_big": festival["line_big"],
                "line_end": festival["line_end"],
                "too_long": [],
            }
        )
    chosen = {
        "hook": options["hooks"][0]["text"],
        "poster": {
            k: options["posters"][0][k] for k in ("line_small", "line_big", "line_end")
        },
        "caption": options["captions"][0]["text"],
        "hashtags": options["hashtags"][0]["tags"],
        "picked": {"hook": 0, "poster": 0, "caption": 0, "hashtags": 0},
    }
    return options, chosen


def rewrite(festival, part, options, instruction=""):
    """One more option for one part (hook / poster / caption / hashtags / title), different from the ones already there."""
    if part not in PARTS:
        raise ValueError("Part must be hook, poster, caption or hashtags.")
    key = {
        "hook": "hooks",
        "poster": "posters",
        "caption": "captions",
        "hashtags": "hashtags",
        "title": "titles",
    }[part]
    seen = [
        o.get("text")
        or (
            " ".join(o["tags"])
            if "tags" in o
            else " / ".join(o[k] for k in ("line_small", "line_big", "line_end"))
        )
        for o in options.get(key, [])
    ]
    shape = {
        "hook": '{"hook": "..."}',
        "poster": '{"poster": {"line_small": "...", "line_big": "...", "line_end": "..."}}',
        "caption": '{"caption": "..."}',
        "hashtags": '{"hashtags": ["#...", "#..."]}',
        "title": '{"title": "..."}',
    }[part]
    what = {
        "hashtags": "set of 5 to 8 hashtags",
        "title": f"poster title (1 or 2 words, max {LIMITS['line_big']} letters)",
    }.get(part, part)
    user = (
        f"Occasion: {festival['occasion_mr']} ({festival.get('occasion_en', '')}), date {festival['date']}.\n"
        f"Write ONE new {what}, clearly different from these:\n- "
        + "\n- ".join(seen)
        + "\n"
        + (
            f"Extra instruction from the team: {instruction}\n"
            if instruction.strip()
            else ""
        )
        + f"Return JSON: {shape}"
    )
    r = ask_json(_system(festival), user, max_tokens=1500)
    angle = "Rewrite" + (f": {instruction.strip()[:30]}" if instruction.strip() else "")
    if part == "hook":
        text = _clean(r.get("hook"))
        return key, {
            "angle": angle,
            "text": text,
            "too_long": len(text) > LIMITS["hook"],
        }
    if part == "poster":
        poster = {
            k: _clean((r.get("poster") or {}).get(k))
            for k in ("line_small", "line_big", "line_end")
        }
        return key, {
            "angle": angle,
            **poster,
            "too_long": [
                k for k in poster if len(poster[k].replace("|", "")) > LIMITS[k]
            ],
        }
    if part == "hashtags":
        return key, {"angle": angle, "tags": _tags(r.get("hashtags"))}
    if part == "title":
        text = _clean(r.get("title"))
        return key, {
            "angle": angle,
            "text": text,
            "too_long": len(text) > LIMITS["line_big"],
        }
    return key, {"angle": angle, "text": _clean(r.get("caption"))}


def final_text(chosen):
    """Caption, hashtags and poster lines for the post, from the chosen words."""
    caption = "\n\n".join(
        t
        for t in [chosen.get("hook", "").strip(), chosen.get("caption", "").strip()]
        if t
    )
    return caption, final_hashtags(chosen.get("hashtags")), chosen.get("poster", {})


# ---------------------------------------------------------------- month plan: hooks and titles only
def plan_hooks_titles(festival, notes=""):
    """4 hooks and 4 poster titles for one occasion (short and fast). Returns (options, chosen)."""
    angles = angles_for(festival)
    user = (
        f"Occasion: {festival['occasion_mr']} ({festival.get('occasion_en', '')})\n"
        f"Date: {festival['date']}\n"
        f"Standard poster title (for reference only): {festival['line_big']}\n"
        + (f"Notes from the team: {notes}\n" if notes.strip() else "")
        + f"Write {len(angles)} versions, one for each angle, in this order: {', '.join(angles)}.\n"
        "Each version has only a hook and a poster title (line_big).\n"
        'Return JSON: {"versions": [{"angle": "...", "hook": "...", "title": "..."}]}'
    )
    result = ask_json(_system(festival), user, max_tokens=1500)
    hooks, titles = [], []
    for i, v in enumerate(result.get("versions", [])[: len(angles)]):
        angle = str(v.get("angle") or angles[min(i, len(angles) - 1)])
        hook, title = _clean(v.get("hook")), _clean(v.get("title"))
        if hook:
            hooks.append(
                {"angle": angle, "text": hook, "too_long": len(hook) > LIMITS["hook"]}
            )
        if title:
            titles.append(
                {
                    "angle": angle,
                    "text": title,
                    "too_long": len(title) > LIMITS["line_big"],
                }
            )
    if not hooks or not titles:
        raise ValueError("The AI did not return hooks and titles. Please try again.")
    if festival["line_big"]:
        titles.append(
            {"angle": "Standard", "text": festival["line_big"], "too_long": False}
        )
    options = {"month": True, "hooks": hooks, "titles": titles}
    chosen = {
        "hook": hooks[0]["text"],
        "poster": {
            "line_small": festival["line_small"],
            "line_big": titles[0]["text"],
            "line_end": festival["line_end"],
        },
        "caption": "",
        "hashtags": [],
        "notes": notes,
        "picked": {"hook": 0, "title": 0},
    }
    return options, chosen


def plan_month(festivals, notes_by_id=None):
    """Hooks and titles for many occasions at once (side by side).
    Returns {festival_id: (options, chosen)} and {festival_id: error}."""
    notes_by_id = notes_by_id or {}
    results, errors = {}, {}
    with ThreadPoolExecutor(max_workers=4) as pool:
        # each task gets a copy of the request context, so it knows the current client
        jobs = {
            f["id"]: pool.submit(
                contextvars.copy_context().run,
                plan_hooks_titles,
                f,
                notes_by_id.get(f["id"], ""),
            )
            for f in festivals
        }
        for fid, job in jobs.items():
            try:
                results[fid] = job.result()
            except (
                Exception
            ) as e:  # noqa: BLE001 - one failed occasion must not stop the others
                errors[fid] = str(e)
    return results, errors


def caption_options(festival, chosen):
    """Caption and hashtag options that follow an already chosen hook and title (and notes)."""
    angles = angles_for(festival)
    poster = chosen.get("poster", {})
    user = (
        f"Occasion: {festival['occasion_mr']} ({festival.get('occasion_en', '')}), date {festival['date']}.\n"
        f"The hook is already chosen (the caption's first line): {chosen.get('hook', '')}\n"
        f"The poster says: {poster.get('line_small', '')} / {poster.get('line_big', '')} / {poster.get('line_end', '')}\n"
        + (
            f"Notes from the team: {chosen.get('notes', '')}\n"
            if chosen.get("notes", "").strip()
            else ""
        )
        + f"Write {len(angles)} captions (the text AFTER the hook, do not repeat it), one for each angle: "
        f"{', '.join(angles)}, each with its own hashtags.\n"
        'Return JSON: {"versions": [{"angle": "...", "caption": "...", "hashtags": ["#..."]}]}'
    )
    result = ask_json(_system(festival), user, max_tokens=3000)
    captions, hashtags = [], []
    for i, v in enumerate(result.get("versions", [])[: len(angles)]):
        angle = str(v.get("angle") or angles[min(i, len(angles) - 1)])
        captions.append({"angle": angle, "text": _clean(v.get("caption"))})
        hashtags.append({"angle": angle, "tags": _tags(v.get("hashtags"))})
    if not captions:
        raise ValueError("The AI did not return captions. Please try again.")
    return captions, hashtags


def write_body(festival, chosen):
    """When a post is made from a plan with no caption yet: one caption + hashtags after the hook."""
    captions, hashtags = caption_options(festival, chosen)
    return captions[0]["text"], hashtags[0]["tags"]