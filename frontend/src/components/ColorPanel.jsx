import { useEffect, useRef, useState } from "react";
import { Pipette, Plus, X } from "lucide-react";

/*
 * Colour panel (like Canva): hex / name search, eyedropper, document + brand + default colours,
 * a colour square with a hue slider, and (optionally) a two-colour gradient with a direction.
 *
 * value:     "#RRGGBB"  or  { type: "gradient", stops: ["#..", "#.."], dir: "down" | "right" | "diag" | "up" }
 * onChange(value, final): final = false while dragging (preview), true when the change is done (one undo step).
 */
export const DIRECTIONS = {
  down: { label: "↓", coords: { x1: 0, y1: 0, x2: 0, y2: 1 } },
  right: { label: "→", coords: { x1: 0, y1: 0, x2: 1, y2: 0 } },
  diag: { label: "↘", coords: { x1: 0, y1: 0, x2: 1, y2: 1 } },
  up: { label: "↗", coords: { x1: 0, y1: 1, x2: 1, y2: 0 } },
};
const DEFAULTS = ["#FFFFFF", "#E8EAEB", "#C7CBD1", "#6B7280", "#111111", "#FFF4DC", "#FFC94A", "#F2A007", "#F26B0F",
  "#C8261B", "#7A1F12", "#E91E63", "#F9C5D1", "#4B2A7B", "#175CD3", "#0E7C5A", "#D4A017", "#B08D57"];
const NAMES = {
  white: "#FFFFFF", black: "#111111", grey: "#9CA3AF", gray: "#9CA3AF", silver: "#C0C0C0", red: "#D92D20", maroon: "#7A1F12",
  orange: "#F26B0F", saffron: "#FF9933", yellow: "#FFC94A", gold: "#D4A017", cream: "#FFF4DC", green: "#0E7C5A",
  teal: "#0F766E", blue: "#175CD3", navy: "#1F2347", purple: "#6D28D9", pink: "#E91E63", brown: "#7C4A21", peach: "#FFC9A8",
};

// ---------------------------------------------------------------- colour maths
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const normHex = (v) => {
  let h = String(v || "").trim().toLowerCase();
  if (NAMES[h]) return NAMES[h];
  h = h.replace(/^#/, "");
  if (/^[0-9a-f]{3}$/.test(h)) h = h.split("").map((c) => c + c).join("");
  return /^[0-9a-f]{6}$/.test(h) ? `#${h.toUpperCase()}` : null;
};
const toRgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const toHex = (r, g, b) => "#" + [r, g, b].map((x) => Math.round(x).toString(16).padStart(2, "0")).join("").toUpperCase();
const toHsv = (hex) => {
  const [r, g, b] = toRgb(hex).map((x) => x / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: max ? d / max : 0, v: max };
};
const fromHsv = ({ h, s, v }) => {
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return toHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
};
const isGradient = (v) => v && typeof v === "object" && v.type === "gradient";
const css = (v) => (isGradient(v) ? `linear-gradient(${{ down: "180deg", right: "90deg", diag: "135deg", up: "45deg" }[v.dir] || "180deg"}, ${v.stops[0]}, ${v.stops[1]})` : v);

export default function ColorPanel({ title = "Colour", value, onChange, onClose, allowGradient = false, docColors = [], brandColors = [] }) {
  const grad = isGradient(value);
  const [mode, setMode] = useState(grad ? "gradient" : "solid");
  const [stop, setStop] = useState(0);                          // which gradient colour is being edited
  const [showPicker, setShowPicker] = useState(grad);
  const solid = grad ? value.stops[stop] : normHex(value) || "#FFFFFF";
  const [hsv, setHsv] = useState(() => toHsv(solid));
  const [text, setText] = useState(solid);
  const square = useRef(null), hue = useRef(null);

  // keep the picker in step when the edited colour changes from outside (swatch, eyedropper, other stop)
  useEffect(() => { setHsv(toHsv(solid)); setText(solid); }, [solid]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // apply one colour to the current target (solid, or the selected gradient stop)
  const apply = (hex, final) => {
    if (mode === "gradient") {
      const base = grad ? value : { type: "gradient", stops: [solid, "#FFFFFF"], dir: "down" };
      const stops = [...base.stops]; stops[stop] = hex;
      onChange({ ...base, stops }, final);
    } else onChange(hex, final);
  };
  const pick = (hex, final = true) => { setHsv(toHsv(hex)); setText(hex); apply(hex, final); };

  const drag = (el, fn) => (e) => {
    e.preventDefault();
    const move = (ev) => { const r = el.current.getBoundingClientRect(); fn(clamp((ev.clientX - r.left) / r.width, 0, 1), clamp((ev.clientY - r.top) / r.height, 0, 1), false); };
    const up = (ev) => { const r = el.current.getBoundingClientRect(); fn(clamp((ev.clientX - r.left) / r.width, 0, 1), clamp((ev.clientY - r.top) / r.height, 0, 1), true);
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
    move(e);
  };
  const onSquare = drag(square, (x, y, final) => { const next = { ...hsv, s: x, v: 1 - y }; setHsv(next); const hex = fromHsv(next); setText(hex); apply(hex, final); });
  const onHue = drag(hue, (x, _y, final) => { const next = { ...hsv, h: x * 359.9 }; setHsv(next); const hex = fromHsv(next); setText(hex); apply(hex, final); });

  const eyedropper = typeof window !== "undefined" && "EyeDropper" in window;
  const sample = async () => { try { const r = await new window.EyeDropper().open(); pick(r.sRGBHex.toUpperCase()); } catch { /* cancelled */ } };
  const typed = (v) => { setText(v); const hex = normHex(v); if (hex) { setHsv(toHsv(hex)); apply(hex, false); } };
  const commitTyped = () => { const hex = normHex(text); if (hex) pick(hex); };

  const toGradient = () => { setMode("gradient"); setShowPicker(true); setStop(0); if (!grad) onChange({ type: "gradient", stops: [solid, "#FFFFFF"], dir: "down" }, true); };
  const toSolid = () => { setMode("solid"); if (grad) onChange(value.stops[0], true); };

  const Row = ({ label, colors }) => colors.length ? (
    <div className="cpx-group">
      <div className="cpx-label">{label}</div>
      <div className="cpx-swatches">
        {colors.map((c, i) => (
          <button key={`${label}${i}`} className={`cpx-swatch${!grad && normHex(value) === normHex(c) ? " on" : ""}`} style={{ background: c }}
                  title={c} aria-label={c} onClick={() => pick(c)} />
        ))}
      </div>
    </div>
  ) : null;

  return (
    <div className="cpx" role="dialog" aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
      <div className="cpx-head"><strong>{title}</strong><button className="cpx-x" onClick={onClose} aria-label="Close"><X size={16} /></button></div>
      <input className="cpx-search" value={text} placeholder='Try "gold" or "#E8EAEB"' aria-label="Colour name or hex code"
             onChange={(e) => typed(e.target.value)} onBlur={commitTyped} onKeyDown={(e) => { if (e.key === "Enter") commitTyped(); }} />

      <div className="cpx-group">
        <div className="cpx-label">Document colours</div>
        <div className="cpx-swatches">
          <button className="cpx-add" title="Pick any colour" aria-label="Pick any colour" onClick={() => setShowPicker((v) => !v)}><Plus size={16} /></button>
          {eyedropper && <button className="cpx-tool" title="Pick a colour from the screen" aria-label="Eyedropper" onClick={sample}><Pipette size={15} /></button>}
          {docColors.map((c, i) => (
            <button key={`d${i}`} className={`cpx-swatch${!grad && normHex(value) === normHex(c) ? " on" : ""}`} style={{ background: c }} title={c} aria-label={c} onClick={() => pick(c)} />
          ))}
        </div>
      </div>

      {showPicker && (
        <div className="cpx-picker">
          {allowGradient && (
            <div className="cpx-tabs" role="tablist">
              <button role="tab" aria-selected={mode === "solid"} className={mode === "solid" ? "on" : ""} onClick={toSolid}>Solid colour</button>
              <button role="tab" aria-selected={mode === "gradient"} className={mode === "gradient" ? "on" : ""} onClick={toGradient}>Gradient</button>
            </div>
          )}
          {mode === "gradient" && grad && (
            <div className="cpx-grad">
              <div className="cpx-grad-preview" style={{ background: css(value) }} />
              <div className="cpx-grad-row">
                {value.stops.map((c, i) => (
                  <button key={i} className={`cpx-stop${stop === i ? " on" : ""}`} onClick={() => setStop(i)} title={`Colour ${i + 1}`}>
                    <span style={{ background: c }} />{i === 0 ? "Start" : "End"}
                  </button>
                ))}
                <span className="cpx-sep" />
                {Object.entries(DIRECTIONS).map(([k, d]) => (
                  <button key={k} className={`cpx-dir${value.dir === k ? " on" : ""}`} title="Direction" onClick={() => onChange({ ...value, dir: k }, true)}>{d.label}</button>
                ))}
              </div>
            </div>
          )}
          <div ref={square} className="cpx-square" style={{ background: `hsl(${hsv.h}, 100%, 50%)` }} onPointerDown={onSquare}>
            <span className="cpx-thumb" style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: fromHsv(hsv) }} />
          </div>
          <div ref={hue} className="cpx-hue" onPointerDown={onHue}><span className="cpx-thumb" style={{ left: `${(hsv.h / 360) * 100}%`, background: `hsl(${hsv.h}, 100%, 50%)` }} /></div>
          <div className="cpx-hexrow">
            <span className="cpx-current" style={{ background: fromHsv(hsv) }} />
            <input value={text} onChange={(e) => typed(e.target.value)} onBlur={commitTyped} onKeyDown={(e) => { if (e.key === "Enter") commitTyped(); }} aria-label="Hex code" />
            {eyedropper && <button className="cpx-tool" title="Eyedropper" aria-label="Eyedropper" onClick={sample}><Pipette size={15} /></button>}
          </div>
        </div>
      )}

      <Row label="Brand colours" colors={brandColors} />
      <Row label="Default colours" colors={DEFAULTS} />
    </div>
  );
}
