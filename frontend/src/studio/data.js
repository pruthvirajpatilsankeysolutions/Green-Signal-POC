// Plain helpers the pages share: stage names, how to word a state, relative times, short notes about an approved stage.
export const STAGE_LABELS = ["Concept", "Logline", "Characters", "Conflict", "Ending", "Structure", "Beats", "Outline", "Story", "Screenplay"];
export const STATE = { your: ["Your turn", "your"], bad: ["Needs attention", "bad"], ok: ["Validated", "ok"], working: ["Working…", "work"] };
export const LENGTH = { Short: "About 1,000 words", Medium: "About 2,500 words", Long: "About 4,500 words" };

export const STAGE_HELP = {
  concept: "About 200 words: the world, the central situation, what makes this take fresh and the emotional core. It states the concrete facts plainly (the city, where everyone lives, the time frame, what happened before), because a vague setting causes contradictions later.",
  logline: "One sentence: who wants what, what stands in the way, and what happens if they fail. Then a short line on why it works.",
  characters: "A protagonist, an antagonist and two to four supporting characters, each with a Want, Need, Fear, Flaw and Arc that can visibly happen in this story.",
  conflict: "The external and internal conflict, the relationship at its centre, the stakes and the ticking clock.",
  ending: "The chosen ending with its final image, and two alternatives with the reason they are weaker.",
  structure: "The acts (or halves, for a feature film): the purpose of each, its turning points and its share of the story.",
  beats: "A numbered beat sheet from the opening image to the final image. Every character arc gets a payoff and the approved ending's key actions appear exactly as approved.",
  outline: "A scene-by-scene outline under act headings. Every beat appears in a scene, and every important event has its cause shown earlier.",
  story: "The complete story, written from the approved outline, then checked and validated against everything you approved.",
};

export function rel(ts) {
  const d = Date.now() / 1000 - ts;
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d / 60)} min ago`;
  if (d < 86400) return `${Math.floor(d / 3600)} h ago`;
  const days = Math.floor(d / 86400);
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  return new Date(ts * 1000).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}

export const words = (t) => (String(t || "").match(/[\p{L}\p{N}']+/gu) || []).length;

// "186 words", "5 characters", "15 beats" ... one short line about an approved stage
export function stageNote(key, text) {
  const raw = String(text || "");
  const plain = raw.replace(/[*_#>`]/g, "").replace(/\s+/g, " ").trim();
  const count = (re) => (raw.match(re) || []).length;
  if (key === "concept") return `${words(plain)} words`;
  if (key === "characters") { const n = (raw.match(/\*\*[^*\n]+\*\*/g) || []).filter((x) => !/^\*\*(want|need|fear|flaw|arc)\b/i.test(x)).length; return n ? `${n} characters` : `${words(plain)} words`; }
  if (key === "beats") { const n = count(/^\s*\d+[.)]\s/gm); return n ? `${n} beats` : `${words(plain)} words`; }
  if (key === "outline") { const n = (raw.match(/^\s*(?:\d+[.)]\s*|[-*]\s*)?\*\*[^*\n]+\*\*/gm) || []).filter((l) => !/^\s*#/.test(l)).length; return n ? `${n} scenes` : `${words(plain)} words`; }
  if (key === "structure") { const n = count(/\bact\b/gi); return n ? `${n} acts` : "Structure"; }
  return plain.length > 90 ? plain.slice(0, 87) + "…" : plain;
}

// how far along a story is, for sorting
export const progressOf = (s) => (s.has_screenplay ? 1.1 : s.state === "ok" ? 1 : s.state === "bad" ? 0.95 : s.has_story ? 0.9 : s.approved / 9);
export const rowState = (s) => (s.working ? "working" : s.state);

export const PROBLEM_TYPES = {
  character_contradiction: "A character contradicts the canon", relationship_contradiction: "A relationship contradicts the canon", ending_contradiction: "The ending differs from the approved ending",
  major_event_contradiction: "An important event contradicts itself", location_contradiction: "A location contradiction", temporal_contradiction: "Things happen out of order",
  missing_causal_event: "An important event has no shown cause", missing_object_origin: "An object is used without being obtained", missing_information_origin: "Information is used without being learned",
  unauthorized_major_character: "A new major character was added", unauthorized_major_plot_device: "A new major plot device was added", reintroduced_rejected_element: "Something you removed came back", other: "A problem",
};

// what the validator's repair did, in a sentence
export function repairNote(r) {
  if (!r || !r.attempted) return "";
  if (r.kept === "draft") return `A repair was tried but made things ${r.reason ? "worse (" + r.reason + ")" : "worse"}, so your earlier draft was kept.`;
  return `Repaired once: ${r.before.hard} ${r.before.hard === 1 ? "problem" : "problems"} became ${r.after.hard}. Some problems remain.`;
}
