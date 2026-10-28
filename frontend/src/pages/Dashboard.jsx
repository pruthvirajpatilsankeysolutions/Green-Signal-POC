import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { Calendar, CalendarHeart, Camera, CheckCircle2, Clock, Feather, Newspaper } from "lucide-react";
import { api } from "../api.js";
import { useRightPane, useStatus } from "../App.jsx";

// Month above the day, as a small tile.
function DashDate({ date }) {
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return <span className="dash-date">{date}</span>;
  return (
    <span className="dash-date" aria-label={d.toDateString()}>
      <i>{d.toLocaleDateString("en-IN", { month: "short" })}</i>
      <b>{d.getDate()}</b>
    </span>
  );
}

export default function Dashboard() {
  const { status } = useStatus();
  const { slot, setHasRight } = useRightPane();
  const [waiting, setWaiting] = useState([]);

  useEffect(() => { api.drafts("waiting").then((d) => setWaiting(d.drafts)).catch(() => {}); }, []);
  // "Waiting for approval" is drawn in the pane on the right of the layout while this page is open
  useEffect(() => { setHasRight(true); return () => setHasRight(false); }, [setHasRight]);

  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const stats = [
    { label: "Waiting for approval", value: status?.counts.waiting, icon: Clock, to: "/approvals", tone: "indigo" },
    { label: "Approved, ready to post", value: status?.counts.approved, icon: CheckCircle2, to: "/approvals", tone: "green" },
    { label: "Occasions due now", value: status?.due.length, icon: CalendarHeart, to: "/festivals", tone: "amber" },
  ];

  const pane = (
    <>
      <div className="sh-rh">
        <h2>Waiting for approval</h2>
        <Link to="/approvals" className="dash-lk">Open approvals</Link>
      </div>
      {waiting.length ? (
        <ul className="dash-rl dash-rl-pane">
          {waiting.slice(0, 5).map((d) => (
            <li key={d.id}>
              {d.image_urls[0] ? <img className="dash-thumb" src={d.image_urls[0]} alt="" /> : <span className="dash-thumb" />}
              <div className="dash-tx">
                <b className="mr">{d.title}</b>
                <small>{d.created_at}</small>
              </div>
              <Link className="dash-btn sm" to={`/approvals?id=${d.id}`}>Review</Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="dash-empty dash-empty-pane">No posts waiting. Create one from Festivals, Events or News reactions.</p>
      )}
    </>
  );

  return (
    <div className="dash">
      <header className="dash-head">
        <div className="dash-t1">
          <h1 className="dash-title">Dashboard</h1>
          <div className="dash-acts">
            <Link to="/events" className="dash-btn"><Camera aria-hidden="true" /> New event post</Link>
            <Link to="/reactions" className="dash-btn k"><Newspaper aria-hidden="true" /> New news reaction</Link>
          </div>
        </div>
        <p className="dash-date-line"><Calendar aria-hidden="true" />{today}</p>
      </header>

      <div className="dash-cards">
        {status?.calendar_errors?.length > 0 && (
          <div className="notice warning">festivals.csv has problems: {status.calendar_errors.join("; ")}</div>
        )}

        <section className="dash-card dash-stats" aria-label="Overview">
          {stats.map(({ label, value, icon: Icon, to, tone }) => (
            <Link key={label} to={to} className="dash-stat">
              <span className={`dash-tile ${tone}`}><Icon aria-hidden="true" /></span>
              <span className="dash-sv">{value ?? "–"}</span>
              <span className="dash-sl">{label}</span>
            </Link>
          ))}
        </section>

        <section className="dash-card dash-studio">
          <span className="dash-tile indigo" aria-hidden="true"><Feather /></span>
          <div className="dash-tx">
            <h2>Story Studio</h2>
            <p>Develop a story or screenplay one stage at a time, with every stage approved by you.</p>
          </div>
          <Link className="dash-btn k sm2" to="/studio">Open Story Studio</Link>
        </section>

        <section className="dash-card">
          <div className="dash-ch">
            <CalendarHeart aria-hidden="true" />
            <h2>Due now</h2>
            <Link to="/festivals" className="dash-lk">View calendar</Link>
          </div>
          {status?.due?.length ? (
            <ul className="dash-rl">
              {status.due.map((f) => (
                <li key={f.id}>
                  <DashDate date={f.date} />
                  <div className="dash-tx">
                    <b className="mr">{f.occasion_mr}</b>
                    <small>{f.days_left === 0 ? "Today" : `In ${f.days_left} days`}</small>
                  </div>
                  <Link className="dash-btn sm" to={`/festivals?id=${f.id}`}>Make poster</Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="dash-empty">Nothing due in the next few days.</p>
          )}
        </section>
      </div>

      {slot && createPortal(pane, slot)}
    </div>
  );
}
