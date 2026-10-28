import { useCallback, useRef, useState } from "react";

// How wide a pane is. The user can drag its edge; the width is remembered on this computer.
// null means "the normal width" (the layout's own default).
export function usePaneWidth(key, min, max) {
  const [width, setWidth] = useState(() => {
    try { const v = Number(localStorage.getItem(key)); return v >= min && v <= max ? v : null; } catch { return null; }
  });
  const set = useCallback((n) => {
    const w = Math.round(Math.min(max, Math.max(min, n)));
    setWidth(w);
    try { localStorage.setItem(key, String(w)); } catch { /* storage can be off in private windows */ }
  }, [key, min, max]);
  const reset = useCallback(() => { setWidth(null); try { localStorage.removeItem(key); } catch { /* ignore */ } }, [key]);
  return [width, set, reset];
}

// A thin handle between two panes. Drag it, or focus it and press the arrow keys (Shift = bigger steps).
// Double-click or Enter puts the pane back to its normal width.
// grows="right": dragging right makes the pane on the left wider (the menu). grows="left": dragging left makes the pane on the right wider.
export function Splitter({ className = "", label, getWidth, onChange, onReset, grows = "right", min, max }) {
  const drag = useRef(null);
  const [active, setActive] = useState(false);
  const dir = grows === "right" ? 1 : -1;
  const down = (e) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, w: getWidth() };
    setActive(true);
  };
  const move = (e) => { if (drag.current) onChange(drag.current.w + dir * (e.clientX - drag.current.x)); };
  const up = (e) => {
    drag.current = null; setActive(false);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* already released */ }
  };
  const key = (e) => {
    const step = e.shiftKey ? 48 : 16;
    if (e.key === "ArrowLeft") { e.preventDefault(); onChange(getWidth() - dir * step); }
    else if (e.key === "ArrowRight") { e.preventDefault(); onChange(getWidth() + dir * step); }
    else if (e.key === "Enter" || e.key === "Home") { e.preventDefault(); onReset(); }
  };
  return (
    <div role="separator" aria-orientation="vertical" aria-label={label} aria-valuemin={min} aria-valuemax={max} tabIndex={0}
         className={`splitter ${className}${active ? " active" : ""}`} title="Drag to resize. Double-click to reset."
         onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onDoubleClick={onReset} onKeyDown={key} />
  );
}
