"""
Reaction post flow:
  1. read the news link (or pasted text)
  2. AI pulls the facts                -> stop if topic is sensitive
  3. code compares team's line vs news -> warn on mismatch
  4. AI writes the caption using ONLY the facts (+ memories for condolence)
  5. code checks no new numbers slipped in
  6. images:
       with photos    -> the real photos, no banner, no text (client's style)
       without photos -> a simple card with banner (fallback)
"""
import requests
from bs4 import BeautifulSoup

from ai.claude import ask_json
from design.photos import prepare_for_instagram
from design.poster import file_uri, footer_data, pick_leader_photo, render
from posts import final_hashtags, marathi_digits
from posts.reaction.checks import compare_team_line, unknown_numbers
from posts.reaction.prompts import caption_prompt, extract_prompt
from storage import drafts

TONES = ["congratulate", "condolence", "support"]


def fetch_article(url):
    """Get the readable text of a news page."""
    response = requests.get(url, timeout=15, headers={"User-Agent": "Mozilla/5.0"})
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")
    paragraphs = [p.get_text(" ", strip=True) for p in soup.find_all("p")]
    text = "\n".join(p for p in paragraphs if len(p) > 40)
    if len(text) < 200:
        raise ValueError("Could not read the article from this link. Paste the news text instead.")
    return text


def check_facts(team_line, url="", pasted_text=""):
    """Steps 1-3. Returns dict with facts, mismatches, blocked reason."""
    article = pasted_text.strip() or fetch_article(url)
    facts = ask_json(*extract_prompt(team_line, article))

    blocked = ""
    # the AI sometimes answers "false" as text; only a real yes counts as sensitive
    sensitive = str(facts.get("sensitive", "")).strip().lower() in ("true", "yes", "1")
    if sensitive:
        blocked = facts.get("sensitive_reason") or "Sensitive topic"
    facts.pop("sensitive", None)
    facts.pop("sensitive_reason", None)

    mismatches = compare_team_line(team_line, facts, article)
    return {"facts": facts, "mismatches": mismatches, "blocked": blocked, "source": url}


TEXT_FIELDS = ["caption", "card_headline", "card_detail", "card_message"]


def _write(team_line, tone, mention, facts, memories, extra=""):
    system, user = caption_prompt(team_line, tone, mention, facts, memories)
    return ask_json(system, user + extra)


def make_post(team_line, tone, mention, checked, photo_paths=(), memories=""):
    facts = checked["facts"]
    allowed = {**facts, "memories": memories}      # numbers in memories are allowed too

    result = _write(team_line, tone, mention, facts, memories)
    bad = unknown_numbers(" ".join(str(result.get(k, "")) for k in TEXT_FIELDS), allowed)
    if bad:
        result = _write(team_line, tone, mention, facts, memories,
                        extra=f"\n\nYou used numbers not in the facts: {bad}. Remove them.")
        bad = unknown_numbers(" ".join(str(result.get(k, "")) for k in TEXT_FIELDS), allowed)

    warnings = [f"CHECK: number(s) {', '.join(bad)} are not in the news"] if bad else []
    warnings += [f"Team's line has {m}, news does not confirm it" for m in checked["mismatches"]]

    if photo_paths:
        # client's style: real photos only, no banner, no text on them
        images = [prepare_for_instagram(p) for p in photo_paths]
        mode = "photo"
    else:
        score = facts.get("result") if tone == "congratulate" else ""
        leader = "" if tone == "condolence" else pick_leader_photo(turn=len(drafts.load_all()))
        data = {
            **footer_data(leader),
            "tone": tone,
            "headline": marathi_digits(result.get("card_headline", "")),
            "result": marathi_digits(str(score).replace("-", " – ")) if score else "",
            "detail": marathi_digits(result.get("card_detail", "")),
            "message": marathi_digits(result.get("card_message", "")),
            "photo_uri": "",
            "label": "",
        }
        images, render_warnings = render("reaction.html", data, name="reaction",
                                         sizes=("feed", "story"))
        warnings += render_warnings
        mode = "card"

    hashtags = [] if tone == "condolence" else final_hashtags(result.get("hashtags"))

    return drafts.create(
        post_type="reaction",
        title=team_line[:60],
        caption=marathi_digits(result["caption"].strip()),
        hashtags=hashtags,
        images=images,
        details={"facts": facts, "memories": memories, "source": checked.get("source"),
                 "tone": tone, "mode": mode},
        warnings=warnings,
    )