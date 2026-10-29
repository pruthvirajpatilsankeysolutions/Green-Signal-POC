import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, BookOpen, Check, CheckCircle2, Clapperboard, Download, FileText, Pencil, RotateCcw, ShieldCheck } from "../icons.jsx";
import { useStudio } from "../useStudio.jsx";
import { PROBLEM_TYPES, SP, STAGE_HELP, lengthText, repairNote } from "../data.js";
import Markdown from "./Markdown.jsx";
import ReviseDialog from "./ReviseDialog.jsx";
import { Spinner } from "./ui.jsx";

const Sec = ({ icon: Icon, label, link, children }) => <div className="sec"><div className="sl2"><Icon />{label}{link}</div>{children}</div>;

// These two live OUTSIDE NextStep on purpose. A component defined inside another component is a new component on every render,
// so React throws its DOM away and rebuilds it; a text box inside it would lose focus after every typed character.
const Head = ({ title, children }) => <div className="rh"><h2 className="mr">{title}</h2><div className="acts">{children}</div></div>;
const Dirs = ({ label, value, onChange }) => (
  <Sec icon={RotateCcw} label={<>{label} <span style={{ color: "var(--faint)" }}>(optional)</span></>}>
    <input className="in mr" value={value} onChange={(e) => onChange(e.target.value)} placeholder="e.g. darker, no villain, set in Pune" aria-label="Direction" />
    <p className="help">A direction is remembered in the Story Bible and still applies to later stages.</p>
  </Sec>
);

// The right pane: what to do next with this story. The writer answers here: Accept, Edit or Retry; or fix, validate, read, write the screenplay.
export default function NextStep() {
  const nav = useNavigate();
  const { story: v, act, busy, save, options } = useStudio();
  const [direction, setDirection] = useState("");
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [revise, setRevise] = useState(false);
  useEffect(() => { setDirection(""); setEditing(false); }, [v?.id, v?.focus]);
  if (!v) return <aside className="right" aria-label="Next step" />;

  const running = v.job?.status === "running";
  const off = !!busy || running;
  const focus = v.stages.find((s) => s.key === v.focus);
  const mode = v.state === "ok" ? "ok" : v.state === "bad" ? "bad" : v.words ? "check" : v.focus === "story" ? "story" : focus.status === "draft" ? "draft" : "ready";
  const failed = v.job?.status === "failed" ? v.job.message : "";
  const val = v.validation || {};
  const banner = (
    <>
      {running && <div className="run" role="status"><Spinner /><span>{v.job.message}</span></div>}
      {failed && <div className="note" role="alert">{failed}</div>}
    </>
  );
  const write = (retry) => act("write", (a) => a.writeStage(v.id, focus.key, direction, retry));
  const accept = (content = null) => act("accept", (a) => a.acceptStage(v.id, focus.key, content)).then((r) => r && setEditing(false));

  let content;
  if (mode === "draft") {
    const w = focus.warnings;
    content = (
      <>
        {editing
          ? <Head title={focus.title}><button className="btn" onClick={() => setEditing(false)}>Cancel</button><button className="btn k" id="primary-action" disabled={off || !text.trim()} onClick={() => accept(text)}><Check />Save as approved</button></Head>
          : <Head title={focus.title}><button className="btn" disabled={off} onClick={() => write(true)}><RotateCcw />Retry</button><button className="btn k" id="primary-action" disabled={off} onClick={() => accept()}><Check />Accept</button></Head>}
        <div className="rbody">
          {banner}
          <Sec icon={ShieldCheck} label="Consistency check">
            {w.length ? <>{w.map((x, i) => <div key={i} className={`ci ${x.kind === "conflict" ? "conflict" : "warning"}`}><AlertTriangle /><span>{x.kind === "conflict" && <b>Conflict: </b>}{x.text}</span></div>)}
              <p className="help">Edit or retry to fix these, or accept if it is fine.</p></>
              : <div className="ci fine"><CheckCircle2 /><span>No problems found against the Story Bible.</span></div>}
          </Sec>
          <Sec icon={FileText} label="Draft" link={!editing && <button className="lk" disabled={off} onClick={() => { setText(focus.content); setEditing(true); }}><Pencil />Edit</button>}>
            {editing
              ? <><textarea className="draft edit mr" value={text} onChange={(e) => setText(e.target.value)} aria-label={`Edit the ${focus.title}`} autoFocus /><p className="help">Your version becomes canon exactly as you write it.</p></>
              : <div className={`draft mr${running ? " dim" : ""}`}><Markdown text={focus.content} /></div>}
          </Sec>
          {!editing && <Dirs label="Direction for a retry" value={direction} onChange={setDirection} />}
        </div>
        <div className="rfoot"><CheckCircle2 />Saved. Nothing after this stage is written until you answer.</div>
      </>
    );
  } else if (mode === "ready") {
    content = (
      <>
        <Head title={focus.title}><button className="btn k" id="primary-action" disabled={off} onClick={() => write(false)}>{running ? <Spinner /> : null}Write the {focus.title}</button></Head>
        <div className="rbody">
          {banner}
          <Sec icon={FileText} label="What this stage is"><p className="plain">{STAGE_HELP[focus.key]}</p></Sec>
          <Dirs label="Direction" value={direction} onChange={setDirection} />
        </div>
        <div className="rfoot"><CheckCircle2 />Nothing is written until you press the button.</div>
      </>
    );
  } else if (mode === "story") {
    content = (
      <>
        <Head title="Story"><button className="btn k" id="primary-action" disabled={off} onClick={() => act("story", (a) => a.writeStory(v.id))}>{running ? <Spinner /> : null}Write the story</button></Head>
        <div className="rbody">
          {banner}
          <Sec icon={FileText} label="What happens next"><p className="plain">{STAGE_HELP.story} {lengthText(options, v.brief)}.</p>
            <p className="help">When it is written it is checked (length, language, characters, repetition) and validated. A problem is repaired once, with the smallest change.</p></Sec>
        </div>
        <div className="rfoot"><CheckCircle2 />All eight stages are approved.</div>
      </>
    );
  } else if (mode === "check") {
    content = (
      <>
        <Head title="Not validated"><button className="btn" onClick={() => nav(`${SP}/story/${v.id}/read`)}><BookOpen />Read</button><button className="btn k" id="primary-action" disabled={off} onClick={() => act("validate", (a) => a.validate(v.id))}><ShieldCheck />Validate</button></Head>
        <div className="rbody">{banner}<Sec icon={ShieldCheck} label="Validation"><p className="plain">The story is written but has not been checked against what you approved. Validate it to see whether it follows the canon.</p></Sec></div>
      </>
    );
  } else if (mode === "bad") {
    const probs = val.hard_failures || [];
    content = (
      <>
        <Head title="Validation"><button className="btn" disabled={off} onClick={() => setRevise(true)}><Pencil />Revise</button><button className="btn k" id="primary-action" disabled={off} onClick={() => act("validate", (a) => a.validate(v.id))}><ShieldCheck />Validate</button></Head>
        <div className="rbody">
          {banner}
          <div className="sec"><div className="sl2"><ShieldCheck />Result<button className="lk" onClick={() => nav(`${SP}/story/${v.id}/read`)}><BookOpen />Read story</button></div>
            <div className="score"><b>{val.score}</b><span>/ 100 · {probs.length} hard {probs.length === 1 ? "problem" : "problems"}</span></div>
            <div className="meter"><i style={{ width: `${val.score}%`, background: "#d92d20" }} /></div>
            {repairNote(val.repair) && <div className="note">{repairNote(val.repair)}</div>}
          </div>
          {probs.length > 0 && <Sec icon={AlertTriangle} label="Problems to fix">{probs.map((p, i) => (
            <div className="prob red" key={i}><b>{PROBLEM_TYPES[p.type] || PROBLEM_TYPES.other}</b><p className="mr">{p.issue}</p>{p.evidence && <q className="mr">{p.evidence}</q>}{p.fix && <em>Fix: {p.fix}</em>}</div>))}</Sec>}
          {!probs.length && <Sec icon={AlertTriangle} label="Why it failed"><p className="plain">The score is under 80 although no single hard problem was found. Read the story, or revise it and validate again.</p></Sec>}
        </div>
      </>
    );
  } else {
    const sp = v.screenplay;
    content = (
      <>
        <Head title="Validation">
          <button className="btn" onClick={() => save(v.id, "story.md", "the story")}><Download />Story</button>
          {sp.fountain ? <button className="btn k" id="primary-action" onClick={() => nav(`${SP}/story/${v.id}/screenplay`)}><Clapperboard />Screenplay</button>
            : <button className="btn k" id="primary-action" disabled={off} onClick={() => act("screenplay", (a) => a.writeScreenplay(v.id)).then(() => nav(`${SP}/story/${v.id}/screenplay`))}><Clapperboard />Write screenplay</button>}
        </Head>
        <div className="rbody">
          {banner}
          <div className="sec"><div className="sl2"><ShieldCheck />Result<button className="lk" onClick={() => nav(`${SP}/story/${v.id}/read`)}><BookOpen />Read story</button></div>
            <div className="score"><b>{val.score}</b><span>/ 100 · follows the approved canon</span></div>
            <div className="meter"><i style={{ width: `${val.score}%`, background: "#16a34a" }} /></div></div>
          {(val.strengths || []).length > 0 && <Sec icon={CheckCircle2} label="What works"><ul className="ls">{val.strengths.map((t, i) => <li className="wrap" key={i}><Check className="ic ok-i" /><span className="v mr" style={{ color: "var(--ink)", fontSize: 14 }}>{t}</span></li>)}</ul></Sec>}
          {(val.warnings || []).length > 0 && <Sec icon={AlertTriangle} label="Worth a look">{val.warnings.map((w, i) => <div className="ci warning" key={i}><AlertTriangle /><span className="mr">{w.issue}</span></div>)}</Sec>}
        </div>
      </>
    );
  }
  return <aside className="right" aria-label="Next step">{content}{revise && <ReviseDialog id={v.id} onClose={() => setRevise(false)} />}</aside>;
}
