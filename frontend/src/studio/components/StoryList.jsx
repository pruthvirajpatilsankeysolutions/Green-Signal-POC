import { useState } from "react";
import { AlertCircle, ArrowUpDown, CheckCircle2, ChevronDown, ChevronLeft, Clapperboard, HelpCircle, Layers, LogOut, Plus, Search, Settings, ShieldCheck, ShieldOff, UserCheck } from "../icons.jsx";
import { useStudio } from "../useStudio.jsx";
import { STATE, rowState } from "../data.js";
import { Pop, Spinner } from "./ui.jsx";

const FILTERS = [["all", Layers, "All stories"], ["your", UserCheck, "Your turn"], ["bad", AlertCircle, "Needs attention"], ["ok", CheckCircle2, "Validated"], ["screen", Clapperboard, "Screenplays"]];
const SORTS = [["recent", "Recent"], ["title", "Title"], ["progress", "Progress"]];

// The stories pane: search, what needs you, and the list.
export default function StoryList({ protectedSite, onSignOut, onExit }) {
  const { stories, visible, selectedId, open, filter, setFilter, q, setQ, sort, setSort, searchRef, setNewOpen, setHelpOpen, loadError } = useStudio();
  const [tools, setTools] = useState(null);
  const [openStatus, setOpenStatus] = useState(true);
  const [menu, setMenu] = useState(null);
  const count = (k) => (stories || []).filter((s) => (k === "all" ? true : k === "screen" ? s.has_screenplay : s.state === k)).length;
  return (
    <section className="list" aria-label="Stories">
      <div className="lh">
        <button className="back-pc" onClick={onExit} aria-label="Back to Postcraft" title="Back to Postcraft"><ChevronLeft /></button>
        <h2>Stories</h2>
        <span className="lh-acts">
          <button className="ib" title="How Story Studio works" aria-label="Help" onClick={() => setHelpOpen(true)}><HelpCircle /></button>
          <button className="ib" title="Settings" aria-label="Settings" onClick={(e) => { e.stopPropagation(); setTools(e.currentTarget.getBoundingClientRect()); }}><Settings /></button>
          <button className="add" aria-label="New story" title="New story" onClick={() => setNewOpen(true)}><Plus /></button>
        </span>
      </div>
      {tools && <Pop anchor={tools} onClose={() => setTools(null)} width={250} items={[
        { label: protectedSite ? "Protected by an access key" : "Open: no access key is set", icon: protectedSite ? <ShieldCheck size={16} /> : <ShieldOff size={16} />, onClick: () => {} },
        ...(protectedSite ? [{ label: "Sign out", icon: <LogOut size={16} />, onClick: onSignOut }] : []),
      ]} />}
      <label className="lsearch"><Search /><span className="sr">Search stories</span><input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search stories…" autoComplete="off" /></label>
      <button className="gl" aria-expanded={openStatus} onClick={() => setOpenStatus(!openStatus)}><ChevronDown />Status</button>
      <div className="status" hidden={!openStatus}>
        {FILTERS.map(([k, Icon, label]) => (
          <button key={k} className={`it${filter === k ? " on" : ""}`} onClick={() => setFilter(k)}><span className="l"><Icon />{label}</span><span className="cnt">{count(k)}</span></button>
        ))}
      </div>
      <div className="lt"><span>Stories</span>
        <button className="sortb" aria-haspopup="menu" onClick={(e) => { e.stopPropagation(); setMenu(e.currentTarget.getBoundingClientRect()); }}><span>{SORTS.find((x) => x[0] === sort)[1]}</span><ArrowUpDown /></button>
      </div>
      {menu && <Pop anchor={menu} onClose={() => setMenu(null)} width={170} items={SORTS.map(([k, l]) => ({ label: l, icon: sort === k ? <CheckCircle2 size={16} /> : null, onClick: () => setSort(k) }))} />}
      <div className="sl">
        {loadError && <p className="empty">{loadError}</p>}
        {stories === null && !loadError && <p className="empty">Loading…</p>}
        {stories && !visible.length && <p className="empty">{stories.length ? "No stories match. Try another word or filter." : "No stories yet. Press + to start one."}</p>}
        {visible.map((s) => {
          const st = rowState(s);
          return (
            <button key={s.id} className={`row${s.id === selectedId ? " on" : ""}`} onClick={() => open(s.id)} aria-current={s.id === selectedId ? "true" : undefined}>
              <span className="tx"><b className="mr">{s.title}</b>
                <small>{s.content_type} · <span className={`st ${STATE[st][1]}`}>{st === "ok" ? `Validated ${s.score ?? ""}`.trim() : STATE[st][0]}</span></small></span>
              {s.working && <Spinner />}
            </button>
          );
        })}
      </div>
    </section>
  );
}
