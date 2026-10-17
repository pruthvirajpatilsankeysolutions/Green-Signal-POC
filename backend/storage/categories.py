POST_TYPES = {
    "greetings": {
        "label": "Festival greetings",
        "description": "Diwali, Ganeshotsav, Gudhi Padwa, special days",
        "page": "festivals",
        "tone": "greeting",
    },
    "tributes": {
        "label": "Jayanti tributes",
        "description": "Birth anniversaries of great personalities",
        "page": "festivals",
        "tone": "tribute",
    },
    "remembrance": {
        "label": "Punyatithi / remembrance",
        "description": "Death anniversaries, Martyrs' Day",
        "page": "festivals",
        "tone": "solemn",
    },
    "events": {
        "label": "Events",
        "description": "Inaugurations, camps, meetings, celebrations with photos",
        "page": "events",
        "tone": None,
    },
    "reactions": {
        "label": "News reactions",
        "description": "Congratulations and condolences on news",
        "page": "reactions",
        "tone": None,
    },
    # made on the "Create post" page
    "announcement": {
        "label": "Announcement",
        "description": "Notices, admissions, timings, schedules, appeals",
        "page": "create",
        "tone": None,
    },
    "offer": {
        "label": "Offer",
        "description": "Discounts, product showcase, launches",
        "page": "create",
        "tone": None,
    },
    "achievement": {
        "label": "Achievement",
        "description": "Development work, toppers, impact numbers, awards",
        "page": "create",
        "tone": None,
    },
    "spotlight": {
        "label": "Person spotlight",
        "description": "Doctor intro, teacher, volunteer, worker birthday",
        "page": "create",
        "tone": None,
    },
}

CATEGORIES = {
    "politician": {
        "label": "Politician",
        "description": "Leader, MLA, MP or party office: greetings, tributes, events and news reactions.",
        "post_types": ["greetings", "tributes", "remembrance", "events", "reactions", "announcement", "achievement", "spotlight"],
        "voice": "formal and respectful, like a public leader speaking to citizens",
        "rules": "",
    },
    "business": {
        "label": "Business",
        "description": "Shop, restaurant, bakery or brand: festival greetings with logo, phone and address, and events.",
        "post_types": ["greetings", "events", "offer", "announcement", "spotlight"],
        "voice": "warm, friendly and inviting, like a trusted local shop talking to its customers",
        "rules": "- Never invent prices, discounts, offers or opening hours. Use only what is given.\n",
    },
    "school": {
        "label": "School / college",
        "description": "Festival greetings, jayanti tributes, school events and student achievements.",
        "post_types": ["greetings", "tributes", "events", "reactions", "announcement", "achievement", "spotlight"],
        "voice": "proud, warm and encouraging, like a school speaking to parents and students",
        "rules": "- Never mention a student's marks, health or family details unless they are given.\n",
    },
    "hospital": {
        "label": "Hospital / clinic",
        "description": "Festival and health-day greetings, health camps and events.",
        "post_types": ["greetings", "events", "announcement", "spotlight"],
        "voice": "caring, calm and informative, like a trusted doctor",
        "rules": (
            "- Never promise cures or results, never claim to be the best or cheapest, "
            "and never give medical advice beyond general awareness.\n"
        ),
    },
    "ngo": {
        "label": "NGO / social organisation",
        "description": "Special-day greetings, tributes, drives and events, and news reactions.",
        "post_types": ["greetings", "tributes", "remembrance", "events", "reactions", "announcement", "achievement", "spotlight"],
        "voice": "hopeful, sincere and community-minded",
        "rules": "- Never invent donation amounts, beneficiary numbers or bank / UPI details.\n",
    },
    "personal": {
        "label": "Personal brand",
        "description": "Professional, artist or influencer: greetings, events and reactions.",
        "post_types": ["greetings", "tributes", "events", "reactions", "announcement", "achievement"],
        "voice": "personal, warm and genuine, in first person",
        "rules": "",
    },
}

# caption example types used by each post type (shown on the Clients page)
STYLE_KINDS_FOR = {
    "greetings": ["greeting"],
    "tributes": ["tribute"],
    "remembrance": ["solemn"],
    "events": ["event"],
    "reactions": ["congratulate", "condolence"],
    "announcement": ["announcement"],
    "offer": ["offer"],
    "achievement": ["achievement"],
    "spotlight": ["spotlight"],
}

# older clients saved as "institution" behave like a school until changed
ALIASES = {"institution": "school"}


def category(client_type):
    """Settings for a client category (falls back to politician)."""
    return CATEGORIES.get(
        ALIASES.get(client_type, client_type), CATEGORIES["politician"]
    )


def clean_post_types(post_types):
    """Keep only known post types, in a fixed order."""
    chosen = set(post_types or [])
    return [t for t in POST_TYPES if t in chosen]


def access(client):
    """What a client can create: its ticked post types (or its category's suggestion)."""
    types = (
        clean_post_types(client.get("post_types"))
        or category(client["type"])["post_types"]
    )
    return {
        "post_types": types,
        "pages": sorted({POST_TYPES[t]["page"] for t in types}),
        "tones": [POST_TYPES[t]["tone"] for t in types if POST_TYPES[t]["tone"]],
        "style_kinds": [k for t in types for k in STYLE_KINDS_FOR.get(t, [])],
    }


def public_list():
    """Categories for the dashboard (what to show when choosing one)."""
    return [
        {
            "id": k,
            "label": v["label"],
            "description": v["description"],
            "post_types": v["post_types"],
        }
        for k, v in CATEGORIES.items()
    ]


def post_type_list():
    return [
        {"id": k, "label": v["label"], "description": v["description"]}
        for k, v in POST_TYPES.items()
    ]