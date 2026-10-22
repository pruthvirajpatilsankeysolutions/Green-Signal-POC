import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileUp, LayoutTemplate, Pencil, Trash2 } from "lucide-react";
import { api } from "../api.js";
import Notice from "../components/Notice.jsx";

// Templates: upload a PowerPoint -> it opens in the design editor -> mark what the app fills -> Save.
export default function Templates() {
    const navigate = useNavigate();
    const [list, setList] = useState(null);
    const [slotNames, setSlotNames] = useState({});
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const fileInput = useRef(null);

    const load = () => api.templates().then((d) => {
        setList(d.templates); setSlotNames(Object.fromEntries(d.slots.map((s) => [s.id, s.label])));
    }).catch((e) => setError(e.message));
    useEffect(() => { load(); }, []);

    const upload = async (file) => {
        if (!file) return;
        setBusy(true); setError("");
        try { const t = await api.importTemplate(file); navigate(`/editor/template/${t.id}`); }
        catch (e) { setError(e.message); setBusy(false); }
        if (fileInput.current) fileInput.current.value = "";
    };
    const remove = async (t) => {
        if (!window.confirm(`Delete the template "${t.name}"?`)) return;
        try { await api.deleteTemplate(t.id); setNotice("Template deleted."); load(); } catch (e) { setError(e.message); }
    };

    return (
        <div className="page">
            <header className="page-head">
                <h1>Templates</h1>
                <p className="lead">Upload a PowerPoint design. It opens in the design editor, where you choose which texts and pictures the app fills for each post. Saved templates appear when creating posts.</p>
            </header>
            <Notice kind="success">{notice}</Notice>
            <Notice kind="error">{error}</Notice>
            <div className="actions">
                <button className="btn primary" disabled={busy} onClick={() => fileInput.current?.click()}>
                    <FileUp size={16} aria-hidden="true" /> {busy ? "Converting…" : "Upload PowerPoint (.pptx)"}
                </button>
                <input ref={fileInput} type="file" accept=".pptx" hidden onChange={(e) => upload(e.target.files?.[0])} />
            </div>
            <p className="hint">Use designs you own or may use as templates. Designs exported from Canva can't be used as templates outside Canva.</p>

            {list === null ? <p className="muted">Loading…</p> : list.length === 0 ? (
                <div className="tpl-empty"><LayoutTemplate size={28} aria-hidden="true" /><p>No templates yet. Upload a PowerPoint design to start.</p></div>
            ) : (
                <div className="tpl-grid">
                    {list.map((t) => (
                        <div key={t.id} className="tpl-card">
                            <button className="tpl-thumb" onClick={() => navigate(`/editor/template/${t.id}`)} title="Edit in the design editor">
                                {t.thumbnail_url ? <img src={t.thumbnail_url} alt="" /> : <LayoutTemplate size={26} aria-hidden="true" />}
                            </button>
                            <div className="tpl-name">{t.name}</div>
                            <div className="tpl-meta">{t.width} × {t.height} · {t.ready ? "Ready" : "Not saved yet"}{t.client_id ? " · this client only" : ""}</div>
                            <div className="tpl-slots">{t.slots.length ? t.slots.map((s) => <span key={s} className="tpl-slot">{slotNames[s] || s}</span>) : <span className="muted">Nothing filled by the app</span>}</div>
                            <div className="actions">
                                <button className="btn small" onClick={() => navigate(`/editor/template/${t.id}`)}><Pencil size={14} aria-hidden="true" /> Edit</button>
                                <button className="btn small danger" onClick={() => remove(t)} aria-label="Delete"><Trash2 size={14} aria-hidden="true" /></button>
                            </div>
                            <div className="tpl-meta">{usedFor(t)}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// "Festival greetings", "Announcement, Offer" or "All posts", from the template's options
function usedFor(t) {
    const names = { festival: "Festival greetings", announcement: "Announcement", offer: "Offer", achievement: "Achievement", spotlight: "Person spotlight" };
    const parts = (t.occasions || []).map((o) => names[o] || o);
    return `For: ${parts.length ? parts.join(", ") : "all posts"}${t.client_types?.length ? ` · ${t.client_types.join(", ")}` : ""}`;
}