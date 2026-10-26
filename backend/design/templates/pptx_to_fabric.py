"""
A PPTX slide -> a Fabric.js 7 template (JSON), with its pictures saved under assets/templates/<id>/.

Texts become Textbox objects (marked as slots later on the Templates page); pictures and
picture-filled shapes (how Canva and PowerPoint export graphics) become Image objects. Fonts are
mapped to a family + weight ("Poppins Semi-Bold" -> Poppins 600) so the app can check it has them.
Plain vector shapes without a picture are not converted yet.
"""
import hashlib
import json
import re

from PIL import Image
from pptx import Presentation
from pptx.enum.shapes import MSO_SHAPE_TYPE
from pptx.oxml.ns import qn

from config import ASSETS_DIR

PX = 9525                                           # EMU per pixel (96 dpi)
SVG_BLIP = "{http://schemas.microsoft.com/office/drawing/2016/SVG/main}svgBlip"   # vector version of a picture
SVG_DETAIL = 3                                      # vector graphics are drawn at 3x their poster size (sharp in HD exports)
HD_SCALE = 3                                        # photos are prepared for exports up to 3x (AI enlargement when needed)
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


def _vector(shape):
    """The SVG version Canva / PowerPoint store next to a picture's PNG backup (None if there is none)."""
    svg = shape._element.find(".//" + SVG_BLIP)
    rid = svg.get(qn("r:embed")) if svg is not None else None
    return shape.part.related_part(rid).blob if rid else None


def _render_svgs(jobs):
    """Draw SVG files as sharp PNGs at a given pixel size (headless Chrome). jobs: [(svg_bytes, w, h, out_path)]."""
    import asyncio
    import base64
    import sys
    from concurrent.futures import ThreadPoolExecutor
    from playwright.sync_api import sync_playwright

    def work():
        if sys.platform.startswith("win"):
            asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
        with sync_playwright() as p:
            browser = p.chromium.launch()
            try:
                page = browser.new_page()
                for svg, w, h, out in jobs:
                    page.set_viewport_size({"width": max(1, w), "height": max(1, h)})
                    uri = "data:image/svg+xml;base64," + base64.b64encode(svg).decode()
                    page.set_content(f'<html><body style="margin:0;background:transparent">'
                                     f'<img id="v" src="{uri}" style="display:block;width:{w}px;height:{h}px"></body></html>')
                    page.wait_for_function("document.getElementById('v').complete")
                    out.write_bytes(page.locator("#v").screenshot(omit_background=True))
            finally:
                browser.close()

    with ThreadPoolExecutor(max_workers=1) as pool:
        pool.submit(work).result()


def _fill_rect(shape):
    """<a:stretch><a:fillRect l t r b/>: where the picture is stretched, as fractions of the shape's size.
    Negative = the picture extends beyond the shape (Canva's "zoomed in" pictures); the shape clips it."""
    fr = shape._element.find(".//" + qn("a:stretch") + "/" + qn("a:fillRect"))
    return {k: int(fr.get(k, 0)) / 100000 for k in ("l", "t", "r", "b")} if fr is not None else {"l": 0, "t": 0, "r": 0, "b": 0}


def _picture_opacity(shape):
    """A picture's transparency (<a:alphaModFix amt="19000"/> = shown at 19%); 1 if none."""
    blip = shape._element.find(".//" + qn("a:blip"))
    fix = blip.find(qn("a:alphaModFix")) if blip is not None else None
    return round(int(fix.get("amt", 100000)) / 100000, 3) if fix is not None else 1


def _picture(shape):
    """The image of a picture, or of a shape filled with a picture, and its crop."""
    blip = shape._element.find(".//" + qn("a:blip"))
    rid = blip.get(qn("r:embed")) if blip is not None else None
    if not rid:
        return None, None
    crop = shape._element.find(".//" + qn("a:srcRect"))
    c = {k: int(crop.get(k, 0)) / 100000 for k in ("l", "t", "r", "b")} if crop is not None else {"l": 0, "t": 0, "r": 0, "b": 0}
    return shape.part.related_part(rid), c


def _group_map(group, tf):
    """Shapes inside a group store positions in the group's own coordinates (chOff / chExt);
    return the mapping that turns them into page coordinates (also for groups inside groups)."""
    ox, oy, sx, sy = tf
    xfrm = group._element.grpSpPr.find(qn("a:xfrm"))
    ch_off, ch_ext = xfrm.find(qn("a:chOff")), xfrm.find(qn("a:chExt"))
    cx, cy = (int(ch_off.get("x")), int(ch_off.get("y"))) if ch_off is not None else (group.left, group.top)
    cw, chh = (int(ch_ext.get("cx")), int(ch_ext.get("cy"))) if ch_ext is not None else (group.width, group.height)
    gsx = group.width / cw if cw else 1
    gsy = group.height / chh if chh else 1
    return (ox + (group.left - cx * gsx) * sx, oy + (group.top - cy * gsy) * sy, gsx * sx, gsy * sy)


def _colour(parent):
    """#RRGGBB (+ opacity) from <a:solidFill><a:srgbClr val=.. ><a:alpha val=../>; None if none."""
    fill = parent.find(qn("a:solidFill")) if parent is not None else None
    clr = fill.find(qn("a:srgbClr")) if fill is not None else None
    if clr is None:
        return None, 1
    alpha = clr.find(qn("a:alpha"))
    return "#" + clr.get("val", "000000").upper(), (int(alpha.get("val")) / 100000 if alpha is not None else 1)


def _gradient(parent):
    """<a:gradFill> (linear) under parent -> a Fabric gradient; None if there is none."""
    import math
    grad = parent.find(qn("a:gradFill")) if parent is not None else None
    if grad is None:
        return None
    stops = []
    for gs in grad.iter(qn("a:gs")):
        clr = gs.find(qn("a:srgbClr"))
        if clr is not None:
            alpha = clr.find(qn("a:alpha"))
            stops.append({"offset": int(gs.get("pos", 0)) / 100000, "color": "#" + clr.get("val", "FFFFFF").upper(),
                          "opacity": int(alpha.get("val")) / 100000 if alpha is not None else 1})
    if not stops:
        return None
    lin = grad.find(qn("a:lin"))
    ang = math.radians(int(lin.get("ang", 0)) / 60000) if lin is not None else 0      # 0 = left to right, 90 = top to bottom
    dx, dy = math.cos(ang) / 2, math.sin(ang) / 2
    return {"type": "linear", "gradientUnits": "percentage", "coords": {"x1": 0.5 - dx, "y1": 0.5 - dy, "x2": 0.5 + dx, "y2": 0.5 + dy},
            "colorStops": sorted(stops, key=lambda x: x["offset"])}


def _svg_path(geom, w, h):
    """DrawingML custom geometry -> SVG path data, scaled to the shape's size (w x h px)."""
    out = []
    for path in geom.iter(qn("a:path")):
        pw, ph = int(path.get("w") or 0) or 1, int(path.get("h") or 0) or 1
        fx, fy = w / pw, h / ph
        pt = lambda p: f"{int(p.get('x')) * fx:.2f} {int(p.get('y')) * fy:.2f}"
        for cmd in path:
            tag = cmd.tag.split("}")[1]
            pts = cmd.findall(qn("a:pt"))
            if tag == "moveTo":
                out.append("M " + pt(pts[0]))
            elif tag == "lnTo":
                out.append("L " + pt(pts[0]))
            elif tag == "cubicBezTo":
                out.append("C " + ", ".join(pt(p) for p in pts))
            elif tag == "quadBezTo":
                out.append("Q " + ", ".join(pt(p) for p in pts))
            elif tag == "close":
                out.append("Z")
    return " ".join(out)


def _shape(shape, tf):
    """A plain drawn shape (rectangle, rounded rectangle, ellipse, custom path) with a fill and/or outline."""
    sp = shape._element.find(qn("p:spPr"))
    if sp is None:
        return None
    fill, fill_alpha = _colour(sp)
    fill = fill or _gradient(sp)
    ln = sp.find(qn("a:ln"))
    stroke, stroke_alpha = _colour(ln) if ln is not None and ln.find(qn("a:noFill")) is None else (None, 1)
    if not fill and not stroke:
        return None
    left, top, w, h = _box(shape, tf)
    sw = round(int(ln.get("w", 12700)) / PX * tf[2], 2) if stroke else 0
    base = {"version": "7.4.0", "originX": "left", "originY": "top", "name": shape.name, "left": left, "top": top,
            "fill": fill or "transparent", "stroke": stroke, "strokeWidth": sw, "angle": shape.rotation or 0, **_flips(shape),
            "opacity": round(min(fill_alpha if fill else 1, stroke_alpha if stroke else 1), 3)}
    prst = sp.find(qn("a:prstGeom"))
    cust = sp.find(qn("a:custGeom"))
    if prst is not None and prst.get("prst") in ("rect", "roundRect"):
        r = 0
        if prst.get("prst") == "roundRect":
            gd = prst.find(".//" + qn("a:gd"))
            adj = int(gd.get("fmla", "val 16667").split()[-1]) if gd is not None else 16667
            r = min(w, h) * adj / 100000
        return _rotated({**base, "type": "Rect", "width": w - sw, "height": h - sw, "rx": r, "ry": r}, w, h)
    if prst is not None and prst.get("prst") == "ellipse":
        return _rotated({**base, "type": "Ellipse", "rx": (w - sw) / 2, "ry": (h - sw) / 2}, w, h)
    if cust is not None:
        d = _svg_path(cust, w, h)
        return _rotated({**base, "type": "Path", "path": d, "pathData": d}, w, h) if d else None
    return None


def _slide_background(slide, W, H):
    """The slide's own background (solid colour or linear gradient) as a locked full-page layer; None if none."""
    bg_pr = slide._element.find(".//" + qn("p:bg") + "/" + qn("p:bgPr"))
    if bg_pr is None:
        return None
    base = {"version": "7.4.0", "type": "Rect", "originX": "left", "originY": "top", "name": "Background", "left": 0, "top": 0,
            "width": W, "height": H, "strokeWidth": 0, "isBackground": True, "selectable": False, "evented": False}
    colour, _alpha = _colour(bg_pr)
    if colour:
        return {**base, "fill": colour}
    grad = _gradient(bg_pr)
    return {**base, "fill": grad} if grad else None


def _box(shape, tf):
    """(left, top, width, height) of a shape on the page, in pixels."""
    ox, oy, sx, sy = tf
    return (_px(ox + (shape.left or 0) * sx), _px(oy + (shape.top or 0) * sy),
            _px((shape.width or 0) * sx), _px((shape.height or 0) * sy))


FABRIC_LINE = 1.13          # Fabric: one line = font size x 1.13 x lineHeight
FABRIC_BASELINE = 0.879     # Fabric: first baseline at 0.879 x font size below the box top, whatever the line spacing
PPT_BASELINE_GAP = 0.21     # PowerPoint / Canva: first baseline at (line height - 0.21 x font size) below the box top


def _line_height(para, size_px, scale):
    """The paragraph's line height in px: exact (<a:spcPts>), a percentage (<a:spcPct>) or single (1.2 x size)."""
    ppr = para._p.find(qn("a:pPr"))
    ln = ppr.find(qn("a:lnSpc")) if ppr is not None else None
    pts = ln.find(qn("a:spcPts")) if ln is not None else None
    pct = ln.find(qn("a:spcPct")) if ln is not None else None
    if pts is not None:
        return int(pts.get("val")) / 100 / 0.75 * scale
    if pct is not None:
        return int(pct.get("val")) / 100000 * 1.2 * size_px
    return 1.2 * size_px


def _rotated(obj, w, h):
    """PowerPoint rotates a shape around its centre (its box is stored unrotated): use a centre origin."""
    if obj.get("angle"):
        obj.update({"originX": "center", "originY": "center", "left": round(obj["left"] + w / 2, 2), "top": round(obj["top"] + h / 2, 2)})
    return obj


def _flips(shape):
    xfrm = shape._element.find(".//" + qn("a:xfrm"))
    yes = lambda k: xfrm is not None and xfrm.get(k) in ("1", "true")
    return {"flipX": yes("flipH"), "flipY": yes("flipV")}


def _run_text(r, rpr):
    """A run's text as shown: Canva's "uppercase" effect (cap="all") is applied to the letters."""
    return r.text.upper() if rpr is not None and rpr.get("cap") == "all" else r.text


def _para_text(p):
    """A paragraph's text as shown, with its bullet (if any) in front."""
    ppr = p._p.find(qn("a:pPr"))
    bu = ppr.find(qn("a:buChar")) if ppr is not None else None
    text = "".join(_run_text(r, r._r.find(qn("a:rPr"))) for r in p.runs)
    return (bu.get("char", "•") + " " + text) if bu is not None and text.strip() else text


def _run_styles(paras, base, size_px_base, scale):
    """Styled ranges for runs that differ from the layer's own style (another colour, weight, font, size, or
    superscript / subscript): [{line, start, end, style}], positions in UTF-16 units of each paragraph's text.
    The engine / editor turn them into Fabric styles with Fabric's own grapheme counting (a Devanagari syllable
    like "त्त" is one position for Fabric, several characters for Python)."""
    u16 = lambda t: len(t.encode("utf-16-le")) // 2
    styles = []
    for li, p in enumerate(paras):
        ppr = p._p.find(qn("a:pPr"))
        ci = len((ppr.find(qn("a:buChar")).get("char", "•") + " ").encode("utf-16-le")) // 2 \
            if (ppr is not None and ppr.find(qn("a:buChar")) is not None and "".join(r.text for r in p.runs).strip()) else 0
        for r in p.runs:
            rpr = r._r.find(qn("a:rPr"))
            st = {}
            fill = _gradient(rpr) or _colour(rpr)[0]
            if fill and fill != base["fill"]:
                st["fill"] = fill
            fam, wt = split_font(r.font.name or base["sourceFont"], bool(r.font.bold))
            if r.font.name and fam != base["fontFamily"]:
                st["fontFamily"] = fam
            if str(wt) != str(base["fontWeight"]):
                st["fontWeight"] = wt
            size = (r.font.size.pt / 0.75 * scale) if r.font.size else size_px_base
            shift = int(rpr.get("baseline", 0)) / 100000 if rpr is not None else 0
            if shift:                                   # superscript (+) / subscript (-): smaller and raised / lowered
                size = size * 0.62
                st["deltaY"] = round(-shift * size_px_base * 1.1, 2)
            if abs(size - size_px_base) > 0.5:
                st["fontSize"] = round(size, 1)
            text = _run_text(r, rpr)
            if st and text:
                styles.append({"line": li, "start": ci, "end": ci + u16(text), "style": st})
            ci += u16(text)
    return styles


def _text_effects(rpr, scale):
    """Outline (stroke) and shadow of the text, from the first run."""
    out = {}
    ln = rpr.find(qn("a:ln")) if rpr is not None else None
    if ln is not None and ln.find(qn("a:noFill")) is None:
        col, _a = _colour(ln)
        if col:
            out.update(stroke=col, strokeWidth=round(int(ln.get("w", 12700)) / PX * scale, 2), paintFirst="stroke")
    eff = rpr.find(qn("a:effectLst")) if rpr is not None else None
    sh = eff.find(qn("a:outerShdw")) if eff is not None else None
    if sh is not None:
        import math
        col, alpha = _colour(sh) if sh.find(qn("a:solidFill")) is not None else (None, 1)
        clr = sh.find(qn("a:srgbClr"))
        if clr is not None:
            a = clr.find(qn("a:alpha")); alpha = int(a.get("val")) / 100000 if a is not None else 1
            col = "#" + clr.get("val")
        if col:
            dist, ang = int(sh.get("dist", 0)) / PX * scale, math.radians(int(sh.get("dir", 0)) / 60000)
            r_, g_, b_ = int(col[1:3], 16), int(col[3:5], 16), int(col[5:7], 16)
            out["shadow"] = {"color": f"rgba({r_},{g_},{b_},{round(alpha, 2)})", "blur": round(int(sh.get("blurRad", 0)) / PX * scale, 1),
                             "offsetX": round(dist * math.cos(ang), 1), "offsetY": round(dist * math.sin(ang), 1)}
    return out


def _text(shape, tf_map=(0, 0, 1, 1), paras=None, offset=0.0, block=None, part=""):
    """One text layer: the whole text box, or (paras) a group of its paragraphs that share a style, placed
    `offset` px below the box's first line; `block` is the height of all the box's lines (for centring)."""
    tf = shape.text_frame
    paras = paras or list(tf.paragraphs)
    para = paras[0]
    runs = [r for p in paras for r in p.runs]
    text = "\n".join(_para_text(p) for p in paras).strip("\n")
    r0 = runs[0] if runs else None
    size_pt = r0.font.size.pt if r0 is not None and r0.font.size else 18
    family, weight = split_font(r0.font.name if r0 is not None else None, bool(r0 is not None and r0.font.bold))
    rpr = r0._r.find(qn("a:rPr")) if r0 is not None else None
    # read the colour straight from the XML: python-pptx's font.color turns any fill into a solid one when read
    solid, _alpha = _colour(rpr)
    fill = _gradient(rpr) or solid or "#000000"         # Canva often gives titles a gradient colour
    spc = int(rpr.get("spc", 0)) if rpr is not None else 0
    align = {1: "left", 2: "center", 3: "right"}.get(int(para.alignment) if para.alignment is not None else 1, "left")
    left, top, width, box_h = _box(shape, tf_map)
    # inner margins (PowerPoint's default is 0.1 inch left/right, 0.05 inch top/bottom) and vertical alignment
    body = tf._txBody.find(qn("a:bodyPr"))
    ins = {k: int(body.get(k, d)) / PX * tf_map[2] for k, d in (("lIns", 91440), ("tIns", 45720), ("rIns", 91440), ("bIns", 45720))} if body is not None \
        else {"lIns": 0, "tIns": 0, "rIns": 0, "bIns": 0}
    left, top, width = left + ins["lIns"], top + ins["tIns"], max(1, width - ins["lIns"] - ins["rIns"])
    box_h = max(1, box_h - ins["tIns"] - ins["bIns"])
    v_align = {"ctr": "middle", "b": "bottom"}.get(body.get("anchor") if body is not None else "t", "top")
    size_px = size_pt / 0.75 * tf_map[2]
    line_px = _line_height(para, size_px, tf_map[2])
    # PowerPoint puts a line's extra spacing above the text, Fabric below it: move the text down so the
    # first baseline lands where PowerPoint / Canva put it, and keep the same distance between lines
    box_top = top                                      # the text box's top (the engine re-positions from it after filling)
    lines = text.count("\n") + 1                       # explicit lines (wrapping is measured later by the engine)
    own = lines * line_px
    whole = block if block is not None else own
    block_top = top + ((box_h - whole) / 2 if v_align == "middle" else (box_h - whole) if v_align == "bottom" else 0)
    block_top += offset
    if block is not None:                              # a part of a split box: its own lines, starting where they are
        box_top, box_h, v_align = block_top, own, "top"
    top = block_top + line_px - (PPT_BASELINE_GAP + FABRIC_BASELINE) * size_px
    upper = any((r._r.find(qn("a:rPr")) is not None and r._r.find(qn("a:rPr")).get("cap") == "all") for r in runs)
    obj = {"type": "Textbox", "version": "7.4.0", "originX": "left", "originY": "top", "name": shape.name + part, "text": text,
            "left": round(left, 2), "top": round(top, 2), "width": round(width, 2),
            "vAlign": v_align, "boxTop": round(box_top, 2), "boxHeight": round(box_h, 2),
            "fontFamily": family, "fontWeight": weight, "fontStyle": "italic" if (r0 is not None and r0.font.italic) else "normal",
            "fontSize": round(size_pt / 0.75 * tf_map[2], 1), "charSpacing": round(spc / 100 / size_pt * 1000) if size_pt else 0,
            "fill": fill, "textAlign": align,
            "lineHeight": round(line_px / (size_px * FABRIC_LINE), 4),
            "angle": shape.rotation or 0, "sourceFont": (r0.font.name if r0 is not None else "") or "",
            **({"textTransform": "uppercase"} if upper else {}), **_text_effects(rpr, tf_map[2])}
    runs_styled = _run_styles(paras, obj, size_px, tf_map[2])
    if runs_styled:
        obj["runStyles"] = runs_styled
    if obj["angle"]:                                   # rotated text: PowerPoint rotates around the box centre
        _w, _h = obj["width"], max(obj["boxHeight"], own)
        obj.update(originX="center", originY="center", left=round(obj["left"] + _w / 2, 2), top=round(obj["boxTop"] + _h / 2, 2))
        obj.pop("boxTop"); obj.pop("boxHeight")       # placed as it is (not re-positioned after filling)
    return obj


def _style_key(para):
    """What makes a paragraph look different: font, weight, italic, colour (sizes within 25% count as the same)."""
    r = next((r for r in para.runs if r.text.strip()), None)
    if r is None:
        return None
    rpr = r._r.find(qn("a:rPr"))
    lat = rpr.find(qn("a:latin")) if rpr is not None else None
    solid, _a = _colour(rpr)
    grad = _gradient(rpr)
    return ((lat.get("typeface") if lat is not None else r.font.name) or "", bool(r.font.bold), bool(r.font.italic),
            solid or (json.dumps(grad, sort_keys=True) if grad else ""), r.font.size.pt if r.font.size else 18)


def _texts(shape, tf_map):
    """A text box becomes one layer, or several when its lines use different styles (e.g. a name in a serif
    and "Jayanti" in a script font): each group of same-style lines is its own layer, where those lines are."""
    paras = [p for p in shape.text_frame.paragraphs]
    groups, current = [], []
    for p in paras:
        key = _style_key(p)
        if key is None:                                 # empty line: belongs to the current group
            current.append(p); continue
        prev = next((_style_key(q) for q in reversed(current) if _style_key(q)), None)
        same = prev is not None and prev[:4] == key[:4] and abs(prev[4] - key[4]) <= 0.25 * max(prev[4], key[4])
        if current and prev is not None and not same:
            groups.append(current); current = []
        current.append(p)
    if current:
        groups.append(current)
    groups = [g for g in groups if "".join(r.text for p in g for r in p.runs).strip()]
    if len(groups) <= 1:
        return [_text(shape, tf_map)]
    # line heights of every paragraph (their own line spacing), to place each group where its lines are
    def para_h(p):
        r = next((r for r in p.runs if r.text.strip()), None)
        size_px = ((r.font.size.pt if r is not None and r.font.size else 18) / 0.75) * tf_map[2]
        return _line_height(p, size_px, tf_map[2])
    block = sum(para_h(p) for g in groups for p in g)
    out, offset = [], 0.0
    for i, g in enumerate(groups):
        o = _text(shape, tf_map, paras=g, offset=offset, block=block, part=f" ({i + 1})")
        if i:
            o["flowAfter"] = out[-1]["name"]           # keep below the part above, however many lines it wraps to
        out.append(o)
        offset += sum(para_h(p) for p in g)
    return out


def convert(pptx_path, template_id):
    """Returns (fabric_json, width, height). Pictures are saved in assets/templates/<template_id>/."""
    folder = ASSETS_DIR / "templates" / template_id
    folder.mkdir(parents=True, exist_ok=True)
    prs = Presentation(str(pptx_path))
    W, H = _px(prs.slide_width), _px(prs.slide_height)
    # small designs (e.g. Canva's 500 x 500) are scaled up to Instagram's 1080 px width, so texts and
    # shapes are sharp; pictures keep their own resolution
    page_scale = 1080 / W if W < 1080 else 1
    W, H = round(W * page_scale, 2), round(H * page_scale, 2)
    objects = []
    svg_jobs = []                                   # vector graphics, drawn sharp after the walk

    def add_picture(shape, tf):
        part, c = _picture(shape)
        if part is None:
            return
        data = part.blob
        ext = part.content_type.split("/")[-1].replace("jpeg", "jpg").replace("svg+xml", "svg")
        name = f"{hashlib.sha1(data).hexdigest()[:12]}.{ext}"
        (folder / name).write_bytes(data)
        with Image.open(folder / name) as im:
            iw, ih = im.size
        left, top, w, h = _box(shape, tf)
        svg = _vector(shape)
        if svg:
            # draw the vector version (not the small PNG backup) at 2x the size it is shown, so it stays sharp
            factor = max(1.0, SVG_DETAIL * w / max(1, iw * (1 - c["l"] - c["r"])))
            iw, ih = round(iw * factor), round(ih * factor)
            (folder / f"{name.rsplit('.', 1)[0]}.svg").write_bytes(svg)          # the original vector, kept
            name = f"{name.rsplit('.', 1)[0]}_x{factor:.1f}.png"
            svg_jobs.append((svg, iw, ih, folder / name))
        else:
            # a photo that would be enlarged in an HD export: enhance it once with AI super-resolution
            from design import photo_enhance
            gain = HD_SCALE * w / max(1, iw * (1 - c["l"] - c["r"]))
            if gain > photo_enhance.MIN_GAIN and photo_enhance.available():
                try:
                    hd_name = f"{name.rsplit('.', 1)[0]}_sr.png"
                    k = photo_enhance.enhance(folder / name, gain, folder / hd_name)
                    if k:                                # None: too big to enhance - the original photo is kept
                        name, iw, ih = hd_name, iw * k, ih * k
                except Exception:                    # never fail an import over this: keep the original photo
                    pass
        cw, ch = iw * (1 - c["l"] - c["r"]), ih * (1 - c["t"] - c["b"])
        crop_x, crop_y = iw * c["l"], ih * c["t"]
        # where the (cropped) picture is stretched: the shape's box grown or shrunk by fillRect
        fr = _fill_rect(shape)
        rect_w, rect_h = w * (1 - fr["l"] - fr["r"]), h * (1 - fr["t"] - fr["b"])
        if rect_w > 0 and rect_h > 0 and any(fr.values()):
            sx, sy = rect_w / cw, rect_h / ch                      # picture pixels -> page pixels
            # visible part = the shape box, inside the stretched rectangle
            vis_l, vis_t = max(0.0, -fr["l"] * w), max(0.0, -fr["t"] * h)                    # cut from the picture
            vis_r, vis_b = max(0.0, -fr["r"] * w), max(0.0, -fr["b"] * h)
            pad_l, pad_t = max(0.0, fr["l"] * w), max(0.0, fr["t"] * h)                      # picture smaller than the box
            pad_r, pad_b = max(0.0, fr["r"] * w), max(0.0, fr["b"] * h)
            crop_x, crop_y = crop_x + vis_l / sx, crop_y + vis_t / sy
            cw, ch = cw - (vis_l + vis_r) / sx, ch - (vis_t + vis_b) / sy
            new_w, new_h = w - pad_l - pad_r, h - pad_t - pad_b
            # keep the centre right for rotated shapes: shift the box by the (rotated) padding offset
            import math
            dx, dy = (pad_l - pad_r) / 2, (pad_t - pad_b) / 2
            a = math.radians(shape.rotation or 0)
            if _flips(shape)["flipX"]:
                dx = -dx
            if _flips(shape)["flipY"]:
                dy = -dy
            cx, cy = left + w / 2 + dx * math.cos(a) - dy * math.sin(a), top + h / 2 + dx * math.sin(a) + dy * math.cos(a)
            w, h = new_w, new_h
            left, top = cx - w / 2, cy - h / 2
        full_page = left <= 1 and top <= 1 and w >= W - 2 and h >= H - 2
        objects.append(_rotated({"type": "Image", "version": "7.4.0", "originX": "left", "originY": "top", "name": shape.name,
                        "src": f"/files/assets/templates/{template_id}/{name}",
                        "left": left, "top": top, "width": round(cw, 2), "height": round(ch, 2),
                        "cropX": round(crop_x, 2), "cropY": round(crop_y, 2),
                        "scaleX": round(w / cw, 5) if cw else 1, "scaleY": round(h / ch, 5) if ch else 1,
                        "angle": shape.rotation or 0, "opacity": _picture_opacity(shape), **_flips(shape),
                        **({"isBackground": True, "selectable": False, "evented": False} if full_page else {})}, w, h))

    def walk(shapes, tf=(0, 0, 1, 1)):
        for s in shapes:
            if s.shape_type == MSO_SHAPE_TYPE.GROUP:
                walk(s.shapes, _group_map(s, tf))
                continue
            if s.shape_type == MSO_SHAPE_TYPE.PICTURE or _picture(s)[0] is not None:
                add_picture(s, tf)
            else:
                shape = _shape(s, tf)                     # a box, pill, circle or drawn path
                if shape:
                    objects.append(shape)
            if s.has_text_frame and s.text_frame.text.strip():
                objects.extend(_texts(s, tf))

    background = _slide_background(prs.slides[0], W, H)
    if background:
        objects.append(background)
    walk(prs.slides[0].shapes, (0, 0, page_scale, page_scale))
    if svg_jobs:
        _render_svgs(svg_jobs)
    return {"version": "7.4.0", "objects": objects, "background": "#ffffff", "size": {"width": W, "height": H}}, round(W), round(H)


def guess_slots(design, width, height):
    """A first guess of which texts the app fills (the user can change it in the editor)."""
    months = r"jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|june?|july?|aug(ust)?|sep(t(ember)?)?|oct(ober)?|nov(ember)?|dec(ember)?"
    is_date = lambda t: len(t) <= 24 and re.search(rf"\b\d{{1,2}}(st|nd|rd|th)?\b.*\b({months})\b|\b({months})\b.*\b\d{{1,2}}(st|nd|rd|th)?\b", t.lower().replace("\n", " "))
    texts = [o for o in design["objects"] if o.get("type") == "Textbox" and "logo here" not in o["text"].lower() and not is_date(o["text"])]
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
        # a title split over stacked text boxes ("Makar" above "Sankranti"): same font, large, one under the other
        # and centred on each other - the next part(s) of the title (line_big_2, _3), filled word by word
        bc = big["left"] + big["width"] / 2
        parts, prev = [], big
        for o in sorted((o for o in rest if id(o) not in taken), key=lambda o: o["top"]):
            oc = o["left"] + o["width"] / 2
            short = lambda t: len(t.split()) <= 2 and len(t.replace("\n", " ")) <= 18      # a word or two, not a sentence
            if (short(big["text"]) and short(o["text"]) and o["top"] > prev["top"] and o["fontFamily"] == big["fontFamily"] and o["fontSize"] >= big["fontSize"] * 0.4
                    and o["top"] - prev["top"] < prev["fontSize"] * 2.2 and abs(oc - bc) < big["width"] * 0.25 and len(parts) < 2):
                parts.append(o); prev = o
        for i, o in enumerate(parts):
            o["slot"] = f"line_big_{i + 2}"; taken.add(id(o))
    if big is not None:                                 # a small text in the top corner: the brand / client name
        corner = [o for o in rest if id(o) not in taken and o["top"] < height * .08 and o["fontSize"] < big["fontSize"] * .35]
        mark(min(corner, key=lambda o: o["top"], default=None), "client_name")
    if big is not None:
        above = [o for o in rest if id(o) not in taken and o["top"] < big["top"] and o["fontSize"] < big["fontSize"]
                 and big["top"] - o["top"] < height * .2]
        mark(max(above, key=lambda o: o["top"], default=None), "line_small")
    longest = max((o for o in rest if id(o) not in taken and len(o["text"]) >= 35), key=lambda o: len(o["text"]), default=None)
    mark(longest, "line_end")
    top = [o for o in rest if id(o) not in taken and o["top"] < height * .14 and o["width"] > width * .3]
    mark(min(top, key=lambda o: o["top"], default=None), "client_name")
    return design
