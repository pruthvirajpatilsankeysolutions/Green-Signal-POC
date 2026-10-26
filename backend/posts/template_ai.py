"""
AI layout plan for a template post: the AI reads the template's text layers and this post's words, and
decides for each layer whether to set new text, remove it (e.g. a sample "50% OFF" when the post has no
discount) or keep it, and may add up to 2 extra lines for facts that have no place (e.g. "Valid till ...").

The AI only decides CONTENT. Positions and sizes are measured by the fill engine. Every plan is checked:
layer ids must exist, texts must fit their space, and no number may appear that isn't in the facts.
Client details (name, phone, handle, address) are filled by the app, never by the AI.
"""
import json
import logging
import re

from ai.claude import ask_json

log = logging.getLogger("uvicorn.error")         # shows in the backend terminal
CLIENT_SLOTS = {"client_name", "phone", "contact", "address"}
MAX_ADDS = 2
_DIGITS = str.maketrans("०१२३४५६७८९", "0123456789")


def text_layers(design):
    """The template's text layers the AI may plan (client details excluded), with their character budget."""
    out = []
    H = (design.get("size") or {}).get("height") or 1080
    for i, o in enumerate(design.get("objects", [])):
        if str(o.get("type", "")).lower() != "textbox" or o.get("slot") in CLIENT_SLOTS:
            continue
        size = float(o.get("fontSize") or 20)
        line_h = size * 1.13 * float(o.get("lineHeight") or 1.16)
        lines = max(1, (o.get("text") or "").count("\n") + 1, round(float(o.get("boxHeight") or 0) / line_h))   # wrapped lines too
        per_line = max(4, int((o.get("width") or 200) / (size * 0.55)))
        top = o.get("boxTop", o.get("top", 0)) or 0
        out.append({"id": i, "sample_text": (o.get("text") or "").strip(), "role": o.get("slot") or "fixed text",
                    "position": "top" if top < H * 0.33 else "middle" if top < H * 0.66 else "bottom",
                    "size": "large" if size >= 60 else "medium" if size >= 30 else "small",
                    # what fits once the engine shrinks the text (down to about 60% for large text)
                    "max_chars": int(per_line * lines * 1.6) if size >= 30 else per_line * max(lines, 2)})
    return out


def anchors(design):
    """Every visible element a text can be placed above / below: texts (incl. client details) and pictures."""
    out = []
    H = (design.get("size") or {}).get("height") or 1080
    for i, o in enumerate(design.get("objects", [])):
        kind = str(o.get("type", "")).lower()
        if o.get("isBackground") or kind not in ("textbox", "image", "path", "rect", "ellipse"):
            continue
        top = o.get("boxTop", o.get("top", 0)) or 0
        label = (o.get("text") or "").strip()[:30] if kind == "textbox" else f"picture: {o.get('name', '')}" if kind == "image" else "shape"
        if o.get("slot") in CLIENT_SLOTS:
            label = f"client {o['slot'].replace('_', ' ')}"
        out.append({"id": i, "what": label, "position": "top" if top < H * 0.33 else "middle" if top < H * 0.66 else "bottom"})
    return out


def font_menu():
    """The fonts the app has, with their style, for the AI to choose from (style changes)."""
    from api.routes.designs import all_fonts
    from config import ASSETS_DIR
    kinds = [(r"script|brush|vibes|pacifico|dancing|lobster|kalam|modak|alex", "script / handwritten"),
             (r"bebas|oswald|khand|rajdhani|yantramanav|anton", "condensed display"),
             (r"playfair|rozha|cinzel|tiro|serif|laila|halant|gotu|glegoo|lustria|lora|imbue", "serif"),
             (r".", "sans-serif")]
    menu = {}
    for f in all_fonts():
        if not (ASSETS_DIR / "fonts" / f["file"]).exists() or f["family"] in menu:
            continue
        kind = next(k for pattern, k in kinds if re.search(pattern, f["family"].lower()))
        menu[f["family"]] = {"font": f["family"], "style": kind, "marathi": f.get("group") == "marathi"}
    return list(menu.values())


def _numbers(text):
    return set(re.findall(r"\d+(?:[.,]\d+)*", str(text or "").translate(_DIGITS).replace(",", "")))


def _where(item, anchor_ids):
    """{"below": id} or {"above": id} -> ("below" | "above", id), or None."""
    for side in ("below", "above"):
        if item.get(side) in anchor_ids:
            return side, item[side]
    return None


SIZE_MIN, SIZE_MAX = 0.6, 1.5


def check(plan, layers, sources, anchor_list=(), fonts=()):
    """Keep only the safe parts of the AI's plan. Returns (edits for the engine, notes about what was dropped)."""
    ids = {l["id"]: l for l in layers}
    anchor_ids = {a["id"] for a in anchor_list} | set(ids)
    allowed = set().union(*(_numbers(s) for s in sources))
    notes, edits = [], {"set": {}, "remove": [], "add": [], "move": [], "style": {}}
    known_fonts = {f["font"].lower(): f["font"] for f in fonts}

    def ok_text(t, limit):
        t = str(t or "").strip()
        if not t:
            return None
        bad = _numbers(t) - allowed
        if bad:
            notes.append(f'AI text dropped (number not in the facts: {", ".join(sorted(bad))}): "{t[:40]}"')
            return None
        if limit and len(t) > limit * 1.5:
            notes.append(f'AI text dropped (too long for its space): "{t[:40]}..."')
            return None
        return t

    for item in (plan or {}).get("set") or []:
        i = item.get("id") if isinstance(item, dict) else None
        if i in ids:
            t = ok_text(item.get("text"), ids[i]["max_chars"])
            if t:
                edits["set"][str(i)] = t
    for i in (plan or {}).get("remove") or []:
        if i in ids and str(i) not in edits["set"]:
            edits["remove"].append(i)
    for item in ((plan or {}).get("add") or [])[:MAX_ADDS]:
        if not isinstance(item, dict) or item.get("like") not in ids:
            continue
        t = ok_text(item.get("text"), ids[item["like"]]["max_chars"] * 1.5)
        side, anchor = _where(item, anchor_ids) or ("below", item["like"])
        if t:
            edits["add"].append({"like": item["like"], side: anchor, "text": t})
    for item in (plan or {}).get("style") or []:
        if not isinstance(item, dict) or item.get("id") not in ids or item["id"] in edits["remove"]:
            continue
        style = {}
        font = known_fonts.get(str(item.get("font") or "").strip().lower())
        if item.get("font") and not font:
            notes.append(f'AI font ignored (not in the app): "{item.get("font")}"')
        if font:
            style["fontFamily"] = font
        weight = str(item.get("weight") or "").lower()
        if weight in ("bold", "700", "800", "900"):
            style["fontWeight"] = "700"
        elif weight in ("normal", "regular", "400"):
            style["fontWeight"] = "400"
        try:
            size = float(item.get("size")) if item.get("size") is not None else None
        except (TypeError, ValueError):
            size = None
        if size:
            style["scale"] = round(min(SIZE_MAX, max(SIZE_MIN, size)), 2)
        if style:
            edits["style"][str(item["id"])] = style
    for item in (plan or {}).get("move") or []:
        if not isinstance(item, dict) or item.get("id") not in ids or item["id"] in edits["remove"]:
            continue
        where = _where(item, anchor_ids)
        if where and where[1] != item["id"]:
            edits["move"].append({"id": item["id"], where[0]: where[1]})
    return edits, notes


def plan(design, facts, headline, caption, language, post_kind):
    """Ask the AI for a layout plan. Returns (edits, notes), or (None, [reason]) to use the normal filling."""
    layers = text_layers(design)
    if not layers:
        return None, []
    system = f"""You place the words of a social media post ({post_kind}) into a poster template designed in Canva.
You get the template's text layers (id, the designer's sample text, its role, position, size and how many characters fit)
and this post's facts. For EVERY layer decide:
- "set": new text for this post in that layer, OR
- "remove": the layer doesn't belong to this post (for example a sample discount when this post has none,
  "On Making Charges" when the offer isn't about making charges, a sample web address or sample date), OR
- leave it out of both lists to keep the designer's text (only for generic words that still fit this post).
You may "add" at most {MAX_ADDS} extra lines for important facts that have no layer (for example "Valid till ..."),
styled like an existing layer ("like": its id) and placed "below" or "above" any element of the "elements" list.
You may "move" a text layer "below" or "above" any element when that reads better for this post (for example the
offer near the product photo). Positions are only "below"/"above" an element: never coordinates. A move or add
is skipped when that spot isn't free, so prefer spots next to empty areas.
You may "style" a text layer: "font" (one of the "fonts" list; for Marathi or Hindi text choose one with "marathi": true),
"weight" ("normal" or "bold") and "size" (a factor: 0.6 to 1.5, 1 = the designer's size). Change style only when it
helps this post (e.g. make the offer stand out, or a long text smaller); keep the template's overall look. A larger
size is only kept if the text still fits its space.
Rules:
- Use ONLY the facts and the chosen headline. Never invent or change numbers, prices, dates, names or places.
- Keep each text within its "max_chars". Poster text is short and punchy: not the caption.
- The headline goes in the largest, most prominent layer. Write in {language}.
Return JSON: {{"set": [{{"id": 3, "text": "..."}}], "remove": [5], "add": [{{"like": 4, "below": 4, "text": "..."}}],
"move": [{{"id": 5, "above": 9}}], "style": [{{"id": 4, "font": "Playfair Display", "weight": "bold", "size": 1.2}}]}}"""
    elements = anchors(design)
    fonts = font_menu()
    user = json.dumps({"layers": layers, "elements": elements, "fonts": fonts, "facts": facts, "chosen_headline": headline}, ensure_ascii=False, indent=1)
    try:
        answer = ask_json(system, user, max_tokens=1500)
    except Exception as e:                       # no AI key / AI busy: the normal filling is used
        return None, [f"AI layout not used ({type(e).__name__}); standard filling used."]
    # print the AI's raw plan and what the checks kept, so a wrong post can be traced back to the plan
    log.info("AI layout plan - layers sent: %s", json.dumps(layers, ensure_ascii=False))
    log.info("AI layout plan - AI answer: %s", json.dumps(answer, ensure_ascii=False))
    edits, notes = check(answer, layers, [facts, headline, caption], elements, fonts)
    log.info("AI layout plan - applied: %s | notes: %s", json.dumps(edits, ensure_ascii=False), notes)
    if not (edits["set"] or edits["remove"] or edits["add"] or edits["move"] or edits["style"]):
        return None, notes + ["AI layout plan was empty or invalid; standard filling used."]
    return edits, notes
