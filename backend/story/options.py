"""The choices a writer makes and the fixed tables of the workflow (from the Story Studio references)."""

# "Film Story" is the older name of the film format. It stays valid so stories already written keep working, but it is no longer offered:
# Short Film and Feature Film replace it.
CONTENT_TYPES = ["Short Story", "Short Film", "Feature Film", "Web Series Pilot", "Advertisement", "Documentary", "Novel Chapter", "Social Media", "Film Story"]
OFFERED_FORMATS = [c for c in CONTENT_TYPES if c != "Film Story"]
# (value kept in the brief, label on the form, one-line hint on the form)
AUDIENCES = [("Children", "Children", "Simple language, gentle humor, nothing graphic."),
             ("Family", "Family audience", "Works for all ages together: mild peril, no strong language."),
             ("Youth", "Youth", "A contemporary voice, honest romance and conflict, nothing explicit."),
             ("Adults", "Adult audience", "Mature themes and darker material when the story needs them.")]
ENDINGS = ["Happy", "Bittersweet", "Tragic", "Open ending", "Twist ending"]
GENRES = ["Action", "Adventure", "Comedy", "Crime", "Drama", "Family", "Fantasy", "Historical", "Horror", "Musical", "Mystery", "Mythological",
          "Political", "Romance", "Sci-Fi", "Social Drama", "Sports", "Supernatural", "Thriller", "War"]
TONES = ["Dark", "Emotional", "Epic", "Feel-good", "Gritty", "Heartwarming", "Hopeful", "Humorous", "Inspirational", "Intense", "Mass / Commercial",
         "Melancholic", "Mysterious", "Nostalgic", "Realistic", "Romantic", "Satirical", "Suspenseful", "Tragic", "Whimsical"]
LANGUAGES = ["English", "Hindi", "Tamil", "Telugu", "Malayalam", "Kannada", "Marathi", "Bengali", "Spanish", "French"]
LENGTHS = ["Short", "Medium", "Long"]
REVISIONS = ["Make it more emotional", "Make the protagonist stronger", "Increase suspense", "Improve the ending", "Make it shorter", "Make it more cinematic"]

STAGES = ["concept", "logline", "characters", "conflict", "ending", "structure", "beats", "outline", "story"]
STAGE_TITLES = {"concept": "Concept", "logline": "Logline", "characters": "Characters", "conflict": "Conflict", "ending": "Ending",
                "structure": "Structure", "beats": "Beats", "outline": "Outline", "story": "Story"}

# the approved stages each stage reads (every stage also reads the whole Story Bible)
STAGE_READS = {
    "concept": [],
    "logline": ["concept"],
    "characters": ["concept", "logline"],
    "conflict": ["logline", "characters"],
    "ending": ["logline", "characters", "conflict"],
    "structure": ["logline", "characters", "conflict", "ending"],
    "beats": ["characters", "conflict", "ending", "structure"],
    "outline": ["characters", "conflict", "ending", "structure", "beats"],
    "story": ["characters", "conflict", "ending", "outline"],
}

# sizes depend on the length
SIZES = {
    "Short": {"words": 1000, "scenes": (8, 12), "beats": 10, "pages": 12},
    "Medium": {"words": 2500, "scenes": (15, 20), "beats": 15, "pages": 30},
    "Long": {"words": 4500, "scenes": (25, 35), "beats": 15, "pages": 90},
}
# Story-like formats get about 250-375 words per outline scene (the old budget gave 80-180, which reads as the outline retold).
# Advertisements and social scripts keep the sizes above. Tune LONGFORM_WORDS after reading a few real stories.
LONGFORM = {"Film Story", "Short Story", "Web Series Pilot", "Novel Chapter", "Documentary"}
LONGFORM_WORDS = {"Short": 3000, "Medium": 5500, "Long": 9000}
MAX_FACTS = 15
MAX_SCENES = 40
WORDS_PER_PAGE = 180
PASS_SCORE = 80

# What each audience means for humor, themes, emotional intensity and language. Given to the model with every prompt when the writer picks one.
AUDIENCE_RULES = {
    "Children": "Simple, warm language and concrete images. Gentle humor. Danger may be real but is never graphic: no gore, no sexual content, no cruelty played for laughs. The ending reassures.",
    "Family": "Suitable for all ages watching together. Humor that works for adults and children alike, mild peril, emotion without graphic violence or sexual content, no strong profanity.",
    "Youth": "Teenagers and young adults. A contemporary voice and humor, real emotional stakes, romance and conflict handled honestly. No gratuitous violence and no explicit sexual content.",
    "Adults": "Mature themes, moral ambiguity, darker material and stronger language are allowed when the story needs them, but nothing gratuitous.",
}

FORMAT_NOTES = {
    "Film Story": "a cinematic prose treatment (present tense, visual, scene-driven)",
    "Short Film": "a cinematic prose treatment of a short film (present tense, visual, scene-driven): one clear storyline, few locations and characters",
    "Feature Film": "a cinematic prose treatment of a feature film (present tense, visual, scene-driven)",
    "Short Story": "literary prose, past tense",
    "Web Series Pilot": "a pilot episode ending on a hook for the season",
    "Novel Chapter": "an immersive opening chapter",
    "Documentary": "narration-led, with interview and archive moments marked",
    "Advertisement": "a brand film or TVC script with the product's role clear",
    "Social Media": "short scripts with a hook in the first line",
}



# Formats whose length and shape differ from the general table above. One script page is about one minute on screen.
# "words" is the story (treatment) text; "scenes" and "beats" size the outline and the beat sheet; "pages" is the screenplay.
FORMAT_SIZES = {
    "Short Film": {
        "Short":  {"words": 1800, "scenes": (5, 8),   "beats": 8,  "pages": 5,  "time": "About 5 minutes on screen"},
        "Medium": {"words": 3000, "scenes": (8, 12),  "beats": 10, "pages": 12, "time": "About 12 minutes on screen"},
        "Long":   {"words": 4500, "scenes": (12, 18), "beats": 15, "pages": 25, "time": "About 25 minutes on screen"},
    },
    "Feature Film": {
        "Short":  {"words": 8000,  "scenes": (28, 34), "beats": 15, "pages": 90,  "time": "About 90 minutes on screen"},
        "Medium": {"words": 9000,  "scenes": (32, 38), "beats": 15, "pages": 105, "time": "About 105 minutes on screen"},
        "Long":   {"words": 10000, "scenes": (36, 40), "beats": 15, "pages": 120, "time": "About 120 minutes on screen"},
    },
    "Advertisement": {
        "Short":  {"words": 250,  "scenes": (3, 5),  "beats": 5, "pages": 1, "time": "About 30 seconds"},
        "Medium": {"words": 500,  "scenes": (4, 7),  "beats": 6, "pages": 2, "time": "About 60 seconds"},
        "Long":   {"words": 1200, "scenes": (6, 10), "beats": 8, "pages": 4, "time": "About 3 minutes (a brand film)"},
    },
}

# How each format is structured. It goes into the Structure stage.
STRUCTURE_HINTS = {
    "default": "Three acts (or the structure that suits the format; for Indian feature films consider two halves with an interval block).",
    "Short Story": "A compact three-part shape (setup, turn, resolution) around one main storyline, with few characters and locations.",
    "Short Film": "Three tight acts for a short running time: one main storyline, few locations and characters, one clear turning point, and an ending that lands fast.",
    "Feature Film": "Three acts, or for an Indian feature film two halves with an interval block, with a midpoint reversal and a clear low point before the finale.",
    "Web Series Pilot": "A cold open, three or four act breaks, and a final beat that opens the question the season will answer.",
    "Advertisement": "Hook, build, the product's moment, payoff and tag line. No subplots.",
    "Documentary": "Chapters: a hook, the central question, three or four chapters that deepen it, and a closing reflection.",
    "Novel Chapter": "One immersive chapter: an opening hook, a rising sequence of scenes, and a closing turn that pulls the reader into the next chapter.",
    "Social Media": "A hook in the first line, one beat of tension, and a payoff in the last line.",
}

# One line per format, shown under the format choice on the form.
FORMAT_SUMMARY = {
    "Short Story": "Literary prose, past tense: one main storyline in a compact three-part shape.",
    "Short Film": "A treatment for a film of 5 to 25 minutes: one storyline, few locations, three tight acts.",
    "Feature Film": "A treatment for a film of 90 to 120 minutes: three acts, or two halves with an interval.",
    "Web Series Pilot": "A pilot episode: a cold open, act breaks, and a hook for the season.",
    "Advertisement": "A film of 30 seconds to 3 minutes: hook, build, the product's moment, payoff.",
    "Documentary": "Narration-led, in chapters, with interview and archive moments marked.",
    "Novel Chapter": "An immersive opening chapter that ends by pulling the reader on.",
    "Social Media": "A short script with a hook in the first line.",
}


def sizes(brief):
    brief = brief or {}
    length = brief.get("length") if brief.get("length") in SIZES else "Medium"
    content_type = brief.get("content_type")
    if content_type in FORMAT_SIZES:
        return FORMAT_SIZES[content_type][length]
    if content_type in LONGFORM:
        return {**SIZES[length], "words": LONGFORM_WORDS[length]}
    return SIZES[length]


def length_text(content_type, length):
    """What Short, Medium or Long means for this format, in plain words (shown on the form and the overview)."""
    s = sizes({"content_type": content_type, "length": length})
    return f"{s['time']} · about {s['words']:,} words" if s.get("time") else f"About {s['words']:,} words"


def format_info():
    return {c: {"summary": FORMAT_SUMMARY.get(c, ""), "lengths": {n: length_text(c, n) for n in LENGTHS}} for c in OFFERED_FORMATS}


def clean_brief(raw):
    """Keep only what the studio understands; values outside the lists are refused with a plain message."""
    raw = raw or {}
    brief = {
        "content_type": raw.get("content_type") or "Short Story",
        "idea": str(raw.get("idea") or "").strip(),
        "genres": [g for g in (raw.get("genres") or []) if g in GENRES],
        "tones": [t for t in (raw.get("tones") or []) if t in TONES],
        "language": raw.get("language") or "English",
        "length": raw.get("length") or "Medium",
    }
    if brief["content_type"] not in CONTENT_TYPES:
        raise ValueError(f"Choose a content type: {', '.join(CONTENT_TYPES)}.")
    if brief["language"] not in LANGUAGES:
        raise ValueError(f"Choose a language: {', '.join(LANGUAGES)}.")
    if brief["length"] not in LENGTHS:
        raise ValueError("Choose a length: Short, Medium or Long.")
    if len(brief["idea"]) < 10:
        raise ValueError("Describe the idea in a sentence or two (at least 10 characters).")
    if len(brief["idea"]) > 4000:
        raise ValueError("The idea is too long. Keep it under 4,000 characters.")
    if not brief["genres"]:
        raise ValueError("Choose at least one genre.")
    if not brief["tones"]:
        raise ValueError("Choose at least one tone.")
    # all optional: a writer never has to fill these
    caps = {"audience": 100, "setting": 300, "preferred_ending": 200, "protagonist_type": 300, "avoid_themes": 600}
    for key in ("characters", "setting", "audience", "brand", "notes", "preferred_ending", "protagonist_type", "avoid_themes"):
        value = str(raw.get(key) or "").strip()
        if value:
            brief[key] = value[:caps.get(key, 2000)]
    return brief