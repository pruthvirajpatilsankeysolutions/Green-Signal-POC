import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  CalendarDays, CalendarRange, Check, ChevronLeft, ChevronRight, ClipboardList, Clock, ExternalLink, List, Search, Sparkles, Upload, X,
} from "lucide-react";
import { api } from "../api.js";
import { useStatus } from "../App.jsx";
import DateBlock from "../components/DateBlock.jsx";
import FeedPreview from "../components/FeedPreview.jsx";
import CreatedNotice from "../components/CreatedNotice.jsx";
import MonthPlanTable from "../components/MonthPlanTable.jsx";
import Notice from "../components/Notice.jsx";
import PlanPanel from "../components/PlanPanel.jsx";
import Segmented from "../components/Segmented.jsx";

const LAYOUTS = [
  { value: "text_right", label: "Text right" },
  { value: "text_left", label: "Text left" },
  { value: "text_center", label: "Centre (light)" },
  { value: "text_corners", label: "Corners (light)" },
];
const TONE_NAMES = { greeting: "Festival", tribute: "Jayanti", solemn: "Punyatithi" };
const SOURCE_NAMES = { ready: "Ready", uploaded: "Uploaded", ai: "AI" };
const STATUS_NAMES = { approved: "Approved", waiting: "Waiting for approval", todo: "To do" };
const STATUS_SHORT = { approved: "Approved", waiting: "Waiting", todo: "To do" };
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_IN_CELL = 3;

// ---------------------------------------------------------------- date helpers (local time, Monday-first weeks)
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parse = (s) => new Date(`${s}T00:00:00`);
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
const addMonths = (s, n) => { const d = parse(`${s.slice(0, 7)}-01`); d.setMonth(d.getMonth() + n); return ymd(d); };
const weekStart = (s) => { const d = parse(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ymd(d); };
const monthTitle = (s) => parse(`${s.slice(0, 7)}-01`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
const short = (s) => parse(s).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const whenText = (d) => (d === 0 ? "Today" : d === 1 ? "Tomorrow" : d > 0 ? `In ${d} days` : `${-d} days ago`);
const monthGrid = (s) => {
  const start = weekStart(`${s.slice(0, 7)}-01`);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
};

export default function Festivals() {
  const { status, refresh } = useStatus();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [list, setList] = useState([]);
  const [posts, setPosts] = useState({});
  const [hiddenTones, setHiddenTones] = useState([]);
  const [hiddenStatus, setHiddenStatus] = useState([]);
  const [search, setSearch] = useState("");
  const [moreDay, setMoreDay] = useState(null);
  const [hover, setHover] = useState(null);
  const hoverTimer = useRef(null);
  const [error, setError] = useState("");
  const today = ymd(new Date());

  const view = params.get("view") || "month";
  const anchor = params.get("date") || today;
  const openId = params.get("id");
  const go = useCallback((changes) => {
    const next = { view, date: anchor, ...(openId ? { id: openId } : {}), ...changes };
    Object.keys(next).forEach((k) => next[k] == null && delete next[k]);
    setParams(next);
  }, [view, anchor, openId, setParams]);

  // best post per occasion (approved > waiting), with its picture for the cards
  const loadPosts = () => api.drafts().then((d) => {
    const map = {};
    d.drafts.filter((x) => x.type === "festival" && x.details?.festival_id && x.status !== "rejected").forEach((x) => {
      const id = x.details.festival_id;
      if (!map[id] || (x.status === "approved" && map[id].status !== "approved")) {
        map[id] = { status: x.status, thumb: x.image_urls?.[0] || "", draftId: x.id };
      }
    });
    setPosts(map);
  }).catch(() => {});

  useEffect(() => {
    api.festivals().then((d) => {
      setList([...d.festivals].sort((a, b) => a.date.localeCompare(b.date)));
      if (d.errors.length) setError(`festivals.csv: ${d.errors.join("; ")}`);
    }).catch((e) => setError(e.message));
    loadPosts();
  }, []);

  const stateOf = (f) => posts[f.id]?.status || "todo";
  const tones = [...new Set(list.map((f) => f.tone))];
  const q = search.trim().toLowerCase();
  const shown = list.filter((f) => !hiddenTones.includes(f.tone) && !hiddenStatus.includes(stateOf(f))
    && (!q || `${f.occasion_mr} ${f.occasion_en}`.toLowerCase().includes(q)));
  const byDate = useMemo(() => shown.reduce((m, f) => ({ ...m, [f.date]: [...(m[f.date] || []), f] }), {}), [shown]);
  const allByDate = useMemo(() => list.reduce((m, f) => ({ ...m, [f.date]: true }), {}), [list]);

  // period shown + navigation
  const month = anchor.slice(0, 7);
  const wk = weekStart(anchor);
  const period = view === "week"
    ? `${short(wk)} – ${short(addDays(wk, 6))} ${parse(addDays(wk, 6)).getFullYear()}`
    : monthTitle(anchor);
  const step = (n) => go({ date: view === "week" ? addDays(anchor, 7 * n) : addMonths(anchor, n) });

  useEffect(() => {
    const onKey = (e) => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName) || openId) return;
      if (e.key === "ArrowLeft") step(-1);
      if (e.key === "ArrowRight") step(1);
      if (e.key.toLowerCase() === "t") go({ date: today });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // month progress
  const inMonth = shown.filter((f) => f.date.startsWith(month));
  const done = inMonth.filter((f) => stateOf(f) === "approved").length;
  const waiting = inMonth.filter((f) => stateOf(f) === "waiting").length;
  const dueNow = list.filter((f) => f.due && stateOf(f) === "todo");

  const fest = list.find((f) => f.id === openId);
  const toggle = (setter) => (v) => setter((h) => (h.includes(v) ? h.filter((x) => x !== v) : [...h, v]));

  // close the hover card when the view or date changes, or the page scrolls
  useEffect(() => { setHover(null); }, [view, anchor, openId]);
  useEffect(() => {
    const close = () => setHover(null);
    window.addEventListener("scroll", close, true);
    return () => window.removeEventListener("scroll", close, true);
  }, []);

  // hover card (stays open while the mouse is over it)
  const showHover = (f, el) => { clearTimeout(hoverTimer.current); setHover({ f, rect: el.getBoundingClientRect() }); };
  const hideHover = () => { hoverTimer.current = setTimeout(() => setHover(null), 160); };

  const Chip = ({ f, big = false }) => {
    const st = stateOf(f);
    const post = posts[f.id];
    return (
      <button className={`cx-event tone-${f.tone} st-${st}${f.due && st === "todo" ? " due" : ""}${big ? " big" : ""}`}
              onClick={() => { setHover(null); go({ id: f.id }); }}
              onMouseEnter={(e) => showHover(f, e.currentTarget)} onMouseLeave={hideHover}>
        {big && (post?.thumb ? <img className="cx-thumb" src={post.thumb} alt="" /> : <span className="cx-thumb empty"><Sparkles size={16} /></span>)}
        <span className="cx-event-text">
          <span className="mr ellipsis cx-event-name">{f.occasion_mr}</span>
          {big && <span className="ellipsis cx-event-sub">{f.occasion_en}</span>}
        </span>
        {st === "approved" && <Check size={13} aria-label="Approved" />}
        {st === "waiting" && <Clock size={13} aria-label="Waiting for approval" />}
        {big && <span className={`status-chip st-${st}`}>{f.due && st === "todo" ? "Due now" : STATUS_SHORT[st]}</span>}
      </button>
    );
  };

  return (
    <div className="page cx-page">
      <header className="page-head row">
        <div>
          <h1>Content calendar</h1>
          <p className="lead">Every festival, jayanti and punyatithi for this client. Click an occasion to make its post.</p>
        </div>
      </header>
      <Notice kind="error">{error}</Notice>

      <div className="cx">
        {/* ---------------- left side panel ---------------- */}
        <aside className="cx-side">
          <MiniMonth anchor={anchor} today={today} marked={allByDate} onPick={(d) => go({ date: d })} />

          <div className="cx-box">
            <div className="cx-box-title">Due now <span className="cx-count">{dueNow.length}</span></div>
            {dueNow.length ? (
              <ul className="cx-due">
                {dueNow.map((f) => (
                  <li key={f.id}>
                    <button onClick={() => go({ id: f.id, date: f.date })}>
                      <span className={`cx-dot tone-${f.tone}`} />
                      <span className="mr ellipsis">{f.occasion_mr}</span>
                      <span className="cx-when">{whenText(f.days_left)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : <p className="cx-empty">Nothing due. You're up to date.</p>}
          </div>

          <div className="cx-box">
            <div className="cx-box-title">Show</div>
            {tones.map((t) => (
              <label key={t} className="cx-check">
                <input type="checkbox" checked={!hiddenTones.includes(t)} onChange={() => toggle(setHiddenTones)(t)} />
                <span className={`cx-dot tone-${t}`} />{TONE_NAMES[t]}
              </label>
            ))}
            <div className="cx-sep" />
            {["todo", "waiting", "approved"].map((st) => (
              <label key={st} className="cx-check">
                <input type="checkbox" checked={!hiddenStatus.includes(st)} onChange={() => toggle(setHiddenStatus)(st)} />
                <span className={`cx-status st-${st}`} />{STATUS_SHORT[st]}
              </label>
            ))}
          </div>
        </aside>

        {/* ---------------- main area ---------------- */}
        <section className="cx-main">
          <div className="cx-toolbar">
            <div className="cx-nav">
              <button className="btn small" onClick={() => go({ date: today })} title="Today (T)">Today</button>
              <button className="icon-tool" aria-label="Previous" title="Previous (←)" onClick={() => step(-1)}><ChevronLeft size={18} /></button>
              <button className="icon-tool" aria-label="Next" title="Next (→)" onClick={() => step(1)}><ChevronRight size={18} /></button>
              <h2 className="cx-title">{period}</h2>
            </div>
            <div className="cx-tools">
              <label className="cx-search">
                <Search size={15} aria-hidden="true" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search occasions" aria-label="Search occasions" />
              </label>
              <div className="seg" role="tablist" aria-label="View">
                {[["month", CalendarDays, "Month"], ["week", CalendarRange, "Week"], ["list", List, "List"], ["plan", ClipboardList, "Plan"]].map(([v, Icon, label]) => (
                  <button key={v} role="tab" aria-selected={view === v} className={view === v ? "on" : ""} onClick={() => go({ view: v })}>
                    <Icon size={16} aria-hidden="true" /> {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {(view === "month" || view === "week") && (
            <div className="cx-progress" title={`${done} approved, ${waiting} waiting, ${inMonth.length - done - waiting} to do`}>
              <span><strong>{done}</strong> of <strong>{inMonth.length}</strong> posts approved in {monthTitle(anchor).split(" ")[0]}</span>
              <span className="cx-bar">
                <span className="cx-bar-done" style={{ width: `${inMonth.length ? (done / inMonth.length) * 100 : 0}%` }} />
                <span className="cx-bar-wait" style={{ width: `${inMonth.length ? (waiting / inMonth.length) * 100 : 0}%` }} />
              </span>
              <span className="cx-legend"><i className="st-approved" />Approved <i className="st-waiting" />Waiting <i className="st-todo" />To do</span>
            </div>
          )}

          {view === "month" && (
            <div className="cx-grid" role="grid" aria-label={period}>
              {WEEKDAYS.map((w) => <div key={w} className="cx-weekday" role="columnheader">{w}</div>)}
              {monthGrid(anchor).map((d) => {
                const items = byDate[d] || [];
                const outside = d.slice(0, 7) !== month;
                const sunday = parse(d).getDay() === 0;
                return (
                  <div key={d} role="gridcell" className={`cx-day${outside ? " outside" : ""}${d === today ? " today" : ""}${d < today ? " past" : ""}${sunday ? " sunday" : ""}`}>
                    <span className="cx-date">{parse(d).getDate()}</span>
                    {items.slice(0, MAX_IN_CELL).map((f) => <Chip key={f.id} f={f} />)}
                    {items.length > MAX_IN_CELL && (
                      <button className="cx-more" onClick={() => setMoreDay(d)}>+{items.length - MAX_IN_CELL} more</button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {view === "week" && (
            <div className="cx-week">
              {Array.from({ length: 7 }, (_, i) => addDays(wk, i)).map((d, i) => {
                const items = byDate[d] || [];
                return (
                  <div key={d} className={`cx-wcol${d === today ? " today" : ""}${d < today ? " past" : ""}`}>
                    <div className="cx-whead">
                      <span className="cx-wday">{WEEKDAYS[i]}</span>
                      <span className={`cx-wdate${i === 6 ? " sunday" : ""}`}>{parse(d).getDate()}</span>
                    </div>
                    <div className="cx-wbody">
                      {items.map((f) => <Chip key={f.id} f={f} big />)}
                      {!items.length && <span className="cx-wempty">No occasions</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {view === "plan" && (
            <MonthPlanTable month={month} monthName={monthTitle(anchor).split(" ")[0]} reloadKey={openId}
                            onOpen={(f) => go({ id: f.id, date: f.date })} />
          )}

          {view === "list" && <Agenda items={shown} stateOf={stateOf} posts={posts} openId={openId} onOpen={(f) => go({ id: f.id, date: f.date })} />}
        </section>
      </div>

      {/* ---------------- "+N more" day list ---------------- */}
      {moreDay && (
        <div className="cx-modal-wrap" onMouseDown={(e) => { if (e.target === e.currentTarget) setMoreDay(null); }}>
          <div className="cx-modal" role="dialog" aria-label={moreDay}>
            <div className="cx-modal-head">
              <strong>{parse(moreDay).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</strong>
              <button className="icon-tool" aria-label="Close" onClick={() => setMoreDay(null)}><X size={16} /></button>
            </div>
            {(byDate[moreDay] || []).map((f) => <Chip key={f.id} f={f} big />)}
          </div>
        </div>
      )}

      {/* ---------------- hover card ---------------- */}
      {hover && !openId && (
        <div className="cx-hover" style={{ top: Math.min(hover.rect.bottom + 6, window.innerHeight - 230), left: Math.min(hover.rect.left, window.innerWidth - 300) }}
             onMouseEnter={() => clearTimeout(hoverTimer.current)} onMouseLeave={hideHover}>
          <div className="cx-hover-top">
            {posts[hover.f.id]?.thumb && <img src={posts[hover.f.id].thumb} alt="" />}
            <div>
              <div className="mr strong">{hover.f.occasion_mr}</div>
              <div className="muted small">{hover.f.occasion_en}</div>
              <div className="cx-hover-meta">
                <span className={`cx-dot tone-${hover.f.tone}`} />{TONE_NAMES[hover.f.tone]} · {short(hover.f.date)} · {whenText(hover.f.days_left)}
              </div>
              <span className={`status-chip st-${stateOf(hover.f)}`}>{STATUS_NAMES[stateOf(hover.f)]}</span>
            </div>
          </div>
          <div className="cx-hover-actions">
            <button className="btn small primary" onClick={() => { setHover(null); go({ id: hover.f.id }); }}>
              <Sparkles size={14} /> {posts[hover.f.id] ? "Make another post" : "Make post"}
            </button>
            {posts[hover.f.id] && (
              <button className="btn small" onClick={() => navigate(`/approvals?id=${posts[hover.f.id].draftId}`)}>
                <ExternalLink size={14} /> Open post
              </button>
            )}
          </div>
        </div>
      )}

      {/* ---------------- make-post drawer ---------------- */}
      {fest && (
        <div className="drawer-wrap" onMouseDown={(e) => { if (e.target === e.currentTarget) go({ id: null }); }}>
          <aside className="drawer" aria-label={fest.occasion_en}>
            <div className="drawer-head">
              <DateBlock date={fest.date} />
              <div className="drawer-title">
                <h2 className="mr">{fest.occasion_mr}</h2>
                <span className="muted">{fest.occasion_en} · {TONE_NAMES[fest.tone]} · {whenText(fest.days_left)}</span>
                <span className={`status-chip st-${stateOf(fest)}`}>{STATUS_NAMES[stateOf(fest)]}</span>
              </div>
              <button className="icon-tool" aria-label="Close" onClick={() => go({ id: null })}><X size={18} /></button>
            </div>
            {fest.notes && <Notice kind="warning">{fest.notes}</Notice>}
            <FestivalEditor key={fest.id} fest={fest} imageAi={status?.image_ai} onCreated={() => { refresh(); loadPosts(); }} />
          </aside>
        </div>
      )}
    </div>
  );
}

function MiniMonth({ anchor, today, marked, onPick }) {
  const [shownMonth, setShownMonth] = useState(anchor.slice(0, 7));
  useEffect(() => { setShownMonth(anchor.slice(0, 7)); }, [anchor]);
  const first = `${shownMonth}-01`;
  return (
    <div className="cx-box cx-mini">
      <div className="cx-mini-head">
        <button className="icon-btn" aria-label="Previous month" onClick={() => setShownMonth(addMonths(first, -1).slice(0, 7))}><ChevronLeft size={15} /></button>
        <strong>{monthTitle(first)}</strong>
        <button className="icon-btn" aria-label="Next month" onClick={() => setShownMonth(addMonths(first, 1).slice(0, 7))}><ChevronRight size={15} /></button>
      </div>
      <div className="cx-mini-grid">
        {WEEKDAYS.map((w) => <span key={w} className="cx-mini-wd">{w[0]}</span>)}
        {monthGrid(first).map((d) => (
          <button key={d} onClick={() => onPick(d)}
                  className={`cx-mini-day${d.slice(0, 7) !== shownMonth ? " outside" : ""}${d === today ? " today" : ""}${d === anchor ? " on" : ""}`}>
            {parse(d).getDate()}{marked[d] && <i />}
          </button>
        ))}
      </div>
    </div>
  );
}

function Agenda({ items, stateOf, posts, openId, onOpen }) {
  const today = ymd(new Date());
  const upcoming = items.filter((f) => f.date >= today);
  const past = items.filter((f) => f.date < today).reverse();
  const groups = upcoming.reduce((m, f) => ({ ...m, [f.date.slice(0, 7)]: [...(m[f.date.slice(0, 7)] || []), f] }), {});
  const Row = (f) => (
    <li key={f.id}>
      <button className={`agenda-row${f.id === openId ? " on" : ""}`} onClick={() => onOpen(f)}>
        <DateBlock date={f.date} />
        <span className="agenda-main">
          <span className="mr strong">{f.occasion_mr}</span>
          <span className="muted">{f.occasion_en}</span>
        </span>
        <span className={`cal-filter tone-${f.tone} static`}><span className="dot" />{TONE_NAMES[f.tone]}</span>
        <span className="agenda-when">{whenText(f.days_left)}</span>
        {posts[f.id]?.thumb ? <img className="agenda-thumb" src={posts[f.id].thumb} alt="" /> : <span className="agenda-thumb empty" />}
        <span className={`status-chip st-${stateOf(f)}`}>{f.due && stateOf(f) === "todo" ? "Due now" : STATUS_SHORT[stateOf(f)]}</span>
      </button>
    </li>
  );
  return (
    <div className="agenda">
      {Object.entries(groups).map(([key, rows]) => (
        <section key={key}>
          <h3 className="agenda-month">{monthTitle(`${key}-01`)}</h3>
          <ul className="agenda-list">{rows.map(Row)}</ul>
        </section>
      ))}
      {!upcoming.length && <p className="empty">No upcoming occasions match. Add them to data/festivals.csv, or clear the search and filters.</p>}
      {past.length > 0 && (
        <details className="agenda-past">
          <summary>Past occasions ({past.length})</summary>
          <ul className="agenda-list">{past.map(Row)}</ul>
        </details>
      )}
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
  const [plan, setPlan] = useState(null);
  const [planKey, setPlanKey] = useState(0);
  const upload = useRef(null);

  const loadBackgrounds = () => api.backgrounds(fest.id).then((d) => setBackgrounds(d.backgrounds)).catch((e) => setError(e.message));
  useEffect(() => { loadBackgrounds(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const choose = (bg) => { setChosen(bg); setAiLabel(bg.source === "ai"); };
  // the poster uses the planned words when there is a plan, otherwise the calendar's standard text
  const words = plan?.chosen?.poster || fest;
  const posterLines = [words.line_small, words.line_big, words.line_end].map((t) => (t || "").replaceAll("|", " "));

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
    const d = await api.createFestivalPost(fest.id, { background: chosen.path, layout, ai_generated: aiLabel, use_plan: true });
    setDraft(d);
    setPlanKey((k) => k + 1);                       // the plan was used; the next post starts fresh
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

      <div className="step-title"><span>1</span> Words</div>
      <PlanPanel key={planKey} fest={fest} onPlan={setPlan} />

      <div className="step-title"><span>2</span> Picture and layout</div>
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

      <div className="step-title"><span>3</span> Create</div>
      {plan && plan.status !== "approved" && <p className="hint">The words aren't approved yet. You can still create the poster with the current picks.</p>}
      <Notice kind="error">{error}</Notice>
      <div className="actions end">
        <button className="btn primary" onClick={onCreate} disabled={!chosen || !!busy}>
          {busy === "create" ? "Making the poster…" : "Create poster"}
        </button>
      </div>

      {draft && (
        <div className="result">
          <CreatedNotice draft={draft} label="Poster" />
          <FeedPreview draft={draft} />
          {draft.warnings.map((w) => <Notice key={w} kind="warning">{w}</Notice>)}
        </div>
      )}
    </section>
  );
}