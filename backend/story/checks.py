"""Objective checks on the final story: length, language, cast, repetition, title. Facts about the text,
used alongside the validator (which judges continuity)."""
import re
from collections import Counter

from story.options import SIZES

SCRIPTS = {"Hindi": (0x0900, 0x097F), "Marathi": (0x0900, 0x097F), "Tamil": (0x0B80, 0x0BFF), "Telugu": (0x0C00, 0x0C7F),
           "Kannada": (0x0C80, 0x0CFF), "Malayalam": (0x0D00, 0x0D7F), "Bengali": (0x0980, 0x09FF)}


def word_count(text):
    return len(re.findall(r"\w+", text))


def language_ratio(text, language):
    letters = [c for c in text if c.isalpha()]
    if not letters:
        return 0.0
    if language in SCRIPTS:
        lo, hi = SCRIPTS[language]
        return sum(lo <= ord(c) <= hi for c in letters) / len(letters)
    return sum(c.isascii() for c in letters) / len(letters)


def cast_names(characters_md):
    """The bold names in the approved Characters stage."""
    names = {re.split(r"[—\-–(,:]", n)[0].strip() for n in re.findall(r"\*\*([^*]+)\*\*", characters_md or "")}
    skip = {"want", "need", "fear", "flaw", "arc"}
    return sorted(n for n in names if n and n.lower() not in skip)


def repetition(text, n=4):
    words = re.findall(r"\w+", text.lower())
    grams = [tuple(words[i:i + n]) for i in range(len(words) - n + 1)]
    return sum(c - 1 for c in Counter(grams).values() if c > 1) / len(grams) if grams else 0.0


def run(brief, story, characters_md=""):
    target = SIZES.get(brief.get("length"), SIZES["Medium"])["words"]
    wc = word_count(story)
    lang = brief.get("language", "English")
    ratio = language_ratio(story, lang)
    names = cast_names(characters_md)
    missing = [n for n in names if n.split()[0].lower() not in story.lower()]
    rep = repetition(story)
    return [
        {"key": "length", "ok": abs(wc - target) / target <= 0.20, "detail": f"{wc} words (target about {target}, within 20%)"},
        {"key": "language", "ok": ratio >= 0.95, "detail": f"{ratio:.0%} of the letters are in {lang}"},
        {"key": "cast", "ok": not missing, "detail": "all approved characters appear" if not missing else f"missing: {', '.join(missing)}"},
        {"key": "repetition", "ok": rep <= 0.03, "detail": f"{rep:.1%} repeated 4-word phrases (target 3% or less)"},
        {"key": "title", "ok": story.lstrip().startswith("# "), "detail": "starts with a '# Title' heading"},
    ]
