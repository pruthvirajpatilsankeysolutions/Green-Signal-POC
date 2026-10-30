import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { TABLE_COLORS, TABLE_LOOKS, styleOf } from "./table";

const PREVIEW_ROWS = 4, PREVIEW_COLS = 3;

// a small picture of a preset: 4 x 3 cells drawn with the same rules the real table uses
function Preview({ look, color }) {
  const s = styleOf(look, color), cw = 100 / PREVIEW_COLS, ch = 100 / PREVIEW_ROWS, bw = s.border.width * 0.6;
  const cells = [];
  for (let r = 0; r < PREVIEW_ROWS; r++) for (let c = 0; c < PREVIEW_COLS; c++) {
    cells.push(<rect key={`${r}-${c}`} x={c * cw} y={r * ch} width={cw} height={ch} fill={s.header && r === 0 ? s.headFill : s.fill(r, c)} />);
  }
  const lines = [];
  for (let i = 0; i <= PREVIEW_ROWS; i++) lines.push(<rect key={`h${i}`} x="0" y={Math.min(100 - bw, Math.max(0, i * ch - bw / 2))} width="100" height={bw} fill={s.border.color} />);
  for (let j = 0; j <= PREVIEW_COLS; j++) lines.push(<rect key={`v${j}`} y="0" x={Math.min(100 - bw, Math.max(0, j * cw - bw / 2))} height="100" width={bw} fill={s.border.color} />);
  return <svg viewBox="0 0 100 100" preserveAspectRatio="none">{cells}{lines}</svg>;
}

// "Tables" in the Elements tab: how many rows and columns, then a colour x look preset to insert
export default function TablePanel({ onAdd }) {
  const [rows, setRows] = useState(4);
  const [cols, setCols] = useState(3);
  const stepper = (label, value, set, max) => (
    <div className="tp-step">
      <span>{label}</span>
      <button onClick={() => set(Math.max(1, value - 1))} aria-label={`Fewer ${label}`}><Minus size={14} /></button>
      <b>{value}</b>
      <button onClick={() => set(Math.min(max, value + 1))} aria-label={`More ${label}`}><Plus size={14} /></button>
    </div>
  );
  return (
    <>
      <div className="tp-sizes">{stepper("Rows", rows, setRows, 12)}{stepper("Columns", cols, setCols, 8)}</div>
      <div className="tp-grid">
        {TABLE_COLORS.flatMap(([name, color]) => TABLE_LOOKS.map((look) => (
          <button key={`${name}-${look}`} title={`${name} table`} onClick={() => onAdd({ rows, cols, look, color })}>
            <Preview look={look} color={color} />
          </button>
        )))}
      </div>
    </>
  );
}
