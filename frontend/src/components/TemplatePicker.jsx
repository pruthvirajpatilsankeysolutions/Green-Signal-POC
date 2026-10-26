import { useEffect, useState } from "react";
import { LayoutTemplate } from "lucide-react";
import { api } from "../api.js";
import { getClientId } from "../api/request.js";

// Pick a saved template for this post, or the standard design. Hidden when no template fits.
export default function TemplatePicker({ occasion = "", postType = "", value, onChange, frame = "none", onFrameChange }) {
  const [list, setList] = useState([]);
  const [frames, setFrames] = useState({});            // { banner: bool, photo_banner: bool }
  const key = `postcraft:frame:${getClientId()}`;       // the choice is remembered per client
  useEffect(() => {
    api.templatesForPost({ occasion, postType }).then((d) => setList(d.templates)).catch(() => setList([]));
  }, [occasion, postType]);
  useEffect(() => {
    if (!onFrameChange) return;
    api.templateFrames().then((f) => {
      setFrames(f);
      let saved = "none";
      try { saved = localStorage.getItem(key) || "none"; } catch { /* storage off */ }
      onFrameChange(f[saved] ? saved : "none");
    }).catch(() => setFrames({}));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const pickFrame = (f) => { onFrameChange?.(f); try { localStorage.setItem(key, f); } catch { /* storage off */ } };
  if (!list.length) return null;
  const frameOptions = [["photo_banner", "Photo + banner"], ["banner", "Banner only"], ["none", "None"]].filter(([k]) => k === "none" || frames[k]);
  return (
    <div className="field">
      <span className="field-label">Design: standard, or one of your templates</span>
      <div className="tpl-pick">
        <button className={!value ? "on" : ""} onClick={() => onChange("")} aria-pressed={!value}>
          <span className="std"><LayoutTemplate size={20} aria-hidden="true" /> Standard design</span>Standard
        </button>
        {list.map((t) => (
          <button key={t.id} className={value === t.id ? "on" : ""} onClick={() => onChange(t.id, t)} aria-pressed={value === t.id} title={t.name}>
            <img src={t.thumbnail_url} alt="" />{t.name}
          </button>
        ))}
      </div>
      {value && onFrameChange && frameOptions.length > 1 && (
        <div className="tpl-frame">
          <span className="field-label">Leader photo &amp; banner on this post</span>
          <div className="seg" role="radiogroup">
            {frameOptions.map(([k, label]) => (
              <button key={k} role="radio" aria-checked={frame === k} className={frame === k ? "on" : ""} onClick={() => pickFrame(k)}>{label}</button>
            ))}
          </div>
          <p className="hint">The design is fitted above the banner; texts are kept clear of the photo.</p>
        </div>
      )}
    </div>
  );
}
