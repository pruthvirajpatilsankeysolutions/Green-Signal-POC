import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { LayoutTemplate } from "lucide-react";
import { api } from "../api.js";
import { getClientId } from "../api/request.js";
import BannerChoice from "./BannerChoice.jsx";
import TemplateBrowser from "./TemplateBrowser.jsx";
import { decorate, getRecent, pushRecent } from "./templateUtils.js";

// The design of a post: the standard design, or one of the client's templates, chosen right on the page.
// allowStandard=false: a template is required (the festival page); the first one is chosen for you.
export default function TemplatePicker({ occasion = "", occasionLabel = "", postType = "", value, onChange, frame = "none", onFrameChange, allowStandard = true }) {
  const clientId = getClientId();
  const [raw, setRaw] = useState(null);                 // null = still loading
  const [recent, setRecent] = useState(() => getRecent(clientId));
  const frameKey = `postcraft:frame:${clientId}`;       // the leader photo choice is remembered per client

  useEffect(() => {
    api.templatesForPost({ occasion, postType }).then((d) => setRaw(d.templates)).catch(() => setRaw([]));
  }, [occasion, postType]);
  useEffect(() => {
    if (!onFrameChange) return;
    api.templateFrames().then((f) => {
      let saved = "none";
      try { saved = localStorage.getItem(frameKey) || "none"; } catch { /* storage off */ }
      onFrameChange(f[saved] ? saved : "none");
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const templates = useMemo(() => decorate(raw || [], { occasion, postType, recent }), [raw, occasion, postType, recent]);
  const selected = templates.find((t) => t.id === value) || null;

  // a template is required: start with the one this client used last, or the one made for this post
  useEffect(() => {
    if (allowStandard || value || !templates.length) return;
    const first = templates.find((t) => t.forThis) || [...templates].filter((t) => t.recentRank >= 0).sort((a, b) => a.recentRank - b.recentRank)[0];
    if (first) onChange(first.id, first);
  }, [templates]); // eslint-disable-line react-hooks/exhaustive-deps

  const choose = (id, t) => {
    if (id) { pushRecent(clientId, id); setRecent(getRecent(clientId)); }
    onChange(id, t || null);
  };
  const pickFrame = (f) => { onFrameChange?.(f); try { localStorage.setItem(frameKey, f); } catch { /* storage off */ } };

  if (raw && !raw.length) {
    return (
      <div className="dp">
        <div className="dp-now">
          <span className="dp-thumb dp-std"><LayoutTemplate size={20} aria-hidden="true" /></span>
          <span className="dp-info">
            <strong>{allowStandard ? "Standard design" : "No templates yet"}</strong>
            <span>{allowStandard ? "No templates yet. " : ""}Upload a Canva PowerPoint on the Templates page to use your own designs.</span>
          </span>
          <Link className="btn small" to="/templates">Open Templates</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="dp">
      <div className="dp-now" aria-live="polite">
        <span className={`dp-thumb${selected ? "" : " dp-std"}`} style={selected ? { aspectRatio: `${selected.width} / ${selected.height}` } : undefined}>
          {selected?.thumbnail_url ? <img src={selected.thumbnail_url} alt="" /> : <LayoutTemplate size={20} aria-hidden="true" />}
        </span>
        <span className="dp-info">
          <span className="dp-kicker">Selected design</span>
          <strong>{selected ? selected.name : allowStandard ? "Standard design" : "No template selected"}</strong>
          <span>{selected ? selected.size : allowStandard ? "A background picture with a text layout" : "Choose one below"}</span>
        </span>
        {selected && allowStandard && <button className="btn ghost small" onClick={() => choose("", null)}>Use standard design</button>}
      </div>

      <TemplateBrowser templates={templates} loading={raw === null} selectedId={value} occasionLabel={occasionLabel} onSelect={choose} allowStandard={allowStandard} />

      {selected && onFrameChange && <BannerChoice value={frame} onChange={pickFrame} />}
    </div>
  );
}
