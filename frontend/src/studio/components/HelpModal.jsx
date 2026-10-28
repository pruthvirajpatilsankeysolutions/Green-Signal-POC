import { useStudio } from "../useStudio.jsx";
import { Modal } from "./ui.jsx";

export default function HelpModal() {
  const { setHelpOpen } = useStudio();
  return (
    <Modal title="How Story Studio works" onClose={() => setHelpOpen(false)} size="sm" footer={<button className="btn k" onClick={() => setHelpOpen(false)}>Got it</button>}>
      <ol className="steps2">
        <li><b>Start with an idea.</b> Choose what you are making, the genre, the tone, the language and the length.</li>
        <li><b>Approve one stage at a time.</b> Concept, Logline, Characters, Conflict, Ending, Structure, Beats and Outline. For each one you can <b>Accept</b> it, <b>Edit</b> it (your own words become canon exactly as written), or <b>Retry</b> it with a direction.</li>
        <li><b>Approved means canon.</b> Everything you approve goes into the Story Bible. Every later stage, the story and the screenplay must stay consistent with it, and each new draft is checked against it before you see it.</li>
        <li><b>The story is validated.</b> A problem is repaired once with the smallest change. The pass or fail result is decided by fixed rules, not by the AI's opinion.</li>
        <li><b>Change it, then take it away.</b> Revise the story in your own words, write a screenplay (optional), and download the whole project.</li>
      </ol>
      <p className="help" style={{ margin: 0 }}>Nothing after a stage is written until you have answered. Read the stories yourself: the AI can still miss a problem.</p>
    </Modal>
  );
  
}

