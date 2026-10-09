"""
Shared helpers for all post types.
"""
import re

from config import CLIENT, USE_MARATHI_DIGITS

_TO_MARATHI = str.maketrans("0123456789", "०१२३४५६७८९")


def marathi_digits(text):
    """5-1 -> ५-१ in caption text. Hashtags, @mentions and links keep English digits."""
    if not USE_MARATHI_DIGITS:
        return text
    parts = re.split(r"(\s+)", text)
    return "".join(p if p.startswith(("#", "@", "http")) else p.translate(_TO_MARATHI)
                   for p in parts)


def style_kind(post_type, tone=""):
    """Which group of past captions to copy: tribute, greeting, congratulate, condolence, event."""
    if post_type == "festival":
        return "greeting" if tone == "greeting" else "tribute"
    if post_type == "reaction":
        return "condolence" if tone == "condolence" else "congratulate"
    return "event"


def client_intro(kind="event"):
    """Who we write for + their past captions of the same type."""
    examples = CLIENT["style_examples"]
    if isinstance(examples, dict):
        chosen = examples.get(kind) or [e for group in examples.values() for e in group][:3]
    else:
        chosen = examples
    shown = "\n\n---\n\n".join(chosen)
    return (
        f"You write Instagram captions for {CLIENT['name']} "
        f"({', '.join(CLIENT['designation_lines'])}).\n"
        "Language: Marathi, formal and respectful, simple words people use daily.\n"
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
    for tag in list(tags or []) + CLIENT.get("fixed_hashtags", []):
        tag = "#" + str(tag).strip().lstrip("#").replace(" ", "_")
        if len(tag) > 1 and tag.lower() not in [t.lower() for t in out]:
            out.append(tag)
    return out