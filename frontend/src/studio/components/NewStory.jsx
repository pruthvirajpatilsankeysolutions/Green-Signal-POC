import { useState } from "react";
import { Check } from "../icons.jsx";
import { useStudio } from "../useStudio.jsx";
import { LENGTH } from "../data.js";
import { Modal } from "./ui.jsx";

const MAX_PICK = 3;
function Chips({ label, items, value, onChange }) {
  const toggle = (x) => onChange(value.includes(x) ? value.filter((v) => v !== x) : value.length < MAX_PICK ? [...value, x] : value);
  return (
    <div className="fld"><span className="fl">{label} <span className="hint">pick up to {MAX_PICK}</span></span>
      <div className="chips" role="group" aria-label={label}>
        {items.map((x) => { const on = value.includes(x); return <button type="button" key={x} className={`chipb${on ? " on" : ""}`} aria-pressed={on} disabled={!on && value.length >= MAX_PICK} onClick={() => toggle(x)}>{on && <Check size={13} />}{x}</button>; })}
      </div>
    </div>
  );
}

// The brief: what the writer wants. Everything Story Studio needs to start, and nothing more.
export default function NewStory() {
  const { options, create, setNewOpen } = useStudio();
  const [f, setF] = useState({ content_type: "Short Story", idea: "", genres: [], tones: [], language: localStorage.getItem("studio-language") || "English", length: "Medium", characters: "", setting: "", audience: "", brand: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  if (!options) return null;
  const missing = f.idea.trim().length < 10 ? "Describe the idea in a sentence or two." : !f.genres.length ? "Choose at least one genre." : !f.tones.length ? "Choose at least one tone." : "";
  const submit = async () => {
    setBusy(true); setError("");
    try {
      localStorage.setItem("studio-language", f.language);
      await create(Object.fromEntries(Object.entries(f).filter(([, v]) => (Array.isArray(v) ? true : String(v).trim() !== ""))));
      setNewOpen(false);
    } catch (e) { setError(e.message); setBusy(false); }
  };
  return (
    <Modal title="New story" onClose={() => setNewOpen(false)}
           footer={<>{missing && <span className="help" style={{ margin: "0 auto 0 0" }}>{missing}</span>}<button className="btn" onClick={() => setNewOpen(false)} disabled={busy}>Cancel</button><button className="btn k" onClick={submit} disabled={busy || !!missing}>{busy ? "Starting…" : "Start the story"}</button></>}>
      <p className="help" style={{ margin: 0 }}>Tell Story Studio the basics. It writes one stage at a time and you approve each one before the next is written.</p>
      <div className="two2">
        <div className="fld"><label htmlFor="ct">What are you making?</label><select id="ct" className="in" value={f.content_type} onChange={(e) => set("content_type")(e.target.value)}>{options.content_types.map((x) => <option key={x}>{x}</option>)}</select></div>
        <div className="fld"><label htmlFor="lg">Language</label><select id="lg" className="in" value={f.language} onChange={(e) => set("language")(e.target.value)}>{options.languages.map((x) => <option key={x}>{x}</option>)}</select></div>
      </div>
      <div className="fld"><label htmlFor="idea">The idea <span className="hint">{f.idea.trim().length}/4000</span></label>
        <textarea id="idea" className="in area mr" rows={4} maxLength={4000} value={f.idea} onChange={(e) => set("idea")(e.target.value)} placeholder="e.g. A fisherman finds an old radio that plays tomorrow's news, and has to decide whether to warn the village." autoFocus /></div>
      <Chips label="Genre" items={options.genres} value={f.genres} onChange={set("genres")} />
      <Chips label="Tone" items={options.tones} value={f.tones} onChange={set("tones")} />
      <div className="fld"><span className="fl">Length <span className="hint">{LENGTH[f.length].toLowerCase()}</span></span>
        <div className="seg2" role="radiogroup" aria-label="Length">{options.lengths.map((x) => <button type="button" key={x} role="radio" aria-checked={f.length === x} className={f.length === x ? "on" : ""} onClick={() => set("length")(x)}>{x}</button>)}</div></div>
      <details className="more2"><summary>More details (optional)</summary>
        <div className="two2" style={{ marginTop: 12 }}>
          {[["characters", "Characters you already have in mind"], ["setting", "Setting"], ["audience", "Audience"], ["brand", "Brand (for an advertisement)"]].map(([k, l]) => <div className="fld" key={k}><label htmlFor={`f-${k}`}>{l}</label><input id={`f-${k}`} className="in mr" value={f[k]} onChange={(e) => set(k)(e.target.value)} /></div>)}
        </div>
        <div className="fld" style={{ marginTop: 12 }}><label htmlFor="f-notes">Anything else Story Studio should know</label><textarea id="f-notes" className="in area mr" rows={2} value={f.notes} onChange={(e) => set("notes")(e.target.value)} /></div>
      </details>
      {error && <div className="err" role="alert">{error}</div>}
    </Modal>
  );
}
