import { useState } from "react";
import { useStudio } from "../useStudio.jsx";
import { Modal } from "./ui.jsx";

// Change the story: a quick option or the writer's own words. Only that is changed, the canon stays intact, and the story is checked again.
export default function ReviseDialog({ id, onClose }) {
  const { options, act, busy } = useStudio();
  const [text, setText] = useState("");
  const go = async (instruction) => { const r = await act("revise", (a) => a.revise(id, instruction)); if (r) onClose(); };
  return (
    <Modal title="Change the story" onClose={onClose} size="sm"
           footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn k" disabled={busy || text.trim().length < 3} onClick={() => go(text)}>Revise the story</button></>}>
      <div className="fld"><span className="fl">Quick changes</span>
        <div className="chips">{(options?.revisions || []).map((r) => <button key={r} className="chipb" disabled={!!busy} onClick={() => go(r)}>{r}</button>)}</div></div>
      <div className="fld"><label htmlFor="rv">Or say what should change</label>
        <textarea id="rv" className="in area" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. make the village scene longer" autoFocus /></div>
      <p className="help" style={{ margin: 0 }}>Only what you ask is changed and the canon stays intact. The story is checked again afterwards, and you can go back one version.</p>
    </Modal>
  );
}
