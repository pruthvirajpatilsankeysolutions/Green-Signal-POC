"""Objective checks on the final story: length, language, cast, repetition, title. Facts about the text,
used alongside the validator (which judges continuity)."""
import re
from collections import Counter

from story.options import sizes

SCRIPTS = {"Hindi": (0x0900, 0x097F), "Marathi": (0x0900, 0x097F), "Tamil": (0x0B80, 0x0BFF), "Telugu": (0x0C00, 0x0C7F),
           "Kannada": (0x0C80, 0x0CFF), "Malayalam": (0x0D00, 0x0D7F), "Bengali": (0x0980, 0x09FF)}


def word_count(text):
    """Words as a reader counts them: whitespace-separated tokens that contain a letter or digit.
    (A \\w+ regex splits Hindi, Marathi, Tamil... words at their vowel signs and counts "don't" as two.)"""
    return sum(1 for w in text.split() if any(c.isalnum() for c in w))


def _tokens(text):
    strip = ".,;:!?\"'\u201c\u201d\u2018\u2019()[]{}\u2014\u2013-*_#`\u0964\u0965"
    return [t for t in (w.strip(strip) for w in text.split()) if t]


def language_ratio(text, language):
    letters = [c for c in text if c.isalpha()]
    if not letters:
        return 0.0
    if language in SCRIPTS:
        lo, hi = SCRIPTS[language]
        return sum(lo <= ord(c) <= hi for c in letters) / len(letters)
    return sum(c.isascii() for c in letters) / len(letters)


LABELS = {"want", "why", "need", "fear", "flaw", "past", "contradiction", "habit", "voice", "never", "relationship", "relationships", "pressure", "arc"}


def cast_names(characters_md):
    """The bold names in the approved Characters stage. Bold field labels ("**Want:**", "**Past**:") are not names."""
    names = set()
    for m in re.finditer(r"\*\*([^*\n]+)\*\*(\s*:)?", characters_md or ""):
        span, colon = m.group(1).strip(), m.group(2)
        if colon or span.endswith(":"):
            continue
        name = re.split(r"[—\-–(,:]", span)[0].strip()
        if name and name.lower() not in LABELS:
            names.add(name)
    return sorted(names)


def repetition(text, n=4):
    words = [t.lower() for t in _tokens(text)]
    grams = [tuple(words[i:i + n]) for i in range(len(words) - n + 1)]
    return sum(c - 1 for c in Counter(grams).values() if c > 1) / len(grams) if grams else 0.0


def run(brief, story, characters_md=""):
    target = sizes(brief)["words"]
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