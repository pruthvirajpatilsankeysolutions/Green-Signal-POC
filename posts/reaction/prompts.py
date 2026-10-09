"""
Prompts for news reaction posts.
Two separate steps: (1) pull facts from the news, (2) write using only those facts.
"""
from posts import COMMON_RULES, client_intro, style_kind

EXTRACT_SYSTEM = """
You read a news article and pull out facts. Copy facts exactly as the article states them.
If something is not in the article, use null. Never guess.

Also decide if the topic is SENSITIVE for a politician to react to automatically:
politics, elections, arrests, court cases, protests, allegations, party disputes,
caste or religious conflict. Sports wins, awards, national achievements,
disasters and deaths of well-known people are NOT sensitive.

Return JSON:
{"event": "...", "result": "score or result, e.g. 5-1, or null",
 "winner": "...", "opponent": "...", "competition": "...",
 "names": ["..."], "date": "...", "place": "...",
 "record_or_first": "a record or 'first time' fact, or null",
 "sensitive": true/false, "sensitive_reason": "..."}
"""

FORMATS = {
    "congratulate": """
Format (blank line between every part), like the past congratulation captions:
1. A short emotional hook line ending with "…" (e.g. "जय हिंद…" or "भारतीय कुस्तीपटूंची घोडदौड सुरूच…").
2. One headline line with the achievement, ending with "…".
3. One detailed paragraph: competition, event, opponent, score, key names (only from FACTS).
4. Closing: "<who>चे मनःपूर्वक अभिनंदन आणि पुढील वाटचालीसाठी हार्दिक शुभेच्छा."
Maximum 120 words.
Hashtags: 3 to 5 in ENGLISH (e.g. #AsianGames2026 #India #Hockey #GoldMedal #Cheer4Bharat).
""",
    "condolence": """
Format (blank line between every part), like the past condolence caption:
1. A short emotional opening line about the loss.
2. A paragraph about the person's life and work (only from FACTS).
3. ONLY IF MEMORIES are given: one or two paragraphs with the leader's personal memories,
   written in first person ("मी", "माझ्या"), using ONLY what MEMORIES says. Add nothing.
   If MEMORIES is empty: skip this part completely and never suggest the leader knew them.
4. Closing exactly: "भावपूर्ण श्रद्धांजली! ईश्वर त्यांच्या आत्म्यास सद्गती देवो."
No 'शुभेच्छा', no celebration words. Hashtags: empty list.
""",
    "support": """
Format: 2 to 4 short paragraphs: what happened -> support and solidarity -> appeal or prayer.
Calm and respectful. Hashtags: 0 to 2.
""",
}

CARD_FIELDS = """
Also write short text for a poster card (used only if there is no photo), in Marathi:
- card_headline: max 4 words
- card_detail: max 10 words; do NOT repeat the score here
- card_message: max 7 words
"""


def extract_prompt(team_line, article_text):
    return EXTRACT_SYSTEM, (
        f"Team's one-line summary: {team_line}\n\n"
        f"News article:\n{article_text[:8000]}"
    )


def caption_prompt(team_line, tone, mention, facts, memories=""):
    system = (client_intro(style_kind("reaction", tone)) + COMMON_RULES + FORMATS[tone] + CARD_FIELDS
              + '\nReturn JSON: {"caption": "...", "hashtags": ["#..."], '
                '"card_headline": "...", "card_detail": "...", "card_message": "..."}')
    user = (
        f"Team's summary: {team_line}\n"
        f"Mention specially: {mention or 'nobody extra'}\n"
        f"FACTS (use only these): {facts}\n"
        f"MEMORIES (leader's own, from the team): {memories.strip() or 'none'}"
    )
    return system, user