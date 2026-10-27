"""Screenplay helpers for the Fountain format."""
import re
from datetime import date

from story.checks import cast_names as _cast

HEADING = re.compile(r"^(INT\./EXT\.|INT/EXT\.?|I/E\.?|INT\.|EXT\.)\s", re.I)
EXT = re.compile(r"\s*\((V\.O\.|O\.S\.|O\.C\.|CONT'D)\)", re.I)


def cast_upper(characters_md):
    names = set()
    for full in _cast(characters_md):
        full = full.upper()
        names.add(full)
        names.update(p for p in full.split() if len(p) > 2)
    return names


def speakers(text):
    """Character cues: a line in capitals followed by a line of dialogue."""
    lines = text.splitlines()
    found = []
    for i, line in enumerate(lines[:-1]):
        cue = line.strip()
        if (cue and cue == cue.upper() and any(c.isalpha() for c in cue) and len(cue) < 40
                and not HEADING.match(cue + " ") and not cue.endswith("TO:") and not cue.startswith(("(", "FADE")) and lines[i + 1].strip()):
            found.append(EXT.sub("", cue).strip())
    return list(dict.fromkeys(found))


def check_scene(text, characters_md="", heading=""):
    """Tidy one scene: remove code fences, add a missing heading, report speaking characters that are not in the cast.
    Returns (text, issues, speakers)."""
    text = re.sub(r"^```\w*\s*|\s*```$", "", text.strip()).strip()
    issues = []
    first = next((l for l in text.splitlines() if l.strip()), "")
    if not HEADING.match(first.strip() + " "):
        if heading:
            text = heading.strip().upper() + "\n\n" + text
            issues.append("The scene heading was missing and was added.")
        else:
            issues.append("The scene heading is missing.")
    names = cast_upper(characters_md)
    spoken = speakers(text)
    if names:
        for s in spoken:
            if s not in names and not any(p in names for p in s.split()):
                issues.append(f"A speaking character is not in the approved cast: {s}")
    return text, issues, spoken


def assemble(scene_texts, title, author="Story Studio (draft)"):
    page = f"Title: {title}\nCredit: Written by\nAuthor: {author}\nDraft date: {date.today():%d %B %Y}\n"
    return page + "\n\n" + "\n\n".join(t.strip() for t in scene_texts) + "\n\nFADE OUT.\n"
