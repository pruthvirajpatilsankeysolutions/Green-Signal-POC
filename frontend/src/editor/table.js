// Tables for the editor (like Canva's). A table is a Fabric Group drawn from a plain model that is kept on the
// group (`group.table`, listed in the editor's EXTRA so Save and Undo carry it). Every change (add a column,
// size rows, borders...) edits the model and rebuilds the group; nothing edits the drawn pieces directly.
import { Group, Rect, Textbox, Point, util } from "fabric";

const PAD = 14;          // space between a cell's edge and its text
const MIN_COL = 80;

export const TABLE_COLORS = [["Grey", "#6B7280"], ["Red", "#EF6460"], ["Yellow", "#F6C06B"], ["Blue", "#5575F7"], ["Purple", "#8B5CF6"]];
export const TABLE_LOOKS = ["grid", "header", "banded"];
export const BORDER_MODES = [
  ["all", "All borders"], ["outer", "Outer borders"], ["inner", "Inner borders"],
  ["horizontal", "Horizontal lines"], ["vertical", "Vertical lines"], ["top", "Top border"],
  ["bottom", "Bottom border"], ["left", "Left border"], ["right", "Right border"],
];
// which grid lines (0 .. n) a border mode draws
export const showH = (mode, i, n) => ({ all: true, horizontal: true, outer: i === 0 || i === n, inner: i > 0 && i < n, top: i === 0, bottom: i === n })[mode] ?? false;
export const showV = (mode, j, n) => ({ all: true, vertical: true, outer: j === 0 || j === n, inner: j > 0 && j < n, left: j === 0, right: j === n })[mode] ?? false;

const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const mix = (hex, t) => "#" + rgb(hex).map((v) => Math.round(v * t + 255 * (1 - t)).toString(16).padStart(2, "0")).join("");
const isLight = (hex) => { const [r, g, b] = rgb(hex); return 0.299 * r + 0.587 * g + 0.114 * b > 170; };

// the look of a preset: header row, cell fills, text colours and the default border
export function styleOf(look, color) {
  const headText = isLight(color) ? "#1F2937" : "#FFFFFF";
  if (look === "grid") return { header: false, headFill: color, headText, fill: () => "#FFFFFF", text: "#1F2937", border: { mode: "all", color, width: 5 } };
  if (look === "header") return { header: true, headFill: color, headText, fill: () => "#FFFFFF", text: "#1F2937", border: { mode: "all", color, width: 4 } };
  return { header: true, headFill: color, headText, fill: (r, c) => mix(color, c === 0 ? 0.4 : 0.2), text: "#1F2937", border: { mode: "all", color: "#FFFFFF", width: 6 } };
}

export function newTable({ rows = 4, cols = 3, look = "header", color = "#5575F7", width = 900, fontSize = 40, fontFamily = "Mukta" } = {}) {
  const s = styleOf(look, color);
  return {
    rows, cols, look, color, fontSize, fontFamily, border: { ...s.border },
    colW: Array(cols).fill(width / cols), rowH: Array(rows).fill(0),
    cells: Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, () => ({ text: s.header && r === 0 ? "Heading" : "Text" }))),
  };
}

const cum = (a) => a.reduce((acc, v) => { acc.push(acc[acc.length - 1] + v); return acc; }, [0]);
export const layoutOf = (m) => ({ xs: cum(m.colW), ys: cum(m.rowH) });

// the drawn Group for a model (rows grow to fit their text; the real heights are written back into the model)
export function buildTable(m) {
  const s = styleOf(m.look, m.color);
  const head = (r) => s.header && r === 0;
  const texts = m.cells.map((row, r) => row.map((cell, c) => (cell.text ? new Textbox(cell.text, {
    width: Math.max(20, m.colW[c] - 2 * PAD), fontSize: m.fontSize, fontFamily: m.fontFamily,
    fontWeight: head(r) ? "800" : "400", fill: head(r) ? s.headText : s.text, textAlign: "left",
  }) : null)));
  m.rowH = m.rowH.map((h, r) => Math.max(h, m.fontSize * 1.3 + 2 * PAD, ...texts[r].map((t) => (t ? t.height + 2 * PAD : 0))));
  const { xs, ys } = layoutOf(m);
  const Wt = xs[m.cols], Ht = ys[m.rows], bw = m.border.width;
  const out = [];
  m.cells.forEach((row, r) => row.forEach((_, c) => out.push(new Rect({
    left: xs[c], top: ys[r], width: m.colW[c], height: m.rowH[r], fill: head(r) ? s.headFill : s.fill(r, c), strokeWidth: 0,
  }))));
  for (let i = 0; i <= m.rows; i++) if (showH(m.border.mode, i, m.rows)) {
    out.push(new Rect({ left: 0, top: i === 0 ? 0 : i === m.rows ? Ht - bw : ys[i] - bw / 2, width: Wt, height: bw, fill: m.border.color, strokeWidth: 0 }));
  }
  for (let j = 0; j <= m.cols; j++) if (showV(m.border.mode, j, m.cols)) {
    out.push(new Rect({ left: j === 0 ? 0 : j === m.cols ? Wt - bw : xs[j] - bw / 2, top: 0, width: bw, height: Ht, fill: m.border.color, strokeWidth: 0 }));
  }
  texts.forEach((row, r) => row.forEach((t, c) => {
    if (!t) return;
    t.set({ left: xs[c] + PAD, top: ys[r] + (m.rowH[r] - t.height) / 2 });
    out.push(t);
  }));
  const group = new Group(out, { name: "Table", subTargetCheck: false, objectCaching: false });
  group.table = m;
  return group;
}

// replace `old` on the canvas by a fresh build of `model`, in the same place and layer, selected
const KEEP = ["left", "top", "angle", "opacity", "lockMovementX", "lockMovementY", "lockScalingX", "lockScalingY", "lockRotation", "hasControls"];
export function rebuild(canvas, old, model) {
  const group = buildTable(model);
  group.set(Object.fromEntries(KEEP.map((k) => [k, old[k]])));
  const index = canvas.getObjects().indexOf(old);
  canvas.remove(old);
  canvas.insertAt(index, group);
  group.setCoords();
  canvas.setActiveObject(group);
  canvas.requestRenderAll();
  return group;
}

// stretching the table with its handles resizes the cells instead of scaling the drawing
export function bakeScale(group) {
  const m = structuredClone(group.table);
  m.colW = m.colW.map((w) => Math.max(MIN_COL, w * group.scaleX));
  m.rowH = m.rowH.map((h) => h * group.scaleY);
  return m;
}

// a point on the page -> position inside the table's own (unscaled) grid
export function localPoint(group, scenePoint) {
  const p = scenePoint.transform(util.invertTransform(group.calcTransformMatrix()));
  return { x: p.x + group.width / 2, y: p.y + group.height / 2 };
}
export function cellAt(m, x, y) {
  const { xs, ys } = layoutOf(m);
  const index = (edges, v) => { const i = edges.findIndex((e, k) => k > 0 && v < e); return i === -1 ? edges.length - 2 : i - 1; };
  return { r: index(ys, y), c: index(xs, x) };
}

// the four corners of a cell on the page [[x, y] x 4], for the selection outline and the text editor
export function cellCorners(group, r, c) {
  const m = group.table, { xs, ys } = layoutOf(m), matrix = group.calcTransformMatrix();
  const at = (x, y) => { const p = util.transformPoint(new Point(x - group.width / 2, y - group.height / 2), matrix); return [p.x, p.y]; };
  return [at(xs[c], ys[r]), at(xs[c + 1], ys[r]), at(xs[c + 1], ys[r + 1]), at(xs[c], ys[r + 1])];
}

// ---------------------------------------------------------------- edits on a model (c / r = the cell the user right-clicked)
const filler = () => ({ text: "Text" });
const widest = (m, c) => Math.max(...m.cells.map((row, r) => {
  const t = new Textbox(row[c].text || "", { fontSize: m.fontSize, fontFamily: m.fontFamily, fontWeight: r === 0 && styleOf(m.look, m.color).header ? "800" : "400", width: 5000 });
  return t.calcTextWidth();
}));

export const TABLE_OPS = {
  addColumn: (m, { c }) => { m.colW.splice(c + 1, 0, m.colW[c]); m.cells.forEach((row) => row.splice(c + 1, 0, filler())); m.cols++; },
  deleteColumn: (m, { c }) => { if (m.cols > 1) { m.colW.splice(c, 1); m.cells.forEach((row) => row.splice(c, 1)); m.cols--; } },
  addRow: (m, { r }) => { m.rowH.splice(r + 1, 0, 0); m.cells.splice(r + 1, 0, Array.from({ length: m.cols }, filler)); m.rows++; },
  deleteRow: (m, { r }) => { if (m.rows > 1) { m.rowH.splice(r, 1); m.cells.splice(r, 1); m.rows--; } },
  moveColumn: (m, { c }, dir) => {
    const to = c + dir;
    if (to < 0 || to >= m.cols) return;
    [m.colW[c], m.colW[to]] = [m.colW[to], m.colW[c]];
    m.cells.forEach((row) => { [row[c], row[to]] = [row[to], row[c]]; });
  },
  sizeRowsEqually: (m) => { const h = Math.max(...m.rowH); m.rowH = m.rowH.map(() => h); },
  sizeRowsToContent: (m) => { m.rowH = m.rowH.map(() => 0); },
  sizeColumnToContent: (m, { c }) => { m.colW[c] = Math.max(MIN_COL, widest(m, c) + 2 * PAD); },
};
