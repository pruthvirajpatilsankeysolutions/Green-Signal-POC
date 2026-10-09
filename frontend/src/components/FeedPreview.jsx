import { useState } from "react";
import { Bookmark, ChevronLeft, ChevronRight, Heart, MessageCircle, Send } from "lucide-react";
import { useStatus } from "../App.jsx";

// Shows a post the way it will look in the Instagram feed: images on top, caption below.
export default function FeedPreview({ draft }) {
  const { status } = useStatus();
  const [index, setIndex] = useState(0);
  const urls = draft.image_urls || [];
  const handle = (status?.client?.handle || "account").replace(/^[@/]/, "");
  const count = urls.length;

  return (
    <article className="feed">
      <header className="feed-head">
        <span className="feed-avatar" aria-hidden="true">{(status?.client?.name || "?").slice(0, 1)}</span>
        <span className="feed-handle">{handle}</span>
      </header>

      <div className="feed-media">
        {count > 0 ? (
          <a href={urls[index]} target="_blank" rel="noreferrer" title="Open full size">
            <img src={urls[index]} alt={`${draft.title}, image ${index + 1} of ${count}`} />
          </a>
        ) : (
          <div className="feed-empty">No image</div>
        )}
        {count > 1 && (
          <>
            <button className="feed-nav prev" onClick={() => setIndex((index - 1 + count) % count)} aria-label="Previous image">
              <ChevronLeft size={18} />
            </button>
            <button className="feed-nav next" onClick={() => setIndex((index + 1) % count)} aria-label="Next image">
              <ChevronRight size={18} />
            </button>
            <span className="feed-count">{index + 1}/{count}</span>
          </>
        )}
      </div>

      <div className="feed-actions" aria-hidden="true">
        <Heart size={20} /><MessageCircle size={20} /><Send size={20} />
        <Bookmark size={20} className="push" />
      </div>
      {count > 1 && (
        <div className="feed-dots" aria-hidden="true">
          {urls.map((u, i) => <span key={u} className={i === index ? "on" : ""} />)}
        </div>
      )}

      <div className="feed-caption">
        <strong>{handle}</strong>{" "}
        <span className="caption-text">{draft.caption}</span>
        {draft.hashtags?.length > 0 && <p className="feed-tags">{draft.hashtags.join(" ")}</p>}
      </div>
    </article>
  );
}