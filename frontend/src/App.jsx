import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, Route, Routes, useLocation } from "react-router-dom";
import {
  CalendarHeart, Camera, CheckCircle2, ChevronDown, Feather, History as HistoryIcon, LayoutDashboard, LayoutTemplate, Menu, Newspaper, Plus, PlusSquare, Users, X,
} from "lucide-react";
import { api, getClientId, setClientId } from "./api.js";
import { Splitter, usePaneWidth } from "./components/Splitter.jsx";
import StudioHost from "./studio/StudioHost.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Festivals from "./pages/Festivals.jsx";
import EventPage from "./pages/EventPage.jsx";
import Reaction from "./pages/Reaction.jsx";
import Approvals from "./pages/Approvals.jsx";
import History from "./pages/History.jsx";
import Clients from "./pages/Clients.jsx";
import Templates from "./pages/Templates.jsx";
import Editor from "./pages/Editor.jsx";
import CreatePost from "./pages/CreatePost.jsx";

const StatusContext = createContext({ status: null, refresh: () => { } });
export const useStatus = () => useContext(StatusContext);

// A page can show a pane on the right of the layout (the Dashboard shows "Waiting for approval" there).
// `slot` is the element to draw into; the page tells the layout it is using it with setHasRight.
const RightPaneContext = createContext({ slot: null, setHasRight: () => { } });
export const useRightPane = () => useContext(RightPaneContext);

const APP_NAME = "Postcraft";

// Navigation, grouped the way the work flows: create posts, then review them.
const NAV = [
  { items: [{ to: "/", label: "Dashboard", icon: LayoutDashboard, end: true }] },
  {
    title: "Create",
    items: [
      { to: "/create", label: "Create post", icon: PlusSquare, feature: "create" },
      { to: "/festivals", label: "Festivals", icon: CalendarHeart, feature: "festivals" },
      { to: "/events", label: "Events", icon: Camera, feature: "events" },
      { to: "/reactions", label: "News reactions", icon: Newspaper, feature: "reactions" },
    ],
  },
  {
    title: "Review",
    items: [
      { to: "/approvals", label: "Approvals", icon: CheckCircle2, badge: "waiting" },
      { to: "/history", label: "History", icon: HistoryIcon },
    ],
  },
  {
    // Story Studio opens inside this app. On a computer it is in the icon strip; this group is the way to it on a phone.
    title: "Tools", phoneOnly: true,
    items: [{ to: "/studio", label: "Story Studio", icon: Feather }],
  },
  {
    title: "Settings",
    items: [{ to: "/clients", label: "Clients", icon: Users }, { to: "/templates", label: "Templates", icon: LayoutTemplate }],
  },
];

const PAGE_NAMES = {
  "/": "Dashboard", "/festivals": "Festivals", "/events": "Events",
  "/reactions": "News reactions", "/create": "Create post", "/approvals": "Approvals", "/history": "History", "/clients": "Clients", "/templates": "Templates",
};
const pageName = (path) => PAGE_NAMES[path] || (path.startsWith("/editor") ? "Edit design" : "");

export default function App() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");
  const [clientKey, setClientKey] = useState(getClientId());
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);            // the menu on a phone
  const [slot, setSlot] = useState(null);
  const [hasRight, setHasRight] = useState(false);
  const rightPane = useMemo(() => ({ slot, setHasRight }), [slot]);
  useEffect(() => { setMenuOpen(false); }, [pathname]);
  const isStudio = pathname === "/studio" || pathname.startsWith("/studio/");
  // the user can drag the edge of the menu and of the pane on the right
  const [menuW, setMenuW, resetMenuW] = usePaneWidth("pc.menuW", 200, 420);
  const [rightW, setRightW, resetRightW] = usePaneWidth("pc.rightW", 300, 640);
  const menuRef = useRef(null);

  const refresh = useCallback(() => {
    api.status().then((s) => {
      setStatus(s); setError("");
      if (!getClientId() && s.client?.id) { setClientId(s.client.id); setClientKey(s.client.id); }
    })
      .catch(() => setError("Can't reach the server. Start the backend: uvicorn api.main:app --reload --port 8000"));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // switching client reloads every page with that client's data
  const switchClient = (id) => { setClientId(id); setClientKey(id); refresh(); };

  const client = status?.client;
  const aiReady = status?.text_ai;
  // the client's post types decide which Create pages are shown
  const allowed = (feature) => !feature || !client?.features || client.features.includes(feature);
  const onlyFor = (feature, page) => (allowed(feature) ? page : <NotForCategory category={client?.category} />);

  // the design editor uses the whole screen, like a design tool
  if (pathname.startsWith("/editor/")) {
    return (
      <StatusContext.Provider value={{ status, refresh }}>
        <Routes>
          <Route path="/editor/template/:tid" element={<Editor />} />
          <Route path="/editor/:id" element={<Editor />} />
        </Routes>
      </StatusContext.Provider>
    );
  }

  return (
    <StatusContext.Provider value={{ status, refresh }}>
      <RightPaneContext.Provider value={rightPane}>
        <div className={`sh${isStudio ? " is-studio" : ""}`} data-menu={menuOpen ? "open" : "closed"}
             style={{ "--menu-w": menuW ? `${menuW}px` : undefined, "--right-w": rightW ? `${rightW}px` : undefined }}>
          {/* the two products: this app, and Story Studio */}
          <nav className="sh-rail" aria-label="Products">
            <Link to="/" className="sh-logo" aria-label={APP_NAME} title={APP_NAME}>
              <img src="/logo-mark-white.png" alt="" aria-hidden="true" />
            </Link>
            <Link to="/" className={`sh-rb${isStudio ? "" : " on"}`} aria-label={`${APP_NAME}: Dashboard`} title={APP_NAME}><LayoutDashboard aria-hidden="true" /></Link>
            <Link to="/studio" className={`sh-rb${isStudio ? " on" : ""}`} aria-label="Story Studio" title="Story Studio"><Feather aria-hidden="true" /></Link>
          </nav>

          {isStudio ? (
          /* Story Studio fills the page, with its own list and panes */
          <div className="sh-studio">
            <Routes><Route path="/studio/*" element={<StudioHost />} /></Routes>
          </div>
          ) : (
          <>
          {/* the menu */}
          <aside className="sh-menu" aria-label="Menu" ref={menuRef}>
            <div className="sh-mh">
              <h2>{APP_NAME}</h2>
              <span className="sh-mh-acts">
                {allowed("create") && <Link to="/create" className="sh-add" title="Create post" aria-label="Create post"><Plus aria-hidden="true" /></Link>}
                <button type="button" className="sh-close" onClick={() => setMenuOpen(false)} aria-label="Close menu"><X aria-hidden="true" /></button>
              </span>
            </div>
            <nav className="sh-scroll" aria-label="Main">
              {NAV.map((group, gi) => (
                <div key={gi} className={`sh-group${group.phoneOnly ? " sh-phone-only" : ""}`}>
                  {group.title && <div className="sh-gh">{group.title}</div>}
                  {group.items.filter((item) => allowed(item.feature)).map(({ to, label, icon: Icon, end, badge }) => (
                    <NavLink key={to} to={to} end={end} className={({ isActive }) => `sh-it${isActive ? " active" : ""}`}>
                      <span className="sh-l"><Icon aria-hidden="true" /><span>{label}</span></span>
                      {badge && status?.counts?.[badge] > 0 && <span className="sh-cnt">{status.counts[badge]}</span>}
                    </NavLink>
                  ))}
                </div>
              ))}
            </nav>
            <div className="sh-foot">
              <span className={`sh-dot ${aiReady ? "ok" : "warn"}`} aria-hidden="true" />
              <span>{status ? (aiReady ? "AI connected" : "AI key missing in .env") : "Connecting…"}</span>
            </div>
          </aside>
          <Splitter className="sh-split-m" label="Resize the menu" min={200} max={420} grows="right"
                    getWidth={() => menuRef.current.getBoundingClientRect().width} onChange={setMenuW} onReset={resetMenuW} />

          <div className={`sh-work${hasRight ? " has-right" : ""}`}>
            <div className="sh-main">
              <header className="sh-crumbs">
                <nav className="sh-crumbnav" aria-label="Breadcrumb">
                  <button type="button" className="sh-burger" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu aria-hidden="true" /></button>
                  <span className="sh-mini" aria-hidden="true"><img src="/logo-mark-white.png" alt="" /></span>
                  <span className="sh-muted sh-hide-m">{APP_NAME}</span>
                  <span className="sh-sep sh-hide-m" aria-hidden="true">/</span>
                  <b>{pageName(pathname)}</b>
                </nav>
                {client && (
                  <label className="sh-chip" title="Switch client">
                    <span className="sh-av" aria-hidden="true">{client.name.slice(0, 1)}</span>
                    <span className="sh-cat">{client.category}</span>
                    <select className="sh-sel mr" value={client.id} onChange={(e) => switchClient(e.target.value)} aria-label="Current client">
                      {(status.clients || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <ChevronDown className="sh-chev" aria-hidden="true" />
                  </label>
                )}
              </header>

              <main className={`content${pathname === "/" ? " content-flush" : ""}`} key={clientKey}>
                {error && <div className="notice error">{error}</div>}
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/create" element={onlyFor("create", <CreatePost />)} />
                  <Route path="/festivals" element={onlyFor("festivals", <Festivals />)} />
                  <Route path="/events" element={onlyFor("events", <EventPage />)} />
                  <Route path="/reactions" element={onlyFor("reactions", <Reaction />)} />
                  <Route path="/approvals" element={<Approvals />} />
                  <Route path="/history" element={<History />} />
                  <Route path="/clients" element={<Clients onChanged={refresh} onSwitch={switchClient} />} />
                  <Route path="/templates" element={<Templates />} />
                </Routes>
              </main>
            </div>
            <aside className="sh-right" ref={setSlot} hidden={!hasRight} />
            {hasRight && <Splitter className="sh-split-r" label="Resize the right pane" min={300} max={640} grows="left"
                                   getWidth={() => slot.getBoundingClientRect().width} onChange={setRightW} onReset={resetRightW} />}
          </div>
          </>
          )}
        </div>
      </RightPaneContext.Provider>
    </StatusContext.Provider>
  );
}

function NotForCategory({ category }) {
  return (
    <div className="page">
      <div className="notice info">This page isn't used for {category ? `${category} clients` : "this client"}. Change the post types on the Clients page if needed.</div>
    </div>
  );
}