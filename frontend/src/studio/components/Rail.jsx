import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clapperboard, Feather, HelpCircle, LogOut, PenLine, Search, Settings, ShieldCheck, ShieldOff } from "../icons.jsx";
import { useStudio } from "../useStudio.jsx";
import { Pop } from "./ui.jsx";

// The narrow strip on the left: the way around Story Studio, help and settings.
export default function Rail({ protectedSite, onSignOut }) {
  const nav = useNavigate();
  const { searchRef, filter, setFilter, setHelpOpen } = useStudio();
  const [menu, setMenu] = useState(null);
  const home = (f) => { setFilter(f); nav("/"); };
  return (
    <nav className="rail" aria-label="Story Studio">
      <div className="logo" aria-label="Story Studio"><Feather /></div>
      <button className="rb" title="Search" aria-label="Search" onClick={() => { nav("/"); setTimeout(() => searchRef.current?.focus(), 30); }}><Search /></button>
      <button className={`rb${filter !== "screen" ? " on" : ""}`} title="Stories" aria-label="Stories" onClick={() => home("all")}><PenLine /></button>
      <button className={`rb${filter === "screen" ? " on" : ""}`} title="Screenplays" aria-label="Screenplays" onClick={() => home("screen")}><Clapperboard /></button>
      <span className="sp" />
      <button className="rb" title="How Story Studio works" aria-label="Help" onClick={() => setHelpOpen(true)}><HelpCircle /></button>
      <button className="rb" title="Settings" aria-label="Settings" onClick={(e) => { e.stopPropagation(); setMenu(e.currentTarget.getBoundingClientRect()); }}><Settings /></button>
      <span className="me" title="Story Studio">S</span>
      {menu && (
        <Pop anchor={menu} side="right" onClose={() => setMenu(null)} width={250}
             items={[
               { label: protectedSite ? "Protected by an access key" : "Open: no access key is set", icon: protectedSite ? <ShieldCheck size={16} /> : <ShieldOff size={16} />, onClick: () => {} },
               ...(protectedSite ? [{ label: "Sign out", icon: <LogOut size={16} />, onClick: onSignOut }] : []),
             ]} />
      )}
    </nav>
  );
}
