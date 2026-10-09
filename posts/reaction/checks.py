"""
Safety checks for news reaction posts.
A wrong score or name under a politician's name is a public embarrassment,
so numbers are checked by code, not only by the AI.
"""
import re

DEVANAGARI_DIGITS = str.maketrans("०१२३४५६७८९", "0123456789")


def numbers_in(text):
    """All numbers in a text (Marathi digits counted too)."""
    return set(re.findall(r"\d+", str(text).translate(DEVANAGARI_DIGITS)))


def _facts_text(facts):
    parts = []
    for value in (facts or {}).values():
        if isinstance(value, list):
            parts += [str(v) for v in value]
        elif value not in (None, ""):
            parts.append(str(value))
    return " ".join(parts)


def unknown_numbers(text, facts):
    """Numbers in our text that do NOT appear anywhere in the news facts."""
    return sorted(numbers_in(text) - numbers_in(_facts_text(facts)))


def compare_team_line(team_line, facts, article_text=""):
    """Numbers the team typed that the news article doesn't confirm."""
    known = numbers_in(_facts_text(facts)) | numbers_in(article_text)
    return sorted(numbers_in(team_line) - known)
