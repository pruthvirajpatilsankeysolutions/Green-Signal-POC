import { useState } from "react";
import { api } from "../api.js";
import BannerChoice from "./BannerChoice.jsx";
import Notice from "./Notice.jsx";

// On a poster that was just made from a template: change its banner whenever you want.
// The same words are drawn again in the same post; nothing new is written.
export default function PostBanner({ draft, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!draft?.details?.rerender) return null;            // standard posters and older posts can't switch
  const change = async (frame) => {
    setBusy(true); setError("");
    try { onChanged(await api.changeBanner(draft.id, frame)); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  return (
    <div className="pb">
      <BannerChoice value={draft.details.frame || "none"} onChange={change} busy={busy} label="Banner on this poster" />
      {busy && <span className="hint">Drawing the poster again…</span>}
      {draft.status === "approved" && <span className="hint">This post is approved. Changing the banner sends it back for approval.</span>}
      <Notice kind="error">{error}</Notice>
    </div>
  );
}
