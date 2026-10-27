import { Check } from "../icons.jsx";
import { STAGE_LABELS } from "../data.js";

// The ten steps from Concept to Screenplay: approved, the one in front of you, and what is still locked.
export function nodesOf(v) {
  const st = (i) => v.stages[i];
  return STAGE_LABELS.map((label, i) => {
    let cls = "", inner = i + 1;
    if (i < 8) {
      if (st(i).status === "approved") { cls = "done"; inner = <Check />; } else if (v.focus === st(i).key) cls = "cur";
    } else if (i === 8) {
      if (v.state === "ok") { cls = "ok"; inner = <Check />; } else if (v.state === "bad") { cls = "bad"; inner = "!"; } else if (v.focus === "story") cls = "cur";
    } else if (v.screenplay?.fountain) { cls = "ok"; inner = <Check />; }
    return { label, cls, inner };
  });
}

export default function Pipeline({ story }) {
  return (
    <div className="pipe-wrap">
      <ol className="pipe">
        {nodesOf(story).map((n) => <li key={n.label} className={n.cls}><span className="n">{n.inner}</span><span className="lb">{n.label}</span></li>)}
      </ol>
    </div>
  );
}
