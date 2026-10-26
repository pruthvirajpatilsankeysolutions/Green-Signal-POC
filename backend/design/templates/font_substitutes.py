"""
Close-looking open fonts for fonts a template uses but the app doesn't have (often Canva's commercial
fonts). Used on import so a template never falls back to the browser's plain default font; the editor
shows each replacement and lets the user upload the original font file instead.
"""
import re

# common Canva / designer fonts -> the closest font the app ships (all open-licence)
KNOWN = {
    "itc benguiat": "Playfair Display", "benguiat": "Playfair Display", "cooper": "Playfair Display", "recoleta": "Playfair Display",
    "itc souvenir": "Playfair Display", "souvenir": "Playfair Display", "tan meringue": "Playfair Display", "hello paris": "Playfair Display", "kulachat serif": "Playfair Display", "the seasons": "Playfair Display",
    "lustria": "Playfair Display", "imbue": "Playfair Display", "bodoni": "Playfair Display",
    "didot": "Playfair Display", "garamond": "Playfair Display", "cormorant": "Playfair Display", "dm serif": "Playfair Display",
    "libre baskerville": "Playfair Display", "lora": "Playfair Display", "fraunces": "Playfair Display",
    "respondent": "Great Vibes", "alex brush": "Great Vibes", "allura": "Great Vibes", "brittany": "Great Vibes",
    "sacramento": "Great Vibes", "parisienne": "Great Vibes", "pinyon": "Great Vibes", "playlist": "Great Vibes",
    "dancing": "Dancing Script", "pacifico": "Pacifico", "lobster": "Lobster",
    "garet": "Montserrat", "glacial": "Montserrat", "canva sans": "Open Sans", "open sauce": "Open Sans",
    "league spartan": "Montserrat", "lumberjack": "Montserrat", "muli": "Montserrat", "mulish": "Montserrat",
    "roboto": "Montserrat", "open sans": "Montserrat", "lato": "Montserrat", "inter": "Montserrat", "raleway": "Montserrat",
    "arimo": "Montserrat", "arial": "Montserrat", "helvetica": "Montserrat", "now": "Montserrat",
    "barlow condensed": "Oswald", "barlow semicondensed": "Oswald", "anton": "Oswald", "league gothic": "Oswald",
    "bebas": "Bebas Neue", "archivo black": "Oswald",
}
RULES = [  # name words -> style
    (r"script|brush|signature|hand|calligra|scribble|ink|pen\b", "Great Vibes"),
    (r"condensed|narrow|compressed|gothic", "Oswald"),
    (r"serif|display|didone|roman|elegan|classic|luxury", "Playfair Display"),
]


def substitute(family, available):
    """The closest available font for a missing one (never the browser's default)."""
    name = (family or "").strip().lower()
    for key, sub in KNOWN.items():
        if re.search(rf"\b{re.escape(key)}\b", name) and sub in available:     # whole words: "now" must not match "unknown"
            return sub
    for pattern, sub in RULES:
        if re.search(pattern, name) and sub in available and not re.search(r"sans", name):
            return sub
    return "Montserrat" if "Montserrat" in available else sorted(available)[0]
