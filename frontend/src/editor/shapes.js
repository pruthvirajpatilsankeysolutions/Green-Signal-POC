// Shapes, lines, frames, labels and overlays for the design editor (Fabric.js objects).
import { Circle, Ellipse, Gradient, Group, Line, Path, Polygon, Rect, Textbox, Triangle } from "fabric";

const star = (points, outer, inner) =>
  Array.from({ length: points * 2 }, (_, i) => {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / points) * i - Math.PI / 2;
    return { x: outer + Math.cos(a) * r, y: outer + Math.sin(a) * r };
  });

const polygon = (sides, r) =>
  Array.from({ length: sides }, (_, i) => {
    const a = ((Math.PI * 2) / sides) * i - Math.PI / 2;
    return { x: r + Math.cos(a) * r, y: r + Math.sin(a) * r };
  });

const HEART = "M100 180 C 40 140, 0 100, 0 58 C 0 25, 25 0, 55 0 C 75 0, 92 12, 100 28 C 108 12, 125 0, 145 0 C 175 0, 200 25, 200 58 C 200 100, 160 140, 100 180 Z";
const ARROW = "M0 60 L140 60 L140 20 L220 90 L140 160 L140 120 L0 120 Z";
const BUBBLE = "M20 0 L240 0 Q 260 0 260 20 L260 130 Q 260 150 240 150 L90 150 L40 195 L50 150 L20 150 Q 0 150 0 130 L0 20 Q 0 0 20 0 Z";
const RIBBON = "M0 20 L50 20 L50 0 L350 0 L350 20 L400 20 L370 60 L400 100 L300 100 L300 80 L100 80 L100 100 L0 100 L30 60 Z";

// each shape: name, preview SVG (for the panel button), make(fill) -> Fabric object
export const SHAPES = [
  { name: "Rectangle", preview: '<rect x="4" y="9" width="32" height="22"/>', make: (fill) => new Rect({ width: 320, height: 210, fill }) },
  { name: "Rounded box", preview: '<rect x="4" y="9" width="32" height="22" rx="6"/>', make: (fill) => new Rect({ width: 320, height: 210, rx: 32, ry: 32, fill }) },
  { name: "Circle", preview: '<circle cx="20" cy="20" r="15"/>', make: (fill) => new Circle({ radius: 130, fill }) },
  { name: "Oval", preview: '<ellipse cx="20" cy="20" rx="17" ry="11"/>', make: (fill) => new Ellipse({ rx: 180, ry: 110, fill }) },
  { name: "Triangle", preview: '<path d="M20 5 L36 34 L4 34 Z"/>', make: (fill) => new Triangle({ width: 260, height: 230, fill }) },
  { name: "Star", preview: '<path d="M20 3 L24.5 14 L36 14.5 L27 22 L30 34 L20 27 L10 34 L13 22 L4 14.5 L15.5 14 Z"/>', make: (fill) => new Polygon(star(5, 130, 55), { fill }) },
  { name: "Hexagon", preview: '<path d="M20 3 L35 12 L35 28 L20 37 L5 28 L5 12 Z"/>', make: (fill) => new Polygon(polygon(6, 130), { fill }) },
  { name: "Diamond", preview: '<path d="M20 3 L36 20 L20 37 L4 20 Z"/>', make: (fill) => new Polygon([{ x: 120, y: 0 }, { x: 240, y: 140 }, { x: 120, y: 280 }, { x: 0, y: 140 }], { fill }) },
  { name: "Heart", preview: '<path d="M20 35 C 8 27, 3 20, 3 13 C 3 7, 8 3, 13 3 C 16 3, 19 5, 20 8 C 21 5, 24 3, 27 3 C 32 3, 37 7, 37 13 C 37 20, 32 27, 20 35 Z"/>', make: (fill) => new Path(HEART, { fill, scaleX: 1.3, scaleY: 1.3 }) },
  { name: "Arrow", preview: '<path d="M3 15 L23 15 L23 7 L37 20 L23 33 L23 25 L3 25 Z"/>', make: (fill) => new Path(ARROW, { fill }) },
  { name: "Speech bubble", preview: '<path d="M6 5 L34 5 Q37 5 37 8 L37 24 Q37 27 34 27 L16 27 L9 35 L10 27 L6 27 Q3 27 3 24 L3 8 Q3 5 6 5 Z"/>', make: (fill) => new Path(BUBBLE, { fill, scaleX: 1.4, scaleY: 1.4 }) },
  { name: "Ribbon", preview: '<path d="M1 12 L7 12 L7 8 L33 8 L33 12 L39 12 L35 19 L39 26 L30 26 L30 23 L10 23 L10 26 L1 26 L5 19 Z"/>', make: (fill) => new Path(RIBBON, { fill, scaleX: 1.6, scaleY: 1.6 }) },
  { name: "Starburst", preview: '<path d="' + "M20 2 " + star(12, 18, 13).map((p) => `L${p.x + 2} ${p.y + 2}`).join(" ") + ' Z"/>', make: (fill) => new Polygon(star(12, 140, 105), { fill }) },
];

export const LINES = [
  { name: "Line", preview: '<line x1="3" y1="20" x2="37" y2="20" stroke-width="3"/>', make: (stroke) => new Line([0, 0, 500, 0], { stroke, strokeWidth: 8 }) },
  { name: "Thick line", preview: '<line x1="3" y1="20" x2="37" y2="20" stroke-width="7"/>', make: (stroke) => new Line([0, 0, 500, 0], { stroke, strokeWidth: 22 }) },
  { name: "Dashed line", preview: '<line x1="3" y1="20" x2="37" y2="20" stroke-width="3" stroke-dasharray="6 4"/>', make: (stroke) => new Line([0, 0, 500, 0], { stroke, strokeWidth: 8, strokeDashArray: [30, 18] }) },
  { name: "Dotted line", preview: '<line x1="3" y1="20" x2="37" y2="20" stroke-width="4" stroke-dasharray="1 5" stroke-linecap="round"/>', make: (stroke) => new Line([0, 0, 500, 0], { stroke, strokeWidth: 12, strokeDashArray: [1, 26], strokeLineCap: "round" }) },
  { name: "Frame", preview: '<rect x="5" y="7" width="30" height="26" fill="none" stroke-width="3"/>', make: (stroke) => new Rect({ width: 700, height: 700, fill: "transparent", stroke, strokeWidth: 14 }) },
  { name: "Rounded frame", preview: '<rect x="5" y="7" width="30" height="26" rx="6" fill="none" stroke-width="3"/>', make: (stroke) => new Rect({ width: 700, height: 700, rx: 40, ry: 40, fill: "transparent", stroke, strokeWidth: 14 }) },
  { name: "Ring", preview: '<circle cx="20" cy="20" r="14" fill="none" stroke-width="3"/>', make: (stroke) => new Circle({ radius: 200, fill: "transparent", stroke, strokeWidth: 14 }) },
];

// full-width colour fades, to make text readable over any photo
const fade = (W, H, stops, name, coords) => new Rect({
  name, width: W, height: H, left: 0, top: 0,
  fill: new Gradient({ type: "linear", gradientUnits: "pixels", coords, colorStops: stops }),
});

export const OVERLAYS = [
  { name: "Dark fade bottom", preview: "linear-gradient(0deg,#000c,#0000)", make: (W, H) => fade(W, H, [{ offset: 0, color: "rgba(0,0,0,0)" }, { offset: 0.55, color: "rgba(0,0,0,0)" }, { offset: 1, color: "rgba(0,0,0,0.8)" }], "Dark fade bottom", { x1: 0, y1: 0, x2: 0, y2: H }) },
  { name: "Dark fade top", preview: "linear-gradient(180deg,#000c,#0000)", make: (W, H) => fade(W, H, [{ offset: 0, color: "rgba(0,0,0,0.8)" }, { offset: 0.45, color: "rgba(0,0,0,0)" }, { offset: 1, color: "rgba(0,0,0,0)" }], "Dark fade top", { x1: 0, y1: 0, x2: 0, y2: H }) },
  { name: "Dark fade left", preview: "linear-gradient(90deg,#000c,#0000)", make: (W, H) => fade(W, H, [{ offset: 0, color: "rgba(0,0,0,0.75)" }, { offset: 0.55, color: "rgba(0,0,0,0)" }, { offset: 1, color: "rgba(0,0,0,0)" }], "Dark fade left", { x1: 0, y1: 0, x2: W, y2: 0 }) },
  { name: "Dim all", preview: "#0007", make: (W, H) => new Rect({ name: "Dim all", width: W, height: H, left: 0, top: 0, fill: "rgba(0,0,0,0.4)" }) },
  { name: "Light wash", preview: "linear-gradient(180deg,#fffe,#fff0)", make: (W, H) => fade(W, H, [{ offset: 0, color: "rgba(255,248,236,0.92)" }, { offset: 0.4, color: "rgba(255,248,236,0)" }, { offset: 1, color: "rgba(255,248,236,0)" }], "Light wash", { x1: 0, y1: 0, x2: 0, y2: H }) },
  { name: "Saffron glow", preview: "linear-gradient(0deg,#f76707c0,#0000)", make: (W, H) => fade(W, H, [{ offset: 0, color: "rgba(247,103,7,0)" }, { offset: 0.6, color: "rgba(247,103,7,0)" }, { offset: 1, color: "rgba(247,103,7,0.7)" }], "Saffron glow", { x1: 0, y1: 0, x2: 0, y2: H }) },
];

// a label = shape + text moved and resized together
export function makeBadge({ text, shape, fill, color }) {
  const big = text.length > 6;
  const w = big ? 420 : 260;
  const h = shape === "pill" ? 110 : w;
  let back;
  if (shape === "pill") back = new Rect({ width: w, height: h, rx: h / 2, ry: h / 2, fill });
  else if (shape === "circle") back = new Circle({ radius: w / 2, fill });
  else back = new Polygon(star(14, w / 2, w / 2 - 26), { fill });
  const label = new Textbox(text, {
    width: w - 40, left: 20, top: h / 2 - (big ? 34 : 42), fontSize: big ? 56 : 72,
    fontFamily: "Baloo 2", fontWeight: "800", fill: color, textAlign: "center",
  });
  return new Group([back, label], { name: `Label ${text}` });
}