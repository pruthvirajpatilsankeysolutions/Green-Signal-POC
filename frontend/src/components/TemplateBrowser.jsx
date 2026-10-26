import { useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Clock, LayoutTemplate, Search, SearchX, Star, X } from "lucide-react";

const PAGE = 12;   // cards shown per section before "Show more"

function Card({ t, selected, onPick }) {
  return (
    <button className={`tb-card${selected ? " on" : ""}`} onClick={() => onPick(t)} aria-pressed={selected} title={t.name}>
      <span className="tb-thumb" style={{ aspectRatio: `${t.width} / ${t.height}` }}>
        {t.thumbnail_url ? <img src={t.thumbnail_url} alt="" loading="lazy" decoding="async" /> : <LayoutTemplate size={26} aria-hidden="true" />}
        {t.forThis && <span className="tb-badge"><Star size={10} aria-hidden="true" /> Made for this</span>}
        {selected && <span className="tb-check"><Check size={13} aria-label="Selected" /></span>}
      </span>
      <span className="tb-name">{t.name}</span>
      <span className="tb-meta">{t.size}{t.hasLogo ? " · logo" : ""}{t.hasPhoto ? " · photo" : ""}</span>
    </button>
  );
}

// Templates shown right on the page: search, filters, sections and a grid in a scrolling area.
export default function TemplateBrowser({ templates, loading, selectedId, occasionLabel, onSelect, allowStandard = true }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState([]);          // ids of the filter chips that are on
  const [limit, setLimit] = useState({});            // section -> how many cards are shown
  const [tall, setTall] = useState(false);           // the scrolling area, normal or taller
  const search = useRef(null);

  const chips = useMemo(() => {
    const out = [];
    if (templates.some((t) => t.forThis)) out.push({ id: "forThis", label: "Made for this", test: (t) => t.forThis });
    if (templates.some((t) => t.recentRank >= 0)) out.push({ id: "recent", label: "Recently used", test: (t) => t.recentRank >= 0 });
    ["Square", "Portrait", "Story", "Landscape"].filter((s) => templates.some((t) => t.shape === s))
      .forEach((s) => out.push({ id: s, label: s, group: "shape", test: (t) => t.shape === s }));
    if (templates.some((t) => t.hasLogo)) out.push({ id: "logo", label: "Logo spot", test: (t) => t.hasLogo });
    if (templates.some((t) => t.hasPhoto)) out.push({ id: "photo", label: "Photo spot", test: (t) => t.hasPhoto });
    return out;
  }, [templates]);

  const toggle = (chip) => setActive((cur) => {
    if (cur.includes(chip.id)) return cur.filter((x) => x !== chip.id);
    const others = chip.group ? cur.filter((id) => chips.find((c) => c.id === id)?.group !== chip.group) : cur;   // one shape at a time
    return [...others, chip.id];
  });

  const q = query.trim().toLowerCase();
  const browsing = !q && active.length === 0;
  const filtered = useMemo(() => {
    const tests = chips.filter((c) => active.includes(c.id)).map((c) => c.test);
    return templates.filter((t) => (!q || q.split(/\s+/).every((w) => t.haystack.includes(w))) && tests.every((fn) => fn(t)));
  }, [templates, chips, active, q]);

  const sections = useMemo(() => {
    if (!browsing) return [{ key: "results", title: `${filtered.length} ${filtered.length === 1 ? "result" : "results"}`, items: filtered }];
    const forThis = templates.filter((t) => t.forThis);
    const recent = templates.filter((t) => t.recentRank >= 0 && !t.forThis).sort((a, b) => a.recentRank - b.recentRank);
    const shown = new Set([...forThis, ...recent].map((t) => t.id));
    return [
      { key: "forThis", title: `Made for ${occasionLabel || "this post"}`, items: forThis },
      { key: "recent", title: "Recently used", icon: <Clock size={13} aria-hidden="true" />, items: recent },
      { key: "all", title: forThis.length || recent.length ? "All other templates" : "All templates", items: templates.filter((t) => !shown.has(t.id)) },
    ].filter((s) => s.items.length);
  }, [browsing, filtered, templates, occasionLabel]);

  const clear = () => { setQuery(""); setActive([]); search.current?.focus(); };

  return (
    <div className="tb">
      <div className="tb-tools">
        <label className="tb-search">
          <Search size={16} aria-hidden="true" />
          <input ref={search} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${templates.length} templates`} aria-label="Search templates" />
          {query && <button type="button" className="tb-clear" onClick={() => { setQuery(""); search.current?.focus(); }} aria-label="Clear search"><X size={14} /></button>}
        </label>
        <button className="tb-size" onClick={() => setTall((v) => !v)} aria-pressed={tall} title={tall ? "Show fewer rows" : "Show more rows"}>
          <ChevronsUpDown size={15} aria-hidden="true" /> {tall ? "Smaller" : "Larger"}
        </button>
      </div>
      {chips.length > 0 && (
        <div className="tb-chips" role="group" aria-label="Filters">
          {chips.map((c) => {
            const on = active.includes(c.id);
            return <button key={c.id} className={`tb-chip${on ? " on" : ""}`} aria-pressed={on} onClick={() => toggle(c)}>{on && <Check size={12} aria-hidden="true" />}{c.label}</button>;
          })}
          {!browsing && <button className="tb-chip tb-chip-clear" onClick={clear}>Clear all</button>}
        </div>
      )}

      <div className={`tb-body${tall ? " tall" : ""}`}>
        {browsing && allowStandard && (
          <button className={`tb-std${!selectedId ? " on" : ""}`} onClick={() => onSelect("", null)} aria-pressed={!selectedId}>
            <span className="tb-std-icon"><LayoutTemplate size={18} aria-hidden="true" /></span>
            <span className="tb-std-text"><strong>Standard design</strong><span>No template</span></span>
            {!selectedId && <span className="tb-std-state"><Check size={14} aria-hidden="true" /> Selected</span>}
          </button>
        )}

        {loading ? (
          <div className="tb-grid" aria-hidden="true">{[0.8, 1, 0.8, 1.25, 1, 0.8].map((r, i) => <div key={i} className="tb-card"><span className="tb-thumb tb-skel" style={{ aspectRatio: `${r}` }} /></div>)}</div>
        ) : (
          <>
            <p className="tb-live" aria-live="polite">{filtered.length} {filtered.length === 1 ? "template" : "templates"} shown</p>
            {sections.map((s) => {
              const cap = limit[s.key] || PAGE;
              return (
                <section key={s.key} aria-label={s.title}>
                  <h4 className="tb-sec">{s.icon}{s.title}{browsing && <span>{s.items.length}</span>}</h4>
                  <div className="tb-grid">
                    {s.items.slice(0, cap).map((t) => <Card key={t.id} t={t} selected={t.id === selectedId} onPick={(x) => onSelect(x.id, x)} />)}
                  </div>
                  {s.items.length > cap && (
                    <div className="tb-more"><button className="btn small" onClick={() => setLimit({ ...limit, [s.key]: cap + PAGE })}>Show {Math.min(PAGE, s.items.length - cap)} more</button></div>
                  )}
                </section>
              );
            })}
            {!filtered.length && (
              <div className="tb-empty">
                <SearchX size={30} aria-hidden="true" />
                <strong>No templates match{q ? ` “${query.trim()}”` : ""}</strong>
                <span>Try another word, or remove a filter.</span>
                <button className="btn small" onClick={clear}>Clear search and filters</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
