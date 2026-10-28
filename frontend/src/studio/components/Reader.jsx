import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, BookOpen, CheckCircle2, ChevronLeft, Clapperboard, Download, Feather, Pencil, ShieldCheck, Undo2 } from "../icons.jsx";
import { useStudio } from "../useStudio.jsx";
import { PROBLEM_TYPES, SP, repairNote } from "../data.js";
import Markdown from "./Markdown.jsx";
import ReviseDialog from "./ReviseDialog.jsx";
import { Spinner } from "./ui.jsx";

const CHECK_NAMES = { length: "Length", language: "Language", cast: "Characters", repetition: "Repetition", title: "Title" };

const Crumbs = ({ v, last }) => {
  const nav = useNavigate();
  return (
    <div className="crumbs"><nav>
      <button className="back" onClick={() => nav(`${SP}/story/${v.id}`)} aria-label="Back to the story"><ChevronLeft /></button>
      <span className="mini-logo"><Feather /></span>
      <button className="crumb hide-m" onClick={() => nav(SP)}>Stories</button><span className="s">/</span>
      <button className="crumb" onClick={() => nav(`${SP}/story/${v.id}`)}><span className="mr">{v.title}</span></button><span className="s">/</span><b>{last}</b>
    </nav></div>
  );
};

// The whole story, to read.
export function StoryReader() {
  const { story: v } = useStudio();
  if (!v) return <div className="center"><p className="loading">Loading…</p></div>;
  const text = v.stages[8].content;
  return (
    <div className="center">
      <Crumbs v={v} last="Story" />
      {text ? <article className="read mr"><Markdown text={text} /></article> : <div className="blank"><BookOpen size={32} /><strong>The story isn't written yet</strong><p>Approve every stage up to the Outline, then write the story from the pane on the right.</p></div>}
    </div>
  );
}

// Beside the story: what the validator found, the checks, and the ways to change it.
export function ReaderPane() {
  const nav = useNavigate();
  const { story: v, act, busy, save } = useStudio();
  const [revise, setRevise] = useState(false);
  if (!v) return <aside className="right" />;
  const val = v.validation || {};
  const running = v.job?.status === "running";
  const off = !!busy || running;
  const probs = val.hard_failures || [];
  const pass = val.status === "PASS";
  return (
    <aside className="right" aria-label="Validation">
      <div className="rh"><h2>Story</h2><div className="acts">
        <button className="btn" disabled={off || !v.words} onClick={() => setRevise(true)}><Pencil />Revise</button>
        <button className="btn k" disabled={off || !v.words} onClick={() => act("validate", (a) => a.validate(v.id))}><ShieldCheck />Validate</button></div></div>
      <div className="rbody">
        {running && <div className="run" role="status"><Spinner /><span>{v.job.message}</span></div>}
        {v.job?.status === "failed" && <div className="note" role="alert">{v.job.message}</div>}
        <div className="sec"><div className="sl2"><ShieldCheck />Result</div>
          {val.status ? (<><div className="score"><b>{val.score}</b><span>/ 100 · {pass ? "follows the approved canon" : `${probs.length} hard ${probs.length === 1 ? "problem" : "problems"}`}</span></div>
            <div className="meter"><i style={{ width: `${val.score}%`, background: pass ? "#16a34a" : "#d92d20" }} /></div>
            {repairNote(val.repair) && <div className="note">{repairNote(val.repair)}</div>}</>) : <p className="plain">Not validated yet.</p>}
        </div>
        {probs.length > 0 && <div className="sec"><div className="sl2"><AlertTriangle />Problems to fix</div>{probs.map((p, i) => (
          <div className="prob red" key={i}><b>{PROBLEM_TYPES[p.type] || PROBLEM_TYPES.other}</b><p className="mr">{p.issue}</p>{p.evidence && <q className="mr">{p.evidence}</q>}{p.fix && <em>Fix: {p.fix}</em>}</div>))}</div>}
        {v.checks.length > 0 && <div className="sec"><div className="sl2"><CheckCircle2 />Checks on the text</div>
          <ul className="ls">{v.checks.map((c) => <li key={c.key}>{c.ok ? <CheckCircle2 className="ic ok-i" /> : <AlertTriangle className="ic warn-i" />}<b>{CHECK_NAMES[c.key] || c.key}</b><span className="v">{c.detail}</span></li>)}</ul></div>}
        <div className="sec"><div className="sl2"><Download />Take it with you</div>
          <div className="btnrow">
            <button className="btn" disabled={!v.words} onClick={() => save(v.id, "story.md", "the story")}><Download />story.md</button>
            <button className="btn" onClick={() => save(v.id, "story_bible.md", "the Story Bible")}><Download />Story Bible</button>
            {v.can_undo && <button className="btn" disabled={off} onClick={() => act("undo", (a) => a.undo(v.id))}><Undo2 />Go back one version</button>}
            {pass && <button className="btn" onClick={() => nav(`${SP}/story/${v.id}/screenplay`)}><Clapperboard />Screenplay</button>}
          </div></div>
      </div>
      {revise && <ReviseDialog id={v.id} onClose={() => setRevise(false)} />}
    </aside>
  );
}

// The screenplay, scene by scene.
export function ScreenplayReader() {
  const { story: v } = useStudio();
  const [open, setOpen] = useState(null);
  if (!v) return <div className="center"><p className="loading">Loading…</p></div>;
  const sp = v.screenplay;
  return (
    <div className="center">
      <Crumbs v={v} last="Screenplay" />
      <div className="head"><div className="t1"><h1 className="ttl mr">Screenplay</h1><span className="chip grey">{sp.written} of {sp.planned || "?"} scenes</span></div></div>
      <div className="cards">
        {!sp.planned && <div className="blank"><Clapperboard size={32} /><strong>No screenplay yet</strong><p>A screenplay in the Fountain format is written scene by scene from your approved outline and the story. Start it from the pane on the right.</p></div>}
        {sp.scenes.map((s) => (
          <section className="scene" key={s.n}>
            <button aria-expanded={open === s.n} onClick={() => setOpen(open === s.n ? null : s.n)}>
              <span className="sn">{s.n}</span><span className="sh"><b>{s.heading}</b><span className="muted"> · {s.title}</span></span>
              {s.issues.length > 0 && <span className="chip bad" style={{ height: 24 }}>{s.issues.length}</span>}
            </button>
            {open === s.n && <pre className="fountain">{s.text}</pre>}
          </section>
        ))}
      </div>
    </div>
  );
}

export function ScreenplayPane() {
  const { story: v, act, busy, save } = useStudio();
  if (!v) return <aside className="right" />;
  const sp = v.screenplay;
  const running = v.job?.status === "running";
  const off = !!busy || running;
  const partial = sp.written > 0 && sp.written < sp.planned;
  const canWrite = v.words > 0;
  return (
    <aside className="right" aria-label="Screenplay">
      <div className="rh"><h2>Screenplay</h2><div className="acts">
        {sp.fountain && <button className="btn" onClick={() => save(v.id, "screenplay.fountain", "the screenplay")}><Download />.fountain</button>}
        {(!sp.planned || partial || sp.stale) && <button className="btn k" disabled={off || !canWrite} onClick={() => act("screenplay", (a) => a.writeScreenplay(v.id, sp.stale))}>{running ? <Spinner /> : <Clapperboard />}{partial ? `Continue from scene ${sp.written + 1}` : sp.stale ? "Write it again" : "Write the screenplay"}</button>}
        {sp.fountain && !partial && !sp.stale && <button className="btn" disabled={off} onClick={() => window.confirm("Plan and write the whole screenplay again?") && act("screenplay", (a) => a.writeScreenplay(v.id, true))}>Write again</button>}
      </div></div>
      <div className="rbody">
        {running && <div className="run" role="status"><Spinner /><span>{v.job.message}</span></div>}
        {v.job?.status === "failed" && <div className="note" role="alert">{v.job.message}</div>}
        {sp.stale && <div className="note">The story changed after this screenplay was written. Write it again to match.</div>}
        <div className="sec"><div className="sl2"><Clapperboard />Progress</div>
          <div className="score"><b>{sp.written}</b><span>of {sp.planned || "?"} scenes written</span></div>
          <div className="meter"><i style={{ width: `${sp.planned ? (sp.written / sp.planned) * 100 : 0}%`, background: "#16a34a" }} /></div>
          <p className="help">Written one scene at a time from your approved outline. A scene that stops partway is kept, and the next run continues from it.</p></div>
        {sp.warnings.length > 0 && <div className="sec"><div className="sl2"><AlertTriangle />Check these scenes</div>{sp.warnings.map((w, i) => <div className="ci warning" key={i}><AlertTriangle /><span>{w}</span></div>)}</div>}
      </div>
    </aside>
  );
}
