import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Upload } from "lucide-react";
import { api, getClientId } from "../api.js";
import Notice from "../components/Notice.jsx";

const TYPE_NAMES = { politician: "Politician", business: "Business", institution: "Institution", ngo: "NGO", personal: "Personal brand" };
const KIND_NAMES = {
  tribute: "Jayanti (tribute)", solemn: "Punyatithi", greeting: "Festival / special day",
  congratulate: "News: congratulate", condolence: "News: condolence", event: "Event",
};
const ASSET_INFO = {
  banner: { title: "Footer banner", hint: "Logo, name and designation in one image. Replaces the old one.", multiple: false },
  logo: { title: "Logo", hint: "Used only if there is no banner. PNG with transparent background.", multiple: false },
  leader: { title: "Leader photos", hint: "Cut-out PNGs with transparent background. Add several; they rotate.", multiple: true },
};

export default function Clients({ onChanged, onSwitch }) {
  const [list, setList] = useState([]);
  const [selected, setSelected] = useState(getClientId());
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);

  const load = () => api.clients().then((d) => {
    setList(d.clients);
    if (!d.clients.find((c) => c.id === selected) && d.clients[0]) setSelected(d.clients[0].id);
  }).catch((e) => setError(e.message));

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const created = (c) => { setAdding(false); load(); setSelected(c.id); onChanged(); };

  return (
    <div className="page">
      <header className="page-head row">
        <div>
          <h1>Clients</h1>
          <p className="lead">Each client has their own banner, photos, colours and caption style.</p>
        </div>
        <button className="btn primary" onClick={() => setAdding(true)}><Plus size={16} aria-hidden="true" /> Add client</button>
      </header>
      <Notice kind="error">{error}</Notice>

      <div className="split">
        <ul className="occasion-list" aria-label="Clients">
          {list.map((c) => (
            <li key={c.id}>
              <button className={`occasion${c.id === selected ? " on" : ""}`} onClick={() => { setSelected(c.id); setAdding(false); }}>
                <span className="avatar" aria-hidden="true">{c.name.slice(0, 1)}</span>
                <span className="occasion-text">
                  <span className="mr">{c.name}</span>
                  <span className="muted">{TYPE_NAMES[c.type] || c.type}{c.handle ? `, ${c.handle}` : ""}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>

        {adding ? <NewClient onCreated={created} onCancel={() => setAdding(false)} />
          : selected ? <ClientEditor key={selected} id={selected} onSaved={() => { load(); onChanged(); }} onSwitch={onSwitch} />
          : <p className="empty">Add your first client.</p>}
      </div>
    </div>
  );
}

function NewClient({ onCreated, onCancel }) {
  const [form, setForm] = useState({ name: "", type: "politician", handle: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (!form.name.trim()) { setError("Add the client's name."); return; }
    setBusy(true); setError("");
    try { onCreated(await api.createClient(form)); } catch (e) { setError(e.message); setBusy(false); }
  };

  return (
    <section className="panel">
      <h2>New client</h2>
      <label className="field">
        <span className="field-label">Name (as it should appear on posts)</span>
        <input className="mr" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </label>
      <div className="row-2">
        <label className="field">
          <span className="field-label">Type</span>
          <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            {Object.entries(TYPE_NAMES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Instagram handle <span className="optional">optional</span></span>
          <input value={form.handle} onChange={(e) => setForm({ ...form, handle: e.target.value })} placeholder="@handle" />
        </label>
      </div>
      <Notice kind="error">{error}</Notice>
      <div className="actions end">
        <button className="btn" onClick={onCancel}>Cancel</button>
        <button className="btn primary" disabled={busy} onClick={save}>{busy ? "Creating…" : "Create client"}</button>
      </div>
    </section>
  );
}

function ClientEditor({ id, onSaved, onSwitch }) {
  const [client, setClient] = useState(null);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [style, setStyle] = useState({ kind: "tribute", text: "" });

  const fill = (c) => {
    setClient(c);
    setForm({
      name: c.name, type: c.type, handle: c.handle, accent_color: c.accent_color,
      designation_lines: c.designation_lines.join("\n"), fixed_hashtags: c.fixed_hashtags.join(" "),
      show_ai_label: c.show_ai_label,
    });
  };

  useEffect(() => { api.client(id).then(fill).catch((e) => setError(e.message)); }, [id]);

  const act = async (label, fn) => {
    setBusy(label); setError(""); setSaved(false);
    try { const c = await fn(); if (c) fill(c); return true; } catch (e) { setError(e.message); return false; } finally { setBusy(""); }
  };

  const saveProfile = async () => {
    const ok = await act("save", () => api.updateClient(id, {
      ...form,
      designation_lines: form.designation_lines.split("\n").map((l) => l.trim()).filter(Boolean),
      fixed_hashtags: form.fixed_hashtags.split(/\s+/).filter(Boolean),
    }));
    if (ok) { setSaved(true); onSaved(); }
  };

  const addStyle = async () => {
    if (!style.text.trim()) return;
    const ok = await act("style", () => api.addStyle(id, style));
    if (ok) setStyle({ ...style, text: "" });
  };

  if (!client || !form) return <section className="panel"><p className="empty">Loading…</p></section>;
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const isCurrent = getClientId() === id;

  return (
    <div className="stack">
      <section className="panel">
        <div className="card-head">
          <h2 className="mr">{client.name}</h2>
          {isCurrent ? <span className="tag status-approved">Working on this client</span>
            : <button className="btn small" onClick={() => onSwitch(id)}>Work on this client</button>}
        </div>
        <div className="row-2">
          <label className="field">
            <span className="field-label">Name</span>
            <input className="mr" value={form.name} onChange={set("name")} />
          </label>
          <label className="field">
            <span className="field-label">Type</span>
            <select className="input" value={form.type} onChange={set("type")}>
              {client.types.map((t) => <option key={t} value={t}>{TYPE_NAMES[t] || t}</option>)}
            </select>
          </label>
        </div>
        <label className="field">
          <span className="field-label">Designation <span className="optional">one per line; shown if there is no banner</span></span>
          <textarea className="mr" rows={3} value={form.designation_lines} onChange={set("designation_lines")} />
        </label>
        <div className="row-2">
          <label className="field">
            <span className="field-label">Instagram handle</span>
            <input value={form.handle} onChange={set("handle")} />
          </label>
          <label className="field">
            <span className="field-label">Brand colour</span>
            <span className="color-row">
              <input type="color" value={form.accent_color} onChange={set("accent_color")} aria-label="Brand colour" />
              <input value={form.accent_color} onChange={set("accent_color")} />
            </span>
          </label>
        </div>
        <label className="field">
          <span className="field-label">Hashtags on every post <span className="optional">separate with spaces</span></span>
          <input value={form.fixed_hashtags} onChange={set("fixed_hashtags")} placeholder="#Brand" />
        </label>
        <label className="check">
          <input type="checkbox" checked={form.show_ai_label} onChange={set("show_ai_label")} />
          Show an "AI-Generated" label on posters with AI-made pictures
        </label>
        <Notice kind="error">{error}</Notice>
        {saved && <Notice kind="success">Saved.</Notice>}
        <div className="actions end">
          <button className="btn primary" disabled={!!busy} onClick={saveProfile}>{busy === "save" ? "Saving…" : "Save profile"}</button>
        </div>
      </section>

      <section className="panel">
        <h2>Brand assets</h2>
        {Object.entries(ASSET_INFO).map(([kind, info]) => (
          <AssetGroup key={kind} kind={kind} info={info} assets={client.assets.filter((a) => a.kind === kind)}
                      busy={busy === kind}
                      onUpload={(files) => act(kind, () => api.uploadAssets(id, kind, files))}
                      onDelete={(assetId) => act(kind, () => api.deleteAsset(id, assetId))} />
        ))}
      </section>

      <section className="panel">
        <div className="card-head">
          <h2>Caption style examples</h2>
          <span className="muted">{client.styles.length} saved</span>
        </div>
        <p className="hint">Paste real past captions. The AI copies their style for that post type. Approved posts are added here automatically.</p>
        <div className="style-add">
          <select className="input" value={style.kind} onChange={(e) => setStyle({ ...style, kind: e.target.value })} aria-label="Post type">
            {client.style_kinds.map((k) => <option key={k} value={k}>{KIND_NAMES[k] || k}</option>)}
          </select>
          <textarea className="mr" rows={4} value={style.text} onChange={(e) => setStyle({ ...style, text: e.target.value })}
                    placeholder="Paste a real caption from their Instagram, including hashtags" />
          <div className="actions end">
            <button className="btn" disabled={!!busy || !style.text.trim()} onClick={addStyle}>
              <Plus size={16} aria-hidden="true" /> {busy === "style" ? "Adding…" : "Add example"}
            </button>
          </div>
        </div>
        {client.style_kinds.map((kind) => {
          const items = client.styles.filter((s) => s.kind === kind);
          if (!items.length) return null;
          return (
            <div key={kind} className="style-group">
              <div className="field-label">{KIND_NAMES[kind] || kind} <span className="optional">{items.length}</span></div>
              {items.map((s) => (
                <div key={s.id} className="style-item">
                  <pre className="mr">{s.text}</pre>
                  <div className="style-meta">
                    {s.source === "approved" && <span className="tag status-approved">From approved post</span>}
                    <button className="icon-btn" title="Delete example" aria-label="Delete example"
                            onClick={() => act("style", () => api.deleteStyle(id, s.id))}><Trash2 size={16} /></button>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </section>
    </div>
  );
}

function AssetGroup({ kind, info, assets, busy, onUpload, onDelete }) {
  const input = useRef(null);
  return (
    <div className="asset-group">
      <div className="field-row">
        <div>
          <div className="field-label">{info.title}</div>
          <div className="hint">{info.hint}</div>
        </div>
        <button className="btn small" disabled={busy} onClick={() => input.current?.click()}>
          <Upload size={16} aria-hidden="true" /> {busy ? "Uploading…" : assets.length && !info.multiple ? "Replace" : "Upload"}
        </button>
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" multiple={info.multiple} hidden
               onChange={(e) => { if (e.target.files.length) onUpload(e.target.files); e.target.value = ""; }} />
      </div>
      {assets.length ? (
        <div className={`asset-list ${kind}`}>
          {assets.map((a) => (
            <figure key={a.id} className="asset">
              <img src={a.url} alt={info.title} />
              <button className="thumb-remove" aria-label={`Delete ${info.title}`} onClick={() => onDelete(a.id)}><Trash2 size={13} /></button>
            </figure>
          ))}
        </div>
      ) : <p className="empty small-pad">Nothing uploaded yet.</p>}
    </div>
  );
}