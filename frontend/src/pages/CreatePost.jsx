import { useEffect, useMemo, useRef, useState } from "react";
import { Award, Check, ImagePlus, Megaphone, Plus, Sparkles, Tag, UserRound, X } from "lucide-react";
import { api } from "../api.js";
import { useStatus } from "../App.jsx";
import CreatedNotice from "../components/CreatedNotice.jsx";
import FeedPreview from "../components/FeedPreview.jsx";
import Notice from "../components/Notice.jsx";

const ICONS = { announcement: Megaphone, offer: Tag, achievement: Award, spotlight: UserRound };
const PHOTO_NOTE = { required: "required", recommended: "recommended", optional: "optional" };
const emptyForm = (type) => Object.fromEntries(type.fields.map((f) => [f.key,
  f.kind === "stats" ? [{ value: "", label: "" }] : f.kind === "checkbox" ? false
    : f.kind === "select" ? f.options[0].value : ""]));
const asTag = (t) => "#" + t.trim().replace(/^#+/, "").replace(/\s+/g, "_");

// Create post: announcement, offer, achievement, person spotlight.
// Form -> AI word options (pick / edit) -> poster -> Approvals.
export default function CreatePost() {
  const { refresh } = useStatus();
  const [types, setTypes] = useState(null);
  const [type, setType] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.customTypes().then((d) => { setTypes(d.types); if (d.types[0]) setType(d.types[0]); }).catch((e) => setError(e.message));
  }, []);

  return (
    <div className="page">
      <header className="page-head">
        <h1>Create post</h1>
        <p className="lead">Announcements, offers, achievements and people. Facts come only from what you type; the AI writes the words around them.</p>
      </header>
      <Notice kind="error">{error}</Notice>
      {types && !types.length && (
        <Notice kind="info">No post types are switched on for this client. Tick them under "Post types" on the Clients page.</Notice>
      )}
      {types && types.length > 0 && (
        <div className="cp-types" role="tablist" aria-label="Post type">
          {types.map((t) => {
            const Icon = ICONS[t.id] || Sparkles;
            return (
              <button key={t.id} role="tab" aria-selected={type?.id === t.id} className={`cp-type${type?.id === t.id ? " on" : ""}`}
                      onClick={() => setType(t)}>
                <Icon size={22} aria-hidden="true" />
                <span><strong>{t.label}</strong><span className="muted small">{t.description}</span></span>
              </button>
            );
          })}
        </div>
      )}
      {type && <TypeForm key={type.id} type={type} onCreated={refresh} />}
    </div>
  );
}

function TypeForm({ type, onCreated }) {
  const [form, setForm] = useState(() => emptyForm(type));
  const [photo, setPhoto] = useState(null);
  const [options, setOptions] = useState(null);
  const [chosen, setChosen] = useState({ headline: "", caption: "", hashtags: [], picked: {} });
  const [newTag, setNewTag] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [draft, setDraft] = useState(null);
  const fileInput = useRef(null);
  const photoUrl = useMemo(() => (photo ? URL.createObjectURL(photo) : ""), [photo]);
  useEffect(() => () => { if (photoUrl) URL.revokeObjectURL(photoUrl); }, [photoUrl]);

  const set = (key, value) => { setForm({ ...form, [key]: value }); setDraft(null); };
  const act = async (label, fn) => {
    setBusy(label); setError("");
    try { await fn(); } catch (e) { setError(e.message); } finally { setBusy(""); }
  };

  const writeOptions = () => act("options", async () => {
    const o = await api.customOptions(type.id, form);
    setOptions(o);
    setChosen({ headline: o.headlines[0].text, caption: o.captions[0], hashtags: o.hashtags.slice(0, 8), picked: { headline: 0, caption: 0 } });
  });

  const create = () => act("create", async () => {
    if (type.photo === "required" && !photo) throw new Error("Please add a photo for this post.");
    const data = new FormData();
    data.append("form", JSON.stringify(form));
    data.append("chosen", JSON.stringify(chosen));
    if (photo) data.append("photo", photo);
    setDraft(await api.createCustomPost(type.id, data));
    onCreated();
  });

  const toggleTag = (tag) => setChosen((c) => ({
    ...c, hashtags: c.hashtags.some((t) => t.toLowerCase() === tag.toLowerCase())
      ? c.hashtags.filter((t) => t.toLowerCase() !== tag.toLowerCase()) : [...c.hashtags, tag],
  }));
  const addTags = () => {
    const fresh = newTag.split(/[\s,]+/).filter(Boolean).map(asTag).filter((t) => t.length > 1);
    setChosen((c) => ({ ...c, hashtags: [...c.hashtags, ...fresh.filter((t) => !c.hashtags.some((x) => x.toLowerCase() === t.toLowerCase()))] }));
    setNewTag("");
  };

  const field = (f) => {
    const label = <span className="field-label">{f.label} {!f.required && <span className="optional">optional</span>}</span>;
    if (f.kind === "select") {
      return (
        <label key={f.key} className="field">{label}
          <select className="input" value={form[f.key]} onChange={(e) => set(f.key, e.target.value)}>
            {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
      );
    }
    if (f.kind === "textarea") {
      return <label key={f.key} className="field">{label}<textarea className="mr" rows={3} value={form[f.key]} placeholder={f.placeholder} onChange={(e) => set(f.key, e.target.value)} /></label>;
    }
    if (f.kind === "checkbox") {
      return (
        <label key={f.key} className="check">
          <input type="checkbox" checked={form[f.key]} onChange={(e) => set(f.key, e.target.checked)} /> {f.label}
        </label>
      );
    }
    if (f.kind === "stats") {
      const rows = form[f.key];
      const update = (i, k, v) => set(f.key, rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
      return (
        <div key={f.key} className="field">{label}
          {rows.map((r, i) => (
            <div key={i} className="cp-stat">
              <input className="mr" value={r.value} placeholder={["₹१२ कोटी", "१२", "८ महिने"][i]} aria-label={`Number ${i + 1}`} onChange={(e) => update(i, "value", e.target.value)} />
              <input className="mr" value={r.label} placeholder={["निधी", "रस्ते", "कालावधी"][i]} aria-label={`Label ${i + 1}`} onChange={(e) => update(i, "label", e.target.value)} />
              {rows.length > 1 && <button className="icon-btn" aria-label="Remove" onClick={() => set(f.key, rows.filter((_, j) => j !== i))}><X size={15} /></button>}
            </div>
          ))}
          {rows.length < 3 && <button className="btn small" onClick={() => set(f.key, [...rows, { value: "", label: "" }])}><Plus size={14} /> Add a number</button>}
        </div>
      );
    }
    return <label key={f.key} className="field">{label}<input className="mr" value={form[f.key]} placeholder={f.placeholder} onChange={(e) => set(f.key, e.target.value)} /></label>;
  };

  const pool = options ? [...new Set([...options.hashtags, ...chosen.hashtags])] : [];
  return (
    <div className="split wide-right">
      <section className="panel form">
        <h2>{type.label}</h2>
        {type.fields.map(field)}
        <div className="field">
          <span className="field-label">Photo <span className="optional">{PHOTO_NOTE[type.photo]}</span></span>
          <div className="cp-photo">
            {photoUrl ? <img src={photoUrl} alt="Chosen" /> : <span className="cp-photo-empty"><ImagePlus size={22} /></span>}
            <div className="actions">
              <button className="btn small" onClick={() => fileInput.current?.click()}>{photo ? "Change photo" : "Add photo"}</button>
              {photo && <button className="btn small" onClick={() => setPhoto(null)}>Remove</button>}
            </div>
            <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" hidden
                   onChange={(e) => { if (e.target.files[0]) { setPhoto(e.target.files[0]); setDraft(null); } e.target.value = ""; }} />
          </div>
        </div>
        <div className="actions end">
          <button className="btn primary" onClick={writeOptions} disabled={!!busy}>
            <Sparkles size={16} aria-hidden="true" /> {busy === "options" ? "Writing options…" : options ? "Write new options" : "Write options with AI"}
          </button>
        </div>
      </section>

      <div className="result-col">
        {!options && !draft && <p className="empty tall">Fill in the form, then click "Write options with AI". You'll pick the headline and caption here.</p>}
        {options && (
          <section className="plan">
            <section className="plan-part">
              <div className="plan-part-head"><strong>Headline</strong><span className="hint">printed big on the poster</span></div>
              <div className="plan-options">
                {options.headlines.map((h, i) => (
                  <button key={i} className={`plan-opt${chosen.picked.headline === i ? " on" : ""}`} title={h.text}
                          onClick={() => setChosen({ ...chosen, headline: h.text, picked: { ...chosen.picked, headline: i } })}>Option {i + 1}</button>
                ))}
              </div>
              <input className="mr cp-headline" value={chosen.headline} onChange={(e) => setChosen({ ...chosen, headline: e.target.value })} />
              <span className={`plan-count${chosen.headline.length > options.headline_max ? " over" : ""}`}>{chosen.headline.length} / {options.headline_max}</span>
            </section>
            <section className="plan-part">
              <div className="plan-part-head"><strong>Caption</strong></div>
              <div className="plan-options">
                {options.captions.map((c, i) => (
                  <button key={i} className={`plan-opt${chosen.picked.caption === i ? " on" : ""}`}
                          onClick={() => setChosen({ ...chosen, caption: c, picked: { ...chosen.picked, caption: i } })}>Option {i + 1}</button>
                ))}
              </div>
              <textarea className="mr" rows={6} value={chosen.caption} onChange={(e) => setChosen({ ...chosen, caption: e.target.value })} />
            </section>
            <section className="plan-part">
              <div className="plan-part-head"><strong>Hashtags</strong><span className="hint">tick or untick</span></div>
              <div className="tag-pool">
                {pool.map((tag) => {
                  const on = chosen.hashtags.some((t) => t.toLowerCase() === tag.toLowerCase());
                  return (
                    <button key={tag} className={`tag-chip${on ? " on" : ""}`} aria-pressed={on} onClick={() => toggleTag(tag)}>
                      <span className="mr">{tag}</span>{on ? <X size={12} /> : <Plus size={12} />}
                    </button>
                  );
                })}
              </div>
              <div className="plan-rewrite">
                <input className="mr" value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="Add your own"
                       onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTags(); } }} aria-label="Add hashtags" />
                <button className="btn small" onClick={addTags} disabled={!newTag.trim()}><Plus size={14} /> Add</button>
              </div>
            </section>
            <Notice kind="error">{error}</Notice>
            <div className="actions end">
              <button className="btn primary" onClick={create} disabled={!!busy || !chosen.headline.trim() || !chosen.caption.trim()}>
                <Check size={16} aria-hidden="true" /> {busy === "create" ? "Making the poster…" : "Create poster"}
              </button>
            </div>
          </section>
        )}
        {!options && <Notice kind="error">{error}</Notice>}
        {draft && (
          <div className="result">
            <CreatedNotice draft={draft} />
            {draft.warnings.map((w) => <Notice key={w} kind="warning">{w}</Notice>)}
            <FeedPreview draft={draft} />
          </div>
        )}
      </div>
    </div>
  );
}