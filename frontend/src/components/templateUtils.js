// Helpers shared by the template picker and the template gallery.

// "diwali-2027" -> "diwali": a template made for a festival works every year
export const baseId = (x) => String(x || "").replace(/-\d{4}$/, "");

export function orientation(t) {
  const r = (t.width || 1) / (t.height || 1);
  if (r > 1.05) return "Landscape";
  if (r >= 0.95) return "Square";
  if (r < 0.62) return "Story";
  return "Portrait";
}

const RATIOS = [["1:1", 1], ["4:5", 0.8], ["3:4", 0.75], ["9:16", 0.5625], ["16:9", 1.7778], ["5:4", 1.25], ["4:3", 1.3333]];
export function ratioLabel(t) {
  const r = (t.width || 1) / (t.height || 1);
  const [label, v] = RATIOS.reduce((best, cur) => (Math.abs(cur[1] - r) < Math.abs(best[1] - r) ? cur : best));
  return Math.abs(v - r) / v < 0.04 ? label : "";
}

export function sizeText(t) {
  const px = `${Math.round(t.width)} × ${Math.round(t.height)}`;
  const ratio = ratioLabel(t);
  return ratio ? `${ratio} · ${px}` : px;
}

// made for this festival / this kind of post
export const madeFor = (t, occasion, postType) =>
  (t.occasions || []).some((o) => (occasion && baseId(o) === baseId(occasion)) || (postType && o === postType));

const recentKey = (clientId) => `postcraft:recent-templates:${clientId}`;
export function getRecent(clientId) {
  try { const v = JSON.parse(localStorage.getItem(recentKey(clientId)) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
}
export function pushRecent(clientId, id) {
  if (!id) return;
  try { localStorage.setItem(recentKey(clientId), JSON.stringify([id, ...getRecent(clientId).filter((x) => x !== id)].slice(0, 8))); } catch { /* storage off */ }
}

// add what the picker and the gallery need to show, filter and sort a template
export function decorate(list, { occasion, postType, recent }) {
  return list.map((t) => {
    const slots = t.slots || [];
    const shape = orientation(t);
    const forThis = madeFor(t, occasion, postType);
    const hasLogo = slots.includes("logo");
    const hasPhoto = slots.includes("photo");
    return {
      ...t, shape, forThis, hasLogo, hasPhoto, size: sizeText(t),
      recentRank: recent.indexOf(t.id),
      haystack: [t.name, shape, sizeText(t), hasLogo ? "logo" : "", hasPhoto ? "photo picture" : "", forThis ? "made for this festival" : ""].join(" ").toLowerCase(),
    };
  });
}
