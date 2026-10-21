import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Canvas, FabricImage, FabricObject, Gradient, Shadow, Textbox, loadSVGFromString, util } from "fabric";
import {
  AlignCenter, AlignLeft, AlignRight, ArrowDown, ArrowLeft, ArrowUp, Bold, ChevronLeft, Copy, Download, Image as ImageIcon,
  Layers, Lock, Maximize, Minus, Palette, Plus, Redo2, Save, Shapes, Trash2, Type, Undo2, Unlock, Upload, Wallpaper,
} from "lucide-react";
import { api } from "../api.js";
import { useStatus } from "../App.jsx";
import Notice from "../components/Notice.jsx";
import { BADGES, GRAPHICS } from "../editor/graphics.js";
import { LINES, OVERLAYS, SHAPES, makeBadge } from "../editor/shapes.js";

// Fabric.js 7 measures positions from an object's centre by default; this app uses the top-left corner.
FabricObject.ownDefaults.originX = "left";
FabricObject.ownDefaults.originY = "top";

// The background always fills the whole board and can't be selected, moved or resized (like Canva).
// It is changed only from the Background tab. Also repairs designs saved with a moved background.
const pinBackground = (c) => {
  const bg = c.getObjects().find((o) => o.isBackground);
  if (!bg) return;
  const width = c.getWidth() / c.getZoom(), height = c.getHeight() / c.getZoom();
  const cover = Math.max(width / bg.width, height / bg.height);
  bg.set({
    originX: "left", originY: "top", angle: 0, skewX: 0, skewY: 0, flipX: false, flipY: false,
    scaleX: cover, scaleY: cover, left: (width - bg.width * cover) / 2, top: (height - bg.height * cover) / 2,
    selectable: false, evented: false, hasControls: false, hoverCursor: "default",
    lockMovementX: true, lockMovementY: true, lockScalingX: true, lockScalingY: true, lockRotation: true,
  });
  bg.setCoords();
  c.sendObjectToBack(bg);
};

// Is the board light or dark where a new text will go? Picks dark text on light areas and
// white text with a shadow on dark areas (like Canva). Falls back to dark text if unsure.
const isLightArea = (c, left, top, width, height) => {
  try {
    const z = c.getZoom();
    const src = c.toCanvasElement(1);
    const x = Math.max(0, Math.round(left * z)), y = Math.max(0, Math.round(top * z));
    const w = Math.max(1, Math.min(src.width - x, Math.round(width * z))), h = Math.max(1, Math.min(src.height - y, Math.round(height * z)));
    const d = src.getContext("2d").getImageData(x, y, w, h).data;
    let sum = 0, n = 0;
    for (let i = 0; i < d.length; i += 16) { sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; n++; }
    return sum / n > 150;
  } catch {
    return true;
  }
};

// Saved designs keep image addresses without the server part (http://localhost:5173), so they
// still open after the app moves to another address. Also repairs designs saved before this fix.
const portableSources = (json) => {
  const fix = (o) => {
    if (o?.src && /^https?:\/\/[^/]+\/(files|api)\//.test(o.src)) o.src = o.src.replace(/^https?:\/\/[^/]+/, "");
    (o?.objects || []).forEach(fix);
    if (o?.clipPath) fix(o.clipPath);
  };
  (json?.objects || []).forEach(fix);
  if (json?.backgroundImage) fix(json.backgroundImage);
  return json;
};

const EXTRA = ["name", "isBackground", "lockMovementX", "lockMovementY", "lockScalingX", "lockScalingY", "lockRotation", "hasControls"];
const EMOJIS = ["🪔", "🎉", "🎊", "✨", "🌸", "🌼", "🌺", "🏵️", "🌻", "🌷", "💐", "🌹", "🙏", "👏", "🤝", "💪",
  "❤️", "🧡", "💛", "💚", "💙", "💜", "⭐", "🌟", "🔥", "🎁", "🍬", "🍭", "🍰", "🎂", "🧁", "🍫",
  "🥳", "🎈", "🎀", "🪷", "🕉️", "🚩", "🇮🇳", "🏏", "🏆", "🥇", "📢", "📍", "📞", "✅", "☀️", "🌙"];
const COLORS = ["#FFFFFF", "#111111", "#FFC94A", "#F2A007", "#F26B0F", "#C8261B", "#7A1F12", "#E91E63", "#4B2A7B", "#175CD3", "#0E7C5A", "#6B7280"];
const BG_COLORS = ["#FFFFFF", "#FFF4DC", "#FBEBD8", "#FDE2E4", "#E8F5EF", "#E0ECFF", "#1F2347", "#111111", "#7A1F12", "#0E7C5A"];
// sample texts in the client's post language (Marathi / Hindi / English)
const SAMPLES = {
  mr: { box: "नवीन मजकूर", heading: "मुख्य शीर्षक", sub: "उपशीर्षक", body: "येथे मजकूर लिहा",
        combos: ["हार्दिक शुभेच्छा!", "विनम्र अभिवादन!", "मानाचा मुजरा!"], name: "Marathi" },
  hi: { box: "नया टेक्स्ट", heading: "मुख्य शीर्षक", sub: "उपशीर्षक", body: "यहाँ टेक्स्ट लिखें",
        combos: ["हार्दिक शुभकामनाएं!", "विनम्र श्रद्धांजलि!", "शत-शत नमन!"], name: "Hindi" },
  en: { box: "New text", heading: "Your heading", sub: "Subheading", body: "Write your text here",
        combos: ["Warm wishes!", "Humble tributes", "Thank you!"], name: "English" },
};
const presetsFor = (s) => [
  { label: "Add a heading", text: s.heading, font: "Baloo 2", weight: "800", size: 110, cls: "p-heading" },
  { label: "Add a subheading", text: s.sub, font: "Mukta", weight: "800", size: 64, cls: "p-sub" },
  { label: "Add a little body text", text: s.body, font: "Mukta", weight: "400", size: 40, cls: "p-body" },
];
const combosFor = (s) => [
  { label: s.combos[0], font: "Kalam", weight: "700", size: 72, fill: "#FFFFFF" },
  { label: s.combos[1], font: "Rozha One", weight: "400", size: 80, fill: "#7A1F12" },
  { label: s.combos[2], font: "Baloo 2", weight: "800", size: 90, fill: "#F26B0F" },
];
const TABS = [
  { id: "text", label: "Text", icon: Type },
  { id: "elements", label: "Elements", icon: Shapes },
  { id: "uploads", label: "Uploads", icon: Upload },
  { id: "brand", label: "Brand", icon: Palette },
  { id: "background", label: "Background", icon: Wallpaper },
  { id: "layers", label: "Layers", icon: Layers },
];

const shadow = () => new Shadow({ color: "rgba(0,0,0,0.55)", blur: 12, offsetX: 0, offsetY: 3 });
const FONT_SIZE_MULT = 1.13;                          // Fabric's line height = fontSize * lineHeight * 1.13
const LAYER_NAMES = {
  "f-logo": "Logo", "f-text": "Name banner", leader: "Leader photo", "brand-logo": "Logo",
  blessing: "Small text", small: "Small text", kicker: "Small text", title: "Title", headline: "Title", big: "Title",
  wish: "Wishes", end: "Wishes", name: "Name", desig: "Designation", handle: "Handle"
};
const layerName = (n) => LAYER_NAMES[n] || (n ? n.charAt(0).toUpperCase() + n.slice(1).replace(/[-_]/g, " ") : "Layer");

// a text layer measured from the generated poster -> an editable Fabric text with the same look
function measuredText(item) {
  const pad = 8;                                       // a little room so the words never re-wrap
  const left = item.textAlign === "center" ? item.left - pad / 2 : item.textAlign === "right" ? item.left - pad : item.left;
  const fill = item.gradient?.length > 1
    ? new Gradient({
      type: "linear", gradientUnits: "percentage", coords: { x1: 0, y1: 0, x2: 0, y2: 1 },
      colorStops: item.gradient.map((color, i) => ({ offset: i / (item.gradient.length - 1), color }))
    })
    : item.color;
  return new Textbox(item.text, {
    name: layerName(item.name), left, top: item.top, width: item.width + pad, fontSize: item.fontSize,
    fontFamily: item.fontFamily, fontWeight: String(item.fontWeight), fill, textAlign: item.textAlign,
    lineHeight: item.lineHeightPx / (item.fontSize * FONT_SIZE_MULT),
    charSpacing: item.letterSpacing ? (item.letterSpacing / item.fontSize) * 1000 : 0,
    shadow: item.shadow ? new Shadow(item.shadow) : null,
  });
}

const isBold = (w) => ["700", "800", "bold"].includes(String(w));

export default function Editor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { status } = useStatus();
  const sample = SAMPLES[status?.client?.language] || SAMPLES.mr;
  const holder = useRef(null);
  const canvasRef = useRef(null);
  const history = useRef({ stack: [], index: -1, paused: false });
  const [info, setInfo] = useState(null);
  const [tab, setTab] = useState("text");
  const [panelOpen, setPanelOpen] = useState(true);
  const [selected, setSelected] = useState(null);
  const [, setTick] = useState(0);
  const [layers, setLayers] = useState([]);
  const [uploads, setUploads] = useState([]);
  const [zoom, setZoomState] = useState(0.5);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const uploadInput = useRef(null);
  const faces = useRef([]);
  const bgInput = useRef(null);
  const refresh = () => setTick((t) => t + 1);

  // ---------------------------------------------------------------- history
  const snapshot = useCallback(() => {
    const c = canvasRef.current;
    const h = history.current;
    if (!c || h.paused) return;
    h.stack = h.stack.slice(0, h.index + 1);
    h.stack.push(JSON.stringify(c.toObject(EXTRA)));
    if (h.stack.length > 60) h.stack.shift();
    h.index = h.stack.length - 1;
    setLayers([...c.getObjects()].reverse());
    setSaved(false);
    refresh();
  }, []);

  const restore = async (step) => {
    const c = canvasRef.current;
    const h = history.current;
    const next = h.index + step;
    if (!c || next < 0 || next >= h.stack.length) return;
    h.paused = true;
    await c.loadFromJSON(JSON.parse(h.stack[next]));
    pinBackground(c);
    h.index = next;
    h.paused = false;
    c.requestRenderAll();
    setSelected(null);
    setLayers([...c.getObjects()].reverse());
  };

  // ---------------------------------------------------------------- zoom
  const applyZoom = useCallback((z) => {
    const c = canvasRef.current;
    if (!c || !info) return;
    const value = Math.min(1.5, Math.max(0.2, z));
    c.setDimensions({ width: info.size.width * value, height: info.size.height * value });
    c.setZoom(value);
    c.requestRenderAll();
    setZoomState(value);
  }, [info]);

  const fitZoom = useCallback(() => {
    const area = document.querySelector(".ed-workspace");
    if (!area || !info) return;
    const fit = Math.min((area.clientWidth - 80) / info.size.width, (area.clientHeight - 80) / info.size.height);
    applyZoom(fit);
  }, [applyZoom, info]);

  // ---------------------------------------------------------------- load
  useEffect(() => {
    let disposed = false;
    const el = document.createElement("canvas");
    holder.current.appendChild(el);
    (async () => {
      try {
        const data = await api.design(id);
        // register every font; load the core ones now, plus any font the saved design uses
        faces.current = data.fonts.map((f) => {
          const face = new FontFace(f.family, `url(${f.url})`, { weight: f.weight });
          document.fonts.add(face);
          return { family: f.family, core: f.core, face };
        });
        const used = new Set((data.saved?.objects || []).flatMap((o) => [o.fontFamily, ...(o.objects || []).map((x) => x.fontFamily)]).filter(Boolean));
        await Promise.all(faces.current.filter((f) => f.core || used.has(f.family)).map((f) => f.face.load().catch(() => null)));
        if (disposed) return;
        const { width, height } = data.size;
        const c = new Canvas(el, { preserveObjectStacking: true, backgroundColor: "#ffffff" });
        c.setDimensions({ width: width * 0.5, height: height * 0.5 });
        c.setZoom(0.5);
        canvasRef.current = c;
        history.current.paused = true;
        if (data.saved) {
          await c.loadFromJSON(portableSources(data.saved));
        } else {
          const st = data.starter;
          if (st.background) {
            const bg = await FabricImage.fromURL(st.background.url);
            const cover = Math.max(width / bg.width, height / bg.height);
            bg.set({
              name: "Background", isBackground: true, scaleX: cover, scaleY: cover,
              left: (width - bg.width * cover) / 2, top: (height - bg.height * cover) / 2
            });
            c.add(bg);
          }
          for (const item of st.items) {
            if (item.type === "image") {
              const img = await FabricImage.fromURL(item.url);
              if (item.height) img.set({ scaleX: item.width / img.width, scaleY: item.height / img.height });
              else img.scaleToWidth(item.width);
              img.set({ name: st.measured ? layerName(item.name) : item.name, left: item.left, top: item.top });
              c.add(img);
            } else if (st.measured) {
              c.add(measuredText(item));
            } else {
              c.add(new Textbox(item.text, {
                name: item.name, left: item.left, top: item.top, width: item.width, fontSize: item.fontSize,
                fontFamily: item.fontFamily, fontWeight: item.fontWeight, fill: item.fill,
                textAlign: item.textAlign, shadow: item.shadow ? shadow() : null,
              }));
            }
          }
        }
        pinBackground(c);
        c.requestRenderAll();
        history.current.paused = false;
        snapshot();
        const select = () => { setSelected(c.getActiveObject() || null); refresh(); };
        c.on("selection:created", select);
        c.on("selection:updated", select);
        c.on("selection:cleared", () => setSelected(null));
        c.on("object:modified", snapshot);
        c.on("text:changed", refresh);
        c.on("text:editing:exited", snapshot);
        setInfo(data);
        // the other fonts download quietly in the background
        faces.current.filter((f) => f.face.status === "unloaded").forEach((f) => f.face.load().then(refresh).catch(() => null));
      } catch (e) {
        setError(e.message);
      }
    })();
    return () => {
      disposed = true;
      canvasRef.current?.dispose();
      canvasRef.current = null;
      if (holder.current) holder.current.innerHTML = "";
    };
  }, [id, snapshot]);

  useEffect(() => { if (info) fitZoom(); }, [info]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onResize = () => fitZoom();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [fitZoom]);

  // ---------------------------------------------------------------- keyboard
  useEffect(() => {
    const onKey = (e) => {
      const c = canvasRef.current;
      const obj = c?.getActiveObject();
      if (obj?.isEditing || ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); restore(e.shiftKey ? 1 : -1); return; }
      if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); restore(1); return; }
      if (mod && e.key.toLowerCase() === "s") { e.preventDefault(); save(); return; }
      if (mod && e.key.toLowerCase() === "d") { e.preventDefault(); duplicate(); return; }
      if (!obj) return;
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); remove(); return; }
      const step = e.shiftKey ? 10 : 2;
      const move = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (move && !obj.lockMovementX) {
        e.preventDefault();
        obj.set({ left: obj.left + move[0], top: obj.top + move[1] });
        obj.setCoords(); c.requestRenderAll(); snapshot();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ---------------------------------------------------------------- actions
  const c = () => canvasRef.current;
  const W = () => info.size.width;
  const place = (obj) => { c().add(obj); c().setActiveObject(obj); c().requestRenderAll(); setSelected(obj); snapshot(); };
  const added = useRef(0);
  const nextTop = (base) => base + ((added.current++ % 5) - 2) * 120;    // new items step down so they don't overlap

  const addText = ({ text, font, weight, size, fill, name = "Text" }) => {
    const width = Math.min(900, Math.max(300, text.length * size * 0.55));
    const left = (W() - width) / 2, top = nextTop(420);
    // no colour given (or plain white): pick what is readable on the poster at that spot
    const light = (!fill || fill.toUpperCase() === "#FFFFFF") && isLightArea(c(), left, top, width, size * 1.3);
    const colour = !fill || fill.toUpperCase() === "#FFFFFF" ? (light ? "#1F2347" : "#FFFFFF") : fill;
    place(new Textbox(text, {
      name, left, top, width, fontSize: size, fontFamily: font,
      fontWeight: weight, fill: colour, textAlign: "center", shadow: colour === "#FFFFFF" ? shadow() : null
    }));
  };

  const addEmoji = (emoji) => place(new Textbox(emoji, { name: `Emoji ${emoji}`, left: (W() - 160) / 2, top: nextTop(460), width: 160, fontSize: 130, textAlign: "center" }));

  const ensureFont = async (family) => {
    await Promise.all(faces.current.filter((f) => f.family === family).map((f) => f.face.load().catch(() => null)));
  };

  const setFont = async (family) => { await ensureFont(family); setProp("fontFamily", family); };

  const centerPlace = (obj, name) => {
    obj.set({ name, left: (W() - obj.getScaledWidth()) / 2, top: (info.size.height - obj.getScaledHeight()) / 2 });
    place(obj);
  };

  const addShape = (shape) => centerPlace(shape.make("#F26B0F"), shape.name);
  const addLine = (line) => centerPlace(line.make("#D4A017"), line.name);

  const addOverlay = (overlay) => {
    const obj = overlay.make(info.size.width, info.size.height);
    c().add(obj);
    const bgIndex = c().getObjects().findIndex((o) => o.isBackground);
    c().moveObjectTo(obj, bgIndex + 1);                     // just above the background photo
    c().setActiveObject(obj); c().requestRenderAll(); setSelected(obj); snapshot();
  };

  const addGraphic = async (graphic) => {
    const { objects, options } = await loadSVGFromString(graphic.svg);
    const obj = util.groupSVGElements(objects.filter(Boolean), options);
    obj.scaleToWidth(graphic.name === "Toran" || graphic.name === "Gold divider" ? 700 : 260);
    centerPlace(obj, graphic.name);
  };

  const addBadge = async (badge) => { await ensureFont("Baloo 2"); centerPlace(makeBadge(badge), `Label ${badge.text}`); };

  const addImageFromUrl = async (url, name) => {
    const img = await FabricImage.fromURL(url);
    img.scaleToWidth(Math.min(380, img.width));
    img.set({ name, left: (W() - img.getScaledWidth()) / 2, top: (info.size.height - img.getScaledHeight()) / 2 });
    place(img);
  };

  const readFile = (file) => new Promise((res, rej) => {
    const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file);
  });

  const onUpload = async (files) => {
    const added = await Promise.all(Array.from(files).map(async (f) => ({ name: f.name, url: await readFile(f) })));
    setUploads((u) => [...added, ...u]);
  };

  const setBackgroundImage = async (url) => {
    const { width, height } = info.size;
    const bg = await FabricImage.fromURL(url);
    const cover = Math.max(width / bg.width, height / bg.height);
    bg.set({
      name: "Background", isBackground: true, scaleX: cover, scaleY: cover,
      left: (width - bg.width * cover) / 2, top: (height - bg.height * cover) / 2
    });
    const old = c().getObjects().find((o) => o.isBackground);
    if (old) c().remove(old);
    c().add(bg); pinBackground(c()); c().requestRenderAll(); snapshot();
  };

  const setBackgroundColor = (color) => {
    const old = c().getObjects().find((o) => o.isBackground);
    if (old) c().remove(old);
    c().backgroundColor = color; c().requestRenderAll(); snapshot();
  };

  const remove = () => {
    const obj = c()?.getActiveObject();
    if (!obj) return;
    c().remove(obj); c().discardActiveObject(); c().requestRenderAll(); setSelected(null); snapshot();
  };

  const duplicate = async () => {
    const obj = c()?.getActiveObject();
    if (!obj) return;
    const copy = await obj.clone(EXTRA);
    copy.set({ left: obj.left + 30, top: obj.top + 30, isBackground: false, name: `${obj.name || "Copy"} copy` });
    place(copy);
  };

  const layer = (dir) => {
    const obj = c().getActiveObject();
    if (!obj) return;
    if (dir > 0) c().bringObjectForward(obj); else c().sendObjectBackwards(obj);
    c().requestRenderAll(); snapshot();
  };

  const toggleLock = () => {
    const obj = c().getActiveObject();
    if (!obj) return;
    const locked = !obj.lockMovementX;
    obj.set({ lockMovementX: locked, lockMovementY: locked, lockScalingX: locked, lockScalingY: locked, lockRotation: locked, hasControls: !locked });
    c().requestRenderAll(); snapshot();
  };

  const setProp = (key, value) => {
    const obj = c().getActiveObject();
    if (!obj) return;
    obj.set(key, value); obj.setCoords?.(); c().requestRenderAll(); snapshot();
  };

  const selectLayer = (obj) => { c().setActiveObject(obj); c().requestRenderAll(); setSelected(obj); };

  const exportPng = () => {
    c().discardActiveObject(); c().requestRenderAll();
    return c().toDataURL({ format: "png", multiplier: 1 / c().getZoom() });
  };

  const save = async () => {
    if (!c()) return;
    setBusy("save"); setError("");
    try {
      await api.saveDesign(id, portableSources(c().toObject(EXTRA)), exportPng());
      setSaved(true);
    } catch (e) { setError(e.message); } finally { setBusy(""); }
  };

  const download = () => {
    const a = document.createElement("a");
    a.href = exportPng(); a.download = `post-${id}.png`; a.click();
  };

  // ---------------------------------------------------------------- render helpers
  const isText = selected?.type === "textbox";
  const isLine = selected?.type === "line" || selected?.fill === "transparent";     // lines, frames, rings: colour = outline
  const isShape = !isLine && ["rect", "circle", "ellipse", "triangle", "polygon", "path"].includes(selected?.type)
    && typeof selected?.fill === "string";                                           // gradient overlays have no colour picker
  const fontsIn = (group) => (info ? [...new Set(info.fonts.filter((f) => f.group === group).map((f) => f.family))] : []);
  const h = history.current;
  const currentFill = typeof selected?.fill === "string" ? selected.fill : "#ffffff";

  const panel = {
    text: (
      <>
        <button className="ed-primary" onClick={() => addText({ text: sample.box, font: "Mukta", weight: "800", size: 64 })}>
          <Type size={18} /> Add a text box
        </button>
        <div className="ed-section">Default text styles</div>
        {presetsFor(sample).map((p) => (
          <button key={p.label} className={`ed-preset ${p.cls}`} style={{ fontFamily: p.font, fontWeight: p.weight }}
            onClick={() => addText({ text: p.text, font: p.font, weight: p.weight, size: p.size })}>{p.label}</button>
        ))}
        <div className="ed-section">{sample.name} combinations</div>
        <div className="ed-combos">
          {combosFor(sample).map((p) => (
            <button key={p.label} className="ed-combo" style={{ fontFamily: p.font, fontWeight: p.weight, color: p.fill === "#FFFFFF" ? "#7A1F12" : p.fill }}
              onClick={() => addText({ text: p.label, font: p.font, weight: p.weight, size: p.size, fill: p.fill })}>{p.label}</button>
          ))}
        </div>
        {[["marathi", "Marathi / Hindi fonts", "नमस्कार"], ["english", "English only", "Hello"]].map(([group, title, sample]) => (
          <div key={group} className="ed-fontgroup">
            <div className="ed-section">{title}</div>
            {fontsIn(group).map((f) => (
              <button key={f} className="ed-font" style={{ fontFamily: f }} disabled={!isText}
                title={isText ? "Apply to the selected text" : "Select a text first"}
                onClick={() => setFont(f)}>{f} <span>{sample}</span></button>
            ))}
          </div>
        ))}
      </>
    ),
    elements: (
      <>
        <div className="ed-section">Shapes</div>
        <div className="ed-tiles">
          {SHAPES.map((sh) => (
            <button key={sh.name} title={sh.name} onClick={() => addShape(sh)}>
              <svg viewBox="0 0 40 40" fill="#F26B0F" dangerouslySetInnerHTML={{ __html: sh.preview }} />
            </button>
          ))}
        </div>
        <div className="ed-section">Lines and frames</div>
        <div className="ed-tiles">
          {LINES.map((ln) => (
            <button key={ln.name} title={ln.name} onClick={() => addLine(ln)}>
              <svg viewBox="0 0 40 40" stroke="#D4A017" fill="none" dangerouslySetInnerHTML={{ __html: ln.preview }} />
            </button>
          ))}
        </div>
        <div className="ed-section">Graphics</div>
        <div className="ed-graphics">
          {GRAPHICS.map((g) => (
            <button key={g.name} title={g.name} onClick={() => addGraphic(g)}>
              <span dangerouslySetInnerHTML={{ __html: g.svg }} />
            </button>
          ))}
        </div>
        <div className="ed-section">Labels</div>
        <div className="ed-badges">
          {BADGES.map((bd) => (
            <button key={bd.text} onClick={() => addBadge(bd)} style={{ background: bd.fill, color: bd.color }}
              className={`ed-badge ${bd.shape}`}>{bd.text}</button>
          ))}
        </div>
        <div className="ed-section">Overlays <span className="ed-hint">make text readable over photos</span></div>
        <div className="ed-overlays">
          {OVERLAYS.map((o) => (
            <button key={o.name} title={o.name} onClick={() => addOverlay(o)}>
              <span style={{ background: o.preview }} /><em>{o.name}</em>
            </button>
          ))}
        </div>
        <div className="ed-section">Emojis</div>
        <div className="ed-emojis">
          {EMOJIS.map((e) => <button key={e} onClick={() => addEmoji(e)} aria-label={`Add ${e}`}>{e}</button>)}
        </div>
      </>
    ),
    uploads: (
      <>
        <button className="ed-primary" onClick={() => uploadInput.current?.click()}><Upload size={18} /> Upload files</button>
        <p className="ed-hint">PNG stickers, photos, logos. Click a file to add it to the design.</p>
        <div className="ed-grid">
          {uploads.map((u, i) => (
            <button key={i} onClick={() => addImageFromUrl(u.url, u.name)} title={u.name}><img src={u.url} alt={u.name} /></button>
          ))}
        </div>
        {!uploads.length && <p className="ed-hint">Nothing uploaded in this session yet.</p>}
      </>
    ),
    brand: (
      <>
        <div className="ed-section">Brand assets</div>
        <div className="ed-grid">
          {(info?.brand_assets || []).map((a) => (
            <button key={a.url} onClick={() => addImageFromUrl(a.url, a.name)} title={`Add ${a.name}`}><img src={a.url} alt={a.name} /></button>
          ))}
        </div>
        {!info?.brand_assets?.length && <p className="ed-hint">No assets yet. Upload a banner, logo or photos on the Clients page.</p>}
        <div className="ed-section">Brand colours</div>
        <div className="ed-swatches">
          {COLORS.map((col) => <button key={col} style={{ background: col }} aria-label={col} disabled={!selected}
            title={selected ? "Apply to the selection" : "Select something first"}
            onClick={() => setProp(isLine ? "stroke" : "fill", col)} />)}
        </div>
      </>
    ),
    background: (
      <>
        <button className="ed-primary" onClick={() => bgInput.current?.click()}><ImageIcon size={18} /> Upload background photo</button>
        {uploads.length > 0 && (
          <>
            <div className="ed-section">Use an upload as background</div>
            <div className="ed-grid">
              {uploads.map((u, i) => <button key={i} onClick={() => setBackgroundImage(u.url)} title={u.name}><img src={u.url} alt={u.name} /></button>)}
            </div>
          </>
        )}
        <div className="ed-section">Plain colour</div>
        <div className="ed-swatches">
          {BG_COLORS.map((col) => <button key={col} style={{ background: col }} aria-label={col} onClick={() => setBackgroundColor(col)} />)}
        </div>
        <p className="ed-hint">A plain colour removes the background photo.</p>
      </>
    ),
    layers: (
      <ul className="ed-layers">
        {layers.map((o, i) => (
          <li key={i}>
            <button className={o === selected ? "on" : ""} onClick={() => selectLayer(o)}>
              <span className="mr ellipsis">{o.type === "textbox" ? (o.text || "").split("\n")[0] : (o.name || o.type)}</span>
              {o.lockMovementX && <Lock size={12} aria-label="Locked" />}
            </button>
          </li>
        ))}
      </ul>
    ),
  };

  return (
    <div className="ed">
      {/* ---------------- top bar ---------------- */}
      <header className="ed-top">
        <button className="ed-top-btn" onClick={() => navigate("/approvals")} title="Back to Approvals"><ArrowLeft size={18} /> Back</button>
        <div className="ed-top-group">
          <button className="ed-top-icon" title="Undo (Ctrl+Z)" onClick={() => restore(-1)} disabled={h.index <= 0}><Undo2 size={18} /></button>
          <button className="ed-top-icon" title="Redo (Ctrl+Y)" onClick={() => restore(1)} disabled={h.index >= h.stack.length - 1}><Redo2 size={18} /></button>
          <span className="ed-status">{busy === "save" ? "Saving…" : saved ? "Saved" : ""}</span>
        </div>
        <div className="ed-title mr">{info?.draft?.title || "Loading…"}</div>
        <div className="ed-top-group">
          <button className="ed-top-btn" onClick={download} disabled={!info}><Download size={18} /> Download</button>
          <button className="ed-top-save" onClick={save} disabled={!info || busy === "save"}><Save size={18} /> Save design</button>
        </div>
      </header>

      <div className="ed-body">
        {/* ---------------- left icon rail ---------------- */}
        <nav className="ed-rail" aria-label="Editor tools">
          {TABS.map(({ id: t, label, icon: Icon }) => (
            <button key={t} className={tab === t && panelOpen ? "on" : ""} onClick={() => { setTab(t); setPanelOpen(true); }}>
              <Icon size={22} /><span>{label}</span>
            </button>
          ))}
        </nav>

        {/* ---------------- side panel ---------------- */}
        {panelOpen && (
          <aside className="ed-panel">
            <div className="ed-panel-scroll">{info ? panel[tab] : <p className="ed-hint">Loading…</p>}</div>
            <button className="ed-collapse" onClick={() => setPanelOpen(false)} aria-label="Hide panel"><ChevronLeft size={16} /></button>
          </aside>
        )}

        {/* ---------------- workspace ---------------- */}
        <main className="ed-main">
          <div className="ed-context">
            {selected ? (
              <>
                {isText && (
                  <>
                    <select className="ed-select" value={selected.fontFamily} onChange={(e) => setFont(e.target.value)} aria-label="Font">
                      <optgroup label="Marathi">{fontsIn("marathi").map((f) => <option key={f} value={f}>{f}</option>)}</optgroup>
                      <optgroup label="English only">{fontsIn("english").map((f) => <option key={f} value={f}>{f}</option>)}</optgroup>
                    </select>
                    <div className="ed-size">
                      <button onClick={() => setProp("fontSize", Math.max(10, Math.round(selected.fontSize) - 4))} aria-label="Smaller"><Minus size={14} /></button>
                      <input value={Math.round(selected.fontSize)} onChange={(e) => setProp("fontSize", Number(e.target.value) || selected.fontSize)} aria-label="Font size" />
                      <button onClick={() => setProp("fontSize", Math.round(selected.fontSize) + 4)} aria-label="Bigger"><Plus size={14} /></button>
                    </div>
                    <label className="ed-color" title="Text colour" style={{ "--c": currentFill }}>
                      <span className="ed-color-a">A</span>
                      <input type="color" value={currentFill} onChange={(e) => setProp("fill", e.target.value)} />
                    </label>
                    <button className={`ed-ctx${isBold(selected.fontWeight) ? " on" : ""}`} title="Bold"
                      onClick={() => setProp("fontWeight", isBold(selected.fontWeight) ? "400" : "800")}><Bold size={16} /></button>
                    {[["left", AlignLeft], ["center", AlignCenter], ["right", AlignRight]].map(([a, Icon]) => (
                      <button key={a} className={`ed-ctx${selected.textAlign === a ? " on" : ""}`} title={`Align ${a}`} onClick={() => setProp("textAlign", a)}><Icon size={16} /></button>
                    ))}
                    <button className={`ed-ctx text${selected.shadow ? " on" : ""}`} onClick={() => setProp("shadow", selected.shadow ? null : shadow())}>Shadow</button>
                  </>
                )}
                {(isShape || isLine) && (
                  <label className="ed-color swatch" title="Colour" style={{ "--c": isLine ? selected.stroke : currentFill }}>
                    <input type="color" value={isLine ? selected.stroke : currentFill} onChange={(e) => setProp(isLine ? "stroke" : "fill", e.target.value)} />
                  </label>
                )}
                <span className="ed-sep" />
                <label className="ed-opacity" title="Transparency">
                  <span>{Math.round((selected.opacity ?? 1) * 100)}%</span>
                  <input type="range" min="10" max="100" value={Math.round((selected.opacity ?? 1) * 100)} onChange={(e) => setProp("opacity", Number(e.target.value) / 100)} />
                </label>
                <button className="ed-ctx" title="Bring forward" onClick={() => layer(1)}><ArrowUp size={16} /></button>
                <button className="ed-ctx" title="Send backward" onClick={() => layer(-1)}><ArrowDown size={16} /></button>
                <button className="ed-ctx" title="Duplicate (Ctrl+D)" onClick={duplicate}><Copy size={16} /></button>
                <button className="ed-ctx" title={selected.lockMovementX ? "Unlock" : "Lock"} onClick={toggleLock}>{selected.lockMovementX ? <Unlock size={16} /> : <Lock size={16} />}</button>
                <button className="ed-ctx danger" title="Delete" onClick={remove}><Trash2 size={16} /></button>
              </>
            ) : (
              <span className="ed-hint">Select an item to edit it, or add something from the left.</span>
            )}
          </div>

          <div className="ed-workspace" onMouseDown={(e) => { if (e.target === e.currentTarget) { c()?.discardActiveObject(); c()?.requestRenderAll(); setSelected(null); } }}>
            <div ref={holder} className="ed-page" />
          </div>
          {error && <div className="ed-notice"><Notice kind="error">{error}</Notice></div>}

          <footer className="ed-bottom">
            <span className="ed-hint">Double-click text to type · Delete removes · Arrows nudge</span>
            <div className="ed-zoom">
              <button onClick={() => applyZoom(zoom - 0.1)} aria-label="Zoom out"><Minus size={14} /></button>
              <input type="range" min="20" max="150" value={Math.round(zoom * 100)} onChange={(e) => applyZoom(Number(e.target.value) / 100)} aria-label="Zoom" />
              <button onClick={() => applyZoom(zoom + 0.1)} aria-label="Zoom in"><Plus size={14} /></button>
              <span className="ed-zoom-v">{Math.round(zoom * 100)}%</span>
              <button onClick={fitZoom} title="Fit to screen"><Maximize size={15} /></button>
            </div>
          </footer>
        </main>
      </div>

      <input ref={uploadInput} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden
        onChange={(e) => { onUpload(e.target.files); e.target.value = ""; }} />
      <input ref={bgInput} type="file" accept="image/png,image/jpeg,image/webp" hidden
        onChange={async (e) => { const f = e.target.files[0]; e.target.value = ""; if (f) { const url = await readFile(f); setUploads((u) => [{ name: f.name, url }, ...u]); setBackgroundImage(url); } }} />
    </div>
  );
}