import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarHeart, Camera, CheckCircle2, Clock, Newspaper } from "lucide-react";
import { api } from "../api.js";
import { useStatus } from "../App.jsx";
import DateBlock from "../components/DateBlock.jsx";

export default function Dashboard() {
  const { status } = useStatus();
  const [waiting, setWaiting] = useState([]);

  useEffect(() => { api.drafts("waiting").then((d) => setWaiting(d.drafts)).catch(() => {}); }, []);

  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const stats = [
    { label: "Waiting for approval", value: status?.counts.waiting, icon: Clock, to: "/approvals", tone: "amber" },
    { label: "Approved, ready to post", value: status?.counts.approved, icon: CheckCircle2, to: "/approvals", tone: "green" },
    { label: "Occasions due now", value: status?.due.length, icon: CalendarHeart, to: "/festivals", tone: "blue" },
  ];

  return (
    <div className="page">
      <header className="page-head row">
        <div>
          <h1>Dashboard</h1>
          <p className="lead">{today}</p>
        </div>
        <div className="actions">
          <Link to="/events" className="btn"><Camera size={16} aria-hidden="true" /> New event post</Link>
          <Link to="/reactions" className="btn primary"><Newspaper size={16} aria-hidden="true" /> New news reaction</Link>
        </div>
      </header>

      {status?.calendar_errors?.length > 0 && (
        <div className="notice warning">festivals.csv has problems: {status.calendar_errors.join("; ")}</div>
      )}

      <div className="stats">
        {stats.map(({ label, value, icon: Icon, to, tone }) => (
          <Link key={label} to={to} className="stat">
            <span className={`stat-icon ${tone}`}><Icon size={18} aria-hidden="true" /></span>
            <span className="stat-value">{value ?? "–"}</span>
            <span className="stat-label">{label}</span>
          </Link>
        ))}
      </div>

      <div className="grid-2">
        <section className="card">
          <div className="card-head">
            <h2>Due now</h2>
            <Link to="/festivals" className="link">View calendar</Link>
          </div>
          {status?.due?.length ? (
            <ul className="list">
              {status.due.map((f) => (
                <li key={f.id} className="list-row">
                  <DateBlock date={f.date} />
                  <div className="list-text">
                    <span className="mr strong">{f.occasion_mr}</span>
                    <span className="muted">{f.days_left === 0 ? "Today" : `In ${f.days_left} days`}</span>
                  </div>
                  <Link className="btn small" to={`/festivals?id=${f.id}`}>Make poster</Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty">Nothing due in the next few days.</p>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Waiting for approval</h2>
            <Link to="/approvals" className="link">Open approvals</Link>
          </div>
          {waiting.length ? (
            <ul className="list">
              {waiting.slice(0, 5).map((d) => (
                <li key={d.id} className="list-row">
                  {d.image_urls[0] ? <img className="thumb-sm" src={d.image_urls[0]} alt="" /> : <span className="thumb-sm" />}
                  <div className="list-text">
                    <span className="mr strong ellipsis">{d.title}</span>
                    <span className="muted">{d.created_at}</span>
                  </div>
                  <Link className="btn small" to={`/approvals?id=${d.id}`}>Review</Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty">No posts waiting. Create one from Festivals, Events or News reactions.</p>
          )}
        </section>
      </div>
    </div>
  );
}