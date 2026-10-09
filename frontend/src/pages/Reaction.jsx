import { useState } from "react";
import { api } from "../api.js";
import { useStatus } from "../App.jsx";
import FeedPreview from "../components/FeedPreview.jsx";
import Notice from "../components/Notice.jsx";
import PhotoPicker from "../components/PhotoPicker.jsx";
import Segmented from "../components/Segmented.jsx";

const TONES = [
  { value: "congratulate", label: "Congratulate" },
  { value: "condolence", label: "Condolence" },
  { value: "support", label: "Support" },
];

export default function Reaction() {
  const { refresh } = useStatus();
  const [tone, setTone] = useState("congratulate");
  const [line, setLine] = useState("");
  const [url, setUrl] = useState("");
  const [pasted, setPasted] = useState("");
  const [mention, setMention] = useState("");
  const [memories, setMemories] = useState("");
  const [photos, setPhotos] = useState([]);
  const [rights, setRights] = useState(false);
  const [checked, setChecked] = useState(null);
  const [checkedLine, setCheckedLine] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [draft, setDraft] = useState(null);

  const factsCurrent = checked && checkedLine === line;

  const check = async () => {
    if (!line.trim() || !(url.trim() || pasted.trim())) {
      setError("Add the one-line summary and a news link, or paste the news text.");
      return;
    }
    setBusy("check"); setError(""); setDraft(null);
    try {
      setChecked(await api.checkFacts({ team_line: line, url, pasted }));
      setCheckedLine(line);
    } catch (e) { setError(e.message); } finally { setBusy(""); }
  };

  const create = async () => {
    if (photos.length && !rights) { setError("Confirm you have the right to use these photos, or remove them."); return; }
    setBusy("create"); setError("");
    const data = new FormData();
    data.append("team_line", line);
    data.append("tone", tone);
    data.append("mention", mention);
    data.append("memories", tone === "condolence" ? memories : "");
    data.append("checked", JSON.stringify(checked));
    photos.forEach((p) => data.append("photos", p));
    try {
      setDraft(await api.createReaction(data));
      refresh();
    } catch (e) { setError(e.message); } finally { setBusy(""); }
  };

  const facts = factsCurrent ? Object.entries(checked.facts).filter(([, v]) => v !== null && v !== "" && !(Array.isArray(v) && !v.length)) : [];

  return (
    <div className="page">
      <header className="page-head">
        <h1>News reaction</h1>
        <p className="lead">Sports wins, awards, achievements and condolences. Political or controversial news is blocked and needs a hand-written post.</p>
      </header>

      <div className="split wide-right">
        <div className="panel form">
          <div className="field">
            <span className="field-label">Type</span>
            <Segmented label="Type" options={TONES} value={tone} onChange={setTone} />
          </div>
          <label className="field">
            <span className="field-label">What happened, in one line</span>
            <input value={line} onChange={(e) => setLine(e.target.value)} placeholder="India won Asian Games hockey gold, beat Japan 5-1" />
          </label>
          <label className="field">
            <span className="field-label">News link</span>
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
          </label>
          <label className="field">
            <span className="field-label">Or paste the news text <span className="optional">if the link doesn't open</span></span>
            <textarea rows={4} value={pasted} onChange={(e) => setPasted(e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Mention specially <span className="optional">optional</span></span>
            <input value={mention} onChange={(e) => setMention(e.target.value)} className="mr" />
          </label>
          {tone === "condolence" && (
            <label className="field">
              <span className="field-label">Leader's personal memories <span className="optional">optional, only real ones</span></span>
              <textarea rows={4} value={memories} onChange={(e) => setMemories(e.target.value)} className="mr"
                        placeholder="Leave empty if he didn't know the person. The AI only arranges these words." />
            </label>
          )}
          <div className="field">
            <span className="field-label">Photos <span className="optional">real photos are posted as they are, without a banner</span></span>
            <PhotoPicker files={photos} onChange={setPhotos} />
            {photos.length > 0 && (
              <label className="check">
                <input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} />
                We have the right to use these photos (not TV or broadcast screenshots)
              </label>
            )}
          </div>

          <Notice kind="error">{error}</Notice>
          <div className="actions end">
            <button className="btn" onClick={check} disabled={!!busy}>{busy === "check" ? "Reading the news…" : "Check facts"}</button>
            <button className="btn primary" onClick={create} disabled={!factsCurrent || !!checked?.blocked || !!busy}>
              {busy === "create" ? "Writing the caption…" : "Create post"}
            </button>
          </div>
        </div>

        <div className="result-col">
          {factsCurrent && checked.blocked && (
            <Notice kind="error">Blocked: {checked.blocked}. This topic needs a hand-written post.</Notice>
          )}
          {factsCurrent && !checked.blocked && (
            <section className="panel facts">
              <h2>Facts found in the news</h2>
              <dl>
                {facts.map(([k, v]) => (
                  <div key={k}><dt>{k.replaceAll("_", " ")}</dt><dd>{Array.isArray(v) ? v.join(", ") : String(v)}</dd></div>
                ))}
              </dl>
              {checked.mismatches.map((m) => (
                <Notice key={m} kind="warning">You wrote {m}, but the news doesn't mention it. Check before continuing.</Notice>
              ))}
            </section>
          )}
          {draft && (
            <>
              <Notice kind="success">Post created. It is waiting on the Approvals page.</Notice>
              {draft.warnings.map((w) => <Notice key={w} kind="warning">{w}</Notice>)}
              <FeedPreview draft={draft} />
            </>
          )}
          {!checked && !draft && <p className="empty tall">Check the facts first. They appear here, then you can create the post.</p>}
        </div>
      </div>
    </div>
  );
}