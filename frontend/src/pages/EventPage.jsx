import { useState } from "react";
import { api } from "../api.js";
import { useStatus } from "../App.jsx";
import FeedPreview from "../components/FeedPreview.jsx";
import Notice from "../components/Notice.jsx";
import PhotoPicker from "../components/PhotoPicker.jsx";

const today = () => new Date().toISOString().slice(0, 10);
const toDisplayDate = (iso) => iso.split("-").reverse().join("/");

export default function EventPage() {
  const { refresh } = useStatus();
  const [form, setForm] = useState({ name: "", place: "", date: today(), guests: "", points: "", thanks: "" });
  const [photos, setPhotos] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState(null);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    const missing = [!form.name.trim() && "event name", !form.place.trim() && "place",
                     !form.points.trim() && "key points", !photos.length && "at least one photo"].filter(Boolean);
    if (missing.length) { setError(`Add the ${missing.join(", ")}.`); return; }

    setBusy(true); setError(""); setDraft(null);
    const data = new FormData();
    Object.entries({ ...form, date: toDisplayDate(form.date) }).forEach(([k, v]) => data.append(k, v));
    photos.forEach((p) => data.append("photos", p));
    try {
      setDraft(await api.createEvent(data));
      refresh();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <div className="page">
      <header className="page-head">
        <h1>Event post</h1>
        <p className="lead">Tell what happened and add the photos. The caption is written from what you type here only.</p>
      </header>

      <div className="split wide-right">
        <form className="panel form" onSubmit={submit} noValidate>
          <label className="field">
            <span className="field-label">Event name</span>
            <input value={form.name} onChange={set("name")} placeholder="नवीन आरोग्य केंद्राचे उद्घाटन" className="mr" />
          </label>
          <div className="row-2">
            <label className="field">
              <span className="field-label">Place</span>
              <input value={form.place} onChange={set("place")} placeholder="ठाणे" className="mr" />
            </label>
            <label className="field">
              <span className="field-label">Date</span>
              <input type="date" value={form.date} onChange={set("date")} />
            </label>
          </div>
          <label className="field">
            <span className="field-label">Who attended <span className="optional">optional</span></span>
            <input value={form.guests} onChange={set("guests")} className="mr" />
          </label>
          <label className="field">
            <span className="field-label">Key points</span>
            <textarea rows={5} value={form.points} onChange={set("points")} className="mr"
                      placeholder="3 to 5 lines: what happened, what was said, why it matters" />
          </label>
          <label className="field">
            <span className="field-label">People to thank <span className="optional">optional</span></span>
            <input value={form.thanks} onChange={set("thanks")} className="mr" />
          </label>
          <div className="field">
            <span className="field-label">Photos <span className="optional">best photo first, up to 10</span></span>
            <PhotoPicker files={photos} onChange={setPhotos} />
          </div>
          <Notice kind="error">{error}</Notice>
          <div className="actions end">
            <button className="btn primary" type="submit" disabled={busy}>{busy ? "Writing the caption…" : "Create post"}</button>
          </div>
        </form>

        <div className="result-col">
          {draft ? (
            <>
              <Notice kind="success">Post created. It is waiting on the Approvals page.</Notice>
              {draft.warnings.map((w) => <Notice key={w} kind="warning">{w}</Notice>)}
              <FeedPreview draft={draft} />
            </>
          ) : (
            <p className="empty tall">The post preview appears here after you create it.</p>
          )}
        </div>
      </div>
    </div>
  );
}