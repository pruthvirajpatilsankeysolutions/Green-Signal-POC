import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Canvas, FabricImage, FabricObject, Gradient, Rect, Shadow, Textbox, config as fabricConfig, filters, loadSVGFromString, util } from "fabric";
import {
  ALargeSmall, Grid3x3, MoveLeft, MoveRight, Rows3, Table2, UnfoldVertical, ChevronsUpDown, AlignCenter, AlignLeft, TextAlignJustify as AlignJustify, AlignRight, ArrowDown, ArrowDownToLine, ArrowUpToLine, Blend, FoldVertical, Italic, List, Sparkles, Underline, ArrowLeft, ArrowUp, Bold, ChevronLeft, ChevronRight, CircleHelp, ClipboardPaste, Copy, CopyPlus, Download, Expand, Image as ImageIcon,
  FlipHorizontal2, FlipVertical2, GripVertical, Layers, Lock, Maximize, Minimize, Minus, Palette, Plus, Redo2, Save, Shapes, Trash2, Type, Undo2, Unlock, Upload, Wallpaper,
} from "lucide-react";
import { api } from "../api.js";
import { useStatus } from "../App.jsx";
import Notice from "../components/Notice.jsx";
import SaveTemplateDialog from "../components/SaveTemplateDialog.jsx";
import ColorPanel, { DIRECTIONS, normHex } from "../components/ColorPanel.jsx";
import { BADGES, GRAPHICS } from "../editor/graphics.js";
import IconBrowser from "../editor/IconBrowser.jsx";
import { makeShapePath } from "../editor/shapeLibrary.js";
import { BORDER_MODES, TABLE_OPS, bakeScale, buildTable, cellAt, cellCorners, localPoint, newTable, rebuild, showH, showV } from "../editor/table.js";
import { LINES, OVERLAYS, makeBadge } from "../editor/shapes.js";

// Fabric.js 7 measures positions from an object's centre by default; this app uses the top-left corner.
FabricObject.ownDefaults.originX = "left";
FabricObject.ownDefaults.originY = "top";
// Selection box: a clear purple outline with round white handles (easy to see and grab at any zoom)
Object.assign(FabricObject.ownDefaults, {
  borderColor: "#8B3DFF", borderScaleFactor: 2.5, borderOpacityWhenMoving: 1,
  cornerStyle: "circle", cornerColor: "#FFFFFF", cornerStrokeColor: "#8B3DFF", transparentCorners: false,
  cornerSize: 14, touchCornerSize: 28,
});
// Pictures draw straight onto the page (no low-quality cached copy), so the high-quality
// smoothing below applies to them when they are shown smaller than their real size.
FabricImage.ownDefaults.objectCaching = false;
// Texts are drawn straight onto the page too: Fabric's cached copy of a text softens small text
// (measured: small text 14% less sharp than a perfect rendering; drawn directly: 2%).
Textbox.ownDefaults.objectCaching = false;

// Styled ranges imported from a PPTX ({line, start, end} in UTF-16 units) -> Fabric styles, counted with
// Fabric's own grapheme split (a Devanagari syllable is one position for Fabric). Same as the server engine.
function applyRunStyles(o) {
  if (!o.runStyles || !o.runStyles.length) return;
  const lines = String(o.text).split("\n"), styles = {};
  for (const rs of o.runStyles) {
    const line = lines[rs.line];
    if (line == null) continue;
    let at = 0;
    util.string.graphemeSplit(line).forEach((g, gi) => {
      if (at >= rs.start && at < rs.end) (styles[rs.line] = styles[rs.line] || {})[gi] = { ...rs.style };
      at += g.length;
    });
  }
  o.set({ styles }); o.runStyles = null;
}

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

// a small picture of one layer for the Layers panel ("" if it can't be drawn: the name is shown instead)
const layerThumb = (o) => {
  try {
    const { width, height } = o.getBoundingRect();
    if (!width || !height) return "";
    return o.toDataURL({ format: "png", enableRetinaScaling: false, multiplier: Math.min(1, 260 / width, 90 / height) });
  } catch { return ""; }
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
  "slot", "minSize", "maxLines", "sourceFont", "sourceFamily", "vAlign", "boxTop", "boxHeight", "textTransform", "flowAfter", "anchor", "table"];

// Anchor text box: when the text grows or shrinks, the box keeps its top, middle or bottom edge in place
const anchorFix = (o) => {
  const h = o.getScaledHeight();
  if (o._anchorH != null && o.anchor && o.anchor !== "top") o.set({ top: o.top + (o._anchorH - h) * (o.anchor === "bottom" ? 1 : 0.5) });
  o._anchorH = h; o.setCoords();
};
const isLightColor = (hex) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return false;
  const n = parseInt(m[1], 16);
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) > 150;
};
const BULLET = "• ";
const isListed = (o) => o?.type === "textbox" && (o.text || "").split("\n").every((l) => !l.trim() || l.startsWith(BULLET));
const effectOf = (o) => (o?.strokeWidth > 0 ? "outline" : o?.shadow ? (o.shadow.offsetY === 0 && o.shadow.offsetX === 0 ? "glow" : "shadow") : "none");
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
    const sel = c._tableSel;                           // the clicked cell of the selected table
    const cell = sel && c.getActiveObject() === sel.group && c.getObjects().includes(sel.group) ? cellCorners(sel.group, sel.r, sel.c) : null;
    if (!lines.length && !cell) return;
    const v = c.viewportTransform, r = c.getRetinaScaling(), z = c.getZoom();
    ctx.save();
    ctx.setTransform(v[0] * r, 0, 0, v[3] * r, v[4] * r, v[5] * r);
    if (cell) {
      ctx.beginPath();
      cell.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.fillStyle = "rgba(124, 58, 237, .12)"; ctx.fill();
      ctx.strokeStyle = "#7C3AED"; ctx.lineWidth = 3 / z; ctx.setLineDash([]); ctx.stroke();
    }
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
  const guidesOn = useRef(true);                           // alignment guides while dragging, always on
  const [helpOpen, setHelpOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
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

  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const toggleFullscreen = () => { (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => null); };

  // ---------------------------------------------------------------- load
  useEffect(() => {
    let disposed = false;
    const el = document.createElement("canvas");
    holder.current.innerHTML = "";       // a canvas left behind by the previous editor's dispose would add a blank 150px strip above the page
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
        const c = new Canvas(el, { preserveObjectStacking: true, backgroundColor: "#ffffff", stopContextMenu: false });
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
          c.getObjects().forEach((o) => { if (o.type === "textbox") applyRunStyles(o); });
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
        c.on("mouse:down", (e) => tableEvents.current.down?.(e));
        c.on("mouse:dblclick", (e) => tableEvents.current.dbl?.(e));
        c.on("object:modified", (e) => {                 // stretching a table resizes its cells
          const t = e.target;
          if (t?.table && (Math.abs(t.scaleX - 1) > 0.001 || Math.abs(t.scaleY - 1) > 0.001)) setSelected(rebuild(c, t, bakeScale(t)));
        });
        c.on("object:modified", snapshot);
        c.on("text:changed", (e) => { if (e.target?.anchor) anchorFix(e.target); refresh(); });
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

  // Ctrl + wheel / pinch and Ctrl + / Ctrl - / Ctrl 0 zoom the design, not the whole browser page (like Canva)
  useEffect(() => {
    const zoomBy = (factor) => { const c = canvasRef.current; if (c) applyZoom(c.getZoom() * factor); };
    const onWheel = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      zoomBy(Math.exp(-Math.max(-25, Math.min(25, e.deltaY)) * 0.01));   // a mouse-wheel notch is about 100, a trackpad pinch a few: cap the step
    };
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      if (e.key === "+" || e.key === "=") { e.preventDefault(); zoomBy(1.1); }
      else if (e.key === "-" || e.key === "_") { e.preventDefault(); zoomBy(1 / 1.1); }
      else if (e.key === "0") { e.preventDefault(); fitZoom(); }
    };
    window.addEventListener("wheel", onWheel, { passive: false });      // passive: false, or the browser zooms the page anyway
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("wheel", onWheel); window.removeEventListener("keydown", onKey); };
  }, [applyZoom, fitZoom]);

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
      if (mod && e.key.toLowerCase() === "c" && obj) { e.preventDefault(); copy(); return; }
      if (mod && e.key.toLowerCase() === "v") { e.preventDefault(); paste(); return; }
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

  // an icon from the Iconify library (SVG text): an editable shape, centred on the page
  const addIconSvg = async (svg, name) => {
    const { objects, options } = await loadSVGFromString(svg);
    const obj = util.groupSVGElements(objects.filter(Boolean), options);
    obj.scaleToWidth(260);
    centerPlace(obj, name.charAt(0).toUpperCase() + name.slice(1));
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

  // ---------------------------------------------------------------- layers panel: pictures, filter, drag to reorder
  const [layerFilter, setLayerFilter] = useState("all");   // "all" | "overlap" (only what touches the selected item)
  const [dragOver, setDragOver] = useState(null);
  const dragFrom = useRef(null);
  const thumbs = useMemo(() => (tab === "layers" ? new Map(layers.map((o) => [o, layerThumb(o)])) : null), [layers, tab]);
  const moveLayer = (obj, onto) => {
    if (!obj || !onto || obj === onto) return;
    const objects = c().getObjects();
    c().moveObjectTo(obj, Math.max(objects.indexOf(onto), objects.some((o) => o.isBackground) ? 1 : 0));
    pinBackground(c()); c().requestRenderAll(); snapshot();
  };

  // ---------------------------------------------------------------- tables
  const tableEvents = useRef({});
  const [cellEdit, setCellEdit] = useState(null);          // the cell being typed in: { group, r, c, x, y, w, h, size, text }
  const skipCommit = useRef(false);

  const addTable = async (opts) => {
    await ensureFont("Mukta");
    const model = newTable({ ...opts, width: Math.min(W() - 160, 300 * opts.cols) });
    centerPlace(buildTable(model), "Table");
  };
  // change the selected table's model (cell = the cell that was right-clicked) and redraw it
  const editTable = (fn, cell, ...args) => {
    const group = c()?.getActiveObject();
    if (!group?.table) return;
    const model = structuredClone(group.table);
    fn(model, cell || { r: 0, c: 0 }, ...args);
    setSelected(rebuild(c(), group, model));
    snapshot();
  };
  const cellOfEvent = (group, nativeEvent) => {
    const p = localPoint(group, c().getScenePoint(nativeEvent));
    return cellAt(group.table, p.x, p.y);
  };
  const openCellEdit = (group, r, col) => {
    const corners = cellCorners(group, r, col), z = c().getZoom(), box = c().upperCanvasEl.getBoundingClientRect();
    setCellEdit({
      group, r, c: col, text: group.table.cells[r][col].text,
      x: box.left + corners[0][0] * z, y: box.top + corners[0][1] * z,
      w: (corners[1][0] - corners[0][0]) * z, h: (corners[3][1] - corners[0][1]) * z, size: group.table.fontSize * group.scaleY * z,
    });
  };
  const commitCell = (value) => {
    const edit = cellEdit;
    setCellEdit(null);
    if (skipCommit.current) { skipCommit.current = false; return; }
    if (!edit || value === edit.text || !c().getObjects().includes(edit.group)) return;
    const model = structuredClone(edit.group.table);
    model.cells[edit.r][edit.c].text = value;
    setSelected(rebuild(c(), edit.group, model));
    snapshot();
  };
  tableEvents.current = {
    down: (e) => {
      const t = e.target;
      c()._tableSel = t?.table ? { group: t, ...cellOfEvent(t, e.e) } : null;
      c().requestRenderAll();
    },
    dbl: (e) => { const t = e.target; if (t?.table) { const { r, c: col } = cellOfEvent(t, e.e); openCellEdit(t, r, col); } },
  };

  // ---------------------------------------------------------------- right-click menu (Canva-style)
  const clipboard = useRef(null);                          // the copied object
  const styleClip = useRef(null);                          // the copied look, applied to the next item clicked
  const [styleMode, setStyleMode] = useState(false);
  const [menu, setMenu] = useState(null);                  // { x, y, layers } while the menu is open
  const STYLE_KEYS = ["fill", "stroke", "strokeWidth", "opacity", "shadow", "fontFamily", "fontWeight", "fontStyle", "fontSize", "textAlign", "underline"];

  const copy = async () => {
    const obj = c()?.getActiveObject();
    if (obj) clipboard.current = await obj.clone(EXTRA);
  };
  const paste = async () => {
    if (!clipboard.current) return;
    const copyOf = await clipboard.current.clone(EXTRA);
    copyOf.set({ left: clipboard.current.left + 30, top: clipboard.current.top + 30, isBackground: false });
    clipboard.current.set({ left: copyOf.left, top: copyOf.top });   // the next paste steps down again
    place(copyOf);
  };
  const copyStyle = () => {
    const obj = c()?.getActiveObject();
    if (!obj) return;
    styleClip.current = { source: obj, props: Object.fromEntries(STYLE_KEYS.filter((k) => k in obj).map((k) => [k, obj[k]])) };
    setStyleMode(true);
  };
  const layerTo = (where) => {
    const obj = c()?.getActiveObject();
    if (!obj) return;
    if (where === "front") c().bringObjectToFront(obj);
    else if (where === "back") { c().sendObjectToBack(obj); pinBackground(c()); }   // never behind the pinned background
    else layer(where === "forward" ? 1 : -1);
    c().requestRenderAll(); snapshot();
  };

  // after "Copy style": the next different item selected takes on the copied look
  useEffect(() => {
    if (!styleMode || !selected || selected === styleClip.current?.source) return;
    const props = { ...styleClip.current.props };
    if (selected.type !== "textbox") ["fontFamily", "fontWeight", "fontStyle", "fontSize", "textAlign", "underline"].forEach((k) => delete props[k]);
    selected.set(props); selected.setCoords?.();
    c().requestRenderAll(); snapshot();
    styleClip.current = null; setStyleMode(false);
  }, [selected, styleMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const openMenu = (e) => {
    e.preventDefault();
    const target = c()?.findTarget(e)?.target;         // Fabric 7 returns { target, subTargets, ... }
    if (target && !target.isBackground) { c().setActiveObject(target); c().requestRenderAll(); setSelected(target); }
    else if (!c()?.getActiveObject()) { setMenu(null); return; }
    const hit = c().getActiveObject();
    setMenu({ x: e.clientX, y: e.clientY, layers: false, cell: hit?.table ? cellOfEvent(hit, e.nativeEvent) : null });
  };
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e) => { if (e.key === "Escape") close(); };
    window.addEventListener("mousedown", close); window.addEventListener("resize", close);
    window.addEventListener("wheel", close); window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", close); window.removeEventListener("resize", close);
      window.removeEventListener("wheel", close); window.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  const setProp = (key, value) => {
    const obj = c().getActiveObject();
    if (!obj) return;
    if (obj.type === "textbox") obj._anchorH = obj.getScaledHeight();
    obj.set(key, value);
    if (obj.type === "textbox" && obj.anchor) anchorFix(obj);
    obj.setCoords?.(); c().requestRenderAll(); snapshot();
  };

  // ---------------------------------------------------------------- text toolbar: alignment, list, effects, spacing popups
  const [pop, setPop] = useState(null);                    // { kind: "spacing" | "effects" | "opacity", x, y }
  const openPop = (kind, e) => {
    const r = e.currentTarget.getBoundingClientRect();
    setPop((p) => (p?.kind === kind ? null : { kind, x: Math.min(r.left, window.innerWidth - 340), y: r.bottom + 8 }));
  };
  useEffect(() => {
    if (!pop) return;
    const close = () => setPop(null);
    window.addEventListener("mousedown", close); window.addEventListener("resize", close);
    return () => { window.removeEventListener("mousedown", close); window.removeEventListener("resize", close); };
  }, [pop]);
  useEffect(() => { setPop((p) => (p?.kind === "borders" && selected?.table ? p : null)); }, [selected]);

  const cycleAlign = () => {
    const order = ["left", "center", "right", "justify"];
    setProp("textAlign", order[(order.indexOf(selected.textAlign) + 1) % order.length]);
  };
  const toggleList = () => {
    const obj = c().getActiveObject();
    if (!obj || obj.type !== "textbox") return;
    const lines = (obj.text || "").split("\n");
    const next = isListed(obj) ? lines.map((l) => (l.startsWith(BULLET) ? l.slice(BULLET.length) : l)) : lines.map((l) => (l.trim() && !l.startsWith(BULLET) ? BULLET + l : l));
    obj.styles = {};                                       // per-letter styles no longer line up once the text changes
    setProp("text", next.join("\n"));
  };
  const setEffect = (kind) => {
    const obj = c().getActiveObject();
    if (!obj) return;
    const light = typeof obj.fill === "string" && isLightColor(obj.fill);
    const changes = { shadow: null, stroke: null, strokeWidth: 0, paintFirst: "fill" };
    if (kind === "shadow") changes.shadow = shadow();
    if (kind === "glow") changes.shadow = new Shadow({ color: typeof obj.fill === "string" ? obj.fill : "#FFC94A", blur: 24, offsetX: 0, offsetY: 0 });
    if (kind === "outline") Object.assign(changes, { stroke: light ? "#111111" : "#FFFFFF", strokeWidth: Math.max(2, Math.round(obj.fontSize * 0.06)), paintFirst: "stroke" });
    obj.set(changes); c().requestRenderAll(); snapshot();
  };
  const setAnchor = (a) => {
    const obj = c().getActiveObject();
    if (!obj) return;
    obj.anchor = a; obj._anchorH = obj.getScaledHeight(); snapshot();
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
      </>
    ),
    elements: (
      <IconBrowser onPick={addIconSvg} onAddTable={addTable} onPickShape={(sh) => centerPlace(makeShapePath(sh), sh.name)}>
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
      </IconBrowser>
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
    layers: tab !== "layers" ? null : (
      <>
        <div className="ed-layers-title">Layers</div>
        <div className="ed-seg" role="tablist">
          {[["all", "All"], ["overlap", "Overlapping"]].map(([k, label]) => (
            <button key={k} role="tab" aria-selected={layerFilter === k} className={layerFilter === k ? "on" : ""} onClick={() => setLayerFilter(k)}>{label}</button>
          ))}
        </div>
        <ul className="ed-layers">
          {layers.filter((o) => layerFilter === "all" || !selected || o === selected || o.intersectsWithObject?.(selected)).map((o) => (
            <li key={layers.indexOf(o)} draggable={!o.isBackground}
                className={[dragOver === o ? "over" : "", dragFrom.current === o ? "dragging" : ""].join(" ")}
                onDragStart={(e) => { dragFrom.current = o; e.dataTransfer.effectAllowed = "move"; }}
                onDragOver={(e) => { if (dragFrom.current && dragFrom.current !== o) { e.preventDefault(); setDragOver(o); } }}
                onDragLeave={() => setDragOver((v) => (v === o ? null : v))}
                onDrop={(e) => { e.preventDefault(); moveLayer(dragFrom.current, o); dragFrom.current = null; setDragOver(null); }}
                onDragEnd={() => { dragFrom.current = null; setDragOver(null); }}>
              <button className={o === selected ? "on" : ""} onClick={() => selectLayer(o)}>
                <GripVertical size={18} className="grip" />
                <span className="lay-pic">
                  {thumbs?.get(o) ? <img src={thumbs.get(o)} alt="" draggable={false} />
                    : <span className="ellipsis">{o.type === "textbox" ? (o.text || "").split("\n")[0] : (o.name || o.type)}</span>}
                </span>
                {o.lockMovementX && <Lock size={14} aria-label="Locked" />}
              </button>
            </li>
          ))}
        </ul>
      </>
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
                    <button className={`ed-color${colorTarget === "fill" ? " on" : ""}`} title="Text colour"
                            style={{ "--c": typeof selected.fill === "string" ? currentFill : "linear-gradient(90deg, #F26B0F, #FFC94A)" }}
                            onClick={() => setColorTarget(colorTarget === "fill" ? null : "fill")}>
                      <span className="ed-color-a" style={{ borderImage: typeof selected.fill === "string" ? "none" : "linear-gradient(90deg, #F26B0F, #FFC94A) 1" }}>A</span>
                    </button>
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
                    <button className="ed-ctx" title={`Alignment: ${selected.textAlign} (click to change)`} onClick={cycleAlign}>
                      {(() => { const A = { left: AlignLeft, center: AlignCenter, right: AlignRight, justify: AlignJustify }[selected.textAlign] || AlignLeft; return <A size={16} />; })()}
                    </button>
                    <button className={`ed-ctx${isBold(selected.fontWeight) ? " on" : ""}`} title="Bold"
                      onClick={() => setProp("fontWeight", isBold(selected.fontWeight) ? "400" : "800")}><Bold size={16} /></button>
                    <button className={`ed-ctx${selected.fontStyle === "italic" ? " on" : ""}`} title="Italic"
                      onClick={() => setProp("fontStyle", selected.fontStyle === "italic" ? "normal" : "italic")}><Italic size={16} /></button>
                    <button className={`ed-ctx${selected.underline ? " on" : ""}`} title="Underline"
                      onClick={() => setProp("underline", !selected.underline)}><Underline size={16} /></button>
                    <button className={`ed-ctx${isListed(selected) ? " on" : ""}`} title="Bulleted list" onClick={toggleList}><List size={16} /></button>
                    <span className="ed-sep" />
                    <button className={`ed-ctx${pop?.kind === "spacing" ? " on" : ""}`} title="Spacing and advanced settings" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => openPop("spacing", e)}><ALargeSmall size={16} /></button>
                    <button className={`ed-ctx text${pop?.kind === "effects" || effectOf(selected) !== "none" ? " on" : ""}`} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => openPop("effects", e)}><Sparkles size={15} /> Effects</button>
                  </>
                )}
                {selected.table && (
                  <>
                    <button className={`ed-ctx text${pop?.kind === "borders" ? " on" : ""}`} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => openPop("borders", e)}><Grid3x3 size={15} /> Borders</button>
                    <div className="ed-size">
                      <button onClick={() => editTable((m) => { m.fontSize = Math.max(10, m.fontSize - 4); })} aria-label="Smaller text"><Minus size={14} /></button>
                      <input value={selected.table.fontSize} readOnly aria-label="Table text size" />
                      <button onClick={() => editTable((m) => { m.fontSize += 4; })} aria-label="Bigger text"><Plus size={14} /></button>
                    </div>
                  </>
                )}
                {(isShape || isLine || (["rect", "circle", "ellipse", "triangle", "polygon", "path"].includes(selected.type) && selected.fill?.colorStops)) && (
                  <button className={`ed-color swatch${colorTarget ? " on" : ""}`} title="Colour"
                          style={{ "--c": isLine ? selected.stroke : typeof selected.fill === "string" ? currentFill : "linear-gradient(135deg, #F26B0F, #FFC94A)" }}
                          onClick={() => { const t = isLine ? "stroke" : "fill"; setColorTarget(colorTarget === t ? null : t); }} />
                )}
                <span className="ed-sep" />
                <button className={`ed-ctx${pop?.kind === "opacity" ? " on" : ""}`} title={`Transparency (${Math.round((selected.opacity ?? 1) * 100)}%)`} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => openPop("opacity", e)}><Blend size={16} /></button>
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
            ) : templateMode && (
              <span className="ed-template-hint">
                Template: click a text or picture, then choose Fill with to let the app fill it for each post. Save template when done.
              </span>
            )}
          </div>

          <div className={`ed-workspace${styleMode ? " painting" : ""}`} onContextMenu={openMenu}
               onMouseDown={(e) => { if (e.target === e.currentTarget) { c()?.discardActiveObject(); c()?.requestRenderAll(); setSelected(null); } }}>
            <div ref={holder} className="ed-page" />
          </div>
          {styleMode && (
            <div className="ed-style-hint">Click another item to apply the copied style
              <button onClick={() => { styleClip.current = null; setStyleMode(false); }}>Cancel</button></div>
          )}
          {pop && selected && (
            <div className="ed-pop" style={{ left: pop.x, top: pop.y }} onMouseDown={(e) => e.stopPropagation()}>
              {pop.kind === "opacity" && (
                <>
                  <div className="ed-pop-title">Transparency</div>
                  <div className="ed-pop-row">
                    <input type="range" min="0" max="100" value={Math.round((selected.opacity ?? 1) * 100)} onChange={(e) => setProp("opacity", Number(e.target.value) / 100)} />
                    <input className="ed-pop-num" value={Math.round((selected.opacity ?? 1) * 100)} onChange={(e) => setProp("opacity", Math.min(100, Math.max(0, Number(e.target.value) || 0)) / 100)} />
                  </div>
                </>
              )}
              {pop.kind === "effects" && (
                <>
                  <div className="ed-pop-title">Effects</div>
                  <div className="ed-pop-fx">
                    {[["none", "None"], ["shadow", "Shadow"], ["glow", "Glow"], ["outline", "Outline"]].map(([k, label]) => (
                      <button key={k} className={effectOf(selected) === k ? "on" : ""} onClick={() => setEffect(k)}>
                        <span style={{ fontWeight: 800, color: "#101828",
                          textShadow: k === "shadow" ? "3px 3px 3px rgba(0,0,0,.45)" : k === "glow" ? "0 0 10px #7c3aed" : "none",
                          WebkitTextStroke: k === "outline" ? "1.5px #7c3aed" : 0 }}>Ag</span>
                        {label}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {pop.kind === "spacing" && (
                <>
                  <div className="ed-pop-title">Letter spacing</div>
                  <div className="ed-pop-row">
                    <input type="range" min="-200" max="800" step="10" value={selected.charSpacing || 0} onChange={(e) => setProp("charSpacing", Number(e.target.value))} />
                    <input className="ed-pop-num" value={Math.round((selected.charSpacing || 0) / 10)} onChange={(e) => setProp("charSpacing", (Number(e.target.value) || 0) * 10)} />
                  </div>
                  <div className="ed-pop-title">Line spacing</div>
                  <div className="ed-pop-row">
                    <input type="range" min="0.5" max="3" step="0.05" value={selected.lineHeight} onChange={(e) => setProp("lineHeight", Number(e.target.value))} />
                    <input className="ed-pop-num" value={Number(selected.lineHeight).toFixed(2)} onChange={(e) => setProp("lineHeight", Math.min(3, Math.max(0.5, Number(e.target.value) || 1)))} />
                  </div>
                  <hr />
                  <div className="ed-pop-anchor">
                    <span>Anchor text box</span>
                    {[["bottom", ArrowDownToLine, "Keep bottom edge in place"], ["middle", FoldVertical, "Keep middle in place"], ["top", ArrowUpToLine, "Keep top edge in place"]].map(([a, Icon, tip]) => (
                      <button key={a} title={tip} className={(selected.anchor || "top") === a ? "on" : ""} onClick={() => { setAnchor(a); refresh(); }}><Icon size={18} /></button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          {pop?.kind === "borders" && selected?.table && (
            <div className="ed-pop" style={{ left: pop.x, top: pop.y }} onMouseDown={(e) => e.stopPropagation()}>
              <div className="ed-pop-title">Borders</div>
              <div className="tb-modes">
                {BORDER_MODES.map(([mode, label]) => (
                  <button key={mode} title={label} className={selected.table.border.mode === mode ? "on" : ""} onClick={() => editTable((m) => { m.border.mode = mode; })}>
                    <svg viewBox="0 0 24 24">
                      <rect x="3" y="3" width="18" height="18" fill="none" stroke="#D0D5DD" strokeWidth="1" />
                      {[1, 2].map((k) => <g key={k}><line x1="3" x2="21" y1={3 + k * 6} y2={3 + k * 6} stroke="#D0D5DD" /><line y1="3" y2="21" x1={3 + k * 6} x2={3 + k * 6} stroke="#D0D5DD" /></g>)}
                      {[0, 1, 2, 3].map((k) => showH(mode, k, 3) && <line key={`h${k}`} x1="3" x2="21" y1={3 + k * 6} y2={3 + k * 6} stroke="#101828" strokeWidth="2" />)}
                      {[0, 1, 2, 3].map((k) => showV(mode, k, 3) && <line key={`v${k}`} y1="3" y2="21" x1={3 + k * 6} x2={3 + k * 6} stroke="#101828" strokeWidth="2" />)}
                    </svg>
                  </button>
                ))}
              </div>
              <div className="ed-pop-title">Border colour</div>
              <div className="ed-swatches">
                {COLORS.map((col) => <button key={col} style={{ background: col }} aria-label={col} onClick={() => editTable((m) => { m.border.color = col; })} />)}
              </div>
              <div className="ed-pop-title">Border thickness</div>
              <div className="ed-pop-row">
                <input type="range" min="1" max="16" value={selected.table.border.width} onChange={(e) => editTable((m) => { m.border.width = Number(e.target.value); })} />
                <input className="ed-pop-num" value={selected.table.border.width} readOnly />
              </div>
            </div>
          )}
          {cellEdit && (
            <textarea className="tb-cell-edit" autoFocus defaultValue={cellEdit.text} aria-label="Cell text"
                      style={{ left: cellEdit.x, top: cellEdit.y, width: cellEdit.w, height: cellEdit.h, fontSize: cellEdit.size, fontFamily: cellEdit.group.table.fontFamily, padding: cellEdit.size * 0.35 }}
                      onFocus={(e) => e.target.select()}
                      onBlur={(e) => commitCell(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.blur(); }
                        if (e.key === "Escape") { skipCommit.current = true; e.currentTarget.blur(); }
                      }} />
          )}
          {menu && selected && (() => {
            const run = (fn) => () => { setMenu(null); fn(); };
            const left = Math.min(menu.x, window.innerWidth - 250), top = Math.max(8, Math.min(menu.y, window.innerHeight - (selected.table ? 690 : 330)));
            return (
              <div className="ed-menu" style={{ left, top }} role="menu" onMouseDown={(e) => e.stopPropagation()} onContextMenu={(e) => e.preventDefault()}>
                <button role="menuitem" onClick={run(copy)}><Copy size={18} /> Copy <kbd>Ctrl+C</kbd></button>
                {!selected.table && <button role="menuitem" onClick={run(copyStyle)}><Palette size={18} /> Copy style</button>}
                <button role="menuitem" onClick={run(paste)} disabled={!clipboard.current}><ClipboardPaste size={18} /> Paste <kbd>Ctrl+V</kbd></button>
                <button role="menuitem" onClick={run(duplicate)}><CopyPlus size={18} /> Duplicate <kbd>Ctrl+D</kbd></button>
                <button role="menuitem" onClick={run(remove)}>{selected.table ? <Table2 size={18} /> : <Trash2 size={18} />} {selected.table ? "Delete table" : "Delete"} <kbd>Del</kbd></button>
                <hr />
                {selected.table && menu.cell && (() => {
                  const op = (fn, ...args) => run(() => editTable(fn, menu.cell, ...args));
                  const m = selected.table;
                  return (
                    <>
                      <button role="menuitem" onClick={op(TABLE_OPS.addColumn)}><Plus size={18} /> Add column</button>
                      <button role="menuitem" onClick={op(TABLE_OPS.deleteColumn)} disabled={m.cols < 2}><Minus size={18} /> Delete column</button>
                      <button role="menuitem" onClick={op(TABLE_OPS.addRow)}><Rows3 size={18} /> Add row</button>
                      <button role="menuitem" onClick={op(TABLE_OPS.deleteRow)} disabled={m.rows < 2}><Minus size={18} /> Delete row</button>
                      <hr />
                      <button role="menuitem" onClick={op(TABLE_OPS.sizeRowsEqually)}><UnfoldVertical size={18} /> Size rows equally</button>
                      <button role="menuitem" onClick={op(TABLE_OPS.sizeRowsToContent)}><ChevronsUpDown size={18} /> Size rows to content</button>
                      <button role="menuitem" onClick={op(TABLE_OPS.sizeColumnToContent)}><Grid3x3 size={18} /> Size column to content</button>
                      <button role="menuitem" onClick={op(TABLE_OPS.moveColumn, -1)} disabled={menu.cell.c === 0}><MoveLeft size={18} /> Move column left</button>
                      <button role="menuitem" onClick={op(TABLE_OPS.moveColumn, 1)} disabled={menu.cell.c >= m.cols - 1}><MoveRight size={18} /> Move column right</button>
                      <hr />
                    </>
                  );
                })()}
                <div className="ed-menu-sub" onMouseEnter={() => setMenu((m) => ({ ...m, layers: true }))}>
                  <button role="menuitem" aria-haspopup="true" onClick={() => setMenu((m) => ({ ...m, layers: !m.layers }))}>
                    <Layers size={18} /> Layer <ChevronRight size={16} className="go" />
                  </button>
                  {menu.layers && (
                    <div className="ed-menu ed-menu-flyout" role="menu">
                      <button role="menuitem" onClick={run(() => layerTo("front"))}>Bring to front</button>
                      <button role="menuitem" onClick={run(() => layerTo("forward"))}>Bring forward</button>
                      <button role="menuitem" onClick={run(() => layerTo("backward"))}>Send backward</button>
                      <button role="menuitem" onClick={run(() => layerTo("back"))}>Send to back</button>
                    </div>
                  )}
                </div>
                <hr />
                <button role="menuitem" onClick={run(toggleLock)}>
                  {selected.lockMovementX ? <Unlock size={18} /> : <Lock size={18} />} {selected.lockMovementX ? "Unlock" : "Lock"} <kbd>Alt+Shift+L</kbd>
                </button>
              </div>
            );
          })()}
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
            <div className="ed-bottom-left" />
            <div className="ed-zoom">
              <button onClick={() => applyZoom(zoom - 0.1)} aria-label="Zoom out"><Minus size={14} /></button>
              <input type="range" min="20" max="150" value={Math.round(zoom * 100)} onChange={(e) => applyZoom(Number(e.target.value) / 100)} aria-label="Zoom" />
              <button onClick={() => applyZoom(zoom + 0.1)} aria-label="Zoom in"><Plus size={14} /></button>
              <span className="ed-zoom-v">{Math.round(zoom * 100)}%</span>
              <button onClick={fitZoom} title="Fit to screen" aria-label="Fit to screen"><Maximize size={16} /></button>
              <button onClick={toggleFullscreen} title={fullscreen ? "Exit full screen" : "Full screen"} aria-label="Full screen">
                {fullscreen ? <Minimize size={16} /> : <Expand size={16} />}
              </button>
              <span className="ed-help">
                <button onClick={() => setHelpOpen((o) => !o)} title="Shortcuts" aria-label="Shortcuts" aria-expanded={helpOpen}><CircleHelp size={17} /></button>
                {helpOpen && (
                  <div className="ed-help-pop" role="dialog">
                    <b>Shortcuts</b>
                    <span>Double-click text to type</span>
                    <span>Delete removes the selection</span>
                    <span>Arrow keys nudge it</span>
                    <span>Alt-drag moves without snapping</span>
                  </div>
                )}
              </span>
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