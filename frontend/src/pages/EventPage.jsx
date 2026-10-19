import { useState } from "react";
import { api } from "../api.js";
import { useStatus } from "../App.jsx";
import FeedPreview from "../components/FeedPreview.jsx";
import CreatedNotice from "../components/CreatedNotice.jsx";
import Notice from "../components/Notice.jsx";
import PhotoPicker from "../components/PhotoPicker.jsx";

const today = () => new Date().toISOString().slice(0, 10);
const toDisplayDate = (iso) => iso.split("-").reverse().join("/");

const LANGUAGE_NAMES = { mr: "Marathi", hi: "Hindi", en: "English" };
// example text for each field, in the client's post language
const PLACEHOLDERS = {
  mr: { name: "नवीन आरोग्य केंद्राचे उद्घाटन", place: "ठाणे", guests: "जिल्हाधिकारी, स्थानिक नगरसेवक",
        points: "३ ते ५ ओळी: काय झाले, काय सांगितले, लोकांसाठी का महत्त्वाचे", thanks: "आरोग्य विभागाचे सर्व कर्मचारी" },
  hi: { name: "नए स्वास्थ्य केंद्र का उद्घाटन", place: "इंदौर", guests: "ज़िलाधिकारी, स्थानीय पार्षद",
        points: "3 से 5 पंक्तियाँ: क्या हुआ, क्या कहा गया, लोगों के लिए क्यों ज़रूरी है", thanks: "स्वास्थ्य विभाग के सभी कर्मचारी" },
  en: { name: "Opening of the new health centre", place: "Pune", guests: "District collector, local councillors",
        points: "3 to 5 lines: what happened, what was said, why it matters", thanks: "All staff of the health department" },
};

export default function EventPage() {
  const { status, refresh } = useStatus();
  const langId = status?.client?.language || "mr";
  const langName = LANGUAGE_NAMES[langId] || "Marathi";
  const ph = PLACEHOLDERS[langId] || PLACEHOLDERS.mr;
  const hint = <span className="cp-hint">Any language. The AI writes the caption in {langName}.</span>;

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
        <p className="lead">Tell what happened and add the photos. Type in any language: the caption is written in {langName}, from what you type here only. Photos are posted as they are.</p>
      </header>

      <div className="split wide-right">
        <form className="panel form" onSubmit={submit} noValidate>
          <label className="field">
            <span className="field-label">Event name</span>
            <input value={form.name} onChange={set("name")} placeholder={ph.name} className="mr" />
            {hint}
          </label>
          <div className="row-2">
            <label className="field">
              <span className="field-label">Place</span>
              <input value={form.place} onChange={set("place")} placeholder={ph.place} className="mr" />
            </label>
            <label className="field">
              <span className="field-label">Date</span>
              <input type="date" value={form.date} onChange={set("date")} />
            </label>
          </div>
          <label className="field">
            <span className="field-label">Who attended <span className="optional">optional</span></span>
            <input value={form.guests} onChange={set("guests")} placeholder={ph.guests} className="mr" />
          </label>
          <label className="field">
            <span className="field-label">Key points</span>
            <textarea rows={5} value={form.points} onChange={set("points")} className="mr" placeholder={ph.points} />
            <span className="cp-hint">Only facts you type here are used. Any language; names and numbers are kept exactly.</span>
          </label>
          <label className="field">
            <span className="field-label">People to thank <span className="optional">optional</span></span>
            <input value={form.thanks} onChange={set("thanks")} placeholder={ph.thanks} className="mr" />
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
              <CreatedNotice draft={draft} />
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