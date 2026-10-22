/*
 * Fills a template (Fabric JSON) for one post: slot texts get the post's words and the client's
 * details, slot pictures get the client's logo or the post's photo. Runs in headless Chrome.
 */
fabric.FabricObject.ownDefaults.originX = "left";
fabric.FabricObject.ownDefaults.originY = "top";
const KEEP = ["name", "slot", "isBackground", "selectable", "evented", "minSize", "maxLines", "sourceFont",
    "lockMovementX", "lockMovementY", "lockScalingX", "lockScalingY", "lockRotation", "hasControls"];
const DEVANAGARI = /[\u0900-\u097F]/;
// fonts that have Devanagari letters; others are swapped for Marathi / Hindi text
const HAS_DEVANAGARI = new Set(["Mukta", "Baloo 2", "Baloo Bhai 2", "Kalam", "Rozha One", "Tiro Devanagari Marathi", "Poppins",
    "Hind", "Gotu", "Halant", "Khand", "Laila", "Modak", "Amita", "Sura", "Yatra One", "Eczar", "Martel", "Noto Sans Devanagari"]);
const SERIF = /imbue|playfair|serif|garamond|bodoni|didot|times|georgia|rozha|tiro/i;
const ONE_LINE = new Set(["client_name", "phone", "contact", "address"]);

const widest = (o) => Math.max(...o._textLines.map((_, i) => o.getLineWidth(i)));
// limit: the width the template's own text used (a text box can be wider than its text, e.g. under a picture)
function fit(o, maxLines, switched, limit, maxH) {
    o.initDimensions();
    limit = Math.min(o.width, limit || o.width);
    maxH = maxH || Infinity;
    // a swapped Marathi font is often much wider than the template's font, so it may shrink further
    const min = switched ? Math.round(o.fontSize * 0.35) : (o.minSize || Math.round(o.fontSize * 0.5));
    while ((o._textLines.length > maxLines || widest(o) > limit + 1 || o.height > maxH + 1) && o.fontSize > min) {
        o.set({ fontSize: o.fontSize - 1 }); o.initDimensions();
    }
}

async function replacePicture(c, o, url, mode) {
    const img = await fabric.FabricImage.fromURL(url);
    const box = { left: o.left, top: o.top, width: o.getScaledWidth(), height: o.getScaledHeight() };
    const iw = img.width, ih = img.height;
    if (mode === "cover") {                       // fill the box, crop the overflow (photo)
        const s = Math.max(box.width / iw, box.height / ih), cw = box.width / s, ch = box.height / s;
        img.set({ cropX: (iw - cw) / 2, cropY: (ih - ch) / 2, width: cw, height: ch, scaleX: s, scaleY: s, left: box.left, top: box.top });
    } else {                                      // fit inside the box (logo)
        const s = Math.min(box.width / iw, box.height / ih);
        img.set({ scaleX: s, scaleY: s, left: box.left + (box.width - iw * s) / 2, top: box.top + (box.height - ih * s) / 2 });
    }
    img.set({ name: o.name, slot: o.slot, angle: o.angle || 0 });
    c.insertAt(c.getObjects().indexOf(o), img);
    c.remove(o);
}

window.fillTemplate = async (design, slots, pictures) => {
    await Promise.all([...document.fonts].map((f) => f.load().catch(() => null)));
    const W = design.size.width, H = design.size.height;
    const c = new fabric.StaticCanvas(null, { width: W, height: H, backgroundColor: "#ffffff" });
    await c.loadFromJSON(design);
    const warnings = [];
    const box = (o) => ({ x: o.left, y: o.top, w: o.getScaledWidth(), h: o.getScaledHeight() });
    // a removed text takes its own background shape with it (e.g. the pill behind a phone number),
    // but not large shapes like a footer bar
    const removeWithBackground = (o) => {
        const t = box(o), objs = c.getObjects(), at = objs.indexOf(o);
        for (const p of objs.slice(0, at).reverse()) {
            if (p.type.toLowerCase() !== "image" || p.isBackground || p.slot) continue;
            const b = box(p);
            const contains = b.x <= t.x + 2 && b.y <= t.y + 2 && b.x + b.w >= t.x + t.w - 2 && b.y + b.h >= t.y + t.h - 2;
            if (contains && b.w * b.h < t.w * t.h * 4) { c.remove(p); break; }
        }
        c.remove(o);
    };
    // template placeholders that aren't filled by the app never reach a real post
    for (const o of [...c.getObjects()]) {
        if (o.type.toLowerCase() === "textbox" && !o.slot && /logo\s*here|\[[^\]]+\]|your\s+(logo|text)\s+here/i.test(o.text)) c.remove(o);
    }
    for (const o of [...c.getObjects()]) {
        const kind = o.type.toLowerCase();
        if (kind === "textbox" && o.slot && o.slot in slots) {
            const value = slots[o.slot];
            if (value === "") { removeWithBackground(o); continue; }     // nothing to show: the line (and its pill) disappears
            // "TOLL-FREE: [NUMBER]" keeps its label; other slots take the whole text
            const placeholder = /\[[^\]]+\]/;
            const text = o.slot === "phone" && placeholder.test(o.text)
                ? o.text.replace(placeholder, value).replace(/\s*\[[^\]]+\]/g, "") : value;
            o.initDimensions();
            const used = Math.max(widest(o), o.width * 0.55);               // the template's own text width (before filling)
            const usedH = o.height;                                          // ... and height: filled text mustn't push into what's below
            o.set({ text });
            let switched = false;
            if (DEVANAGARI.test(text)) {
                o.set({ charSpacing: 0 });                                 // letter spacing breaks Devanagari apart
                if (!HAS_DEVANAGARI.has(o.fontFamily)) {
                    switched = true;
                    o.set(SERIF.test(o.fontFamily) ? { fontFamily: "Rozha One", fontWeight: "400" }
                        : { fontFamily: "Mukta", fontWeight: Number(o.fontWeight) >= 600 ? "800" : "600" });
                }
            }
            const maxLines = o.maxLines || (ONE_LINE.has(o.slot) ? 1 : o.slot === "line_end" ? 4 : 2);
            const maxH = usedH * (o.slot === "line_end" ? 1.35 : 1.15);
            fit(o, maxLines, switched, used * 1.08, maxH);
            o.initDimensions();
            if (o._textLines.length > maxLines || widest(o) > Math.min(o.width, used * 1.08) + 1 || o.height > maxH + 1) warnings.push(`"${o.name}" doesn't fit its box even at the smallest size`);
        }
        if (kind === "image" && o.slot && pictures[o.slot]) await replacePicture(c, o, pictures[o.slot], o.slot === "photo" ? "cover" : "contain");
        else if (kind === "image" && o.slot === "logo") {           // no logo for this client: remove the empty frame and its labels
            const b = box(o);
            const frame = c.getObjects().filter((p) => p !== o && p.type.toLowerCase() === "image" && !p.isBackground).find((p) => {
                const pb = box(p); return pb.x <= b.x + 2 && pb.y <= b.y + 2 && pb.x + pb.w >= b.x + b.w - 2 && pb.y + pb.h >= b.y + b.h - 2 && pb.w * pb.h < b.w * b.h * 4;
            });
            const area = frame ? box(frame) : b;
            for (const t of [...c.getObjects()]) {
                if (t.type.toLowerCase() !== "textbox" || t.slot) continue;
                const tb = box(t), cx = tb.x + tb.w / 2, cy = tb.y + tb.h / 2;
                if (cx > area.x && cx < area.x + area.w && cy > area.y && cy < area.y + area.h) c.remove(t);
            }
            if (frame) c.remove(frame);
            c.remove(o);
        }
    }
    c.renderAll();
    return { png: c.toDataURL({ format: "png" }), json: { ...c.toObject(KEEP), size: { width: W, height: H } }, warnings };
};
window.__ready = true;