ANNOUNCEMENT_KINDS = {
    "notice": "महत्त्वाची सूचना",
    "admission": "प्रवेश सुरू",
    "event": "कार्यक्रम",
    "schedule": "दौरा / वेळापत्रक",
    "appeal": "आवाहन",
    "timing": "वेळेत बदल",
}

SPOTLIGHT_OCCASIONS = {
    "introduction": "ओळख",
    "birthday": "वाढदिवसाच्या हार्दिक शुभेच्छा!",
    "month": "या महिन्याचे मानकरी",
    "thanks": "मनःपूर्वक आभार",
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
                "label": "Kind",
                "kind": "select",
                "required": True,
                "options": [
                    {"value": k, "label": v} for k, v in ANNOUNCEMENT_KINDS.items()
                ],
            },
            {
                "key": "topic",
                "label": "What is it about?",
                "kind": "text",
                "required": True,
                "placeholder": "प्रवेश प्रक्रिया २०२७-२८",
            },
            {
                "key": "details",
                "label": "Details (one per line, 2 to 4 lines)",
                "kind": "textarea",
                "required": True,
                "placeholder": "इयत्ता १ ते १० साठी प्रवेश\nअर्ज शाळेच्या कार्यालयात उपलब्ध\nआवश्यक कागदपत्रे: जन्म दाखला, फोटो",
            },
            {
                "key": "when",
                "label": "Date / time",
                "kind": "text",
                "placeholder": "१ ते ३० नोव्हेंबर, सकाळी १० ते २",
            },
            {
                "key": "place",
                "label": "Place",
                "kind": "text",
                "placeholder": "शाळेचे कार्यालय, शिवाजीनगर",
            },
            {
                "key": "contact",
                "label": "Contact",
                "kind": "text",
                "placeholder": "98220 12345",
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
                "placeholder": "दिवाळी स्पेशल गिफ्ट बॉक्स",
            },
            {
                "key": "offer",
                "label": "Offer (printed exactly as typed)",
                "kind": "text",
                "required": True,
                "placeholder": "२०% सवलत",
            },
            {"key": "price", "label": "Price", "kind": "text", "placeholder": "₹४९९"},
            {
                "key": "valid_till",
                "label": "Valid till",
                "kind": "text",
                "placeholder": "१५ नोव्हेंबर",
            },
            {
                "key": "note",
                "label": "Anything else to mention",
                "kind": "textarea",
                "placeholder": "होम डिलिव्हरी उपलब्ध",
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
                "placeholder": "प्रभागातील रस्त्यांचे काम पूर्ण",
            },
            {
                "key": "stats",
                "label": "Numbers (1 to 3, printed exactly as typed)",
                "kind": "stats",
                "required": True,
            },
            {
                "key": "details",
                "label": "Short details",
                "kind": "textarea",
                "placeholder": "१२ रस्ते, ८ महिन्यांत पूर्ण",
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
                "label": "Occasion",
                "kind": "select",
                "required": True,
                "options": [
                    {"value": k, "label": v} for k, v in SPOTLIGHT_OCCASIONS.items()
                ],
            },
            {
                "key": "name",
                "label": "Name (as it should appear)",
                "kind": "text",
                "required": True,
                "placeholder": "डॉ. स्नेहा जोशी",
            },
            {
                "key": "role",
                "label": "Role",
                "kind": "text",
                "required": True,
                "placeholder": "हृदयरोगतज्ञ",
            },
            {
                "key": "about",
                "label": "About them (1 to 3 lines)",
                "kind": "textarea",
                "placeholder": "१५ वर्षांचा अनुभव\nOPD: सोमवार ते शनिवार, सकाळी १० ते २",
            },
            {
                "key": "consent",
                "label": "This person agreed to be featured",
                "kind": "checkbox",
                "required": True,
            },
        ],
    },
}


def public(ptype):
    t = TYPES[ptype]
    return {
        "id": ptype,
        "label": t["label"],
        "description": t["description"],
        "photo": t["photo"],
        "fields": t["fields"],
    }
