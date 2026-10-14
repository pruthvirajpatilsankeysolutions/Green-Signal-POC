import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Copy, Plus, RotateCcw, Sparkles, X } from "lucide-react";
import { api } from "../api.js";
import Notice from "./Notice.jsx";

const PART_KEYS = { hook: "hooks", poster: "posters", caption: "captions", hashtags: "hashtags" };
const POSTER_FIELDS = [
    ["line_small", "Small line above the title"],
    ["line_big", "Title"],
    ["line_end", "Wishes line"],
];
const lettersOf = (t) => (t || "").replaceAll("|", "").length;
const asTag = (t) => "#" + t.trim().replace(/^#+/, "").replace(/\s+/g, "_");

// Step 1 of making a festival post: AI writes several versions of the words;
// the team picks the hook, poster text, caption and hashtags (from any version), edits and approves them.
export default function PlanPanel({ fest, onPlan }) {
    const [plan, setPlan] = useState(null);
    const [chosen, setChosen] = useState(null);
    const [limits, setLimits] = useState({});
    const [angles, setAngles] = useState([]);
    const [busy, setBusy] = useState("");
    const [error, setError] = useState("");
    const [asks, setAsks] = useState({ hook: "", poster: "", caption: "", hashtags: "" });
    const [fixedTags, setFixedTags] = useState([]);
    const [maxTags, setMaxTags] = useState(15);
    const [newTag, setNewTag] = useState("");
    const [copied, setCopied] = useState(false);
    const saveTimer = useRef(null);

    const show = (p) => { setPlan(p); setChosen(p?.chosen || null); onPlan(p); };

    useEffect(() => {
        api.plan(fest.id).then((d) => {
            show(d.plan); setLimits(d.limits); setAngles(d.angles);
            setFixedTags(d.fixed_hashtags || []); setMaxTags(d.max_hashtags || 15);
        }).catch((e) => setError(e.message));
        return () => clearTimeout(saveTimer.current);
    }, [fest.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const act = async (label, fn) => {
        setBusy(label); setError("");
        try { await fn(); } catch (e) { setError(e.message); } finally { setBusy(""); }
    };

    // edits save on their own a moment after typing stops
    const change = (next) => {
        setChosen(next);
        onPlan({ ...plan, chosen: next, status: "options" });
        clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
            api.savePlan(fest.id, next).then((d) => setPlan(d.plan)).catch((e) => setError(e.message));
        }, 700);
    };

    const listFor = (part) => {
        // a month plan has title options only: show them as poster options (small line and wishes stay as chosen)
        if (part === "poster" && !plan.options.posters && plan.options.titles) {
            return plan.options.titles.map((t) => ({
                angle: t.angle, line_small: chosen.poster.line_small, line_big: t.text,
                line_end: chosen.poster.line_end, too_long: t.too_long ? ["line_big"] : []
            }));
        }
        if (part === "hashtags" && !plan.options.hashtags) {
            return (plan.options.captions || []).map((c) => ({ angle: c.angle, tags: c.hashtags || [] }));
        }
        return plan.options[PART_KEYS[part]] || [];
    };

    const pick = (part, i) => {
        const o = listFor(part)[i];
        const picked = { ...(chosen.picked || {}), [part]: i };
        if (part === "hook") change({ ...chosen, hook: o.text, picked });
        if (part === "poster") change({ ...chosen, poster: { line_small: o.line_small, line_big: o.line_big, line_end: o.line_end }, picked });
        if (part === "caption") change({ ...chosen, caption: o.text, picked });
        if (part === "hashtags") change({ ...chosen, hashtags: o.tags, picked });
    };

    // single hashtags: tick / untick, or add your own
    const toggleTag = (tag) => {
        const tags = chosen.hashtags || [];
        const has = tags.some((t) => t.toLowerCase() === tag.toLowerCase());
        change({ ...chosen, hashtags: has ? tags.filter((t) => t.toLowerCase() !== tag.toLowerCase()) : [...tags, tag] });
    };
    const addTags = () => {
        const fresh = newTag.split(/[\s,]+/).filter(Boolean).map(asTag).filter((t) => t.length > 1);
        const tags = [...(chosen.hashtags || [])];
        fresh.forEach((t) => { if (!tags.some((x) => x.toLowerCase() === t.toLowerCase())) tags.push(t); });
        setNewTag(""); change({ ...chosen, hashtags: tags });
    };

    const rewrite = (part) => act(`rewrite-${part}`, async () => {
        const d = await api.rewritePlan(fest.id, part, asks[part]);
        setPlan(d.plan);
        const list = d.plan.options[PART_KEYS[part]];
        const o = list[list.length - 1];                      // the new option is picked straight away
        const picked = { ...(chosen.picked || {}), [part]: list.length - 1 };
        const next = part === "hook" ? { ...chosen, hook: o.text, picked }
            : part === "poster" ? { ...chosen, poster: { line_small: o.line_small, line_big: o.line_big, line_end: o.line_end }, picked }
                : part === "caption" ? { ...chosen, caption: o.text, picked }
                    : { ...chosen, hashtags: o.tags, picked };
        setAsks({ ...asks, [part]: "" });
        change(next);
    });

    const approve = () => act("approve", async () => {
        clearTimeout(saveTimer.current);
        await api.savePlan(fest.id, chosen);
        show((await api.approvePlan(fest.id)).plan);
    });

    const generate = () => act("generate", async () => show((await api.generatePlan(fest.id)).plan));
    const writeCaptions = () => act("captions", async () => {
        clearTimeout(saveTimer.current);
        await api.savePlan(fest.id, chosen);
        show((await api.planCaptions(fest.id)).plan);
    });

    if (!plan) {
        return (
            <div className="plan plan-empty">
                <div>
                    <div className="plan-title"><Sparkles size={16} aria-hidden="true" /> Words for this post</div>
                    <p className="hint">The AI writes {angles.length || 4} versions ({angles.join(", ")}). You pick the hook, poster text, caption and hashtags you like, from any version.</p>
                    <p className="hint">Or skip this: the standard text below is used, and the AI writes the caption.</p>
                </div>
                <Notice kind="error">{error}</Notice>
                <button className="btn primary" onClick={generate} disabled={!!busy}>
                    <Sparkles size={16} aria-hidden="true" /> {busy === "generate" ? "Writing options…" : "Write options with AI"}
                </button>
            </div>
        );
    }

    const picked = { ...(chosen?.picked || {}), poster: chosen?.picked?.poster ?? chosen?.picked?.title };
    const noCaptions = !(plan.options.captions || []).length;
    const picture = plan.options.pictures?.[picked.poster]?.text || plan.options.pictures?.[0]?.text || "";
    const options = (part) => (
        <div className="plan-options" role="radiogroup" aria-label={`${part} options`}>
            {listFor(part).map((o, i) => {
                const warn = part === "hook" ? o.too_long : part === "poster" ? (o.too_long || []).length > 0 : false;
                return (
                    <button key={i} role="radio" aria-checked={picked[part] === i} className={`plan-opt${picked[part] === i ? " on" : ""}`} onClick={() => pick(part, i)}
                        title={part === "poster" ? `${o.line_small} / ${o.line_big} / ${o.line_end}` : part === "hashtags" ? (o.tags || []).join(" ") : o.text}>
                        {o.angle}{warn && <AlertTriangle size={12} aria-label="Too long" />}
                    </button>
                );
            })}
        </div>
    );
    const rewriteBox = (part) => (
        <div className="plan-rewrite">
            <input value={asks[part]} onChange={(e) => setAsks({ ...asks, [part]: e.target.value })}
                placeholder="Optional: what should change? e.g. shorter, mention farmers" aria-label={`Instruction for a new ${part}`} />
            <button className="btn small" onClick={() => rewrite(part)} disabled={!!busy}>
                <RotateCcw size={14} aria-hidden="true" /> {busy === `rewrite-${part}` ? "Writing…" : "New option"}
            </button>
        </div>
    );

    return (
        <div className="plan">
            <div className="plan-head">
                <div className="plan-title"><Sparkles size={16} aria-hidden="true" /> Words for this post</div>
                <span className={`status-chip ${plan.status === "approved" ? "st-approved" : "st-waiting"}`}>
                    {plan.status === "approved" ? "Words approved" : "Picking words"}
                </span>
            </div>

            <section className="plan-part">
                <div className="plan-part-head"><strong>Hook</strong><span className="hint">the first line of the caption</span></div>
                {options("hook")}
                <textarea className="mr" rows={2} value={chosen.hook} onChange={(e) => change({ ...chosen, hook: e.target.value })} />
                <span className={`plan-count${lettersOf(chosen.hook) > limits.hook ? " over" : ""}`}>{lettersOf(chosen.hook)} / {limits.hook}</span>
                {rewriteBox("hook")}
            </section>

            <section className="plan-part">
                <div className="plan-part-head"><strong>Poster text</strong><span className="hint">printed on the image · use | for a new line</span></div>
                {options("poster")}
                {POSTER_FIELDS.map(([key, label]) => (
                    <label key={key} className="plan-line">
                        <span>{label}</span>
                        <input className={`mr${key === "line_big" ? " big" : ""}`} value={chosen.poster[key]}
                            onChange={(e) => change({ ...chosen, poster: { ...chosen.poster, [key]: e.target.value } })} />
                        <span className={`plan-count${lettersOf(chosen.poster[key]) > limits[key] ? " over" : ""}`}>{lettersOf(chosen.poster[key])} / {limits[key]}</span>
                    </label>
                ))}
                {rewriteBox("poster")}
                {picture && (
                    <div className="plan-picture">
                        <span><strong>Picture idea:</strong> {picture}</span>
                        <button className="icon-btn" title="Copy for Gemini" aria-label="Copy picture idea"
                            onClick={() => { navigator.clipboard.writeText(`${picture} Square 1:1, no text, no letters.`); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
                            {copied ? <Check size={15} /> : <Copy size={15} />}
                        </button>
                    </div>
                )}
            </section>

            <label className="plan-notes">
                <span>Notes for the AI</span>
                <input value={chosen.notes || ""} onChange={(e) => change({ ...chosen, notes: e.target.value })} placeholder="e.g. no selling, solemn tone" />
            </label>

            <section className="plan-part">
                <div className="plan-part-head"><strong>Caption</strong><span className="hint">after the hook</span></div>
                {noCaptions ? (
                    <div className="plan-nocap">
                        <span className="hint">Planned in the month table (hook and title only). Write caption options that follow them, or leave it: the AI writes the caption when the poster is made.</span>
                        <button className="btn small" onClick={writeCaptions} disabled={!!busy}>
                            <Sparkles size={14} aria-hidden="true" /> {busy === "captions" ? "Writing…" : "Write caption options"}
                        </button>
                    </div>
                ) : (
                    <>
                        {options("caption")}
                        <textarea className="mr" rows={5} value={chosen.caption} onChange={(e) => change({ ...chosen, caption: e.target.value })} />
                        {rewriteBox("caption")}
                    </>
                )}
            </section>

            <section className="plan-part">
                <div className="plan-part-head"><strong>Hashtags</strong><span className="hint">pick a set, then tick or untick single ones</span></div>
                {options("hashtags")}
                <div className="tag-pool" aria-label="Suggested hashtags">
                    {[...new Set([...listFor("hashtags").flatMap((o) => o.tags || []), ...(chosen.hashtags || [])])].map((tag) => {
                        const on = (chosen.hashtags || []).some((t) => t.toLowerCase() === tag.toLowerCase());
                        return (
                            <button key={tag} className={`tag-chip${on ? " on" : ""}`} aria-pressed={on} onClick={() => toggleTag(tag)}>
                                <span className="mr">{tag}</span>{on ? <X size={12} aria-hidden="true" /> : <Plus size={12} aria-hidden="true" />}
                            </button>
                        );
                    })}
                </div>
                <div className="plan-rewrite">
                    <input value={newTag} onChange={(e) => setNewTag(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTags(); } }}
                        placeholder="Add your own, e.g. #ठाणे #Thane" aria-label="Add hashtags" className="mr" />
                    <button className="btn small" onClick={addTags} disabled={!newTag.trim()}><Plus size={14} aria-hidden="true" /> Add</button>
                </div>
                <div className="tag-foot">
                    <span className={`plan-count${(chosen.hashtags || []).length > maxTags ? " over" : ""}`}>
                        {(chosen.hashtags || []).length} chosen · up to {maxTags} works best
                    </span>
                    {fixedTags.length > 0 && <span className="hint mr">Always added: {fixedTags.join(" ")}</span>}
                </div>
                {rewriteBox("hashtags")}
            </section>

            <Notice kind="error">{error}</Notice>
            <div className="actions end">
                <button className="btn" onClick={generate} disabled={!!busy}>
                    <Sparkles size={15} aria-hidden="true" /> {busy === "generate" ? "Writing…" : "Write all options again"}
                </button>
                <button className="btn primary" onClick={approve} disabled={!!busy || plan.status === "approved" || !chosen.poster.line_big.trim()}>
                    <Check size={15} aria-hidden="true" /> {plan.status === "approved" ? "Approved" : busy === "approve" ? "Approving…" : "Approve words"}
                </button>
            </div>
        </div>
    );
}