import { useEffect, useState } from "react";
import { api } from "../api.js";
import Notice from "../components/Notice.jsx";
import Segmented from "../components/Segmented.jsx";

const FILTERS = [
  { value: "", label: "All" },
  { value: "waiting", label: "Waiting" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];
const TYPE_NAMES = { festival: "Festival", event: "Event", reaction: "News reaction" };

export default function History() {
  const [filter, setFilter] = useState("");
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => { api.drafts(filter).then((d) => setRows(d.drafts)).catch((e) => setError(e.message)); }, [filter]);

  return (
    <div className="page">
      <header className="page-head">
        <h1>History</h1>
        <p className="lead">Every post and what happened to it.</p>
      </header>
      <Notice kind="error">{error}</Notice>
      <Segmented label="Filter by status" options={FILTERS} value={filter} onChange={setFilter} />

      <div className="table-wrap panel">
        <table>
          <thead>
            <tr><th>Created</th><th>Type</th><th>Post</th><th>Status</th><th>Version</th><th>Approved</th></tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id}>
                <td className="nowrap">{d.created_at}</td>
                <td>{TYPE_NAMES[d.type]}</td>
                <td className="mr">{d.title}</td>
                <td><span className={`tag status-${d.status}`}>{d.status}</span></td>
                <td>{d.version}</td>
                <td className="nowrap">{d.approved_at || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="empty">No posts here yet.</p>}
      </div>
    </div>
  );
}