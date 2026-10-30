import { useEffect, useState } from "react";
import { ChevronLeft, Search, X } from "lucide-react";
import { SHAPE_GROUPS } from "./shapeLibrary";
import TablePanel from "./TablePanel";
import { CATEGORIES, fetchSet, hasIcon, iconSvg, loadIcons, searchIcons } from "./iconify";

const PAGE = 60;

// The top of the Elements tab: a search box and a "Browse categories" grid. Inside a category (or a search)
// it lists icons from Iconify; clicking one calls onPick(svgText, name). When idle it shows `children`.
export default function IconBrowser({ onPick, onPickShape, onAddTable, children }) {
  const [cat, setCat] = useState(null);          // an entry of CATEGORIES
  const [tab, setTab] = useState(null);          // the set prefix or search word chosen inside the category
  const [group, setGroup] = useState("");        // a group inside a set ("" = all)
  const [text, setText] = useState("");          // search box
  const [query, setQuery] = useState("");        // debounced search box
  const [groups, setGroups] = useState([]);      // [{ name, icons }] of the open set
  const [found, setFound] = useState([]);        // search results
  const [shown, setShown] = useState(PAGE);
  const [state, setState] = useState({ busy: false, error: "" });
  const [, setLoaded] = useState(0);            // bumped when icon artwork arrives

  useEffect(() => { const t = setTimeout(() => setQuery(text.trim()), 350); return () => clearTimeout(t); }, [text]);

  const isSet = !query && cat?.sets && tab;
  const word = query || (cat?.queries ? tab : "");
  const shapes = cat?.id === "shapes" && !query ? (SHAPE_GROUPS.find((g) => g.name === tab)?.shapes || []) : query ? SHAPE_GROUPS.flatMap((g) => g.shapes).filter((sh) => sh.name.toLowerCase().includes(query.toLowerCase())) : [];

  useEffect(() => {
    let stale = false;
    setShown(PAGE); setGroup("");
    const run = async () => {
      if (!isSet && !word) { setGroups([]); setFound([]); return; }
      setState({ busy: true, error: "" });
      try {
        if (isSet) { const g = await fetchSet(tab); if (!stale) setGroups(g); }
        else { const f = await searchIcons(word); if (!stale) setFound(f); }
        if (!stale) setState({ busy: false, error: "" });
      } catch (e) { if (!stale) setState({ busy: false, error: e.message }); }
    };
    run();
    return () => { stale = true; };
  }, [isSet, tab, word]);

  const open = (c) => { setCat(c); setText(""); setQuery(""); setTab(c.id === "shapes" ? SHAPE_GROUPS[0].name : c.builtin ? "-" : c.sets ? c.sets[0][0] : c.queries[0]); };
  const back = () => { setCat(null); setTab(null); setText(""); setQuery(""); };

  const pick = (id) => onPick(iconSvg(id, { color: "#F26B0F", size: 512 }), id.split(":")[1].replace(/-/g, " "));

  const icons = isSet ? (groups.find((g) => g.name === group)?.icons || groups.flatMap((g) => g.icons)) : found;
  const browsing = cat || query;
  const visible = icons.slice(0, shown);

  // artwork for the icons on screen (and the category tiles) arrives in bulk
  const visibleKey = visible.join(",");
  useEffect(() => {
    let stale = false;
    loadIcons(visible).then(() => { if (!stale) setLoaded((n) => n + 1); }).catch((e) => { if (!stale) setState((s) => ({ ...s, error: e.message })); });
    return () => { stale = true; };
  }, [visibleKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { loadIcons(CATEGORIES.filter((c) => c.sample).map((c) => c.sample)).then(() => setLoaded((n) => n + 1)).catch(() => null); }, []);

  return (
    <>
      <div className="ib-search">
        <Search size={18} />
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Search icons and emoji" aria-label="Search icons" />
        {text && <button onClick={() => setText("")} aria-label="Clear search"><X size={16} /></button>}
      </div>

      {!browsing && (
        <>
          <div className="ed-section">Browse categories</div>
          <div className="ib-cats">
            {CATEGORIES.map((c) => (
              <button key={c.id} onClick={() => open(c)}>
                <span className="ib-card" style={{ "--from": c.from, "--to": c.to }}>
                  {c.builtin ? <svg viewBox="0 0 100 100"><path d={c.previewPath} fill={c.outline ? "none" : "#fff"} stroke={c.outline ? "#fff" : "none"} strokeWidth="7" strokeLinejoin="round" /></svg>
                    : <span dangerouslySetInnerHTML={{ __html: iconSvg(c.sample, { color: "#ffffff", size: 40 }) }} />}
                </span>
                {c.label}
              </button>
            ))}
          </div>
          {children}
        </>
      )}

      {browsing && (
        <>
          <div className="ib-head">
            <button className="ib-back" onClick={back}><ChevronLeft size={18} /> {query ? "All categories" : cat.label}</button>
            {query && <span>Results for “{query}”</span>}
          </div>
          {!query && cat.id !== "tables" && (
            <div className="ib-chips">
              {(cat.id === "shapes" ? SHAPE_GROUPS.map((g) => [g.name, g.name]) : cat.sets || cat.queries.map((q) => [q, q])).map(([key, label]) => (
                <button key={key} className={tab === key ? "on" : ""} onClick={() => setTab(key)}>{label}</button>
              ))}
            </div>
          )}
          {cat?.id === "tables" && !query && <TablePanel onAdd={onAddTable} />}
          {shapes.length > 0 && (
            <div className="ib-grid ib-shapes">
              {shapes.map((sh) => (
                <button key={sh.name} title={sh.name} onClick={() => onPickShape(sh)}>
                  <svg viewBox="0 0 100 100"><path d={sh.d} fill="#374151" fillRule={sh.rule || "nonzero"} /></svg>
                </button>
              ))}
            </div>
          )}
          {isSet && groups.length > 1 && (
            <select className="ib-group" value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Group">
              <option value="">All groups</option>
              {groups.map((g) => <option key={g.name} value={g.name}>{g.name} ({g.icons.length})</option>)}
            </select>
          )}
          {state.error && <p className="ed-hint ib-error">{state.error}</p>}
          {state.busy && !cat?.builtin && <p className="ed-hint">Loading…</p>}
          {!state.busy && !state.error && icons.length === 0 && shapes.length === 0 && !cat?.builtin && <p className="ed-hint">No icons found.</p>}
          <div className="ib-grid">
            {visible.map((id) => (
              <button key={id} title={id.split(":")[1].replace(/-/g, " ")} disabled={!hasIcon(id)} onClick={() => pick(id)}
                      dangerouslySetInnerHTML={{ __html: iconSvg(id) }} />
            ))}
          </div>
          {icons.length > shown && <button className="ib-more" onClick={() => setShown((n) => n + PAGE)}>Show more</button>}
        </>
      )}
    </>
  );
}
