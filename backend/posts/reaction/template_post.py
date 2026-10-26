"""Make a post from a saved template: the client's details + the post's words + optional photo."""
from design import template_fill
from posts import marathi_digits
from storage import drafts, templates
from storage.clients import current


def client_slots():
    c = current()
    handle = (c.get("handle") or "").strip()
    if handle and not handle.startswith("@") and "." not in handle:
        handle = "@" + handle
    return {"client_name": c.get("name", ""), "phone": marathi_digits(c.get("phone") or ""),
            "contact": "  |  ".join(x for x in (handle, (c.get("address") or "").strip()) if x),
            "address": c.get("address") or ""}


def make_post(template_id, words, title, caption, hashtags, details, post_type, photo="", extra=None, ai=None, frame="none"):
    """words: {line_small, line_big, line_end} (| = new line); extra: slot values from the post's form
    (e.g. its own contact number) that replace the client's. Returns the draft (it opens in the editor)."""
    t = templates.get(template_id)
    if not t or not t.get("ready"):
        raise ValueError("That template isn't saved yet. Open it on the Templates page and save it first.")
    slots = {**client_slots(), **{k: v for k, v in (extra or {}).items() if v},
             **{k: str(v).replace("|", "\n") for k, v in words.items() if v is not None}}
    kept_labels = []
    # a short label in the design ("HAPPY") keeps its word when the new text is far too long for it (it would
    # shrink to an unreadable size) - but only if the label is in the client's own language
    client_devanagari = current().get("language", "mr") in ("mr", "hi")
    for o in t["design"].get("objects", []):
        slot, old = o.get("slot"), str(o.get("text") or "").strip()
        new = str(slots.get(slot) or "")
        if slot not in ("line_small",) or not old or not new or len(old.split()) > 2 or len(old) > 14:
            continue
        old_devanagari = any("\u0900" <= ch <= "\u097f" for ch in old)
        if len(new.replace("\n", " ")) > 2.5 * len(old) and old_devanagari == client_devanagari:
            slots.pop(slot)
            kept_labels.append(f'Kept "{old}": the new small line was too long for its space')
    # a title split over stacked boxes ("Makar" / "Sankranti"): spread the new title's words over them, the
    # longer part where the template had the longer word; a part with no words left is removed
    parts = sorted({o.get("slot") for o in t["design"].get("objects", []) if str(o.get("slot", "")).startswith("line_big_")})
    if parts and slots.get("line_big"):
        words = str(slots["line_big"]).replace("\n", " ").split()
        n = len(parts) + 1
        if len(words) >= n:
            cut = [round(len(words) * k / n) for k in range(1, n)]
            pieces = [" ".join(words[a:b]) for a, b in zip([0] + cut, cut + [len(words)])]
        else:
            pieces = [" ".join(words)] + [""] * (n - 1)
        slots["line_big"] = pieces[0]
        for slot, piece in zip(parts, pieces[1:]):
            slots[slot] = piece
    # a template with its own address line: the contact line shows only the handle (no repeated address)
    used = {o.get("slot") for o in t["design"].get("objects", [])}
    if "address" in used and "contact" in used and not (extra or {}).get("contact"):
        slots["contact"] = slots["contact"].split("  |  ")[0] if slots.get("contact") else ""
    logo = current().get("logo") or ""
    # AI layout plan (optional): which template texts to set, remove or add for this post
    edits, notes = None, []
    if ai:
        from posts import template_ai
        edits, notes = template_ai.plan(t["design"], ai["facts"], ai["headline"], caption, ai["language"], ai["kind"])
    # the client frame (banner + leader photo); the banner shows the name, so the template's own name line goes
    from design import frame as client_frame
    frame_assets = client_frame.assets(frame, turn=len(drafts.load_all()))
    if frame_assets:
        slots["client_name"] = ""
    png, design, warnings = template_fill.fill(t["design"], slots, {"logo": logo, "photo": photo}, name=template_id,
                                               edits=edits, frame=frame_assets)
    warnings = notes + kept_labels + warnings
    details = {**details, "ai_layout": bool(edits), "ai_plan": edits or {}, "frame": frame if frame_assets else "none"}
    draft = drafts.create(post_type=post_type, title=title, caption=caption, hashtags=hashtags, images=[png],
                          details={**details, "template_id": template_id}, warnings=warnings)
    return drafts.update(draft["id"], "made from a template", design={"feed": design})   # Edit design opens these layers
