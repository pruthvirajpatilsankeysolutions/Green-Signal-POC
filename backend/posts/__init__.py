import re

from config import USE_MARATHI_DIGITS
from storage.categories import category
from storage.clients import current
from storage.languages import prompt_block, to_local_digits


def local_digits(text):
    """5-1 -> ५-१ when the client's language uses its own digits (Marathi by default; Hindi and
    English clients usually keep 0-9). Hashtags, @mentions and links keep English digits.
    """
    if (
        not USE_MARATHI_DIGITS or not text
    ):  # USE_MARATHI_DIGITS = False switches it off for everyone
        return text
    client = current()
    parts = re.split(r"(\s+)", str(text))
    return "".join(
        (
            p
            if p.startswith(("#", "@", "http"))
            else to_local_digits(p, client["language"], client["digit_style"])
        )
        for p in parts
    )


marathi_digits = local_digits  # old name, still used in several files


def style_kind(post_type, tone=""):
    """Which group of past captions to copy: greeting, tribute, solemn, congratulate, condolence, event,
    or a Create-post type (announcement, offer, achievement, spotlight)."""
    if post_type == "festival":
        return {"greeting": "greeting", "tribute": "tribute", "solemn": "solemn"}.get(
            tone, "tribute"
        )
    if post_type == "reaction":
        return "condolence" if tone == "condolence" else "congratulate"
    if post_type == "custom" and tone in (
        "announcement",
        "offer",
        "achievement",
        "spotlight",
    ):
        return tone  # Create-post types have their own examples
    return "event"


def client_intro(kind="event"):
    """Who we write for + their past captions of the same type."""
    client = current()
    examples = client["style_examples"]
    chosen = examples.get(kind) or [e for group in examples.values() for e in group][:3]
    shown = (
        "\n\n---\n\n".join(chosen)
        if chosen
        else "(no past captions yet; write in a warm, formal style)"
    )
    who = ", ".join(client["designation_lines"])
    cat = category(client["type"])
    return (
        f"You write Instagram captions for {client['name']}"
        f"{f' ({who})' if who else ''}, a {cat['label'].lower()} client.\n"
        + prompt_block(client["language"], client["second_language"])
        + f"Tone: {cat['voice']}.\n"
        f"{cat['rules']}"
        "Copy the STYLE of these real past captions (structure, tone, line breaks, "
        "use of '…', closing lines). Do NOT copy their facts:\n\n"
        f"{shown}\n"
    )


COMMON_RULES = """
Rules:
- Use ONLY the facts given. Never invent names, numbers, dates, places or quotes.
- Never invent personal memories, meetings or things the leader said.
- If an important detail is missing, write [CONFIRM: what is missing] in its place.
- Never comment on controversy, opponents, blame, caste, religion conflicts or court cases.
- Short paragraphs with ONE blank line between them, like the past captions.
- No emojis.
- Write numbers with normal digits; they are converted automatically.
"""


def final_hashtags(tags):
    """Clean hashtags, add the client's fixed ones, remove duplicates, keep order."""
    out = []
    for tag in list(tags or []) + current().get("fixed_hashtags", []):
        tag = "#" + str(tag).strip().lstrip("#").replace(" ", "_")
        if len(tag) > 1 and tag.lower() not in [t.lower() for t in out]:
            out.append(tag)
    return out
