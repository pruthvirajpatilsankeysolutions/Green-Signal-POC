import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, Copy, Download, Inbox, RotateCcw, X } from "lucide-react";
import { api } from "../api.js";
import { useStatus } from "../App.jsx";
import FeedPreview from "../components/FeedPreview.jsx";
import Notice from "../components/Notice.jsx";

const TYPE_NAMES = { festival: "Festival", event: "Event", reaction: "News reaction" };

export default function Approvals() {
  const { refresh } = useStatus();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState("waiting");
  const [lists, setLists] = useState({ waiting: null, approved: [] });
  const [error, setError] = useState("");

  const load = () => Promise.all([api.drafts("waiting"), api.drafts("approved")])
    .then(([w, a]) => setLists({ waiting: w.drafts, approved: a.drafts }))
    .catch((e) => setError(e.message));

  useEffect(() => { load(); }, []);

  const items = lists[tab] || [];
  const selectedId = params.get("id");
  const selected = useMemo(() => items.find((d) => d.id === selectedId) || items[0], [items, selectedId]);

  const afterAction = (nextTab) => { load(); refresh(); if (nextTab) setTab(nextTab); setParams({}); };

  return (
    <div className="page">
      <header className="page-head">
        <h1>Approvals</h1>
        <p className="lead">See each post as it will appear on Instagram, then approve it, ask for a change, or reject it.</p>
      </header>
      <Notice kind="error">{error}</Notice>

      <div className="inbox">
        <aside className="queue">
          <div className="tabs" role="tablist">
            {["waiting", "approved"].map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "on" : ""}
                      onClick={() => { setTab(t); setParams({}); }}>
                {t === "waiting" ? "Waiting" : "Approved"}
                <span className="tab-count">{lists[t]?.length ?? 0}</span>
              </button>
            ))}
          </div>
          {lists.waiting === null ? <p className="empty pad">Loading…</p>
            : items.length === 0 ? (
              <div className="queue-empty">
                <Inbox size={28} aria-hidden="true" />
                <p>{tab === "waiting" ? "Nothing is waiting. New posts appear here after you create them." : "No approved posts yet."}</p>
              </div>
            ) : (
              <ul className="queue-list">
                {items.map((d) => (
                  <li key={d.id}>
                    <button className={`queue-item${selected?.id === d.id ? " on" : ""}`} onClick={() => setParams({ id: d.id })}>
                      {d.image_urls[0] ? <img src={d.image_urls[0]} alt="" /> : <span className="queue-noimg" />}
                      <span className="queue-text">
                        <span className="mr strong ellipsis">{d.title}</span>
                        <span className="muted">{TYPE_NAMES[d.type]}, v{d.version}</span>
                        <span className="muted small">{tab === "approved" ? `Approved ${d.approved_at}` : d.created_at}</span>
                      </span>
                      {d.warnings.length > 0 && <span className="warn-dot" title="Has warnings" />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
        </aside>

        <section className="detail">
          {selected ? (
            tab === "waiting"
              ? <ReviewPanel key={`${selected.id}-${selected.version}`} draft={selected} onDone={afterAction} />
              : <ApprovedPanel key={selected.id} draft={selected} />
          ) : (
            <p className="empty pad">Select a post to see it here.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function ReviewPanel({ draft, onDone }) {
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const act = async (label, fn, nextTab) => {
    setBusy(label); setError("");
    try { await fn(); onDone(nextTab); } catch (e) { setError(e.message); setBusy(""); }
  };

  return (
    <div className="detail-body">
      <div className="detail-preview"><FeedPreview draft={draft} /></div>
      <div className="detail-side">
        <div>
          <span className="eyebrow-tag">{TYPE_NAMES[draft.type]}</span>
          <h2 className="mr">{draft.title}</h2>
          <p className="muted">Version {draft.version}, created {draft.created_at}</p>
        </div>
        {draft.warnings.map((w) => <Notice key={w} kind="warning">{w}</Notice>)}

        <div className="actions">
          <button className="btn primary" disabled={!!busy} onClick={() => act("approve", () => api.approve(draft.id), "approved")}>
            <Check size={16} aria-hidden="true" /> {busy === "approve" ? "Approving…" : "Approve"}
          </button>
          <button className="btn danger" disabled={!!busy} onClick={() => act("reject", () => api.reject(draft.id))}>
            <X size={16} aria-hidden="true" /> Reject
          </button>
        </div>

        <div className="divider" />

        <label className="field">
          <span className="field-label">Ask for a change in the caption</span>
          <textarea rows={4} className="mr" value={instruction} onChange={(e) => setInstruction(e.target.value)}
                    placeholder="उदा. शेतकऱ्यांचा उल्लेख करा, or: make it shorter" />
        </label>
        <div className="actions">
          <button className="btn" disabled={!!busy || !instruction.trim()}
                  onClick={() => act("rewrite", () => api.rewrite(draft.id, instruction))}>
            <RotateCcw size={16} aria-hidden="true" /> {busy === "rewrite" ? "Rewriting…" : "Rewrite caption"}
          </button>
        </div>
        <p className="hint">To change the text on the poster image, edit festivals.csv and create the poster again.</p>
        <Notice kind="error">{error}</Notice>
      </div>
    </div>
  );
}

function ApprovedPanel({ draft }) {
  const [copied, setCopied] = useState(false);
  const text = [draft.caption, draft.hashtags.join(" ")].filter(Boolean).join("\n\n");

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="detail-body">
      <div className="detail-preview"><FeedPreview draft={draft} /></div>
      <div className="detail-side">
        <div>
          <span className="eyebrow-tag ok">Approved</span>
          <h2 className="mr">{draft.title}</h2>
          <p className="muted">Approved {draft.approved_at}</p>
        </div>
        <div className="field">
          <span className="field-label">Images</span>
          <div className="downloads">
            {draft.image_urls.map((u, i) => (
              <a key={u} className="btn" href={u} download>
                <Download size={16} aria-hidden="true" /> Image {i + 1}
              </a>
            ))}
          </div>
        </div>
        <div className="field">
          <span className="field-label">Caption</span>
          <pre className="caption-box mr">{text}</pre>
          <div className="actions">
            <button className="btn" onClick={copy}><Copy size={16} aria-hidden="true" /> {copied ? "Copied" : "Copy caption"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}