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
IMAGE_QUALITY = os.getenv("IMAGE_QUALITY", "medium")  # low / medium / high

# ---------- poster sizes (width, height) ----------
SIZES = {
    "feed": (1080, 1080),  # square post, same as the client's Instagram posters
    "story": (1080, 1920),  # Instagram / WhatsApp story (9:16)
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
        # jayanti: descriptor + titles and name as inline hashtags + closing, then 1-3 hashtags
        "tribute": [
            "#राष्ट्रपिता #महात्मा_गांधी यांना जयंतीनिमित्त विनम्र अभिवादन!\n\n"
            "#गांधी_जयंती #MahatmaGandhi #GandhiJayanti",
            "भारतीय प्रजासत्ताकाचे दुसरे पंतप्रधान #भारतरत्न #लाल_बहादुर_शास्त्री यांना आज "
            "जयंतीदिनी कोटी कोटी प्रणाम.\n\n#LalBahadurShastri",
            "बहुजनांच्या शिक्षणाचा वटवृक्ष, ‘रयत’ शिक्षण संस्थेचे संस्थापक, शिक्षणमहर्षी "
            "#कर्मवीर #भाऊराव_पाटील यांना जयंतीनिमित्त विनम्र अभिवादन.\n\n#कर्मवीर_भाऊराव_पाटील",
            "आपल्या सुमधुर आवाजाने संपूर्ण जगभरातील असंख्य चाहत्यांना मंत्रमुग्ध करणाऱ्या "
            "#गानसम्राज्ञी #भारतरत्न #लता_मंगेशकर यांच्या जयंती निमित्त भावपूर्ण आदरांजली.\n\n"
            "#LataMangeshkar",
            "भूदान चळवळीचे प्रणेते, महात्मा गांधींच्या वैयक्तिक सत्याग्रहातील पहिले सत्याग्रही, "
            "ज्येष्ठ स्वातंत्र्य सेनानी, भारतरत्न विनायक नरहरी भावे अर्थात आचार्य विनोबा भावे "
            "यांच्या जयंतीनिमित्त त्यांच्या महान जीवनकार्याला विनम्र अभिवादन.",
            "महानुभाव पंथाचे संस्थापक, महान तत्वज्ञ, आणि समाजसुधारक भगवान श्री चक्रधर स्वामी "
            "यांच्या जयंतीनिमित्त त्यांच्या चरणी साष्टांग दंडवत!",
            "आधुनिक भारताचे शिल्पकार आणि एक महान अभियंते, भारतरत्न सर मोक्षगुंडम विश्वेश्वरय्या "
            "यांना जयंतीदिनी विनम्र अभिवादन.\n\n"
            "सर मोक्षगुंडम विश्वेश्वरय्या यांच्या जयंतीनिमित्त देशात राष्ट्रीय अभियंता दिन साजरा "
            "करण्यात येतो. यानिमित्ताने देशाच्या विकासात आपले योगदान देणाऱ्या सर्व अभियंत्यांना "
            "हार्दिक शुभेच्छा.\n\n#अभियंता_दिन #NationalEngineersDay #Engineer #EngineersDay",
        ],
        # punyatithi / death anniversary
        "solemn": [
            "#भारतरत्न किताबाने सन्मानित करण्यात आलेले ज्येष्ठ स्वातंत्र्यसैनिक आणि सर्वोदय "
            "चळवळीचे प्रमुख नेते “जयप्रकाश नारायण” यांच्या पुण्यतिथीनिमित्त त्यांच्या पवित्र "
            "स्मृतींस भावपूर्ण आदरांजली.\n\n#जयप्रकाश_नारायण",
            "अहिल्यादेवी होळकर पुण्यतिथी (तिथीनुसार)...\n\n"
            "अत्यंत कुशल प्रशासक, उत्तम संघटक, न्यायप्रिय व दूरदृष्टी असलेल्या लोक कल्याणकारी "
            "#पुण्यश्लोक #राजमाता #अहिल्यादेवी_होळकर यांना पुण्यतिथी निमित्त कोटी कोटी प्रणाम..."
            "\n\n#AhilyadeviHolkar",
        ],
        # festivals and special days
        "greeting": [
            "बैल पोळा...\n\n"
            "सदैव बळीराजाच्या खांद्याला खांदा लावून काबाडकष्ट करणाऱ्या बळीराजाचा सच्चा मित्र "
            "अशा सर्जा राजा प्रती कृतज्ञता व्यक्त करण्याचा दिवस...\n\n"
            "सर्व शेतकरी बांधवांना बैल पोळा सणाच्या हार्दिक शुभेच्छा!\n\n#बैल_पोळा",
            "वंदितो तूज चरण आर्जव करतो गणराया,\nवरदहस्त असूद्या माथी,\n"
            "राहू द्या आम्हा सर्वांवर सदैव तुमची छत्रछाया,\nगणपती बाप्पा मोरया,\n"
            "पुढच्या वर्षी लवकर या...!!!\n\nअनंत चतुर्दशीच्या सर्वांना शुभेच्छा...\n\n"
            "#गणेशोत्सव #गणेशोत्सव_२०२६ #राज्यमहोत्सव #गणपती_बाप्पा_मोरया #अनंत_चतुर्दशी",
            "गणेशोत्सवाच्या सर्वांना हार्दिक शुभेच्छा!\n\n#गणेश_चतुर्थी #गणपती_बाप्पा_मोरया",
            "समस्त मराठीजनांना #अभिजात_मराठी भाषा दिनाच्या हार्दिक शुभेच्छा...\n\n"
            "मराठीच्या संपन्न परंपरेची पालखी अभिमानाने खांद्यावर घेऊन ती पुढे नेणाऱ्या "
            "मराठीजनांना मराठी अभिजात भाषा दिनाच्या हार्दिक शुभेच्छा...\n\n"
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
