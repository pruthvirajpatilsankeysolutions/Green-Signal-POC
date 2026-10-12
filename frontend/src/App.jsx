import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import {
  CalendarHeart, Camera, CheckCircle2, ChevronRight, History as HistoryIcon, LayoutDashboard, Newspaper, Users,
} from "lucide-react";
import { api, getClientId, setClientId } from "./api.js";
import Dashboard from "./pages/Dashboard.jsx";
import Festivals from "./pages/Festivals.jsx";
import EventPage from "./pages/EventPage.jsx";
import Reaction from "./pages/Reaction.jsx";
import Approvals from "./pages/Approvals.jsx";
import History from "./pages/History.jsx";
import Clients from "./pages/Clients.jsx";

const StatusContext = createContext({ status: null, refresh: () => {} });
export const useStatus = () => useContext(StatusContext);

const APP_NAME = "Post desk";

// Navigation, grouped the way the work flows: create posts, then review them.
const NAV = [
  { items: [{ to: "/", label: "Dashboard", icon: LayoutDashboard, end: true }] },
  {
    title: "Create",
    items: [
      { to: "/festivals", label: "Festivals", icon: CalendarHeart },
      { to: "/events", label: "Events", icon: Camera },
      { to: "/reactions", label: "News reactions", icon: Newspaper },
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
    items: [{ to: "/clients", label: "Clients", icon: Users }],
  },
];

const PAGE_NAMES = {
  "/": "Dashboard", "/festivals": "Festivals", "/events": "Events",
  "/reactions": "News reactions", "/approvals": "Approvals", "/history": "History", "/clients": "Clients",
};

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

  return (
    <StatusContext.Provider value={{ status, refresh }}>
      <div className="app">
        <aside className="sidebar">
          <div className="logo">
            <span className="logo-mark" aria-hidden="true">पो</span>
            <span className="logo-name">{APP_NAME}</span>
          </div>

          <nav className="nav" aria-label="Main">
            {NAV.map((group, gi) => (
              <div key={gi} className="nav-group">
                {group.title && <div className="nav-title">{group.title}</div>}
                {group.items.map(({ to, label, icon: Icon, end, badge }) => (
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
              <span>{PAGE_NAMES[pathname] || ""}</span>
            </div>
            {client && (
              <label className="client-chip" title="Switch client">
                <span className="avatar" aria-hidden="true">{client.name.slice(0, 1)}</span>
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
              <Route path="/festivals" element={<Festivals />} />
              <Route path="/events" element={<EventPage />} />
              <Route path="/reactions" element={<Reaction />} />
              <Route path="/approvals" element={<Approvals />} />
              <Route path="/history" element={<History />} />
              <Route path="/clients" element={<Clients onChanged={refresh} onSwitch={switchClient} />} />
            </Routes>
          </main>
        </div>
      </div>
    </StatusContext.Provider>
  );
}