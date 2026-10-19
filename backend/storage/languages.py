LANGUAGES = {
    "mr": {
        "name": "Marathi",
        "native": "मराठी",
        "script": "Devanagari",
        "digits": "०१२३४५६७८९",
        "default_digits": "native",
        "note": "Write natural, everyday Marathi as people speak it in Maharashtra.",
        "phrases": "",
        "hashtags": "Marathi hashtags with words joined by _ (e.g. #गणपती_बाप्पा_मोरया) and a few English ones",
    },
    "hi": {
        "name": "Hindi",
        "native": "हिन्दी",
        "script": "Devanagari",
        "digits": "०१२३४५६७८९",
        "default_digits": "latin",
        "note": (
            "Write natural, everyday Hindi (not heavily Sanskritised, not Urdu-heavy). "
            "Use Hindi words and spellings only, never Marathi words."
        ),
        "phrases": (
            "Standard Hindi phrases: wishes 'हार्दिक शुभकामनाएं' / 'की हार्दिक बधाई'; tribute "
            "'विनम्र श्रद्धांजलि' / 'शत-शत नमन'; condolence closing 'भावभीनी श्रद्धांजलि! ईश्वर दिवंगत "
            "आत्मा को शांति प्रदान करें।'; congratulation closing 'हार्दिक बधाई और उज्ज्वल भविष्य के लिए "
            "शुभकामनाएं।'"
        ),
        "hashtags": "Hindi hashtags with words joined by _ (e.g. #दीपावली_की_शुभकामनाएं) and a few English ones",
    },
    "en": {
        "name": "English",
        "native": "English",
        "script": "Latin",
        "digits": "",
        "default_digits": "latin",
        "note": "Write warm, simple Indian English. Keep Indian festival and personality names as they are commonly written.",
        "phrases": (
            "Standard English phrases: 'Warm wishes on …'; tribute 'Humble tributes to …'; condolence "
            "closing 'Heartfelt condolences. May the departed soul rest in peace.'; congratulation "
            "closing 'Hearty congratulations and best wishes for the journey ahead.'"
        ),
        "hashtags": "English hashtags in CamelCase (e.g. #HappyDiwali)",
    },
}

DIGIT_STYLES = ["native", "latin"]

# fixed words printed on posters by the templates
POSTER_WORDS = {
    "contact_label": {
        "mr": "अधिक माहितीसाठी संपर्क",
        "hi": "अधिक जानकारी के लिए संपर्क करें",
        "en": "For details, call",
    },
}


def poster_words(code):
    """Fixed poster words in this language (Marathi if missing)."""
    return {k: v.get(code) or v["mr"] for k, v in POSTER_WORDS.items()}


REGIONS = {
    "MH": {
        "label": "Maharashtra",
        "culture": "Maharashtrian culture (wada houses, Sahyadri forts, rangoli, akash kandil)",
    },
    "HI": {
        "label": "Hindi-speaking states (UP, MP, Bihar, Rajasthan, Delhi…)",
        "culture": "North Indian culture (haveli courtyards, ghats, diyas, rangoli, marigold torans)",
    },
    "ALL": {
        "label": "All India",
        "culture": "pan-Indian festive culture (diyas, rangoli, marigolds, torans)",
    },
}


DEFAULT_REGION = {"mr": "MH", "hi": "HI", "en": "ALL"}

_ALL_NATIVE = (
    "०१२३४५६७८९"
    "০১২৩৪৫৬৭৮৯"
    "૦૧૨૩૪૫૬૭૮૯"
    "੦੧੨੩੪੫੬੭੮੯"
    "୦୧୨୩୪୫୬୭୮୯"
    "௦௧௨௩௪௫௬௭௮௯"
    "౦౧౨౩౪౫౬౭౮౯"
    "೦೧೨೩೪೫೬೭೮೯"
    "൦൧൨൩൪൫൬൭൮൯"
    "٠١٢٣٤٥٦٧٨٩"
    "۰۱۲۳۴۵۶۷۸۹"
)

_TO_ASCII = str.maketrans(_ALL_NATIVE, "0123456789" * (len(_ALL_NATIVE) // 10))


def get(code):
    return LANGUAGES.get(code) or LANGUAGES["mr"]


def digit_style(code, style=""):
    """The client's digit style, or the language's usual one."""
    lang = get(code)
    if not lang["digits"]:
        return "latin"
    return style if style in DIGIT_STYLES else lang["default_digits"]


def to_ascii_digits(text):
    return str(text).translate(_TO_ASCII)


def to_local_digits(text, code, style=""):
    """0-9 -> the language's own digits (when the client uses them)."""
    lang = get(code)
    if digit_style(code, style) != "native" or not lang["digits"]:
        return text
    return str(text).translate(str.maketrans("0123456789", lang["digits"]))


def prompt_block(code, second=""):
    """The language instructions every AI prompt gets."""
    lang = get(code)
    lines = [f"Language: {lang['name']} ({lang['native']}). {lang['note']}"]
    if code != "mr":
        lines.append(
            f"Some format examples below are in Marathi: write everything in {lang['name']} instead, "
            f"using the natural {lang['name']} equivalent of each phrase."
        )
    if lang["phrases"]:
        lines.append(lang["phrases"])
    lines.append(f"Hashtags: {lang['hashtags']}.")
    if second and second != code and second in LANGUAGES:
        lines.append(
            f"After the caption, add one short line in {get(second)['name']} with the same message."
        )
    return "\n".join(lines) + "\n"


def public_list():
    return [
        {
            "id": k,
            "name": v["name"],
            "native": v["native"],
            "has_native_digits": bool(v["digits"]),
            "default_digits": v["default_digits"],
            "default_region": DEFAULT_REGION[k],
        }
        for k, v in LANGUAGES.items()
    ]


def regions_list():
    return [{"id": k, "label": v["label"]} for k, v in REGIONS.items()]
