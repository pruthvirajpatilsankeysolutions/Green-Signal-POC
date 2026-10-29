"""Quick objective checks that a stage has the shape it was asked for. They only produce warnings."""
import re

from story.checks import cast_names, word_count
from story.options import sizes


def _numbered(text):
    return len(re.findall(r"^\s*\d+[.)]\s", text, re.M))


def _scene_lines(text):
    return len([l for l in text.splitlines() if re.match(r"^\s*(?:\d+[.)]\s*|[-*]\s*)?\*\*[^*\n]+\*\*", l) and not l.lstrip().startswith("#")])


def check(stage, text, brief):
    w = []
    if stage == "concept":
        n = word_count(text)
        if not 128 <= n <= 253:
            w.append(f"The concept is {n} words (aim for 150 to 220).")
    elif stage == "logline":
        first = next((l for l in text.splitlines() if l.strip()), "")
        n = word_count(first)
        if n > 40:
            w.append(f"The logline is {n} words (one sentence, 35 at most).")
        if "why it works" not in text.lower():
            w.append("There is no 'Why it works:' line.")
    elif stage == "characters":
        names = cast_names(text)
        if not 6 <= len(names) <= 9:
            w.append(f"{len(names)} characters found (aim for 7 to 8: a protagonist, an opposing force and 5 to 6 supporting characters).")
        # Only the protagonist and the opposing force get the full lines; supporting characters get Want, Flaw and Contradiction.
        for label in ("want", "need", "flaw", "arc"):
            if len(re.findall(rf"\b{label}\b", text, re.I)) < min(2, max(1, len(names))):
                w.append(f"The protagonist and the opposing force each need a {label.title()} line.")
                break
    elif stage == "conflict":
        missing = [x for x in ("External", "Internal", "Relationship", "Stakes", "Ticking clock") if x.lower() not in text.lower()]
        if missing:
            w.append(f"Missing sections: {', '.join(missing)}.")
    elif stage == "ending":
        if len(re.findall(r"^\s*(?:[-*]|\d+[.)])\s", text, re.M)) < 2:
            w.append("There should be 2 alternative endings listed.")
    elif stage == "structure":
        if not re.search(r"\bact\b|\bhalf\b|\bhalves\b", text, re.I):
            w.append("No acts or halves are named.")
    elif stage == "beats":
        want, n = sizes(brief)["beats"], _numbered(text)
        if n != want:
            w.append(f"{n} numbered beats (this length needs {want}).")
    elif stage == "outline":
        lo, hi = sizes(brief)["scenes"]
        n = _scene_lines(text)
        if not lo - 2 <= n <= hi + 2:
            w.append(f"About {n} scenes found (this length needs {lo} to {hi}).")
    return w