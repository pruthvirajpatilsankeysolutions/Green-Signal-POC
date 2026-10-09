"""
Client settings. Edit this file once for each client.
"""
import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / ".env")

# ---------- folders ----------
DATA_DIR = ROOT / "data"
ASSETS_DIR = ROOT / "assets"
OUTPUT_DIR = ROOT / "output"
TEMPLATES_DIR = ROOT / "design" / "templates"

# ---------- AI models ----------
CLAUDE_MODEL = os.getenv("CLAUDE_MODEL", "claude-sonnet-5-5")
IMAGE_MODEL = os.getenv("IMAGE_MODEL", "gpt-image-2")
IMAGE_QUALITY = os.getenv("IMAGE_QUALITY", "medium")   # low / medium / high

# ---------- poster sizes (width, height) ----------
SIZES = {
    "feed": (1080, 1080),    # square post, same as the client's Instagram posters
    "story": (1080, 1920),   # Instagram / WhatsApp story (9:16)
}

# Leader photo in the banner is a chest-up crop, like the client's posts.
# Part of the photo height kept from the top (0.58 = head to chest).
# Increase (e.g. 0.7) to show more body, decrease (e.g. 0.5) for a bigger face.
LEADER_BUST = 0.58

# Event posts: "photo" = real photos only, no banner, no text (like the client's
# news posts). "banner" = banner on every photo + event title on the first one.
EVENT_STYLE = "photo"

# Captions use Marathi digits (५-१, २०२६) like the client's posts.
# Hashtags keep English digits (#AsianGames2026).
USE_MARATHI_DIGITS = True

# ---------- the client ----------
CLIENT = {
    "name": "एकनाथ संभाजी शिंदे",
    "designation_lines": [
        "उप-मुख्यमंत्री, महाराष्ट्र राज्य",
        "शिवसेना",
    ],
    "handle": "/mieknathshinde",
    "logo": "assets/logo/logo.png",
    # Ready-made footer banner (logo + name + designation).
    # Leave "" to build the footer from name/designation/logo above.
    "footer_image": "assets/footer/footer_banner.png",
    "leader_photos_dir": "assets/leader",
    "accent_color": "#F26B0F",
    "fixed_hashtags": [],
    # Real past captions, grouped by post type. The AI copies the style of
    # the matching group. Add more real captions over time.
    "style_examples": {
        "tribute": [
            "आधुनिक मराठी काव्याचे प्रवर्तक व मराठी साहित्यात सौंदर्यवादी दृष्टिकोन "
            "आणणारे थोर मराठी कवी कृष्णाजी केशव दामले तथा कवी #केशवसुत यांना "
            "जयंतीदिनी विनम्र अभिवादन.",
            "#भारतरत्न किताबाने सन्मानित करण्यात आलेले ज्येष्ठ स्वातंत्र्यसैनिक आणि "
            "सर्वोदय चळवळीचे प्रमुख नेते “जयप्रकाश नारायण” यांच्या पुण्यतिथीनिमित्त "
            "त्यांच्या पवित्र स्मृतींस भावपूर्ण आदरांजली.\n\n#जयप्रकाश_नारायण",
        ],
        "greeting": [
            "समस्त मराठीजनांना #अभिजात_मराठी भाषा दिनाच्या हार्दिक शुभेच्छा…\n\n"
            "मराठी भाषेला ३ ऑक्टोबर २०२४ रोजी ‘अभिजात भाषा’ म्हणून दर्जा देण्याचा "
            "ऐतिहासिक निर्णय घेण्यात आला. मराठी भाषेचा खऱ्या अर्थाने सन्मान झाला.\n\n"
            "मराठीच्या संपन्न परंपरेची पालखी अभिमानाने खांद्यावर घेऊन ती पुढे "
            "नेणाऱ्या मराठीजनांना मराठी अभिजात भाषा दिनाच्या हार्दिक शुभेच्छा…\n\n"
            "#मराठी #महाराष्ट्र #Marathi #Maharashtra",
        ],
        "congratulate": [
            "भारतीय कुस्तीपटूंची घोडदौड सुरूच…\n\n"
            "पुरुषांच्या ९७ किलो फ्रीस्टाइल प्रकारात दीपक पुनियाचे कांस्यपदक…\n\n"
            "भारताच्या दीपक पुनियाने आशियाई क्रीडा स्पर्धा २०२६ मध्ये पुरुषांच्या "
            "९७ किलो फ्रीस्टाइल कुस्ती प्रकारात मंगोलियाच्या गंखुयाग गंबातरला २-१ ने "
            "पराभूत करून कांस्यपदक पटकावले.\n\n"
            "संयमाचे उत्तम उदाहरण स्थापित करत नेत्रदीपक कामगिरी बजावणाऱ्या दीपक "
            "पुनियाचे मनःपूर्वक अभिनंदन आणि पुढील वाटचालीसाठी हार्दिक शुभेच्छा.\n\n"
            "#AsianGames2026 #India #Wrestling #BronzeMedal #Cheer4Bharat",
            "जय हिंद…\n\n"
            "भारतीय पुरुष क्रिकेट संघाने देखील देशासाठी कमावले अजून एक सुवर्णपदक…\n\n"
            "आशियाई क्रीडा स्पर्धा २०२६ मध्ये पुरुष क्रिकेट संघाने पाकिस्तानी संघाचा "
            "दारुण पराभव करत सुवर्णपदकावर मोहोर उमटवली आहे.\n\n"
            "भारतीय क्रिकेट संघाचे मनःपूर्वक अभिनंदन आणि पुढील कारकीर्दीकरता "
            "हार्दिक शुभेच्छा.",
        ],
        "condolence": [
            "महाराष्ट्राचा स्वाभिमान आणि मराठी माणसाचा अभिमान आज हरपला.\n\n"
            "रंगभूमी आणि चित्रपट क्षेत्रात अभिनयाची उत्तुंग शिखरे गाठणाऱ्या, "
            "स्वतःची स्वतंत्र शैली निर्माण करणाऱ्या व प्रखर सामाजिक जाणिवा "
            "जपणाऱ्या कलाकाराचे निधन हा महाराष्ट्रासाठी फार मोठा धक्का आहे.\n\n"
            "महाराष्ट्राचा बुलंद, बाणेदार आवाज शांत झाला आहे. ही हानी कधीही "
            "भरून न येणारी आहे.\n\n"
            "भावपूर्ण श्रद्धांजली! ईश्वर त्यांच्या आत्म्यास सद्गती देवो.",
        ],
        "event": [
            "आज मतदारसंघातील नवीन आरोग्य केंद्राचे उद्घाटन केले. या केंद्रामुळे "
            "परिसरातील नागरिकांना जवळच दर्जेदार उपचार मिळतील. उपस्थित सर्व "
            "मान्यवर आणि नागरिकांचे मनःपूर्वक आभार.",
        ],
    },
}

# Election Commission asks political content made with AI to be labelled.
SHOW_AI_LABEL = False
AI_LABEL_TEXT = "AI-Generated"