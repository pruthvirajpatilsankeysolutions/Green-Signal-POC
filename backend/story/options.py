"""The choices a writer makes and the fixed tables of the workflow (from the Story Studio references)."""

CONTENT_TYPES = ["Film Story", "Short Story", "Web Series Pilot", "Novel Chapter", "Documentary", "Advertisement", "Social Media"]
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
MAX_FACTS = 15
MAX_SCENES = 40
WORDS_PER_PAGE = 180
PASS_SCORE = 80

FORMAT_NOTES = {
    "Film Story": "a cinematic prose treatment (present tense, visual, scene-driven)",
    "Short Story": "literary prose, past tense",
    "Web Series Pilot": "a pilot episode ending on a hook for the season",
    "Novel Chapter": "an immersive opening chapter",
    "Documentary": "narration-led, with interview and archive moments marked",
    "Advertisement": "a brand film or TVC script with the product's role clear",
    "Social Media": "short scripts with a hook in the first line",
}


def sizes(brief):
    return SIZES.get((brief or {}).get("length"), SIZES["Medium"])


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
    for key in ("characters", "setting", "audience", "brand", "notes"):
        value = str(raw.get(key) or "").strip()
        if value:
            brief[key] = value[:2000]
    return brief
