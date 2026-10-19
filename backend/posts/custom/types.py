"""
The new post types made on the "Create post" page.

Each type lists the form fields the team fills in. Facts (names, prices, dates, numbers)
come ONLY from these fields; fields marked "printed" are put on the poster exactly as typed,
so they must be written in the client's post language. The AI writes only the headline and
the caption around them.

Labels, badges and placeholders exist in every post language (mr / hi / en).
"""

ANNOUNCEMENT_KINDS = {
    "notice": {
        "mr": "महत्त्वाची सूचना",
        "hi": "महत्वपूर्ण सूचना",
        "en": "Important notice",
    },
    "admission": {"mr": "प्रवेश सुरू", "hi": "प्रवेश प्रारंभ", "en": "Admissions open"},
    "event": {"mr": "कार्यक्रम", "hi": "कार्यक्रम", "en": "Event"},
    "schedule": {
        "mr": "दौरा / वेळापत्रक",
        "hi": "दौरा / समय-सारणी",
        "en": "Visit / schedule",
    },
    "appeal": {"mr": "आवाहन", "hi": "अपील", "en": "Appeal"},
    "timing": {"mr": "वेळेत बदल", "hi": "समय में बदलाव", "en": "Change in timings"},
}
SPOTLIGHT_OCCASIONS = {
    "introduction": {"mr": "ओळख", "hi": "परिचय", "en": "Introducing"},
    "birthday": {
        "mr": "वाढदिवसाच्या हार्दिक शुभेच्छा!",
        "hi": "जन्मदिन की हार्दिक शुभकामनाएं!",
        "en": "Happy Birthday!",
    },
    "month": {
        "mr": "या महिन्याचे मानकरी",
        "hi": "इस माह के सम्मानित",
        "en": "Star of the month",
    },
    "thanks": {"mr": "मनःपूर्वक आभार", "hi": "हार्दिक आभार", "en": "Heartfelt thanks"},
}

# fixed words printed on posters, per language
POSTER_TEXT = {
    "offer_until": {
        "mr": "ऑफर {date}पर्यंत",
        "hi": "ऑफर {date} तक",
        "en": "Offer valid till {date}",
    },
}

TYPES = {
    "announcement": {
        "label": "Announcement",
        "description": "Notices, admissions, timings, schedules, appeals",
        "template": "announcement.html",
        "photo": "optional",
        "fields": [
            {
                "key": "kind",
                "label": "Kind (printed as the badge)",
                "kind": "select",
                "required": True,
                "printed": True,
                "options": ANNOUNCEMENT_KINDS,
            },
            {
                "key": "topicmake_post",
                "label": "What is it about?",
                "kind": "text",
                "required": True,
                "printed": False,
                "placeholder": {
                    "mr": "प्रवेश प्रक्रिया २०२७-२८",
                    "hi": "प्रवेश प्रक्रिया 2027-28",
                    "en": "Admissions 2027-28",
                },
            },
            {
                "key": "details",
                "label": "Details (one per line, 2 to 4 lines)",
                "kind": "textarea",
                "required": True,
                "printed": True,
                "placeholder": {
                    "mr": "इयत्ता १ ते १० साठी प्रवेश\nअर्ज शाळेच्या कार्यालयात उपलब्ध\nआवश्यक कागदपत्रे: जन्म दाखला, फोटो",
                    "hi": "कक्षा 1 से 10 के लिए प्रवेश\nफॉर्म स्कूल कार्यालय में उपलब्ध\nज़रूरी दस्तावेज़: जन्म प्रमाण पत्र, फोटो",
                    "en": "Admissions for classes 1 to 10\nForms available at the school office\nDocuments: birth certificate, photo",
                },
            },
            {
                "key": "when",
                "label": "Date / time",
                "kind": "text",
                "printed": True,
                "placeholder": {
                    "mr": "१ ते ३० नोव्हेंबर, सकाळी १० ते २",
                    "hi": "1 से 30 नवंबर, सुबह 10 से 2",
                    "en": "1 to 30 November, 10 am to 2 pm",
                },
            },
            {
                "key": "place",
                "label": "Place",
                "kind": "text",
                "printed": True,
                "placeholder": {
                    "mr": "शाळेचे कार्यालय, शिवाजीनगर",
                    "hi": "स्कूल कार्यालय, विजय नगर",
                    "en": "School office, Shivajinagar",
                },
            },
            {
                "key": "contact",
                "label": "Contact",
                "kind": "text",
                "printed": True,
                "placeholder": {
                    "mr": "98220 12345",
                    "hi": "98220 12345",
                    "en": "98220 12345",
                },
            },
        ],
    },
    "offer": {
        "label": "Offer",
        "description": "Discounts, product showcase, launches",
        "template": "offer.html",
        "photo": "recommended",
        "fields": [
            {
                "key": "product",
                "label": "Product / service",
                "kind": "text",
                "required": True,
                "printed": True,
                "placeholder": {
                    "mr": "दिवाळी स्पेशल गिफ्ट बॉक्स",
                    "hi": "दीपावली स्पेशल गिफ्ट बॉक्स",
                    "en": "Diwali special gift box",
                },
            },
            {
                "key": "offer",
                "label": "Offer",
                "kind": "text",
                "required": True,
                "printed": True,
                "placeholder": {"mr": "२०% सवलत", "hi": "20% छूट", "en": "20% off"},
            },
            {
                "key": "price",
                "label": "Price",
                "kind": "text",
                "printed": True,
                "placeholder": {"mr": "₹४९९", "hi": "₹499", "en": "₹499"},
            },
            {
                "key": "valid_till",
                "label": "Valid till",
                "kind": "text",
                "printed": True,
                "placeholder": {
                    "mr": "१५ नोव्हेंबर",
                    "hi": "15 नवंबर",
                    "en": "15 November",
                },
            },
            {
                "key": "note",
                "label": "Anything else to mention",
                "kind": "textarea",
                "printed": True,
                "placeholder": {
                    "mr": "होम डिलिव्हरी उपलब्ध",
                    "hi": "होम डिलीवरी उपलब्ध",
                    "en": "Home delivery available",
                },
            },
        ],
    },
    "achievement": {
        "label": "Achievement",
        "description": "Development work, toppers, impact numbers, awards",
        "template": "achievement.html",
        "photo": "optional",
        "fields": [
            {
                "key": "title",
                "label": "What was achieved?",
                "kind": "text",
                "required": True,
                "printed": True,
                "placeholder": {
                    "mr": "प्रभागातील रस्त्यांचे काम पूर्ण",
                    "hi": "वार्ड की सड़कों का काम पूरा",
                    "en": "Ward road work completed",
                },
            },
            {
                "key": "stats",
                "label": "Numbers (1 to 3)",
                "kind": "stats",
                "required": True,
                "printed": True,
                "placeholder": {
                    "mr": [
                        ["₹१२ कोटी", "निधी"],
                        ["१२", "रस्ते"],
                        ["८ महिने", "कालावधी"],
                    ],
                    "hi": [
                        ["₹12 करोड़", "निधि"],
                        ["12", "सड़कें"],
                        ["8 महीने", "अवधि"],
                    ],
                    "en": [
                        ["₹12 crore", "fund"],
                        ["12", "roads"],
                        ["8 months", "duration"],
                    ],
                },
            },
            {
                "key": "details",
                "label": "Short details",
                "kind": "textarea",
                "printed": True,
                "placeholder": {
                    "mr": "१२ रस्ते, ८ महिन्यांत पूर्ण",
                    "hi": "12 सड़कें, 8 महीनों में पूरी",
                    "en": "12 roads, completed in 8 months",
                },
            },
        ],
    },
    "spotlight": {
        "label": "Person spotlight",
        "description": "Doctor intro, teacher, volunteer, worker birthday",
        "template": "spotlight.html",
        "photo": "required",
        "fields": [
            {
                "key": "occasion",
                "label": "Occasion (printed as the badge)",
                "kind": "select",
                "required": True,
                "printed": True,
                "options": SPOTLIGHT_OCCASIONS,
            },
            {
                "key": "name",
                "label": "Name (as it should appear)",
                "kind": "text",
                "required": True,
                "printed": True,
                "placeholder": {
                    "mr": "डॉ. स्नेहा जोशी",
                    "hi": "डॉ. स्नेहा जोशी",
                    "en": "Dr. Sneha Joshi",
                },
            },
            {
                "key": "role",
                "label": "Role",
                "kind": "text",
                "required": True,
                "printed": True,
                "placeholder": {
                    "mr": "हृदयरोगतज्ञ",
                    "hi": "हृदय रोग विशेषज्ञ",
                    "en": "Cardiologist",
                },
            },
            {
                "key": "about",
                "label": "About them (1 to 3 lines)",
                "kind": "textarea",
                "printed": True,
                "placeholder": {
                    "mr": "१५ वर्षांचा अनुभव\nOPD: सोमवार ते शनिवार, सकाळी १० ते २",
                    "hi": "15 वर्षों का अनुभव\nOPD: सोमवार से शनिवार, सुबह 10 से 2",
                    "en": "15 years of experience\nOPD: Monday to Saturday, 10 am to 2 pm",
                },
            },
            {
                "key": "consent",
                "label": "This person agreed to be featured",
                "kind": "checkbox",
                "required": True,
                "printed": False,
            },
        ],
    },
}


def text_in(options, lang):
    """A word or phrase in the client's language (Marathi if that language is missing)."""
    return options.get(lang) or options.get("mr", "")


def kind_label(kind, lang):
    return text_in(ANNOUNCEMENT_KINDS.get(kind, {}), lang)


def occasion_label(occasion, lang):
    return text_in(SPOTLIGHT_OCCASIONS.get(occasion, {}), lang)


def public(ptype, lang="mr"):
    """A post type for the Create-post page, with labels and placeholders in the client's language."""
    t = TYPES[ptype]
    fields = []
    for f in t["fields"]:
        out = {k: v for k, v in f.items() if k not in ("options", "placeholder")}
        if "options" in f:
            out["options"] = [
                {
                    "value": k,
                    "label": (
                        text_in(v, lang)
                        if lang == "en"
                        else f"{text_in(v, lang)} · {v['en']}"
                    ),
                }
                for k, v in f["options"].items()
            ]
        if "placeholder" in f:
            out["placeholder"] = text_in(f["placeholder"], lang)
        fields.append(out)
    return {
        "id": ptype,
        "label": t["label"],
        "description": t["description"],
        "photo": t["photo"],
        "fields": fields,
    }
