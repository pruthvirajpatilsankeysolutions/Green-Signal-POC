import { Link } from "react-router-dom";
import { ExternalLink, Palette } from "lucide-react";
import Notice from "./Notice.jsx";

// Shown after a post is created: where it went, and buttons to open it.
export default function CreatedNotice({ draft, label = "Post" }) {
  return (
    <div className="created">
      <Notice kind="success">{label} created. It is waiting on the Approvals page.</Notice>
      <div className="actions">
        <Link className="btn small primary" to={`/approvals?id=${draft.id}`}><ExternalLink size={14} aria-hidden="true" /> Open in Approvals</Link>
        <Link className="btn small" to={`/editor/${draft.id}`}><Palette size={14} aria-hidden="true" /> Edit design</Link>
      </div>
    </div>
  );
}