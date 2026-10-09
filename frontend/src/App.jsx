import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import {
  CalendarHeart, Camera, CheckCircle2, ChevronRight, History as HistoryIcon, LayoutDashboard, Newspaper,
} from "lucide-react";
import { api } from "./api.js";
import Dashboard from "./pages/Dashboard.jsx";
import Festivals from "./pages/Festivals.jsx";
import EventPage from "./pages/EventPage.jsx";
import Reaction from "./pages/Reaction.jsx";
import Approvals from "./pages/Approvals.jsx";
import History from "./pages/History.jsx";

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
];

const PAGE_NAMES = {
  "/": "Dashboard", "/festivals": "Festivals", "/events": "Events",
  "/reactions": "News reactions", "/approvals": "Approvals", "/history": "History",
};

export default function App() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");
  const { pathname } = useLocation();

  const refresh = useCallback(() => {
    api.status().then((s) => { setStatus(s); setError(""); })
      .catch(() => setError("Can't reach the server. Start the backend: uvicorn api.main:app --reload --port 8000"));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

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
              <div className="client-chip" title="Current client">
                <span className="avatar" aria-hidden="true">{client.name.slice(0, 1)}</span>
                <span className="client-text">
                  <span className="client-name">{client.name}</span>
                  <span className="client-handle">{client.handle}</span>
                </span>
              </div>
            )}
          </header>

          <main className="content">
            {error && <div className="notice error">{error}</div>}
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/festivals" element={<Festivals />} />
              <Route path="/events" element={<EventPage />} />
              <Route path="/reactions" element={<Reaction />} />
              <Route path="/approvals" element={<Approvals />} />
              <Route path="/history" element={<History />} />
            </Routes>
          </main>
        </div>
      </div>
    </StatusContext.Provider>
  );
}