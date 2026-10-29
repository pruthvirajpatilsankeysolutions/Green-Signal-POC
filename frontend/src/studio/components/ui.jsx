import { useEffect, useRef } from "react";
import { X } from "../icons.jsx";

// A small menu next to a button. Closes on a click anywhere else or Escape.
export function Pop({ anchor, items, onClose, width = 210, side = "below" }) {
  useEffect(() => {
    const close = () => onClose();
    const key = (e) => e.key === "Escape" && onClose();
    window.addEventListener("click", close); window.addEventListener("keydown", key);
    return () => { window.removeEventListener("click", close); window.removeEventListener("keydown", key); };
  }, [onClose]);
  const h = items.length * 40 + 12;
  const left = side === "right" ? anchor.right + 8 : Math.max(8, Math.min(anchor.right - width, window.innerWidth - width - 8));
  const top = side === "right" ? Math.min(anchor.top, window.innerHeight - h - 8) : anchor.bottom + 6 + h > window.innerHeight ? Math.max(8, anchor.top - h - 6) : anchor.bottom + 6;
  return (
    <div className="pop" role="menu" style={{ left, top, minWidth: width }} onClick={(e) => e.stopPropagation()}>
      {items.map((it) => (
        <button key={it.label} role="menuitem" className={it.danger ? "danger" : ""} onClick={() => { onClose(); it.onClick(); }}>{it.label}{it.icon}</button>
      ))}
    </div>
  );
}

export function Modal({ title, onClose, children, footer, size = "" }) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });
  // Callers pass a new onClose function on every render. If the effects below depended on it they would run after every keystroke
  // and the dialog would take the focus back from the text box being typed in (one character per click). So they run once.
  useEffect(() => {
    const key = (e) => e.key === "Escape" && closeRef.current();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => { const el = ref.current; if (el && !el.contains(el.getRootNode().activeElement)) el.focus(); }, []);   // once, on opening; not if a box inside (autoFocus) already has it (getRootNode: the Studio lives in a shadow DOM)
  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${size}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <div className="mh2"><h2>{title}</h2><button className="ib" onClick={onClose} aria-label="Close"><X size={19} /></button></div>
        <div className="mb">{children}</div>
        {footer && <div className="mf">{footer}</div>}
      </div>
    </div>
  );
}



export const Spinner = () => <span className="spin" aria-hidden="true" />;
export const Toast = ({ text }) => <div className={`toast${text ? " show" : ""}`} role="status" aria-live="polite">{text}</div>;
