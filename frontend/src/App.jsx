import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import {
  CalendarHeart, Camera, CheckCircle2, ChevronRight, History as HistoryIcon, LayoutDashboard, Newspaper, PlusSquare, Users, LayoutTemplate,
} from "lucide-react";
import { api, getClientId, setClientId } from "./api.js";
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
      <div className="app">
        <aside className="sidebar">
          <div className="logo">
            <img className="logo-img" src="/logo.png" alt="" aria-hidden="true" />
            <span className="logo-name">{APP_NAME}</span>
          </div>

          <nav className="nav" aria-label="Main">
            {NAV.map((group, gi) => (
              <div key={gi} className="nav-group">
                {group.title && <div className="nav-title">{group.title}</div>}
                {group.items.filter((item) => allowed(item.feature)).map(({ to, label, icon: Icon, end, badge }) => (
                  <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
                    <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
                    <span>{label}</span>
                    {badge && status?.counts?.[badge] > 0 && <span className="nav-count">{status.counts[badge]}</span>}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>

          <div className="sidebar-foot">
            <span className={`dot ${aiReady ? "ok" : "warn"}`} aria-hidden="true" />
            <span>{status ? (aiReady ? "AI connected" : "AI key missing in .env") : "Connecting…"}</span>
          </div>
        </aside>

        <div className="workspace">
          <header className="topbar">
            <div className="crumbs">
              <span className="crumb-muted">{client?.name || "Workspace"}</span>
              <ChevronRight size={14} aria-hidden="true" className="crumb-sep" />
              <span>{pageName(pathname)}</span>
            </div>
            {client && (
              <label className="client-chip" title="Switch client">
                <span className="avatar" aria-hidden="true">{client.name.slice(0, 1)}</span>
                <span className="client-cat">{client.category}</span>
                <select className="client-select" value={client.id} onChange={(e) => switchClient(e.target.value)}
                  aria-label="Current client">
                  {(status.clients || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
            )}
          </header>

          <main className="content" key={clientKey}>
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
      </div>
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