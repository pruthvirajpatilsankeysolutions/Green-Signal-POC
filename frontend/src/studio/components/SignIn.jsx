import { useState } from "react";
import { Feather } from "../icons.jsx";
import { setKey, studio } from "../api.js";

// Shown when the server has an access key (STUDIO_ACCESS_KEY). It is checked on the server; this page only holds it for you.
export default function SignIn({ onDone }) {
  const [key, setValue] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const go = async (e) => {
    e.preventDefault(); setBusy(true); setError("");
    try { await studio.session(key.trim()); setKey(key.trim(), remember); onDone(); }
    catch (err) { setError(err.name === "Unauthorized" ? "That key isn't right. Check it and try again." : err.message); setBusy(false); }
  };
  return (
    <div className="signin">
      <form className="sicard" onSubmit={go}>
        <span className="logo big"><Feather /></span>
        <h1>Story Studio</h1>
        <p>Enter the access key to continue.</p>
        <label className="sr" htmlFor="key">Access key</label>
        <input id="key" className="in" type="password" value={key} onChange={(e) => setValue(e.target.value)} placeholder="Access key" autoFocus autoComplete="current-password" />
        <label className="rem"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember on this device</label>
        {error && <div className="err" role="alert">{error}</div>}
        <button className="btn k full" disabled={busy || !key.trim()}>{busy ? "Checking…" : "Continue"}</button>
      </form>
    </div>
  );
}
