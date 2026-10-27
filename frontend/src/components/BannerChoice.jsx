import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";

const OPTIONS = [
  ["none", "No banner", "The design as it is"],
  ["banner", "Banner only", "Name, logo and designation strip at the bottom"],
  ["photo_banner", "Photo + banner", "The leader's photo as well as the banner"],
];

// Choose the client's banner for a post: none, the footer banner, or the banner with the leader's photo.
// Always shown. What this client can't use yet is greyed, with the reason and a link to add it.
export default function BannerChoice({ value, onChange, busy = false, label = "Banner" }) {
  const [frames, setFrames] = useState(null);          // { banner: bool, photo_banner: bool }
  useEffect(() => { api.templateFrames().then(setFrames).catch(() => setFrames({})); }, []);
  const can = (k) => k === "none" || !!frames?.[k];
  const missing = frames && !frames.banner ? "banner" : frames && !frames.photo_banner ? "leader photo" : "";
  return (
    <div className="bc">
      <span className="bc-label">{label}</span>
      <div className="seg bc-seg" role="radiogroup" aria-label={label}>
        {OPTIONS.map(([k, name, why]) => (
          <button key={k} role="radio" aria-checked={value === k} className={value === k ? "on" : ""} disabled={busy || !can(k) && frames !== null}
                  title={can(k) ? why : `Not available yet: add a ${k === "banner" || !frames?.banner ? "banner" : "leader photo"} on the Clients page`}
                  onClick={() => value !== k && onChange(k)}>{name}</button>
        ))}
      </div>
      {missing ? (
        <span className="hint">
          {missing === "banner" ? "This client has no banner yet." : "This client has no leader photo yet, so Photo + banner is off."}{" "}
          <Link to="/clients">Add it on the Clients page</Link>
        </span>
      ) : <span className="hint">You can change this whenever you want, even after the poster is made.</span>}
    </div>
  );
}
