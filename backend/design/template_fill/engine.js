/*
 * Fills a template (Fabric JSON) for one post: slot texts get the post's words and the client's
 * details, slot pictures get the client's logo or the post's photo. Runs in headless Chrome.
 */
fabric.FabricObject.ownDefaults.originX = "left";
fabric.FabricObject.ownDefaults.originY = "top";
fabric.FabricImage.ownDefaults.objectCaching = false;     // pictures: no low-quality cached copy
fabric.Textbox.ownDefaults.objectCaching = false;         // texts: drawn directly (sharper small text)
const KEEP = ["name", "frameLayer", "slot", "isBackground", "selectable", "evented", "minSize", "maxLines", "sourceFont", "vAlign", "boxTop", "boxHeight",
              "lockMovementX", "lockMovementY", "lockScalingX", "lockScalingY", "lockRotation", "hasControls"];
const DEVANAGARI = /[\u0900-\u097F]/;
// fonts that have Devanagari letters; others are swapped for Marathi / Hindi text
const HAS_DEVANAGARI = new Set(["Mukta", "Baloo 2", "Baloo Bhai 2", "Kalam", "Rozha One", "Tiro Devanagari Marathi", "Poppins",
  "Hind", "Gotu", "Halant", "Khand", "Laila", "Modak", "Amita", "Sura", "Yatra One", "Eczar", "Martel", "Noto Sans Devanagari"]);
const SERIF = /imbue|playfair|serif|garamond|bodoni|didot|times|georgia|rozha|tiro/i;
const ONE_LINE = new Set(["client_name", "phone", "contact", "address"]);
// (Rozha One's Devanagari digits look Latin; the page's fonts take Rozha One's digits from Laila Bold
//  through a unicode-range font face: see template_fill._page. The text is still drawn in one piece.)

const widest = (o) => Math.max(...o._textLines.map((_, i) => o.getLineWidth(i)));
// limit: the width the template's own text used (a text box can be wider than its text, e.g. under a picture)
function fit(o, maxLines, switched, limit, maxH, origLines = 1) {
  o.initDimensions();
  limit = Math.min(o.width, limit || o.width);
  maxH = maxH || Infinity;
  // more lines than the template's text: its line spacing was meant for that text (e.g. one spaced-out
  // word), so use normal paragraph spacing, and allow more shrinking to stay in the space it had
  const wraps = () => o._textLines.length > origLines;
  if (wraps() && o.lineHeight > 1.06) { o.set({ lineHeight: 1.06 }); o.initDimensions(); }
  // a swapped Marathi font is often much wider than the template's font, so it may shrink further
  const min = switched || wraps() ? Math.round(o.fontSize * 0.35) : (o.minSize || Math.round(o.fontSize * 0.5));
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

// The client frame (politicians): the design is scaled into the space above a banner (logo + name +
// designations) and the leader's photo rises above the banner on the right. Texts the photo would cover
// are moved left (or shrunk), judged by the photo's real shape, not its rectangle.
async function applyFrame(c, f, W, H, warnings) {
  const story = H > W * 1.5;
  const fh = Math.round(H * (story ? 0.11 : 0.15));
  const s = (H - fh) / H;
  // Make room for the banner: the whole design is fitted into the space above it (nothing is covered).
  // Full-page backgrounds keep filling the page; elements touching a side edge stay against that edge, and
  // elements spanning both edges stay full width, so no empty strips appear at the sides.
  const coversPage = (o) => { const r = o.getBoundingRect(); return r.left <= 4 && r.top <= 4 && r.left + r.width >= W - 4 && r.top + r.height >= H * 0.95; };
  const isBack = (o) => o.isBackground || (o.type.toLowerCase() === "image" && coversPage(o));
  for (const o of c.getObjects()) {
    if (isBack(o)) continue;
    const r = o.getBoundingRect(), p = o.getCenterPoint();
    const atLeft = r.left <= 4, atRight = r.left + r.width >= W - 4;
    o.set({ scaleX: o.scaleX * s, scaleY: o.scaleY * s });
    let cx = W / 2 + (p.x - W / 2) * s;
    const w2 = r.width * s;
    if (atLeft && atRight) {
      cx = W / 2;
      if (w2 < W) { const k = W / w2; o.set({ scaleX: o.scaleX * k, scaleY: o.scaleY * k }); }   // stays full width
    } else if (atLeft) cx = r.left + w2 / 2;                          // stays against the left edge
    else if (atRight) cx = r.left + r.width - w2 / 2;                 // stays against the right edge
    o.setPositionByOrigin(new fabric.Point(cx, p.y * s), "center", "center");
    o.setCoords();
  }
  const load = (u) => fabric.FabricImage.fromURL(u);
  const add = (o, name) => { o.set({ name, frameLayer: true }); c.add(o); o.setCoords(); return o; };
  const contain = (img, x, y, w, h, align) => {
    const k = Math.min(w / img.width, h / img.height), w2 = img.width * k, h2 = img.height * k;
    img.set({ originX: "left", originY: "top", scaleX: k, scaleY: k, top: y + (h - h2) / 2,
              left: align === "left" ? x : x + (w - w2) / 2 });
    return img;
  };
  add(new fabric.Rect({ originX: "left", originY: "top", left: 0, top: H - fh, width: W, height: fh, fill: f.bg, strokeWidth: 0 }), "Frame: banner background");
  add(new fabric.Rect({ originX: "left", originY: "top", left: 0, top: H - fh, width: W, height: 6, fill: f.accent, strokeWidth: 0 }), "Frame: accent line");
  let leader = null, leaderW = 0;                                       // 2) banner + photo
  if (f.leader) {
    leader = await load(f.leader);
    const lh = Math.min(fh * 2.6, H * 0.45), k = lh / leader.height;
    leaderW = leader.width * k;
    leader.set({ originX: "left", originY: "top", scaleX: k, scaleY: k, left: W - leaderW - 8, top: H - lh });
  }
  const pad = 14, x0 = 20, x1 = leader ? W - leaderW * 0.85 - 10 : W - 20, y = H - fh + 6 + pad, h = fh - 6 - 2 * pad;
  if (f.logo && f.text) {
    const logo = contain(await load(f.logo), x0, y, h * 1.2, h, "left");
    const logoRight = logo.left + logo.width * logo.scaleX + 16;
    add(logo, "Frame: logo");
    add(contain(await load(f.text), logoRight, y, Math.max(40, x1 - logoRight), h, "center"), "Frame: name and designations");
  } else if (f.full) {
    add(contain(await load(f.full), x0, y, x1 - x0, h, "center"), "Frame: banner");
  }
  if (!leader) return;
  add(leader, "Frame: photo");
  // 3) texts must not sit on the photo: a map of where the photo really is (its visible pixels)
  const others = c.getObjects().filter((o) => o !== leader && o.visible !== false);
  const bg = c.backgroundColor;
  others.forEach((o) => { o.visible = false; }); c.backgroundColor = "";
  const mask = c.toCanvasElement(1).getContext("2d");
  others.forEach((o) => { o.visible = true; }); c.backgroundColor = bg;
  const photoLeftIn = (r) => {                                         // leftmost photo pixel within r (Infinity: none)
    const xa = Math.max(0, Math.floor(r.left)), ya = Math.max(0, Math.floor(r.top));
    const w = Math.min(W - xa, Math.ceil(r.width)), hh = Math.min(H - ya, Math.ceil(r.height));
    if (w <= 0 || hh <= 0) return Infinity;
    const d = mask.getImageData(xa, ya, w, hh).data;
    let best = Infinity;
    for (let yy = 0; yy < hh; yy++) for (let xx = 0; xx < w && xa + xx < best; xx++) if (d[(yy * w + xx) * 4 + 3] > 40) { best = xa + xx; break; }
    return best;
  };
  for (const o of c.getObjects()) {
    if (o.type.toLowerCase() !== "textbox" || o.frameLayer || o.visible === false) continue;
    o.initDimensions();
    const textW = Math.max(...o._textLines.map((_, i) => o.getLineWidth(i))) * o.scaleX;
    const r = o.getBoundingRect();
    const off = o.textAlign === "center" ? (r.width - textW) / 2 : o.textAlign === "right" ? r.width - textW : 0;
    const hit = photoLeftIn({ left: r.left + off, top: r.top, width: textW, height: r.height });
    if (hit === Infinity) continue;
    const limit = hit - 16, margin = 24;
    let k = 1, left = limit - textW;
    if (left < margin) { k = Math.max(0.5, (limit - margin) / textW); left = margin; }
    if ((limit - margin) / textW < 0.5) warnings.push(`"${String(o.text).slice(0, 30)}" is close to the photo even after shrinking`);
    o.set({ width: textW / o.scaleX + 2 });                           // the box hugs its text
    o.set({ scaleX: o.scaleX * k, scaleY: o.scaleY * k });
    o.setPositionByOrigin(new fabric.Point(left, r.top + (r.height - r.height * k) / 2), "left", "top");
    o.setCoords();
  }
}

// edits (optional, from the AI layout plan): { set: {layerIndex: text}, remove: [layerIndex],
//   add: [{ like: layerIndex, below: layerIndex, text }] }; layerIndex = position in design.objects
window.fillTemplate = async (design, slots, pictures, scale = 1, edits = null, frame = null) => {
  await Promise.all([...document.fonts].map((f) => f.load().catch(() => null)));
  const W = design.size.width, H = design.size.height;
  const c = new fabric.StaticCanvas(null, { width: W, height: H, backgroundColor: "#ffffff" });
  c.on("before:render", ({ ctx }) => { if (ctx) ctx.imageSmoothingQuality = "high"; });   // high-quality picture shrinking
  await c.loadFromJSON(design);
  if (!c.backgroundColor) c.backgroundColor = "#ffffff";          // a post is never transparent
  // pictures drawn much smaller than their real size: shrink them properly first (no jagged lines)
  const sharpen = (o) => { if (o.type.toLowerCase() === "image" && !o.resizeFilter) o.resizeFilter = new fabric.filters.Resize({ resizeType: "sliceHack" }); };
  c.getObjects().forEach(sharpen);
  c.on("object:added", (e) => sharpen(e.target));
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
  // the AI plan: texts to set, layers to remove (each layer by its position in the template)
  const layer = c.getObjects().slice();
  if (edits) {
    for (const [i, text] of Object.entries(edits.set || {})) { const o = layer[+i]; if (o && o.type.toLowerCase() === "textbox") o.__planText = String(text); }
    for (const [i, st] of Object.entries(edits.style || {})) { const o = layer[+i]; if (o && o.type.toLowerCase() === "textbox") o.__style = st; }
    for (const i of edits.remove || []) { const o = layer[+i]; if (o && c.getObjects().includes(o)) removeWithBackground(o); }
  }
  // template placeholders that aren't filled by the app never reach a real post
  for (const o of [...c.getObjects()]) {
    if (o.type.toLowerCase() === "textbox" && !o.slot && o.__planText === undefined && /logo\s*here|\[[^\]]+\]|your\s+(logo|text)\s+here/i.test(o.text)) c.remove(o);
  }
  for (const o of [...c.getObjects()]) {
    const kind = o.type.toLowerCase();
    if (kind === "textbox" && (o.__planText !== undefined || o.__style || (o.slot && o.slot in slots))) {
      const value = o.__planText !== undefined ? o.__planText : (o.slot && o.slot in slots) ? slots[o.slot] : o.text;
      if (value === "") { removeWithBackground(o); continue; }     // nothing to show: the line (and its pill) disappears
      // "TOLL-FREE: [NUMBER]" keeps its label; other slots take the whole text
      const placeholder = /\[[^\]]+\]/;
      const text = o.slot === "phone" && placeholder.test(o.text)
        ? o.text.replace(placeholder, value).replace(/\s*\[[^\]]+\]/g, "") : value;
      o.initDimensions();
      const used = Math.max(widest(o), o.width * 0.55);               // the template's own text width (before filling)
      const usedH = o.height;                                          // ... and height: filled text mustn't push into what's below
      const origLines = o._textLines.length;
      o.set({ text });
      // AI style: font, weight, size (a larger size may widen the box around its centre; checked after placing)
      let scale = 1;
      if (o.__style) {
        const st = o.__style;
        if (st.fontFamily) o.set({ fontFamily: st.fontFamily });
        if (st.fontWeight) o.set({ fontWeight: st.fontWeight });
        if (st.scale) {
          scale = st.scale;
          o.__orig = { fontSize: o.fontSize, width: o.width, left: o.left, used, usedH, origLines };
          o.set({ fontSize: o.fontSize * scale });
          const wantW = used * scale * 1.08;
          if (scale > 1 && wantW > o.width) {
            const grow = wantW - o.width;
            o.set({ width: wantW, left: o.textAlign === "center" ? o.left - grow / 2 : o.textAlign === "right" ? o.left - grow : o.left });
          }
        }
      }
      let switched = false;
      if (DEVANAGARI.test(text)) {
        o.set({ charSpacing: 0 });                                 // letter spacing breaks Devanagari apart
        if (!HAS_DEVANAGARI.has(o.fontFamily)) {
          switched = true;
          o.set(SERIF.test(o.fontFamily) ? { fontFamily: "Rozha One", fontWeight: "400" }
                                         : { fontFamily: "Mukta", fontWeight: Number(o.fontWeight) >= 600 ? "800" : "600" });
        }
      }
      const maxLines = o.maxLines || (ONE_LINE.has(o.slot) ? 1 : o.slot === "line_end" ? 4 : Math.max(2, origLines + 1));
      const maxH = usedH * (o.slot === "line_end" ? 1.35 : 1.15) * Math.max(1, scale);
      fit(o, maxLines, switched, used * 1.08 * Math.max(1, scale), maxH, origLines);
      o.initDimensions();
      if (o._textLines.length > maxLines || widest(o) > Math.min(o.width, used * 1.08 * Math.max(1, scale)) + 1 || o.height > maxH + 1) warnings.push(`"${o.name}" doesn't fit its box even at the smallest size`);
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
  // Place each imported text like PowerPoint / Canva, at its final size and font: the block of lines
  // (n x line height) at the top, middle or bottom of its box, and the first baseline at
  // (line height - 0.21 x size) below the block's top (Fabric draws it at 0.879 x size)
  const positionText = (o) => {
    o.initDimensions();
    const lineH = o.fontSize * 1.13 * o.lineHeight, block = o._textLines.length * lineH;
    const blockTop = o.vAlign === "middle" ? o.boxTop + (o.boxHeight - block) / 2
                   : o.vAlign === "bottom" ? o.boxTop + o.boxHeight - block : o.boxTop;
    o.set({ top: blockTop + lineH - (0.21 + 0.879) * o.fontSize });
    o.setCoords();
  };
  for (const o of c.getObjects()) {
    if (o.type.toLowerCase() !== "textbox" || o.boxTop == null || o.boxHeight == null) continue;
    positionText(o);
  }
  // AI plan: extra lines styled like an existing text, placed just below a text when there is free space
  // Is a spot really free? Compare the page with everything vs. only the background, pixel by pixel:
  // transparent corners of rotated photos don't count, real content (text, shapes, photo) does.
  let pageNow = null, pageBare = null;
  const snapshotPages = () => {
    pageNow = c.toCanvasElement(1).getContext("2d");
    const hidden = c.getObjects().filter((o) => !o.isBackground && o.visible !== false);
    hidden.forEach((o) => { o.visible = false; });
    pageBare = c.toCanvasElement(1).getContext("2d");
    hidden.forEach((o) => { o.visible = true; });
  };
  const overlaps = (n) => {
    const b = n.getBoundingRect(), pad = 6;
    const x = Math.floor(b.left - pad), y = Math.floor(b.top - pad), w = Math.ceil(b.width + 2 * pad), h = Math.ceil(b.height + 2 * pad);
    if (x < 0 || y < 0 || x + w > W || y + h > H - 4) return true;
    if (!pageNow) snapshotPages();
    const a = pageNow.getImageData(x, y, w, h).data, z = pageBare.getImageData(x, y, w, h).data;
    let busy = 0;
    for (let i = 0; i < a.length; i += 4) {
      if (Math.abs(a[i] - z[i]) + Math.abs(a[i + 1] - z[i + 1]) + Math.abs(a[i + 2] - z[i + 2]) > 60) busy++;
    }
    return busy > (w * h) * 0.005;                                   // more than 0.5% of the spot has content
  };
  // AI style: a larger text must stay inside its own box (e.g. the "50% OFF" square) and must not run into
  // other content; otherwise it goes back to the designer's size
  const backdropOf = (o) => {
    const t = o.getBoundingRect(), objs = c.getObjects(), at = objs.indexOf(o);
    return objs.slice(0, at).reverse().find((p) => {
      if (p.isBackground || p.visible === false || !["image", "path", "rect", "ellipse"].includes(p.type.toLowerCase())) return false;
      const b = p.getBoundingRect();
      return b.left <= t.left + 4 && b.top <= t.top + 4 && b.left + b.width >= t.left + t.width - 4 && b.top + b.height >= t.top + t.height - 4
             && b.width * b.height < W * H * 0.4;
    });
  };
  for (const o of c.getObjects().filter((x) => x.__orig && x.fontSize > x.__orig.fontSize)) {
    const box0 = { ...o.__orig };
    const restore = () => {
      o.set({ fontSize: box0.fontSize, width: box0.width, left: box0.left });
      fit(o, Math.max(2, box0.origLines + 1), false, box0.used * 1.08, box0.usedH * 1.35, box0.origLines);
      if (o.boxTop != null) positionText(o);
      warnings.push(`"${String(o.text).slice(0, 30)}" kept at its original size: the larger size didn't fit`);
    };
    const shrunkTo = { fontSize: o.fontSize, width: o.width, left: o.left };
    o.set({ fontSize: box0.fontSize, width: box0.width, left: box0.left }); o.initDimensions(); o.setCoords();
    const home = backdropOf(o);                                     // the box it was designed to sit on, if any
    o.set(shrunkTo); o.initDimensions(); o.setCoords();
    let ok;
    if (home) {
      const b = home.getBoundingRect(), t = o.getBoundingRect(), m = 4;
      ok = t.left >= b.left + m && t.top >= b.top + m && t.left + t.width <= b.left + b.width - m && t.top + t.height <= b.top + b.height - m;
    } else {
      o.visible = false; pageNow = null; snapshotPages(); o.visible = true;
      ok = !overlaps(o); pageNow = null;
    }
    if (!ok) restore();
  }
  // put n just below / above an element: centred text centred on it, other text aligned with its left edge
  const placeNear = (n, anchor, side) => {
    const r = anchor.getBoundingRect();
    n.initDimensions();
    // the box hugs its text, so an empty part of a wide box doesn't collide with things beside it
    const textW = Math.ceil(Math.max(...n._textLines.map((_, i) => n.getLineWidth(i)))) + 4;
    if (textW < n.width) { n.set({ width: textW }); n.initDimensions(); }
    const gap = n.fontSize * 0.35, w = n.width;
    const top = side === "above" ? r.top - gap - n.height : r.top + r.height + gap;
    let left = n.textAlign === "center" ? r.left + r.width / 2 - w / 2 : n.textAlign === "right" ? r.left + r.width - w : r.left;
    left = Math.max(8, Math.min(W - w - 8, left));
    n.set({ left, top, angle: 0 }); n.setCoords();
    return !overlaps(n);
  };
  // AI plan: move texts below / above another element, only into free space (else they stay where they were)
  for (const m of (edits && edits.move) || []) {
    const o = layer[+m.id], side = m.above !== undefined ? "above" : "below", anchor = layer[+(m.above ?? m.below)];
    if (!o || !anchor || !c.getObjects().includes(o) || !c.getObjects().includes(anchor)) continue;
    const was = { left: o.left, top: o.top };
    o.visible = false; pageNow = null; snapshotPages(); o.visible = true;          // its old spot doesn't count as taken
    if (placeNear(o, anchor, side)) { pageNow = null; }
    else { o.set(was); o.setCoords(); warnings.push(`No free space to move "${String(o.text).slice(0, 30)}" ${side} the chosen element; kept in place`); }
  }
  // AI plan: extra lines styled like an existing text, placed below / above an element when there is free space;
  // several lines for the same spot stack (the next one goes under / over the previous one)
  const stack = {};
  for (const a of (edits && edits.add) || []) {
    const like = layer[+a.like], side = a.above !== undefined ? "above" : "below", key = `${side}:${a.above ?? a.below}`;
    const anchor = stack[key] || layer[+(a.above ?? a.below)];
    if (!like || like.type.toLowerCase() !== "textbox" || !anchor || !c.getObjects().includes(anchor)) continue;
    const n = await like.clone(KEEP);
    n.set({ text: String(a.text), slot: undefined, boxTop: undefined, boxHeight: undefined, vAlign: "top", name: `${like.name || "Text"} (added)`,
            originX: "left", originY: "top", angle: 0, width: like.width });
    if (DEVANAGARI.test(n.text)) {
      n.set({ charSpacing: 0 });
      if (!HAS_DEVANAGARI.has(n.fontFamily)) n.set(SERIF.test(n.fontFamily) ? { fontFamily: "Rozha One", fontWeight: "400" } : { fontFamily: "Mukta", fontWeight: "600" });
    }
    if (n.lineHeight > 1.06) n.set({ lineHeight: 1.06 });
    const base = n.fontSize;
    let placed = false;
    for (const k of [1, 0.85, 0.7]) {                               // the style's size, then a little smaller
      n.set({ fontSize: Math.round(base * k) }); fit(n, 2, false, n.width, Infinity, 1);
      if (placeNear(n, anchor, side)) { placed = true; break; }
    }
    if (placed) { c.insertAt(c.getObjects().indexOf(like) + 1, n); stack[key] = n; pageNow = null; }
    else warnings.push(`No free space for the extra line "${String(a.text).slice(0, 40)}"`);
  }
  if (frame) await applyFrame(c, frame, W, H, warnings);
  c.renderAll();
  return { png: c.toDataURL({ format: "png", multiplier: scale }), json: { ...c.toObject(KEEP), size: { width: W, height: H } }, warnings };
};
// Render a saved design (no filling) at a larger size for an HD download: texts and shapes are re-drawn
// at that size; pictures use their full resolution.
window.renderDesign = async (design, multiplier) => {
  await Promise.all([...document.fonts].map((f) => f.load().catch(() => null)));
  const W = design.size.width, H = design.size.height;
  const c = new fabric.StaticCanvas(null, { width: W, height: H, backgroundColor: "#ffffff" });
  c.on("before:render", ({ ctx }) => { if (ctx) ctx.imageSmoothingQuality = "high"; });
  await c.loadFromJSON(design);
  if (!c.backgroundColor) c.backgroundColor = "#ffffff";
  c.getObjects().forEach((o) => { if (o.type.toLowerCase() === "image" && !o.resizeFilter) o.resizeFilter = new fabric.filters.Resize({ resizeType: "sliceHack" }); });
  c.renderAll();
  return c.toDataURL({ format: "png", multiplier });
};
window.__ready = true;
