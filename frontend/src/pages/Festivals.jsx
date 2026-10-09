import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, Sparkles, Upload } from "lucide-react";
import { api } from "../api.js";
import { useStatus } from "../App.jsx";
import DateBlock from "../components/DateBlock.jsx";
import FeedPreview from "../components/FeedPreview.jsx";
import Notice from "../components/Notice.jsx";
import Segmented from "../components/Segmented.jsx";

const LAYOUTS = [
  { value: "text_right", label: "Text right" },
  { value: "text_left", label: "Text left" },
  { value: "text_center", label: "Centre (light)" },
];
const TONE_NAMES = { greeting: "Festival", tribute: "Jayanti", solemn: "Punyatithi" };
const SOURCE_NAMES = { ready: "Ready", uploaded: "Uploaded", ai: "AI" };

const whenText = (d) => (d === 0 ? "Today" : d > 0 ? `In ${d} days` : `${-d} days ago`);

export default function Festivals() {
  const { status, refresh } = useStatus();
  const [params, setParams] = useSearchParams();
  const [list, setList] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api.festivals().then((d) => {
      // upcoming first, past ones at the end
      const sorted = [...d.festivals].sort((a, b) =>
        (a.days_left < 0) - (b.days_left < 0) || Math.abs(a.days_left) - Math.abs(b.days_left));
      setList(sorted);
      if (d.errors.length) setError(`festivals.csv: ${d.errors.join("; ")}`);
    }).catch((e) => setError(e.message));
  }, []);

  const selectedId = params.get("id") || list[0]?.id;
  const fest = list.find((f) => f.id === selectedId);

  return (
    <div className="page">
      <header className="page-head">
        <h1>Festivals</h1>
        <p className="lead">Pick an occasion, choose a picture, and make the poster.</p>
      </header>
      <Notice kind="error">{error}</Notice>

      <div className="split">
        <ul className="occasion-list" aria-label="Occasions">
          {list.map((f) => (
            <li key={f.id}>
              <button className={`occasion${f.id === selectedId ? " on" : ""}`} onClick={() => setParams({ id: f.id })}>
                <DateBlock date={f.date} />
                <span className="occasion-text">
                  <span className="mr">{f.occasion_mr}</span>
                  <span className="muted">{TONE_NAMES[f.tone]}, {whenText(f.days_left).toLowerCase()}</span>
                </span>
                {f.due && <span className="tag due">Due</span>}
              </button>
            </li>
          ))}
        </ul>

        {fest ? <FestivalEditor key={fest.id} fest={fest} imageAi={status?.image_ai} onCreated={refresh} />
              : <p className="empty">Add occasions to data/festivals.csv to start.</p>}
      </div>
    </div>
  );
}

function FestivalEditor({ fest, imageAi, onCreated }) {
  const tribute = fest.tone === "tribute" || fest.tone === "solemn";
  const [layout, setLayout] = useState(tribute ? "text_left" : fest.default_layout);
  const [backgrounds, setBackgrounds] = useState([]);
  const [chosen, setChosen] = useState(null);
  const [aiLabel, setAiLabel] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [draft, setDraft] = useState(null);
  const upload = useRef(null);

  const loadBackgrounds = () => api.backgrounds(fest.id).then((d) => setBackgrounds(d.backgrounds)).catch((e) => setError(e.message));
  useEffect(() => { loadBackgrounds(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const choose = (bg) => { setChosen(bg); setAiLabel(bg.source === "ai"); };
  const posterLines = useMemo(() => [fest.line_small, fest.line_big, fest.line_end].map((t) => t.replaceAll("|", " ")), [fest]);

  const act = async (label, fn) => {
    setBusy(label); setError("");
    try { await fn(); } catch (e) { setError(e.message); } finally { setBusy(""); }
  };

  const onUpload = (file) => act("upload", async () => {
    const bg = await api.uploadBackground(fest.id, file);
    await loadBackgrounds();
    choose(bg);
  });

  const onGenerate = () => act("generate", async () => {
    await api.generateBackgrounds(fest.id, layout);
    await loadBackgrounds();
  });

  const onCreate = () => act("create", async () => {
    const d = await api.createFestivalPost(fest.id, { background: chosen.path, layout, ai_generated: aiLabel });
    setDraft(d);
    onCreated();
  });

  return (
    <section className="panel editor">
      <div className="editor-head">
        <div>
          <h2 className="mr">{fest.occasion_mr}</h2>
          <p className="muted">{fest.occasion_en}, {fest.date}</p>
        </div>
        <span className={`tag tone-${fest.tone}`}>{TONE_NAMES[fest.tone]}</span>
      </div>
      {fest.notes && <Notice kind="warning">{fest.notes}</Notice>}

      <div className="poster-text" aria-label="Text on the poster">
        <span className="pt-small mr">{posterLines[0]}</span>
        <span className="pt-big mr">{posterLines[1]}</span>
        <span className="pt-end mr">{posterLines[2]}</span>
      </div>

      <div className="field">
        <span className="field-label">Layout</span>
        <Segmented label="Layout" options={LAYOUTS} value={layout} onChange={setLayout} disabled={tribute} />
        {tribute && <span className="hint">Jayanti and punyatithi always use the tribute design: portrait right, text left.</span>}
      </div>

      <div className="field">
        <div className="field-row">
          <span className="field-label">Background picture</span>
          <div className="actions">
            <button className="btn ghost" onClick={() => upload.current?.click()} disabled={!!busy}>
              <Upload size={16} aria-hidden="true" /> {busy === "upload" ? "Uploading…" : "Upload"}
            </button>
            <button className="btn ghost" onClick={onGenerate} disabled={!!busy || !imageAi}
                    title={imageAi ? "" : "Add OPENAI_API_KEY to .env to use this"}>
              <Sparkles size={16} aria-hidden="true" /> {busy === "generate" ? "Painting 4 pictures…" : "Make 4 with AI"}
            </button>
          </div>
          <input ref={upload} type="file" accept="image/png,image/jpeg,image/webp" hidden
                 onChange={(e) => { if (e.target.files[0]) onUpload(e.target.files[0]); e.target.value = ""; }} />
        </div>

        {backgrounds.length ? (
          <div className="bg-grid">
            {backgrounds.map((bg) => (
              <button key={bg.path} className={`bg${chosen?.path === bg.path ? " on" : ""}`} onClick={() => choose(bg)}
                      aria-pressed={chosen?.path === bg.path}>
                <img src={bg.url} alt="" />
                <span className="bg-source">{SOURCE_NAMES[bg.source]}</span>
                {chosen?.path === bg.path && <span className="bg-check"><Check size={14} /></span>}
              </button>
            ))}
          </div>
        ) : (
          <p className="empty">No picture yet. Upload one, or save a file named {fest.id}.png in assets/backgrounds.</p>
        )}
      </div>

      <label className="check">
        <input type="checkbox" checked={aiLabel} onChange={(e) => setAiLabel(e.target.checked)} />
        This picture was made by AI
      </label>

      <Notice kind="error">{error}</Notice>
      <div className="actions end">
        <button className="btn primary" onClick={onCreate} disabled={!chosen || !!busy}>
          {busy === "create" ? "Making the poster…" : "Create poster"}
        </button>
      </div>

      {draft && (
        <div className="result">
          <Notice kind="success">Poster created. It is waiting on the Approvals page.</Notice>
          <FeedPreview draft={draft} />
          {draft.warnings.map((w) => <Notice key={w} kind="warning">{w}</Notice>)}
        </div>
      )}
    </section>
  );
}