import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, BookMarked, CheckCircle2, ChevronLeft, Clock, Copy, Download, Feather, FileText, Languages, ListChecks, MoreHorizontal, Pencil, ShieldCheck, Trash2, BookOpen, Clapperboard } from "../icons.jsx";
import { useStudio } from "../useStudio.jsx";
import { SP, STATE, lengthText, rel, stageNote } from "../data.js";
import Pipeline from "./Pipeline.jsx";
import { Pop, Spinner } from "./ui.jsx";

const CHECK_NAMES = { length: "Length", language: "Language", cast: "Characters", repetition: "Repetition", title: "Title" };

// The middle: which story, how far along it is, what is approved so far, and what the checks say.
export default function Overview() {
  const nav = useNavigate();
  const { story: v, stories, act, busy, saveProject, remove, flash, setNewOpen, options } = useStudio();
  const [menu, setMenu] = useState(null);
  const [allFacts, setAllFacts] = useState(false);
  const rootRef = useRef(null);
  if (!stories) return <div className="center"><p className="loading">Loading…</p></div>;
  if (!stories.length) {
    return (
      <div className="center"><div className="blank">
        <Feather size={34} /><strong>No stories yet</strong>
        <p>Start with an idea. Story Studio turns it into a concept, characters, an ending, an outline and a full story, one stage at a time, and checks each stage against what you approved.</p>
        <button className="btn k" onClick={() => setNewOpen(true)}>New story</button>
      </div></div>
    );
  }
  if (!v) return <div className="center"><p className="loading">Loading…</p></div>;

  const running = v.job?.status === "running";
  const [label, cls] = running ? STATE.working : STATE[v.state];
  const approved = v.stages.filter((s) => s.status === "approved" && s.key !== "story");
  const facts = approved.flatMap((s) => s.facts);
  const planning = !v.words;
  const focus = v.stages.find((s) => s.key === v.focus);
  const sp = v.screenplay;
  const goRight = () => { const b = rootRef.current?.getRootNode().getElementById?.("primary-action"); b?.scrollIntoView({ block: "nearest", behavior: "smooth" }); b?.focus(); };

  let nextText, nextLabel, nextGo;
  if (running) { nextText = <><b>Working…</b> {v.job.message}</>; nextLabel = null; }
  else if (v.state === "ok" && sp.fountain) { nextText = <>The screenplay has <b>{sp.written} scenes</b></>; nextLabel = "Open screenplay"; nextGo = () => nav(`${SP}/story/${v.id}/screenplay`); }
  else if (v.state === "ok") { nextText = <>Next: write the <b>screenplay</b> (optional)</>; nextLabel = "Write screenplay"; nextGo = () => act("screenplay", (a) => a.writeScreenplay(v.id)).then(() => nav(`${SP}/story/${v.id}/screenplay`)); }
  else if (v.state === "bad") { nextText = <>Next: <b>fix the problems</b> the validator found</>; nextLabel = "Open the story"; nextGo = () => nav(`${SP}/story/${v.id}/read`); }
  else if (v.words) { nextText = <>Next: <b>validate</b> the story</>; nextLabel = "Open the story"; nextGo = () => nav(`${SP}/story/${v.id}/read`); }
  else if (v.focus === "story") { nextText = <>Next: write the <b>story</b></>; nextLabel = "Continue writing"; nextGo = goRight; }
  else if (focus.status === "draft") { nextText = <>Next: review the <b>{focus.title}</b> and accept, edit or retry it</>; nextLabel = "Continue writing"; nextGo = goRight; }
  else { nextText = <>Next: write the <b>{focus.title}</b></>; nextLabel = "Continue writing"; nextGo = goRight; }

  const metrics = planning
    ? [[CheckCircle2, `${approved.length} of 8 stages approved`], [BookMarked, `${facts.length} facts in the Story Bible`], [Languages, v.brief.language], [FileText, lengthText(options, v.brief)], [Clock, `Edited ${rel(v.updated_ts)}`]]
    : [[CheckCircle2, "8 of 8 stages approved"], [FileText, `${v.words.toLocaleString()} words`], [Languages, v.brief.language], [Clock, `Edited ${rel(v.updated_ts)}`]];
  const short = (t) => (t.length > 40 ? `${t.slice(0, 39)}…` : t);
  const tags = [v.brief.content_type, ...(v.brief.genres || []), ...(v.brief.tones || []), v.brief.audience, v.brief.setting && short(v.brief.setting)].filter(Boolean);
  const shown = allFacts ? facts : facts.slice(0, 4);
  const factsBad = approved.find((s) => s.facts_error);

  return (
    <div className="center" ref={rootRef}>
      <div className="crumbs">
        <nav>
          <button className="back" onClick={() => nav(SP)} aria-label="Back to stories"><ChevronLeft /></button>
          <span className="mini-logo"><Feather /></span><span className="hide-m">Story Studio</span><span className="s">/</span><span className="hide-m">Stories</span><span className="s">/</span><b className="mr">{v.title}</b>
        </nav>
        <div style={{ display: "flex", gap: 4 }}>
          <button className="ib" title="Download the whole project" aria-label="Download project" onClick={() => saveProject(v.id)}><Download /></button>
          <button className="ib" title="More" aria-label="More" onClick={(e) => { e.stopPropagation(); setMenu(e.currentTarget.getBoundingClientRect()); }}><MoreHorizontal /></button>
        </div>
      </div>
      {menu && <Pop anchor={menu} onClose={() => setMenu(null)} items={[
        ...(v.words ? [{ label: "Read the story", icon: <BookOpen size={16} />, onClick: () => nav(`${SP}/story/${v.id}/read`) }] : []),
        ...(sp.fountain ? [{ label: "Open the screenplay", icon: <Clapperboard size={16} />, onClick: () => nav(`${SP}/story/${v.id}/screenplay`) }] : []),
        { label: "Copy title", icon: <Copy size={16} />, onClick: () => navigator.clipboard?.writeText(v.title).then(() => flash("Title copied")) },
        { label: "Delete story", icon: <Trash2 size={16} />, danger: true, onClick: () => window.confirm(`Delete "${v.title}"? Its stages, story and screenplay will be lost.`) && remove(v.id) },
      ]} />}

      <div className="head">
        <div className="t1"><h1 className="ttl mr">{v.title}</h1><span className={`chip ${cls}`}>{running && <Spinner />}{label}</span></div>
        <div className="tags">{tags.map((t) => <span className="tag" key={t}><i>#</i>{t}</span>)}</div>
        <div className="metrics">{metrics.map(([Icon, text]) => <span key={text}><Icon />{text}</span>)}</div>
      </div>

      <div className="cards">
        <section className="card" aria-label="Progress">
          <div className="ch"><ListChecks />Progress<span className="chip grey">{planning ? `${approved.length} of 8 stages` : sp.fountain ? "Screenplay written" : "Story written"}</span></div>
          <Pipeline story={v} />
          <div className="next"><p>{nextText}</p>{nextLabel && <button className="btn k" disabled={!!busy} onClick={nextGo}>{nextLabel}</button>}</div>
        </section>

        <div className="two">
          <section className="card">
            <div className="ch"><CheckCircle2 />{planning ? "Approved so far" : "Approved stages"}</div>
            {approved.length ? (
              <ul className="ls">{approved.map((s) => <li key={s.key}><CheckCircle2 className="ic ok-i" /><b>{s.title}</b><span className="v mr">{stageNote(s.key, s.content)}</span></li>)}</ul>
            ) : <p className="help" style={{ marginTop: 14 }}>Nothing is approved yet. Each stage you approve is listed here and saved in the Story Bible.</p>}
          </section>

          {planning ? (
            <section className="card">
              <div className="ch"><BookMarked />Story Bible<span className="chip grey">{facts.length} facts</span></div>
              {factsBad && <div className="note">{factsBad.facts_error} <button className="lk" style={{ border: 0, background: "none", font: "inherit", fontWeight: 600, textDecoration: "underline", cursor: "pointer" }} onClick={() => act("facts", (a) => a.refreshFacts(v.id, factsBad.key))}>Write the facts again</button></div>}
              {facts.length ? <ul className="facts">{shown.map((f, i) => <li key={i} className="mr">{f}</li>)}</ul> : <p className="help" style={{ marginTop: 14 }}>Facts appear here when you approve a stage. Later stages must not contradict them.</p>}
              {facts.length > 4 && <p className="more"><button onClick={() => setAllFacts(!allFacts)} style={{ border: 0, background: "none", font: "inherit", color: "inherit", cursor: "pointer", padding: 0 }}>{allFacts ? "Show fewer" : `+ ${facts.length - 4} more facts`}</button></p>}
              {v.directions.length > 0 && <div className="dir">{v.directions.map((d, i) => <span className="tag" key={i} title={d.text}><i><Pencil size={14} /></i><span className="tx">{d.text}</span></span>)}</div>}
            </section>
          ) : (
            <section className="card">
              <div className="ch"><ShieldCheck />Checks on the text</div>
              <ul className="ls">{v.checks.map((c) => <li key={c.key}>{c.ok ? <CheckCircle2 className="ic ok-i" /> : <AlertTriangle className="ic warn-i" />}<b>{CHECK_NAMES[c.key] || c.key}</b><span className="v">{c.detail}</span></li>)}</ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
