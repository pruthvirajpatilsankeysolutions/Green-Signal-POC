import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, ExternalLink, RotateCcw, Sparkles, X } from "lucide-react";
import { api } from "../api.js";
import Notice from "./Notice.jsx";

const STATUS = {
    todo: ["To do", "st-todo"], options: ["Options ready", "st-waiting"], words_approved: ["Words approved", "st-approved"],
    poster_made: ["Poster made", "st-poster"], approved: ["Approved", "st-approved"], rejected: ["Rejected", "st-todo"],
};
const LOCKED = ["poster_made", "approved", "rejected"];       // a post was made: the words are history
const day = (d) => new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
const weekday = (d) => new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short" });

// Month plan: one row per occasion with its hook and poster title (AI options, pick, edit, approve).
export default function MonthPlanTable({ month, monthName, reloadKey, onOpen }) {
    const [rows, setRows] = useState(null);
    const [limits, setLimits] = useState({});
    const [busy, setBusy] = useState("");
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [popup, setPopup] = useState(null);                // { fid, part }

    const load = () => api.monthPlan(month).then((d) => { setRows(d.rows); setLimits(d.limits); }).catch((e) => setError(e.message));
    useEffect(() => { setRows(null); load(); }, [month, reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

    const act = async (label, fn) => {
        setBusy(label); setError(""); setMessage("");
        try { await fn(); } catch (e) { setError(e.message); } finally { setBusy(""); }
    };

    const generate = () => act("generate", async () => {
        const d = await api.generateMonth(month, true);
        const failed = Object.keys(d.errors || {}).length;
        setMessage(d.message || `Planned ${d.planned} occasion${d.planned === 1 ? "" : "s"}.${failed ? ` ${failed} failed: click Plan again to retry.` : ""}`);
        await load();
    });
    const approveAll = () => act("approve-all", async () => {
        const d = await api.approveMonth(month);
        setMessage(`Approved ${d.approved} row${d.approved === 1 ? "" : "s"}.`);
        await load();
    });
    const approveRow = (fid) => act(`approve-${fid}`, async () => { await api.approvePlan(fid); await load(); });

    const replacePlan = (fid, plan) => setRows((rs) => rs.map((r) => (r.festival.id === fid
        ? { ...r, plan, status: plan.status === "approved" ? "words_approved" : "options" } : r)));

    if (!rows) return <p className="empty">Loading…</p>;
    const counts = rows.reduce((m, r) => ({ ...m, [r.status]: (m[r.status] || 0) + 1 }), {});
    const missing = counts.todo || 0;
    const ready = (counts.words_approved || 0) + (counts.poster_made || 0) + (counts.approved || 0);

    return (
        <div className="mp">
            <div className="mp-bar">
                <div className="mp-progress">
                    <strong>{ready}</strong> of <strong>{rows.length}</strong> occasions have approved words
                    {missing > 0 && <> · <strong>{missing}</strong> not planned yet</>}
                </div>
                <div className="actions">
                    <button className="btn primary" onClick={generate} disabled={!!busy || !missing}>
                        <Sparkles size={15} aria-hidden="true" /> {busy === "generate" ? "Planning…" : missing === rows.length ? `Plan ${monthName}` : "Plan missing rows"}
                    </button>
                    <button className="btn" onClick={approveAll} disabled={!!busy || !counts.options}>
                        <Check size={15} aria-hidden="true" /> {busy === "approve-all" ? "Approving…" : "Approve all"}
                    </button>
                </div>
            </div>
            <Notice kind="error">{error}</Notice>
            {message && <Notice kind="success">{message}</Notice>}

            {!rows.length ? <p className="empty">No occasions this month for this client.</p> : (
                <div className="mp-wrap">
                    <table className="mp-table">
                        <thead>
                            <tr><th>Date</th><th>Occasion</th><th>Hook</th><th>Title</th><th>Status</th><th>Notes</th></tr>
                        </thead>
                        <tbody>
                            {rows.map((r) => {
                                const f = r.festival;
                                const plan = r.plan && !LOCKED.includes(r.status) ? r.plan : null;
                                const chosen = r.plan?.chosen || {};
                                const [label, cls] = STATUS[r.status] || STATUS.todo;
                                return (
                                    <tr key={f.id} className={`tone-${f.tone}`}>
                                        <td className="mp-date"><strong>{day(f.date)}</strong><span>{weekday(f.date)}</span></td>
                                        <td className="mp-occ">
                                            <button className="link-btn mr" onClick={() => onOpen(f)}>{f.occasion_mr}</button>
                                            <span className="muted small">{f.occasion_en}</span>
                                        </td>
                                        <td className="mp-cell">
                                            <Cell fid={f.id} part="hook" text={chosen.hook} plan={plan} limit={limits.hook}
                                                open={popup?.fid === f.id && popup.part === "hook"} setPopup={setPopup} onPlan={replacePlan} />
                                        </td>
                                        <td className="mp-cell mp-title">
                                            <Cell fid={f.id} part="title" text={chosen.poster?.line_big} plan={plan} limit={limits.line_big}
                                                open={popup?.fid === f.id && popup.part === "title"} setPopup={setPopup} onPlan={replacePlan} />
                                        </td>
                                        <td className="mp-status">
                                            <span className={`status-chip ${cls}`}>{label}</span>
                                            {r.thumb && <img className="mp-thumb" src={r.thumb} alt="" />}
                                            {r.status === "options" && (
                                                <button className="btn small" onClick={() => approveRow(f.id)} disabled={!!busy}><Check size={14} /> Approve</button>
                                            )}
                                            {r.status === "words_approved" && (
                                                <button className="btn small primary" onClick={() => onOpen(f)}><Sparkles size={14} /> Make poster</button>
                                            )}
                                            {LOCKED.includes(r.status) && r.plan?.draft_id && (
                                                <a className="btn small" href={`/approvals?id=${r.plan.draft_id}`}><ExternalLink size={14} /> Open</a>
                                            )}
                                        </td>
                                        <td className="mp-notes">
                                            {plan ? <Notes fid={f.id} value={chosen.notes || ""} /> : <span className="muted small">{chosen.notes || ""}</span>}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
            <p className="hint">Click a hook or title to pick another option, type your own, or ask the AI for a new one. Notes go to the AI when it writes the caption.</p>
        </div>
    );
}

// a hook or title cell: shows the choice; click opens the options
function Cell({ fid, part, text, plan, limit, open, setPopup, onPlan }) {
    const [own, setOwn] = useState("");
    const [ask, setAsk] = useState("");
    const [busy, setBusy] = useState("");
    const [error, setError] = useState("");
    const [spot, setSpot] = useState(null);
    const anchor = useRef(null);
    const key = part === "hook" ? "hooks" : "titles";
    const list = plan?.options?.[key] || [];
    const picked = plan?.chosen?.picked?.[part];
    const tooLong = limit && (text || "").length > limit;

    useEffect(() => {
        if (!open) return;
        setOwn(text || ""); setAsk(""); setError("");
        const place = () => {
            const r = anchor.current?.getBoundingClientRect();
            if (!r) return;
            const width = Math.min(380, window.innerWidth - 24);
            const below = window.innerHeight - r.bottom;
            setSpot({
                left: Math.max(12, Math.min(r.left - 6, window.innerWidth - width - 12)), width,
                ...(below > 420 || below > r.top ? { top: r.bottom + 6 } : { bottom: window.innerHeight - r.top + 6 })
            });
        };
        place();
        window.addEventListener("resize", place);
        window.addEventListener("scroll", place, true);
        return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    const save = async (value, index) => {
        setBusy("save"); setError("");
        try {
            const body = part === "hook" ? { hook: value, picked_hook: index } : { title: value, picked_title: index };
            onPlan(fid, (await api.pickPlan(fid, body)).plan);
            setPopup(null);
        } catch (e) { setError(e.message); } finally { setBusy(""); }
    };
    const rewrite = async () => {
        setBusy("rewrite"); setError("");
        try {
            const d = await api.rewritePlan(fid, part, ask);
            const options = d.plan.options[key];
            const fresh = options[options.length - 1];
            const body = part === "hook" ? { hook: fresh.text, picked_hook: options.length - 1 } : { title: fresh.text, picked_title: options.length - 1 };
            onPlan(fid, (await api.pickPlan(fid, body)).plan);
            setAsk("");
        } catch (e) { setError(e.message); } finally { setBusy(""); }
    };

    if (!plan) return <span className={`mr mp-text${text ? "" : " empty"}`}>{text || "—"}</span>;
    return (
        <div className="mp-cellwrap">
            <button ref={anchor} className={`mp-text-btn mr${tooLong ? " over" : ""}`} onClick={() => setPopup(open ? null : { fid, part })} title="Click to change">
                {text || "—"}{tooLong && <AlertTriangle size={12} aria-label="Too long" />}
            </button>
            {open && (
                <>
                    <div className="mp-scrim" onMouseDown={() => setPopup(null)} />
                    <div className="mp-pop" role="dialog" aria-label={`${part} options`} style={spot || { visibility: "hidden" }}>
                        <div className="mp-pop-head">
                            <strong>{part === "hook" ? "Hook" : "Poster title"}</strong>
                            <button className="icon-btn" aria-label="Close" onClick={() => setPopup(null)}><X size={15} /></button>
                        </div>
                        <ul className="mp-opts">
                            {list.map((o, i) => (
                                <li key={i}>
                                    <button className={`mp-opt${picked === i ? " on" : ""}`} onClick={() => save(o.text, i)} disabled={!!busy}>
                                        <span className="mp-angle">{o.angle}{o.too_long && <AlertTriangle size={11} aria-label="Too long" />}</span>
                                        <span className="mr">{o.text}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                        <label className="mp-own">
                            <span>Your own {limit ? <em className={(own || "").length > limit ? "over" : ""}>{(own || "").length} / {limit}</em> : null}</span>
                            <textarea className="mr" rows={part === "hook" ? 2 : 1} value={own} onChange={(e) => setOwn(e.target.value)} />
                        </label>
                        <div className="actions end">
                            <button className="btn small primary" onClick={() => save(own.trim(), null)} disabled={!!busy || !own.trim()}>Use this</button>
                        </div>
                        <div className="plan-rewrite">
                            <input value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="What should change? e.g. shorter" aria-label="Instruction" />
                            <button className="btn small" onClick={rewrite} disabled={!!busy}>
                                <RotateCcw size={13} /> {busy === "rewrite" ? "Writing…" : "New option"}
                            </button>
                        </div>
                        <Notice kind="error">{error}</Notice>
                    </div>
                </>
            )}
        </div>
    );
}

// notes save on their own a moment after typing stops
function Notes({ fid, value }) {
    const [text, setText] = useState(value);
    const [state, setState] = useState("");
    const timer = useRef(null);
    useEffect(() => () => clearTimeout(timer.current), []);
    const change = (v) => {
        setText(v); setState("");
        clearTimeout(timer.current);
        timer.current = setTimeout(() => {
            api.pickPlan(fid, { notes: v }).then(() => setState("saved")).catch(() => setState("error"));
        }, 700);
    };
    return (
        <div className="mp-notebox">
            <input value={text} onChange={(e) => change(e.target.value)} placeholder="e.g. no selling" aria-label="Notes" />
            {state === "saved" && <Check size={13} className="mp-saved" aria-label="Saved" />}
            {state === "error" && <AlertTriangle size={13} className="mp-err" aria-label="Not saved" />}
        </div>
    );
}