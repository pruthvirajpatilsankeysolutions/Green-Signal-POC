import { Fragment } from "react";

// A small, safe Markdown renderer for stages and stories: headings, paragraphs, bold, italic, lists, rules.
// It builds React elements (never raw HTML), so nothing the AI writes can run as code.
function inline(text, key) {
  const parts = [];
  const re = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;
  let last = 0, m, i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const t = m[0];
    parts.push(t.startsWith("**") ? <strong key={`${key}-${i++}`}>{t.slice(2, -2)}</strong> : <em key={`${key}-${i++}`}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export default function Markdown({ text }) {
  const lines = String(text || "").replace(/\r/g, "").split("\n");
  const blocks = [];
  let para = [], list = null;
  const flushPara = () => { if (para.length) { blocks.push({ type: "p", text: para.join(" ") }); para = []; } };
  const flushList = () => { if (list) { blocks.push(list); list = null; } };
  for (const raw of lines) {
    const line = raw.trimEnd();
    let m;
    if (!line.trim()) { flushPara(); flushList(); continue; }
    if ((m = line.match(/^(#{1,4})\s+(.*)$/))) { flushPara(); flushList(); blocks.push({ type: "h", level: m[1].length, text: m[2] }); continue; }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) { flushPara(); flushList(); blocks.push({ type: "hr" }); continue; }
    if ((m = line.match(/^\s*[-*•]\s+(.*)$/))) { flushPara(); if (!list || list.ordered) { flushList(); list = { type: "list", ordered: false, items: [] }; } list.items.push(m[1]); continue; }
    if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) { flushPara(); if (!list || !list.ordered) { flushList(); list = { type: "list", ordered: true, items: [] }; } list.items.push(m[1]); continue; }
    flushList();
    para.push(line.trim());
  }
  flushPara(); flushList();
  return (
    <div className="md">
      {blocks.map((b, i) => {
        if (b.type === "h") { const H = `h${Math.min(b.level + 1, 5)}`; return <H key={i}>{inline(b.text, i)}</H>; }
        if (b.type === "hr") return <hr key={i} />;
        if (b.type === "list") { const L = b.ordered ? "ol" : "ul"; return <L key={i}>{b.items.map((it, j) => <li key={j}>{inline(it, `${i}-${j}`)}</li>)}</L>; }
        return <p key={i}>{inline(b.text, i)}</p>;
      })}
    </div>
  );
}

export const Plain = ({ text }) => <Fragment>{text}</Fragment>;
