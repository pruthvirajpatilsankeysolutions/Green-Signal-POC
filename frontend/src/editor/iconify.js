// Iconify (https://iconify.design/docs/api/): icon sets and icons for the Elements tab. The public API sends
// CORS headers, so the editor calls it straight from the browser; an icon is fetched as SVG text on click.
// Only sets with permissive licences that need no credit (MIT / Apache / ISC) are offered.

export const API = "https://api.iconify.design";

const ALL_SETS = "lucide,tabler,mdi,noto,fluent-emoji-flat";

// A category is a tile on the "Browse categories" grid. It lists either whole icon sets (`sets`) or
// search words (`queries`) answered by the search endpoint across ALL_SETS.
export const CATEGORIES = [
  { id: "shapes", label: "Shapes", builtin: true, from: "#22D3EE", to: "#2563EB",
    previewPath: "M50 5L61 38H95L68 58L78 92L50 71L22 92L32 58L5 38H39Z" },
  { id: "tables", label: "Tables", builtin: true, from: "#F472B6", to: "#9333EA", previewPath: "M12 16H88V84H12Z M12 39H88 M12 62H88 M37 16V84 M63 16V84", outline: true },
  { id: "icons", label: "Icons", sample: "lucide:sparkles", from: "#14B8A6", to: "#0E7490",
    sets: [["lucide", "Lucide"], ["tabler", "Tabler"], ["mdi", "Material"]] },
  { id: "emoji", label: "Emoji", sample: "noto:smiling-face-with-smiling-eyes", from: "#FBBF24", to: "#F97316",
    sets: [["noto", "Noto"], ["fluent-emoji-flat", "Fluent"]] },
  { id: "festive", label: "Festive", sample: "noto:diya-lamp", from: "#FB923C", to: "#DC2626",
    queries: ["flower", "lamp", "gift", "balloon", "party", "candle", "sparkles", "cake", "temple", "confetti", "lantern", "star"] },
  { id: "flags", label: "Flags", sample: "circle-flags:in", from: "#60A5FA", to: "#4F46E5",
    sets: [["circle-flags", "Round"], ["flag", "Rectangle"]] },
  { id: "business", label: "Business", sample: "lucide:briefcase", from: "#34D399", to: "#047857",
    queries: ["chart", "money", "briefcase", "megaphone", "phone", "mail", "location", "calendar", "user", "building"] },
  { id: "arrows", label: "Arrows", sample: "lucide:arrow-right", from: "#A78BFA", to: "#6D28D9",
    queries: ["arrow", "chevron", "cursor", "refresh", "trending", "play"] },
  { id: "nature", label: "Nature", sample: "noto:sunflower", from: "#4ADE80", to: "#15803D",
    queries: ["tree", "leaf", "sun", "moon", "cloud", "mountain", "rain", "sunflower"] },
];

const get = async (path) => {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error("The icon library did not answer. Check the internet connection and try again.");
  return res.json();
};

// one icon set -> [{ name, icons: ["prefix:icon", ...] }], in the set's own groups
const sets = new Map();
export async function fetchSet(prefix) {
  if (!sets.has(prefix)) {
    const d = await get(`/collection?prefix=${prefix}`);
    const groups = Object.entries(d.categories || {}).map(([name, list]) => ({ name, icons: list.map((n) => `${prefix}:${n}`) }));
    if (d.uncategorized?.length) groups.push({ name: groups.length ? "Other" : "All", icons: d.uncategorized.map((n) => `${prefix}:${n}`) });
    sets.set(prefix, groups);
  }
  return sets.get(prefix);
}

export async function searchIcons(query, prefixes = ALL_SETS) {
  const d = await get(`/search?query=${encodeURIComponent(query)}&limit=96&prefixes=${prefixes}`);
  return d.icons || [];
}

// Icon artwork comes in bulk, one request per set and page (/{prefix}.json?icons=a,b,c), not one image per icon:
// the public API answers 429 when a grid asks for dozens of single SVGs at once.
const artwork = new Map();                    // "prefix:name" -> { body, width, height }
const CHUNK = 48;

export async function loadIcons(ids) {
  const missing = ids.filter((id) => !artwork.has(id));
  const byPrefix = {};
  missing.forEach((id) => { const [p, n] = id.split(":"); (byPrefix[p] ||= []).push(n); });
  await Promise.all(Object.entries(byPrefix).flatMap(([prefix, names]) =>
    Array.from({ length: Math.ceil(names.length / CHUNK) }, (_, i) => names.slice(i * CHUNK, (i + 1) * CHUNK)).map(async (chunk) => {
      const d = await get(`/${prefix}.json?icons=${chunk.join(",")}`);
      const [w, h] = [d.width || 16, d.height || 16];
      const add = (name, icon) => artwork.set(`${prefix}:${name}`, { body: icon.body, width: icon.width || w, height: icon.height || h });
      Object.entries(d.icons || {}).forEach(([name, icon]) => add(name, icon));
      Object.entries(d.aliases || {}).forEach(([name, a]) => { const base = d.icons?.[a.parent]; if (base) add(name, { ...base, ...a }); });
    })));
}

export const hasIcon = (id) => artwork.has(id);

// an icon as SVG text; `color` replaces currentColor in single-colour sets (multicolour sets keep their own)
export function iconSvg(id, { color = "#374151", size } = {}) {
  const a = artwork.get(id);
  if (!a) return "";
  const dim = size ? ` width="${size}" height="${Math.round((size * a.height) / a.width)}"` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${a.width} ${a.height}"${dim}>${a.body.replaceAll("currentColor", color)}</svg>`;
}
