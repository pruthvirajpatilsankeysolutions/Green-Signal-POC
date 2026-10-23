import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Canvas, FabricImage, FabricObject, Gradient, Rect, Shadow, Textbox, config as fabricConfig, filters, loadSVGFromString, util } from "fabric";
import {
  AlignCenter, AlignLeft, AlignRight, ArrowDown, ArrowLeft, ArrowUp, Bold, ChevronLeft, Copy, Download, Image as ImageIcon,
  FlipHorizontal2, FlipVertical2, Layers, Lock, Magnet, Maximize, Minus, Palette, Plus, Redo2, Save, Shapes, Trash2, Type, Undo2, Unlock, Upload, Wallpaper,
} from "lucide-react";
import { api } from "../api.js";
import { useStatus } from "../App.jsx";
import Notice from "../components/Notice.jsx";
import SaveTemplateDialog from "../components/SaveTemplateDialog.jsx";
import ColorPanel, { DIRECTIONS, normHex } from "../components/ColorPanel.jsx";
import { BADGES, GRAPHICS } from "../editor/graphics.js";
import { LINES, OVERLAYS, SHAPES, makeBadge } from "../editor/shapes.js";

// Fabric.js 7 measures positions from an object's centre by default; this app uses the top-left corner.
FabricObject.ownDefaults.originX = "left";
FabricObject.ownDefaults.originY = "top";
// Pictures draw straight onto the page (no low-quality cached copy), so the high-quality
// smoothing below applies to them when they are shown smaller than their real size.
FabricImage.ownDefaults.objectCaching = false;

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

// saved with every design; "slot" (and its fitting rules) marks what the app fills in a template
const EXTRA = ["name", "isBackground", "lockMovementX", "lockMovementY", "lockScalingX", "lockScalingY", "lockRotation", "hasControls",
  "slot", "minSize", "maxLines", "sourceFont", "sourceFamily", "vAlign", "boxTop", "boxHeight"];
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

// ---------------------------------------------------------------- alignment guides (like Canva)
// While an element is dragged, its edges and centre snap to the page centre / edges and to other
// elements' edges and centres; pink dashed lines show what it lines up with. Hold Alt to move freely.
const SNAP_PX = 6;                                     // snap distance on screen, at any zoom
function addAlignmentGuides(c, size, enabled) {
  let lines = [];
  const box = (o) => {
    const pts = o.getCoords();                         // corners in page units
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    const l = Math.min(...xs), r = Math.max(...xs), t = Math.min(...ys), b = Math.max(...ys);
    return { l, r, t, b, cx: (l + r) / 2, cy: (t + b) / 2 };
  };
  c.on("object:moving", (e) => {
    lines = [];
    const obj = e.target;
    if (!enabled.current || e.e?.altKey) return;
    const tol = SNAP_PX / c.getZoom();
    const moving = new Set([obj, ...(obj.getObjects?.() || [])]);
    const others = c.getObjects().filter((o) => !moving.has(o) && !o.isBackground && o.visible !== false).map(box);
    const page = { l: 0, r: size.width, t: 0, b: size.height, cx: size.width / 2, cy: size.height / 2, page: true };
    const me = box(obj);
    // best match on one axis: [page or element, which edge of mine, which edge of theirs]
    const best = (keysMine, keysTheirs) => {
      let found = null;
      for (const target of [page, ...others]) {
        for (const km of keysMine) for (const kt of keysTheirs) {
          const d = target[kt] - me[km];
          if (Math.abs(d) <= tol && (!found || Math.abs(d) < Math.abs(found.d))) found = { d, at: target[kt], target };
        }
      }
      return found;
    };
    const vx = best(["l", "cx", "r"], ["l", "cx", "r"]);
    const hy = best(["t", "cy", "b"], ["t", "cy", "b"]);
    if (vx) obj.set({ left: obj.left + vx.d });
    if (hy) obj.set({ top: obj.top + hy.d });
    if (vx || hy) obj.setCoords();
    const now = box(obj);
    // vertical line: full page height for the page, otherwise from one element to the other
    if (vx) lines.push(vx.target.page ? { x: vx.at, y1: 0, y2: size.height }
                                      : { x: vx.at, y1: Math.min(now.t, vx.target.t) - 20, y2: Math.max(now.b, vx.target.b) + 20 });
    if (hy) lines.push(hy.target.page ? { y: hy.at, x1: 0, x2: size.width }
                                      : { y: hy.at, x1: Math.min(now.l, hy.target.l) - 20, x2: Math.max(now.r, hy.target.r) + 20 });
  });
  const clear = () => { if (lines.length) { lines = []; c.requestRenderAll(); } };
  c.on("mouse:up", clear);
  c.on("selection:cleared", clear);
  c.on("after:render", () => {
    const ctx = c.contextTop;
    if (!ctx) return;
    c.clearContext(ctx);
    if (!lines.length) return;
    const v = c.viewportTransform, r = c.getRetinaScaling(), z = c.getZoom();
    ctx.save();
    ctx.setTransform(v[0] * r, 0, 0, v[3] * r, v[4] * r, v[5] * r);
    ctx.strokeStyle = "#FF2D95";
    ctx.lineWidth = 1 / z;
    ctx.setLineDash([5 / z, 4 / z]);
    ctx.beginPath();
    for (const ln of lines) {
      if (ln.x !== undefined) { ctx.moveTo(ln.x, ln.y1); ctx.lineTo(ln.x, ln.y2); }
      else { ctx.moveTo(ln.x1, ln.y); ctx.lineTo(ln.x2, ln.y); }
    }
    ctx.stroke();
    ctx.restore();
    c.contextTopDirty = true;                          // Fabric clears these lines on its next render
  });
}

// colour panel value ("#hex" or {type: "gradient", stops, dir}) <-> Fabric fill
const toFabricFill = (v) => (v && typeof v === "object"
  ? new Gradient({ type: "linear", gradientUnits: "percentage", coords: DIRECTIONS[v.dir]?.coords || DIRECTIONS.down.coords,
                   colorStops: [{ offset: 0, color: v.stops[0] }, { offset: 1, color: v.stops[1] }] })
  : v);
const fromFabricFill = (f) => {
  if (f && typeof f === "object" && f.colorStops?.length) {
    const stops = [...f.colorStops].sort((a, b) => a.offset - b.offset);
    const c = f.coords || {};
    const dir = Object.entries(DIRECTIONS).find(([, d]) => ["x1", "y1", "x2", "y2"].every((k) => Math.abs((c[k] ?? 0) - d.coords[k]) < 0.01))?.[0] || "down";
    return { type: "gradient", stops: [normHex(stops[0].color) || "#FFFFFF", normHex(stops[stops.length - 1].color) || "#FFFFFF"], dir };
  }
  return normHex(f) || "#FFFFFF";
};

export default function Editor() {
  const { id, tid } = useParams();
  const templateMode = !!tid;                              // editing a template (Templates page), not a post
  const [missingFonts, setMissingFonts] = useState([]);
  const [replacedFonts, setReplacedFonts] = useState({});  // template fonts the app doesn't have -> the similar font used
  const [downloadedFonts, setDownloadedFonts] = useState([]); // fonts fetched from Google Fonts on import
  const [fontBusy, setFontBusy] = useState("");             // the font being downloaded now ("*" = all)
  const [fontNotes, setFontNotes] = useState({});           // fonts that couldn't be downloaded -> why
  const [unavailableFonts, setUnavailableFonts] = useState([]); // checked: not on Google Fonts (Canva / commercial)
  const [saveDialog, setSaveDialog] = useState(false);     // template mode: Save opens the options dialog
  const [colorTarget, setColorTarget] = useState(null);    // "fill" | "stroke" | "background": the open colour panel
  const guidesOn = useRef(true);                           // alignment guides (bottom bar toggle)
  const [guides, setGuides] = useState(true);
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
  // While zooming, pictures are drawn with the browser's quick shrinking; when zooming stops, they are
  // re-shrunk once at full quality. Re-filtering every large picture on every zoom step made zooming slow.
  const zoomSettle = useRef(null);
  const applyZoom = useCallback((z) => {
    const c = canvasRef.current;
    if (!c || !info) return;
    const value = Math.min(1.5, Math.max(0.2, z));
    c.getObjects().forEach((o) => { if (o.resizeFilter) { o._resizeWhenSettled = o.resizeFilter; o.resizeFilter = null; } });
    c.setDimensions({ width: info.size.width * value, height: info.size.height * value });
    c.setZoom(value);
    c.requestRenderAll();
    setZoomState(value);
    clearTimeout(zoomSettle.current);
    zoomSettle.current = setTimeout(() => {
      c.getObjects().forEach((o) => { if (o._resizeWhenSettled) { o.resizeFilter = o._resizeWhenSettled; delete o._resizeWhenSettled; } });
      c.requestRenderAll();
    }, 250);
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
        const data = templateMode ? await api.templateDesign(tid) : await api.design(id);
        setMissingFonts(data.template?.missing_fonts || []);
        setReplacedFonts(data.template?.replaced_fonts || {});
        setDownloadedFonts(data.template?.downloaded_fonts || []);
        setUnavailableFonts(data.template?.unavailable_fonts || []);
        // register every font; load the core ones now, plus any font the saved design uses
        faces.current = data.fonts.map((f) => {
          const face = new FontFace(f.family, `url(${f.url})`, { weight: f.weight });
          document.fonts.add(face);
          return { family: f.family, core: f.core, face };
        });
        // Rozha One draws Marathi digits like Latin ones: take its digits from Laila Bold (same as the posts)
        const laila = data.fonts.find((f) => f.family === "Laila");
        if (laila && data.fonts.some((f) => f.family === "Rozha One")) {
          const digits = new FontFace("Rozha One", `url(${laila.url})`, { weight: "400", unicodeRange: "U+0966-096F" });
          document.fonts.add(digits);
          faces.current.push({ family: "Rozha One", core: true, face: digits });
        }
        // every font the design uses, including fonts of single characters (e.g. Marathi digits drawn in Laila)
        const used = new Set([...JSON.stringify(data.saved || {}).matchAll(/"fontFamily":"([^"]+)"/g)].map((m) => m[1]));
        await Promise.all(faces.current.filter((f) => f.core || used.has(f.family)).map((f) => f.face.load().catch(() => null)));
        if (disposed) return;
        const { width, height } = data.size;
        fabricConfig.devicePixelRatio = window.devicePixelRatio;     // the screen's density right now
        const c = new Canvas(el, { preserveObjectStacking: true, backgroundColor: "#ffffff" });
        // the browser's default image shrinking skips pixels (moire, jagged lines); use its high-quality
        // resampling for every render: on screen and in exports (Download / Save design)
        c.on("before:render", ({ ctx }) => { if (ctx) ctx.imageSmoothingQuality = "high"; });
        // pictures shown much smaller than their real size are first shrunk properly (averaging pixels),
        // at the size they are drawn: on screen at any zoom, and again at full size when exporting
        const sharpen = (o) => { if (o?.type === "image" && !o.resizeFilter) o.resizeFilter = new filters.Resize({ resizeType: "sliceHack" }); };
        c.on("object:added", (e) => sharpen(e.target));
        c.setDimensions({ width: width * 0.5, height: height * 0.5 });
        c.setZoom(0.5);
        canvasRef.current = c;
        history.current.paused = true;
        if (data.saved) {
          await c.loadFromJSON(portableSources(data.saved));
          if (!c.backgroundColor) c.backgroundColor = "#ffffff";      // designs without a background colour: white, never transparent
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
        c.getObjects().forEach((o) => { if (o.type === "image" && !o.resizeFilter) o.resizeFilter = new filters.Resize({ resizeType: "sliceHack" }); });
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
        addAlignmentGuides(c, { width, height }, guidesOn);
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
  }, [id, tid, snapshot]);

  useEffect(() => { if (info) fitZoom(); }, [info]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stay sharp when the screen's pixel density changes after the editor opened (browser zoom with
  // Ctrl + / Ctrl -, or moving the window to a monitor with another display scale): rebuild the
  // canvas at the new resolution, keeping the current zoom. Without this, everything is stretched.
  useEffect(() => {
    let mq = null;
    const onChange = () => {
      // Fabric copies the pixel density once when the app loads; give it the new one, then rebuild
      fabricConfig.devicePixelRatio = window.devicePixelRatio;
      const c = canvasRef.current;
      if (c && info) applyZoom(c.getZoom());
      watch();
    };
    const watch = () => {
      mq?.removeEventListener("change", onChange);
      mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      mq.addEventListener("change", onChange);
    };
    watch();
    return () => mq?.removeEventListener("change", onChange);
  }, [applyZoom, info]);
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

  // ---------------------------------------------------------------- template fonts
  // A font is now available (downloaded or uploaded): load it and switch back the texts that used a similar font.
  const applyFont = async (fam, fontsAdded) => {
    for (const f of fontsAdded) {
      const face = new FontFace(f.family, `url(${f.url || `/files/assets/fonts/${f.file}`})`, { weight: f.weight });
      await face.load(); document.fonts.add(face);
    }
    setInfo((i) => ({ ...i, fonts: [...i.fonts, ...fontsAdded.map((f) => ({ ...f, url: f.url || `/files/assets/fonts/${f.file}` }))] }));
    const uses = (o) => o.fontFamily === fam || o.sourceFamily === fam;
    c().getObjects().forEach((o) => { if (uses(o)) { o.set({ fontFamily: fontsAdded[0].family }); o.initDimensions?.(); o.dirty = true; } });
    c().requestRenderAll(); snapshot();
    setMissingFonts((m) => m.filter((x) => x !== fam));
    setReplacedFonts((r) => { const n = { ...r }; delete n[fam]; return n; });
  };
  const downloadFont = async (fam) => {
    try {
      const res = await api.autoFont(fam);
      await applyFont(fam, res.fonts);
      setDownloadedFonts((d) => [...new Set([...d, fam])]);
      return true;
    } catch (err) {
      if (/isn't on Google Fonts/.test(err.message)) setUnavailableFonts((u) => [...new Set([...u, fam])]);
      else setFontNotes((n) => ({ ...n, [fam]: err.message }));          // e.g. no internet: worth trying again
      return false;
    }
  };
  const downloadAllFonts = async (families) => {
    setFontBusy("*");
    for (const fam of families) await downloadFont(fam);
    setFontBusy("");
  };

  // ---------------------------------------------------------------- colour panel
  const docColors = () => {
    const out = new Set();
    const add = (v) => { if (typeof v === "string") { const h = normHex(v); if (h) out.add(h); } else if (v?.colorStops) v.colorStops.forEach((st) => add(st.color)); };
    add(c()?.backgroundColor);
    const walk = (o) => { add(o.fill); add(o.stroke); (o._objects || []).forEach(walk); };
    (c()?.getObjects() || []).forEach(walk);
    return [...out].slice(0, 14);
  };
  const brandColors = [...new Set([status?.client?.accent_color, ...COLORS].map(normHex).filter(Boolean))].slice(0, 12);

  const backgroundValue = () => {
    const bg = c()?.getObjects().find((o) => o.isBackground);
    if (bg && bg.type === "rect") return fromFabricFill(bg.fill);
    return normHex(c()?.backgroundColor) || "#FFFFFF";
  };
  const applyBackground = (value, final) => {
    const old = c().getObjects().find((o) => o.isBackground);
    if (typeof value === "string") {                            // plain colour: the canvas colour, no background layer
      if (old) c().remove(old);
      c().backgroundColor = value;
    } else if (old && old.type === "rect") {
      old.set("fill", toFabricFill(value));
    } else {                                                    // gradient: a locked full-page layer at the back
      if (old) c().remove(old);
      const rect = new Rect({ name: "Background", isBackground: true, left: 0, top: 0, width: info.size.width, height: info.size.height, fill: toFabricFill(value) });
      c().add(rect); pinBackground(c());
    }
    c().requestRenderAll();
    if (final) snapshot();
  };
  const applyColor = (value, final) => {
    if (colorTarget === "background") { applyBackground(value, final); return; }
    const obj = c()?.getActiveObject(); if (!obj) return;
    obj.set(colorTarget, colorTarget === "stroke" && typeof value === "object" ? value.stops[0] : toFabricFill(value));
    obj.dirty = true; c().requestRenderAll();
    if (final) snapshot(); else refresh();
  };
  const colorValue = colorTarget === "background" ? backgroundValue() : selected ? fromFabricFill(selected[colorTarget]) : "#FFFFFF";

  // close the panel when its object is no longer selected
  useEffect(() => { if (colorTarget && colorTarget !== "background" && !selected) setColorTarget(null); }, [selected, colorTarget]);

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

  // scale 1 = the page size (1080 px for Instagram); 2 / 3 = HD: texts and shapes re-drawn at that size
  const settleZoom = () => {               // a save or download right after zooming: pictures at full quality first
    clearTimeout(zoomSettle.current);
    c()?.getObjects().forEach((o) => { if (o._resizeWhenSettled) { o.resizeFilter = o._resizeWhenSettled; delete o._resizeWhenSettled; } });
  };
  const exportPng = (scale = 1) => {
    settleZoom();
    c().discardActiveObject(); c().requestRenderAll();
    return c().toDataURL({ format: "png", multiplier: scale / c().getZoom() });
  };

  const save = async (options) => {
    if (!c()) return;
    if (templateMode && !options) { setSaveDialog(true); return; }   // ask for the template's options first
    settleZoom();
    setBusy("save"); setError("");
    try {
      const design = { ...portableSources(c().toObject(EXTRA)), size: info.size };
      if (templateMode) {
        const t = await api.saveTemplateDesign(tid, design, exportPng(), options);
        setInfo((i) => ({ ...i, draft: { ...i.draft, title: t.name }, template: { ...i.template, ...options, name: t.name } }));
        setSaveDialog(false);
      } else await api.saveDesign(id, design, exportPng(2));      // 2x: the server finishes it crisp at the page size
      setSaved(true);
    } catch (e) { setError(e.message); } finally { setBusy(""); }
  };

  const [downloadMenu, setDownloadMenu] = useState(false);
  const download = (scale = 1) => {
    setDownloadMenu(false);
    const a = document.createElement("a");
    const name = templateMode ? `template-${tid}` : `post-${id}`;
    a.href = exportPng(scale); a.download = scale > 1 ? `${name}-hd${scale}x.png` : `${name}.png`; a.click();
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
        <button className="ed-primary ed-custom-colour" onClick={() => { c()?.discardActiveObject(); c()?.requestRenderAll(); setSelected(null); setColorTarget("background"); }}>
          <Palette size={18} /> Custom colour or gradient
        </button>
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
        <button className="ed-top-btn" onClick={() => navigate(templateMode ? "/templates" : "/approvals")}
                title={templateMode ? "Back to Templates" : "Back to Approvals"}><ArrowLeft size={18} /> Back</button>
        <div className="ed-top-group">
          <button className="ed-top-icon" title="Undo (Ctrl+Z)" onClick={() => restore(-1)} disabled={h.index <= 0}><Undo2 size={18} /></button>
          <button className="ed-top-icon" title="Redo (Ctrl+Y)" onClick={() => restore(1)} disabled={h.index >= h.stack.length - 1}><Redo2 size={18} /></button>
          <span className="ed-status">{busy === "save" ? "Saving…" : saved ? "Saved" : ""}</span>
        </div>
        <div className="ed-title mr">{info ? (templateMode ? `Template: ${info.draft.title}` : info.draft.title) : "Loading…"}</div>
        <div className="ed-top-group">
          <span className="ed-dl">
            <button className="ed-top-btn" onClick={() => setDownloadMenu((v) => !v)} disabled={!info} aria-expanded={downloadMenu}><Download size={18} /> Download</button>
            {downloadMenu && info && (
              <span className="ed-dl-menu" role="menu">
                {[[1, "Instagram", "post size"], [2, "HD 2×", "sharp when zoomed or printed"], [3, "HD 3×", "for print and banners"]].map(([k, label, note]) => (
                  <button key={k} role="menuitem" onClick={() => download(k)}>
                    <b>{label}</b> <span>{info.size.width * k} × {info.size.height * k} px · {note}</span>
                  </button>
                ))}
              </span>
            )}
          </span>
          <button className="ed-top-save" onClick={() => save()} disabled={!info || busy === "save"}><Save size={18} /> {templateMode ? "Save template" : "Save design"}</button>
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
                {templateMode && info?.slots && (isText || selected.type === "image") && (
                  <label className="ed-fill" title="What the app puts here when it makes a post from this template">
                    Fill with
                    <select value={selected.slot || ""} onChange={(e) => { setProp("slot", e.target.value || undefined); setSelected(c().getActiveObject()); }}>
                      <option value="">{isText ? "Keep this text" : "Keep this picture"}</option>
                      {info.slots.filter((sl) => sl.kind === (isText ? "text" : "image")).map((sl) => <option key={sl.id} value={sl.id}>{sl.label}</option>)}
                    </select>
                  </label>
                )}
                {templateMode && (isText || selected.type === "image") && <span className="ed-sep" />}
                {isText && (
                  <>
                    <select className="ed-select" value={selected.fontFamily} onChange={(e) => setFont(e.target.value)} aria-label="Font">
                      <optgroup label="Marathi">{fontsIn("marathi").map((f) => <option key={f} value={f}>{f}</option>)}</optgroup>
                      <optgroup label="English only">{fontsIn("english").map((f) => <option key={f} value={f}>{f}</option>)}</optgroup>
                      {fontsIn("added").length > 0 && <optgroup label="Added fonts">{fontsIn("added").map((f) => <option key={f} value={f}>{f}</option>)}</optgroup>}
                      {!info.fonts.some((f) => f.family === selected.fontFamily) && <option value={selected.fontFamily}>{selected.fontFamily} (missing)</option>}
                    </select>
                    <div className="ed-size">
                      <button onClick={() => setProp("fontSize", Math.max(10, Math.round(selected.fontSize) - 4))} aria-label="Smaller"><Minus size={14} /></button>
                      <input value={Math.round(selected.fontSize)} onChange={(e) => setProp("fontSize", Number(e.target.value) || selected.fontSize)} aria-label="Font size" />
                      <button onClick={() => setProp("fontSize", Math.round(selected.fontSize) + 4)} aria-label="Bigger"><Plus size={14} /></button>
                    </div>
                    <button className={`ed-color${colorTarget === "fill" ? " on" : ""}`} title="Text colour"
                            style={{ "--c": typeof selected.fill === "string" ? currentFill : "linear-gradient(90deg, #F26B0F, #FFC94A)" }}
                            onClick={() => setColorTarget(colorTarget === "fill" ? null : "fill")}>
                      <span className="ed-color-a" style={{ borderImage: typeof selected.fill === "string" ? "none" : "linear-gradient(90deg, #F26B0F, #FFC94A) 1" }}>A</span>
                    </button>
                    <button className={`ed-ctx${isBold(selected.fontWeight) ? " on" : ""}`} title="Bold"
                      onClick={() => setProp("fontWeight", isBold(selected.fontWeight) ? "400" : "800")}><Bold size={16} /></button>
                    {[["left", AlignLeft], ["center", AlignCenter], ["right", AlignRight]].map(([a, Icon]) => (
                      <button key={a} className={`ed-ctx${selected.textAlign === a ? " on" : ""}`} title={`Align ${a}`} onClick={() => setProp("textAlign", a)}><Icon size={16} /></button>
                    ))}
                    <button className={`ed-ctx text${selected.shadow ? " on" : ""}`} onClick={() => setProp("shadow", selected.shadow ? null : shadow())}>Shadow</button>
                  </>
                )}
                {(isShape || isLine || (["rect", "circle", "ellipse", "triangle", "polygon", "path"].includes(selected.type) && selected.fill?.colorStops)) && (
                  <button className={`ed-color swatch${colorTarget ? " on" : ""}`} title="Colour"
                          style={{ "--c": isLine ? selected.stroke : typeof selected.fill === "string" ? currentFill : "linear-gradient(135deg, #F26B0F, #FFC94A)" }}
                          onClick={() => { const t = isLine ? "stroke" : "fill"; setColorTarget(colorTarget === t ? null : t); }} />
                )}
                <span className="ed-sep" />
                <label className="ed-opacity" title="Transparency">
                  <span>{Math.round((selected.opacity ?? 1) * 100)}%</span>
                  <input type="range" min="10" max="100" value={Math.round((selected.opacity ?? 1) * 100)} onChange={(e) => setProp("opacity", Number(e.target.value) / 100)} />
                </label>
                {!isText && (
                  <>
                    <button className={`ed-ctx${selected.flipX ? " on" : ""}`} title="Flip horizontal" onClick={() => setProp("flipX", !selected.flipX)}><FlipHorizontal2 size={16} /></button>
                    <button className={`ed-ctx${selected.flipY ? " on" : ""}`} title="Flip vertical" onClick={() => setProp("flipY", !selected.flipY)}><FlipVertical2 size={16} /></button>
                  </>
                )}
                <button className="ed-ctx" title="Bring forward" onClick={() => layer(1)}><ArrowUp size={16} /></button>
                <button className="ed-ctx" title="Send backward" onClick={() => layer(-1)}><ArrowDown size={16} /></button>
                <button className="ed-ctx" title="Duplicate (Ctrl+D)" onClick={duplicate}><Copy size={16} /></button>
                <button className="ed-ctx" title={selected.lockMovementX ? "Unlock" : "Lock"} onClick={toggleLock}>{selected.lockMovementX ? <Unlock size={16} /> : <Lock size={16} />}</button>
                <button className="ed-ctx danger" title="Delete" onClick={remove}><Trash2 size={16} /></button>
              </>
            ) : (
              <span className={templateMode ? "ed-template-hint" : "ed-hint"}>
                {templateMode ? "Template: click a text or picture, then choose Fill with to let the app fill it for each post. Save template when done."
                  : "Select an item to edit it, or add something from the left."}
              </span>
            )}
          </div>

          <div className="ed-workspace" onMouseDown={(e) => { if (e.target === e.currentTarget) { c()?.discardActiveObject(); c()?.requestRenderAll(); setSelected(null); } }}>
            <div ref={holder} className="ed-page" />
          </div>
          {error && <div className="ed-notice"><Notice kind="error">{error}</Notice></div>}
          {colorTarget && info && (
            <div className="ed-color-pop">
              <ColorPanel key={`${colorTarget}-${selected ? c().getObjects().indexOf(selected) : "bg"}`}
                          title={{ fill: isText ? "Text colour" : "Colour", stroke: "Line colour", background: "Background colour" }[colorTarget]}
                          value={colorValue} allowGradient={colorTarget !== "stroke"}
                          docColors={docColors()} brandColors={brandColors}
                          onChange={applyColor} onClose={() => setColorTarget(null)} />
            </div>
          )}
          {saveDialog && info?.template && (
            <SaveTemplateDialog template={info.template} choices={info.choices} busy={busy === "save"}
                                onSave={(options) => save(options)} onClose={() => setSaveDialog(false)} />
          )}
          {templateMode && (missingFonts.length > 0 || Object.keys(replacedFonts).length > 0 || downloadedFonts.length > 0) && (() => {
            const open = [...new Set([...missingFonts, ...Object.keys(replacedFonts)])];
            const canDownload = open.filter((f) => !unavailableFonts.includes(f));     // not checked yet, or a network error
            const commercial = open.filter((f) => unavailableFonts.includes(f));       // Canva / commercial: only an upload helps
            const using = (f) => replacedFonts[f] ? ` (using ${replacedFonts[f]})` : "";
            const uploadButton = (fam) => (
              <label className="btn small">Upload file
                <input type="file" accept=".ttf,.otf,.woff,.woff2" hidden onChange={async (e) => {
                  const file = e.target.files?.[0]; if (!file) return;
                  try {
                    const weight = c().getObjects().find((o) => o.fontFamily === fam || o.sourceFamily === fam)?.fontWeight || "400";
                    const f = await api.addFont(file, fam, String(weight));
                    await applyFont(fam, [f]);
                    setUnavailableFonts((u) => u.filter((x) => x !== fam));
                  } catch (err) { setError(err.message); }
                }} /></label>
            );
            return (
              <div className="ed-notice ed-notice-bottom"><Notice kind={canDownload.length ? "warning" : open.length ? "info" : "success"}>
                {downloadedFonts.length > 0 && <div>Downloaded from Google Fonts (free, open licence): <b>{downloadedFonts.join(", ")}</b>.</div>}
                {commercial.length > 0 && (
                  <div>
                    Canva / commercial fonts (not downloadable), so similar open fonts are used:{" "}
                    <b>{commercial.map((f) => `${f}${replacedFonts[f] ? ` → ${replacedFonts[f]}` : ""}`).join(", ")}</b>.
                    {" "}For the exact look, use Google fonts in Canva, or upload the font files if you have a licence.
                  </div>
                )}
                {canDownload.length > 0 && (
                  <div>
                    Fonts not in the app yet: <b>{canDownload.map((f) => f + using(f)).join(", ")}</b>. Try <b>Download automatically</b> (Google Fonts).
                    {canDownload.length > 1 && (
                      <span className="tpl-fontfix">
                        <button className="btn small primary" disabled={!!fontBusy} onClick={() => downloadAllFonts(canDownload)}>
                          {fontBusy === "*" ? "Downloading…" : "Download all automatically"}
                        </button>
                      </span>
                    )}
                  </div>
                )}
                {open.map((fam) => (
                  <span key={fam} className="tpl-fontfix ed-fontrow">
                    <b>{fam}</b>{commercial.includes(fam) && <span className="ed-fontmeta">{replacedFonts[fam] ? `using ${replacedFonts[fam]}` : "commercial font"}</span>}
                    {!commercial.includes(fam) && (
                      <button className="btn small" disabled={!!fontBusy}
                              onClick={async () => { setFontBusy(fam); await downloadFont(fam); setFontBusy(""); }}>
                        {fontBusy === fam ? "Downloading…" : "Download automatically"}
                      </button>
                    )}
                    {uploadButton(fam)}
                    {fontNotes[fam] && <span className="ed-fontnote">{fontNotes[fam]}</span>}
                  </span>
                ))}
                {!canDownload.length && <button className="btn small ed-fontok" onClick={() => { setDownloadedFonts([]); setReplacedFonts({}); setMissingFonts([]); }}>OK</button>}
              </Notice></div>
            );
          })()}

          <footer className="ed-bottom">
            <span className="ed-hint">Double-click text to type · Delete removes · Arrows nudge · Alt-drag moves without snapping</span>
            <button className={`ed-guides${guides ? " on" : ""}`} aria-pressed={guides} title="Alignment guides while dragging"
                    onClick={() => { guidesOn.current = !guidesOn.current; setGuides(guidesOn.current); }}>
              <Magnet size={15} /> Guides {guides ? "on" : "off"}
            </button>
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