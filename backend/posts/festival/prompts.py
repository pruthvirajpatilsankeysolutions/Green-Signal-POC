"""
Prompts for festival / jayanti / punyatithi posts.
"""
from posts import COMMON_RULES, client_intro, style_kind

FORMATS = {
    "greeting": """
Format: 3 to 5 short paragraphs, blank line between them:
1. Wishes line ending with "…" (e.g. "समस्त महाराष्ट्रवासीयांना दिवाळीच्या हार्दिक शुभेच्छा…")
2. One short paragraph on what the day means (only well-known, general meaning).
3. Closing wishes line ending with "…".
Hashtags: 2 to 4, mixing Marathi and English (e.g. #दिवाळी #महाराष्ट्र #Diwali).
""",
    "tribute": """
Format: ONE sentence only, like the past tribute captions:
"<who they were> <name> यांना जयंतीदिनी विनम्र अभिवादन."
Write the person's best-known name as an inline Marathi hashtag inside the sentence
(e.g. #केशवसुत, words joined with _). Use the poster text for who they were.
Hashtags list: empty, or at most 1 Marathi hashtag.
""",
    "solemn": """
Format: ONE sentence only, like the past tribute captions:
"<who they were> <name> यांच्या पुण्यतिथीनिमित्त त्यांच्या पवित्र स्मृतींस भावपूर्ण आदरांजली."
(for Mahaparinirvan Din use "महापरिनिर्वाण दिनी विनम्र अभिवादन").
No 'शुभेच्छा', no celebration words.
Hashtags list: exactly 1 Marathi hashtag of the person's name (e.g. #जयप्रकाश_नारायण).
""",
}


def caption_prompt(festival):
    tone = festival["tone"]
    system = (client_intro(style_kind("festival", tone)) + COMMON_RULES + FORMATS[tone]
              + '\nReturn JSON: {"caption": "...", "hashtags": ["#..."]}')
    poster_text = " ".join(p for p in [festival["line_small"], festival["line_big"],
                                       festival["line_end"].replace("|", " ")] if p)
    user = (
        f"Occasion: {festival['occasion_mr']} ({festival.get('occasion_en', '')})\n"
        f"Date: {festival['date']}\n"
        f"Poster text: {poster_text}\n"
        "Write the caption for this post."
    )
    return system, user


SCENE_SYSTEM = """
You write picture descriptions for an AI image model, in English.
The picture is the BACKGROUND of a Marathi poster for a politician in Maharashtra.
- Describe one clear scene: setting, objects, colours, light, mood. 60-90 words.
- Never ask for any text, letters, logos or living people.
Return JSON: {"scene": "..."}
"""

SCENE_STYLE = {
    "greeting": ("Festive scene using Maharashtrian culture where it fits (wada houses, "
                 "Sahyadri forts, rangoli, akash kandil). Warm, rich colours."),
    "tribute": ("A respectful painted portrait (watercolour / oil painting style) of the "
                "historical personality on the RIGHT side, facing slightly left. Soft warm "
                "cream and light parchment background with gentle texture. The LEFT half must "
                "be plain light cream with nothing in it. A few white frangipani flowers "
                "near the bottom are fine."),
    "solemn": ("A respectful, calm painted portrait of the historical personality on the "
               "RIGHT side. Soft cream parchment background, muted warm tones, peaceful mood. "
               "The LEFT half must be plain light cream. No celebration, no fireworks."),
}


CENTRE_STYLE = ("One festive object or symbol of the occasion in the CENTRE (e.g. a decorated "
                "kalash, diya, idol, flag), on a soft light cream / peach background with a faint "
                "mandala pattern. Marigold garlands or decorations only along the left and right "
                "edges. Top area and the strip below the object plain and light. Warm, bright, clean.")


def scene_prompt(festival, layout="text_right"):
    tone = festival["tone"]
    style = CENTRE_STYLE if (layout == "text_center" and tone == "greeting") else SCENE_STYLE[tone]
    return SCENE_SYSTEM, (
        f"Occasion: {festival.get('occasion_en') or festival['occasion_mr']}\n"
        f"Style: {style}\n"
        f"Hint from the team: {festival.get('image_hint') or 'none'}"
    )