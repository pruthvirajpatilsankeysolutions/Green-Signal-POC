"""
A PPTX slide -> a Fabric.js 7 template (JSON), with its pictures saved under assets/templates/<id>/.

Texts become Textbox objects (marked as slots later on the Templates page); pictures and
picture-filled shapes (how Canva and PowerPoint export graphics) become Image objects. Fonts are
mapped to a family + weight ("Poppins Semi-Bold" -> Poppins 600) so the app can check it has them.
Plain vector shapes without a picture are not converted yet.
"""
import hashlib
import re

from PIL import Image
from pptx import Presentation
from pptx.enum.shapes import MSO_SHAPE_TYPE
from pptx.oxml.ns import qn

from config import ASSETS_DIR

PX = 9525                                           # EMU per pixel (96 dpi)
WEIGHTS = (("extrabold", "800"), ("semibold", "600"), ("black", "900"), ("bold", "700"), ("medium", "500"),
           ("light", "300"), ("thin", "100"), ("regular", "400"))


def _px(v):
    return round((v or 0) / PX, 2)


def split_font(name, bold=False):
    """'Poppins Semi-Bold' -> ('Poppins', '600'); 'Imbue 72pt Medium' -> ('Imbue', '500')."""
    raw = (name or "Mukta").strip()
    flat = raw.lower().replace("-", "").replace(" ", "")
    weight = next((w for word, w in WEIGHTS if word in flat), "700" if bold else "400")
    family = re.sub(r"(?i)\b(extra|semi|ultra)?[- ]?(bold|black|medium|light|thin|regular)\b", "", raw)
    family = re.sub(r"\b\d+pt\b", "", family)
    return re.sub(r"\s+", " ", family).strip(" -") or "Mukta", weight


def _picture(shape):
    """The image of a picture, or of a shape filled with a picture, and its crop."""
    blip = shape._element.find(".//" + qn("a:blip"))
    rid = blip.get(qn("r:embed")) if blip is not None else None
    if not rid:
        return None, None
    crop = shape._element.find(".//" + qn("a:srcRect"))
    c = {k: int(crop.get(k, 0)) / 100000 for k in ("l", "t", "r", "b")} if crop is not None else {"l": 0, "t": 0, "r": 0, "b": 0}
    return shape.part.related_part(rid), c


def _text(shape):
    tf = shape.text_frame
    para = tf.paragraphs[0]
    runs = [r for p in tf.paragraphs for r in p.runs]
    r0 = runs[0] if runs else None
    size_pt = r0.font.size.pt if r0 is not None and r0.font.size else 18
    family, weight = split_font(r0.font.name if r0 is not None else None, bool(r0 is not None and r0.font.bold))
    fill = "#000000"
    try:
        if r0 is not None and r0.font.color and r0.font.color.type is not None and r0.font.color.rgb is not None:
            fill = "#" + str(r0.font.color.rgb)
    except (AttributeError, ValueError):
        pass
    rpr = r0._r.find(qn("a:rPr")) if r0 is not None else None
    spc = int(rpr.get("spc", 0)) if rpr is not None else 0
    align = {1: "left", 2: "center", 3: "right"}.get(int(para.alignment) if para.alignment is not None else 1, "left")
    return {"type": "Textbox", "version": "7.4.0", "originX": "left", "originY": "top", "name": shape.name, "text": tf.text,
            "left": _px(shape.left), "top": _px(shape.top), "width": _px(shape.width),
            "fontFamily": family, "fontWeight": weight, "fontStyle": "italic" if (r0 is not None and r0.font.italic) else "normal",
            "fontSize": round(size_pt / 0.75, 1), "charSpacing": round(spc / 100 / size_pt * 1000) if size_pt else 0,
            "fill": fill, "textAlign": align,
            "lineHeight": round(para.line_spacing, 2) if isinstance(para.line_spacing, float) else 1.16,
            "angle": shape.rotation or 0, "sourceFont": (r0.font.name if r0 is not None else "") or ""}


def convert(pptx_path, template_id):
    """Returns (fabric_json, width, height). Pictures are saved in assets/templates/<template_id>/."""
    folder = ASSETS_DIR / "templates" / template_id
    folder.mkdir(parents=True, exist_ok=True)
    prs = Presentation(str(pptx_path))
    W, H = _px(prs.slide_width), _px(prs.slide_height)
    objects = []

    def add_picture(shape):
        part, c = _picture(shape)
        if part is None:
            return
        data = part.blob
        ext = part.content_type.split("/")[-1].replace("jpeg", "jpg").replace("svg+xml", "svg")
        name = f"{hashlib.sha1(data).hexdigest()[:12]}.{ext}"
        (folder / name).write_bytes(data)
        with Image.open(folder / name) as im:
            iw, ih = im.size
        cw, ch = iw * (1 - c["l"] - c["r"]), ih * (1 - c["t"] - c["b"])
        w, h = _px(shape.width), _px(shape.height)
        full_page = _px(shape.left) <= 1 and _px(shape.top) <= 1 and w >= W - 2 and h >= H - 2
        objects.append({"type": "Image", "version": "7.4.0", "originX": "left", "originY": "top", "name": shape.name,
                        "src": f"/files/assets/templates/{template_id}/{name}",
                        "left": _px(shape.left), "top": _px(shape.top), "width": round(cw, 2), "height": round(ch, 2),
                        "cropX": round(iw * c["l"], 2), "cropY": round(ih * c["t"], 2),
                        "scaleX": round(w / cw, 5) if cw else 1, "scaleY": round(h / ch, 5) if ch else 1,
                        "angle": shape.rotation or 0,
                        **({"isBackground": True, "selectable": False, "evented": False} if full_page else {})})

    def walk(shapes):
        for s in shapes:
            if s.shape_type == MSO_SHAPE_TYPE.GROUP:
                walk(s.shapes)
            elif s.has_text_frame and s.text_frame.text.strip():
                objects.append(_text(s))
            elif s.shape_type == MSO_SHAPE_TYPE.PICTURE or _picture(s)[0] is not None:
                add_picture(s)

    walk(prs.slides[0].shapes)
    return {"version": "7.4.0", "objects": objects, "size": {"width": W, "height": H}}, round(W), round(H)


def guess_slots(design, width, height):
    """A first guess of which texts the app fills (the user can change it in the editor)."""
    texts = [o for o in design["objects"] if o.get("type") == "Textbox" and "logo here" not in o["text"].lower()]
    if not texts:
        return design
    taken = set()

    def mark(o, slot):
        if o is not None and id(o) not in taken and slot not in {x.get("slot") for x in texts}:
            o["slot"] = slot
            taken.add(id(o))

    for o in texts:
        t = o["text"].lower()
        if re.search(r"\[(number|phone|mobile|contact no)[^\]]*\]|(\d[\d\s-]{8,}\d)|toll[- ]?free|call\b", t):
            mark(o, "phone")
    for o in texts:
        if re.search(r"\[website\]|www\.|https?://|@\w|\.com|\.in\b|\[contact\]|\[email\]", o["text"].lower()):
            mark(o, "contact")
    rest = [o for o in texts if id(o) not in taken]
    big = max(rest, key=lambda o: o["fontSize"], default=None)
    mark(big, "line_big")
    if big is not None:
        above = [o for o in rest if id(o) not in taken and o["top"] < big["top"] and o["fontSize"] < big["fontSize"]
                 and big["top"] - o["top"] < height * .2]
        mark(max(above, key=lambda o: o["top"], default=None), "line_small")
    longest = max((o for o in rest if id(o) not in taken and len(o["text"]) >= 35), key=lambda o: len(o["text"]), default=None)
    mark(longest, "line_end")
    top = [o for o in rest if id(o) not in taken and o["top"] < height * .14 and o["width"] > width * .3]
    mark(min(top, key=lambda o: o["top"], default=None), "client_name")
    return design