import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import StudioApp from "./StudioApp.jsx";
import css from "./studio.css?inline";

// Story Studio runs inside the app. Its styles live in a shadow root, so they can never change how the rest of the app looks,
// and the app's styles can never change Story Studio.
export default function StudioHost() {
  const navigate = useNavigate();
  const [root, setRoot] = useState(null);
  const attach = useCallback((el) => { if (el) setRoot(el.shadowRoot || el.attachShadow({ mode: "open" })); }, []);
  return (
    <div className="sx-host" ref={attach}>
      {root && createPortal(<><style>{css}</style><StudioApp onExit={() => navigate("/")} /></>, root)}
    </div>
  );
}
