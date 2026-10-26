"""
Prompts for festival / jayanti / punyatithi posts.
"""

from posts import COMMON_RULES, client_intro, style_kind
from storage.clients import current
from storage.languages import REGIONS, get as language

FORMATS = {
    "greeting": """
Format, like the client's real festival captions. Pick the shape that suits the occasion:
A) Short: one warm wishes line, e.g. "गणेशोत्सवाच्या सर्वांना हार्दिक शुभेच्छा!"
B) Header + meaning + wishes: the occasion name with "..." (e.g. "बैल पोळा..."), then one
   warm sentence about what the day honours, ending with "...", then the wishes line.
C) Devotional verse (for deity festivals): 3 to 5 short poetic lines addressed to the deity,
   then the wishes line ending with "...".
Use a blank line between parts. Use "..." (three dots) and "!" like the past captions.
Address people the way he does: "सर्वांना", "समस्त महाराष्ट्रवासीयांना", "सर्व शेतकरी बांधवांना".
If the day is also a special national day, add one line about it (like the Engineers Day example).
Write in {LANG} (for Hindi Divas, Hindi is also fine).
Hashtags: 1 to 5, mostly {LANG} with words joined by _ (the Marathi examples show the style);
an English one is fine.
""",
    "tribute": """
Format, like the client's real jayanti captions: usually ONE sentence, then hashtags.
"<who they were, from the poster> <titles and name as inline {LANG} hashtags>
 यांना जयंतीदिनी / यांच्या जयंतीनिमित्त <closing>"
- Write titles and the name as inline hashtags, words joined with _ :
  e.g. #भारतरत्न #लाल_बहादुर_शास्त्री, #कर्मवीर #भाऊराव_पाटील, #राष्ट्रपिता #महात्मा_गांधी
- Use the SAME closing words as the poster's last line. His closings:
  "विनम्र अभिवादन" (most people), "कोटी कोटी प्रणाम" (very revered leaders),
  "भावपूर्ण आदरांजली" (the departed great), "त्यांच्या चरणी साष्टांग दंडवत" (saints),
  "त्यांच्या महान जीवनकार्याला विनम्र अभिवादन".
- If the day is also a special day (e.g. Engineers Day), add a second short paragraph with wishes.
Hashtags list (after a blank line): 1 to 3, e.g. the full name in {LANG} with _ and/or in
English CamelCase (e.g. #LalBahadurShastri, #GandhiJayanti).
""",
    "solemn": """
Format, like the client's real punyatithi captions: usually ONE sentence, then hashtags.
"<who they were> <titles and name as inline {LANG} hashtags>
 यांच्या पुण्यतिथीनिमित्त त्यांच्या पवित्र स्मृतींस भावपूर्ण आदरांजली."
or "... यांना पुण्यतिथी निमित्त कोटी कोटी प्रणाम..." (very revered).
For Mahaparinirvan Din use "महापरिनिर्वाण दिनी विनम्र अभिवादन".
Use the SAME closing words as the poster's last line.
Optional first line: the occasion with "..." (e.g. "अहिल्यादेवी होळकर पुण्यतिथी (तिथीनुसार)...").
No 'शुभेच्छा', no celebration words.
Hashtags list: 1 to 2, the person's name in {LANG} with _ and/or in English CamelCase.
""",
}


def formats(tone):
    """The format notes for a tone, in the current client's language."""
    return FORMATS[tone].replace("{LANG}", language(current()["language"])["name"])


POSTER_LINES = """
The calendar has no poster text in this language, so also write the words printed ON the poster:
- line_small: a short line above the title, max 45 letters (use | for a line break)
- line_big: the big title naming the occasion, 1 or 2 words, max 18 letters
- line_end: the closing wishes line, max 45 letters
Poster lines are plain words only: no hashtags, no @handles, no emojis (those belong in the caption).
"""


def caption_prompt(festival):
    tone = festival["tone"]
    needs_text = festival.get("needs_text")
    shape = ('{"caption": "...", "hashtags": ["#..."], "poster": {"line_small": "...", "line_big": "...", "line_end": "..."}}'
             if needs_text else '{"caption": "...", "hashtags": ["#..."]}')
    system = (
        client_intro(style_kind("festival", tone))
        + COMMON_RULES
        + formats(tone)
        + (POSTER_LINES if needs_text else "")
        + f"\nReturn JSON: {shape}"
    )
    poster_text = " ".join(
        p
        for p in [
            festival["line_small"],
            festival["line_big"],
            festival["line_end"].replace("|", " "),
        ]
        if p
    )
    user = (
        f"Occasion: {festival['occasion_mr']} ({festival.get('occasion_en', '')})\n"
        f"Date: {festival['date']}\n"
        f"Poster text: {poster_text or '(none yet)'}\n"
        + (f"Poster's last line (use the same closing words): {festival['line_end'].replace('|', ' ')}\n"
           if festival["line_end"] else "")
        + "Write the caption for this post."
    )
    return system, user


SCENE_SYSTEM = """
You write picture descriptions for an AI image model, in English.
The picture is the BACKGROUND of a social media poster for an Indian client.
- Describe one clear scene: setting, objects, colours, light, mood. 60-90 words.
- Never ask for any text, letters, logos or living people.
Return JSON: {"scene": "..."}
"""

SCENE_STYLE = {
    "greeting": (
        "Festive scene using {CULTURE} where it fits. Warm, rich colours."
    ),
    "tribute": (
        "A respectful painted portrait (watercolour / oil painting style) of the "
        "historical personality on the RIGHT side, facing slightly left. Soft warm "
        "cream and light parchment background with gentle texture. The LEFT half must "
        "be plain light cream with nothing in it. A few white frangipani flowers "
        "near the bottom are fine."
    ),
    "solemn": (
        "A respectful, calm painted portrait of the historical personality on the "
        "RIGHT side. Soft cream parchment background, muted warm tones, peaceful mood. "
        "The LEFT half must be plain light cream. No celebration, no fireworks."
    ),
}


CENTRE_STYLE = (
    "One festive object or symbol of the occasion in the CENTRE (e.g. a decorated "
    "kalash, diya, idol, flag), on a soft light cream / peach background with a faint "
    "mandala pattern. Marigold garlands or decorations only along the left and right "
    "edges. Top area and the strip below the object plain and light. Warm, bright, clean."
)


def scene_prompt(festival, layout="text_right"):
    tone = festival["tone"]
    style = (
        CENTRE_STYLE
        if (layout == "text_center" and tone == "greeting")
        else SCENE_STYLE[tone]
    )
    style = style.replace("{CULTURE}", REGIONS.get(current()["region"], REGIONS["ALL"])["culture"])
    return SCENE_SYSTEM, (
        f"Occasion: {festival.get('occasion_en') or festival['occasion_mr']}\n"
        f"Style: {style}\n"
        f"Hint from the team: {festival.get('image_hint') or 'none'}"
    )