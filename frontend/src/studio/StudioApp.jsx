import { useCallback, useEffect, useState } from "react";
import { Route, Routes } from "react-router-dom";
import { clearKey, studio } from "./api.js";
import { StudioProvider, useStudio } from "./useStudio.jsx";
import HelpModal from "./components/HelpModal.jsx";
import NewStory from "./components/NewStory.jsx";
import NextStep from "./components/NextStep.jsx";
import Overview from "./components/Overview.jsx";
import Rail from "./components/Rail.jsx";
import { ReaderPane, ScreenplayPane, ScreenplayReader, StoryReader } from "./components/Reader.jsx";
import SignIn from "./components/SignIn.jsx";
import StoryList from "./components/StoryList.jsx";
import { Toast } from "./components/ui.jsx";

function Shell({ protectedSite, onSignOut }) {
  const { routeId, newOpen, helpOpen, toast } = useStudio();
  return (
    <div className="shell">
      <div className="win" data-view={routeId ? "detail" : "list"}>
        <Rail protectedSite={protectedSite} onSignOut={onSignOut} />
        <StoryList />
        <section className="work" aria-label="Story">
          <Routes>
            <Route path="/story/:id/read" element={<><StoryReader /><ReaderPane /></>} />
            <Route path="/story/:id/screenplay" element={<><ScreenplayReader /><ScreenplayPane /></>} />
            <Route path="*" element={<><Overview /><NextStep /></>} />
          </Routes>
        </section>
      </div>
      {newOpen && <NewStory />}
      {helpOpen && <HelpModal />}
      <Toast text={toast} />
    </div>
  );
}

// Story Studio is its own page. If the server has an access key, nothing is shown until it is entered.
export default function StudioApp() {
  const [gate, setGate] = useState("checking");          // checking | signin | open | offline
  const [protectedSite, setProtected] = useState(false);
  const check = useCallback(() => {
    setGate("checking");
    studio.status()
      .then((s) => { setProtected(s.protected); return s.protected ? studio.session().then(() => setGate("open")).catch(() => setGate("signin")) : setGate("open"); })
      .catch(() => setGate("offline"));
  }, []);
  useEffect(() => { check(); }, [check]);
  useEffect(() => { const f = () => setGate("signin"); window.addEventListener("studio:unauthorized", f); return () => window.removeEventListener("studio:unauthorized", f); }, []);
  if (gate === "checking") return <div className="signin"><p className="loading">Loading…</p></div>;
  if (gate === "offline") return <div className="signin"><div className="sicard"><h1>Can't reach the server</h1><p>Check that the backend is running, then try again.</p><button className="btn k full" onClick={check}>Try again</button></div></div>;
  if (gate === "signin") return <SignIn onDone={() => setGate("open")} />;
  return <StudioProvider><Shell protectedSite={protectedSite} onSignOut={() => { clearKey(); setGate("signin"); }} /></StudioProvider>;
}
