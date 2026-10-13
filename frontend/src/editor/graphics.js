// Original festive and business graphics (drawn for this app, free to use).
// Each is an SVG string; the editor turns it into an editable group with loadSVGFromString.

const petals = (cx, cy, n, rx, ry, dist, fill, rot = 0) =>
  Array.from({ length: n }, (_, i) => {
    const a = (360 / n) * i + rot;
    return `<ellipse cx="${cx}" cy="${cy - dist}" rx="${rx}" ry="${ry}" fill="${fill}" transform="rotate(${a} ${cx} ${cy})"/>`;
  }).join("");

const marigold = (cx, cy, r) =>
  `${petals(cx, cy, 14, r * 0.28, r * 0.5, r * 0.55, "#E8590C")}${petals(cx, cy, 12, r * 0.24, r * 0.42, r * 0.38, "#F59F00", 15)}` +
  `${petals(cx, cy, 10, r * 0.18, r * 0.3, r * 0.2, "#FCC419", 8)}<circle cx="${cx}" cy="${cy}" r="${r * 0.18}" fill="#E67700"/>`;

const leaf = (x, y, rot) =>
  `<path d="M0 0 C 10 18, 10 40, 0 58 C -10 40, -10 18, 0 0 Z" fill="#2B8A3E" transform="translate(${x} ${y}) rotate(${rot})"/>` +
  `<path d="M0 4 L0 54" stroke="#69DB7C" stroke-width="2" transform="translate(${x} ${y}) rotate(${rot})"/>`;

export const GRAPHICS = [
  {
    name: "Diya", svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <path d="M100 18 C 120 52, 126 78, 100 104 C 74 78, 80 52, 100 18 Z" fill="#FFB703"/>
      <path d="M100 46 C 110 66, 112 80, 100 96 C 88 80, 90 66, 100 46 Z" fill="#FFF3B0"/>
      <path d="M22 112 Q 100 112 178 112 Q 168 176 100 180 Q 32 176 22 112 Z" fill="#C2410C"/>
      <path d="M22 112 Q 100 128 178 112 Q 100 100 22 112 Z" fill="#7C2D12"/>
      <path d="M40 138 Q 100 150 160 138" stroke="#FDBA74" stroke-width="5" fill="none"/>
      <circle cx="70" cy="156" r="5" fill="#FDBA74"/><circle cx="100" cy="160" r="5" fill="#FDBA74"/><circle cx="130" cy="156" r="5" fill="#FDBA74"/>
    </svg>` },
  { name: "Marigold", svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">${marigold(100, 100, 92)}</svg>` },
  {
    name: "Toran", svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 150">
      <path d="M0 18 Q 300 48 600 18" stroke="#B45309" stroke-width="6" fill="none"/>
      ${Array.from({ length: 9 }, (_, i) => {
        const x = 30 + i * 67; const y = 18 + Math.sin((x / 600) * Math.PI) * 30;
        return i % 2 === 0 ? `<line x1="${x}" y1="${y}" x2="${x}" y2="${y + 40}" stroke="#B45309" stroke-width="3"/>${marigold(x, y + 62, 30)}`
          : leaf(x, y, 0);
      }).join("")}
    </svg>` },
  {
    name: "Rangoli", svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      ${petals(100, 100, 8, 20, 44, 52, "#E64980")}${petals(100, 100, 8, 16, 34, 52, "#FFD43B", 22.5)}
      ${petals(100, 100, 8, 10, 24, 30, "#7950F2")}<circle cx="100" cy="100" r="22" fill="#12B886"/>
      <circle cx="100" cy="100" r="12" fill="#FFF"/><circle cx="100" cy="100" r="6" fill="#F76707"/>
      ${Array.from({ length: 16 }, (_, i) => { const a = (Math.PI * 2 * i) / 16; return `<circle cx="${100 + Math.cos(a) * 94}" cy="${100 + Math.sin(a) * 94}" r="4" fill="#F76707"/>`; }).join("")}
    </svg>` },
  {
    name: "Kalash", svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -20 200 240">
      ${leaf(88, 62, 140)}${leaf(112, 62, 220)}${leaf(76, 68, 115)}${leaf(124, 68, 245)}
      <circle cx="100" cy="46" r="28" fill="#8D5524"/><path d="M84 30 Q 100 16 116 30" stroke="#6B3F1D" stroke-width="5" fill="none"/>
      <path d="M70 70 L130 70 L124 86 L76 86 Z" fill="#D9480F"/>
      <path d="M76 86 C 30 100, 30 190, 100 200 C 170 190, 170 100, 124 86 Z" fill="#E8590C"/>
      <path d="M50 140 Q 100 156 150 140" stroke="#FFD43B" stroke-width="6" fill="none"/>
      <path d="M94 116 L100 104 L106 116 L118 118 L109 126 L112 138 L100 132 L88 138 L91 126 L82 118 Z" fill="#FFD43B"/>
    </svg>` },
  {
    name: "Bhagwa flag", svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 220">
      <rect x="18" y="10" width="8" height="205" rx="4" fill="#6B4423"/><circle cx="22" cy="10" r="8" fill="#F59F00"/>
      <path d="M26 20 L150 62 L74 74 L150 108 L26 120 Z" fill="#F76707"/>
      <path d="M26 20 L150 62 L74 74" fill="#FF922B"/>
    </svg>` },
  {
    name: "Lotus", svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 160">
      <path d="M110 20 C 140 60, 140 110, 110 140 C 80 110, 80 60, 110 20 Z" fill="#F783AC"/>
      <path d="M110 140 C 70 130, 40 96, 44 56 C 80 66, 104 100, 110 140 Z" fill="#E64980"/>
      <path d="M110 140 C 150 130, 180 96, 176 56 C 140 66, 116 100, 110 140 Z" fill="#E64980"/>
      <path d="M110 140 C 60 146, 18 128, 6 100 C 46 94, 86 110, 110 140 Z" fill="#C2255C"/>
      <path d="M110 140 C 160 146, 202 128, 214 100 C 174 94, 134 110, 110 140 Z" fill="#C2255C"/>
    </svg>` },
  {
    name: "Gold divider", svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 60">
      <path d="M20 30 L250 30" stroke="#D4A017" stroke-width="3"/><path d="M350 30 L580 30" stroke="#D4A017" stroke-width="3"/>
      <path d="M250 30 C 262 14, 278 14, 284 30 C 278 46, 262 46, 250 30 Z" fill="none" stroke="#D4A017" stroke-width="3"/>
      <path d="M350 30 C 338 14, 322 14, 316 30 C 322 46, 338 46, 350 30 Z" fill="none" stroke="#D4A017" stroke-width="3"/>
      <path d="M300 12 L314 30 L300 48 L286 30 Z" fill="#D4A017"/><circle cx="20" cy="30" r="5" fill="#D4A017"/><circle cx="580" cy="30" r="5" fill="#D4A017"/>
    </svg>` },
  {
    name: "Corner flourish", svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <path d="M10 190 L10 60 C 10 30, 30 10, 60 10 L190 10" stroke="#D4A017" stroke-width="5" fill="none"/>
      <path d="M30 170 L30 70 C 30 46, 46 30, 70 30 L170 30" stroke="#D4A017" stroke-width="2" fill="none"/>
      <path d="M60 60 C 90 40, 120 60, 100 80 C 84 96, 64 80, 76 68" stroke="#D4A017" stroke-width="4" fill="none"/>
      <circle cx="10" cy="190" r="6" fill="#D4A017"/><circle cx="190" cy="10" r="6" fill="#D4A017"/>
    </svg>` },
  {
    name: "Sun rays", svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
      ${Array.from({ length: 24 }, (_, i) => `<path d="M200 200 L${200 + Math.cos((i * 15 - 3) * Math.PI / 180) * 200} ${200 + Math.sin((i * 15 - 3) * Math.PI / 180) * 200} L${200 + Math.cos((i * 15 + 3) * Math.PI / 180) * 200} ${200 + Math.sin((i * 15 + 3) * Math.PI / 180) * 200} Z" fill="#FFD43B" opacity="0.45"/>`).join("")}
    </svg>` },
  {
    name: "Sparkles", svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <path d="M100 10 C 106 70, 130 94, 190 100 C 130 106, 106 130, 100 190 C 94 130, 70 106, 10 100 C 70 94, 94 70, 100 10 Z" fill="#FFD43B"/>
      <path d="M160 20 C 162 38, 170 44, 186 46 C 170 48, 162 56, 160 72 C 158 56, 150 48, 134 46 C 150 44, 158 38, 160 20 Z" fill="#FFE066"/>
      <path d="M40 140 C 42 156, 48 162, 62 164 C 48 166, 42 172, 40 188 C 38 172, 32 166, 18 164 C 32 162, 38 156, 40 140 Z" fill="#FFE066"/>
    </svg>` },
  {
    name: "Confetti", svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200">
      ${Array.from({ length: 34 }, (_, i) => {
        const colors = ["#F03E3E", "#F59F00", "#37B24D", "#1C7ED6", "#AE3EC9", "#F06595"];
        const x = (i * 83) % 290 + 5; const y = (i * 47) % 190 + 5; const c = colors[i % colors.length];
        return i % 3 === 0 ? `<circle cx="${x}" cy="${y}" r="5" fill="${c}"/>` : `<rect x="${x}" y="${y}" width="12" height="6" fill="${c}" transform="rotate(${(i * 37) % 180} ${x} ${y})"/>`;
      }).join("")}
    </svg>` },
  {
    name: "Moon and star", svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <path d="M120 20 A 80 80 0 1 0 180 140 A 64 64 0 1 1 120 20 Z" fill="#FFD43B"/>
      <path d="M150 50 L156 66 L172 66 L159 76 L164 92 L150 82 L136 92 L141 76 L128 66 L144 66 Z" fill="#FFE066"/>
    </svg>` },
  {
    name: "Laurel", svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 200">
      <path d="M110 190 C 40 170, 20 100, 50 30" stroke="#B08900" stroke-width="4" fill="none"/>
      <path d="M110 190 C 180 170, 200 100, 170 30" stroke="#B08900" stroke-width="4" fill="none"/>
      ${[[52, 160, -30], [36, 128, -10], [30, 94, 5], [36, 60, 20], [48, 34, 35]].map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="9" ry="20" fill="#D4A017" transform="rotate(${r} ${x} ${y})"/><ellipse cx="${x + 18}" cy="${y + 4}" rx="8" ry="18" fill="#E5B92A" transform="rotate(${r + 60} ${x + 18} ${y + 4})"/>`).join("")}
      ${[[168, 160, 30], [184, 128, 10], [190, 94, -5], [184, 60, -20], [172, 34, -35]].map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="9" ry="20" fill="#D4A017" transform="rotate(${r} ${x} ${y})"/><ellipse cx="${x - 18}" cy="${y + 4}" rx="8" ry="18" fill="#E5B92A" transform="rotate(${r - 60} ${x - 18} ${y + 4})"/>`).join("")}
    </svg>` },
  {
    name: "Gift box", svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <rect x="30" y="80" width="140" height="110" rx="6" fill="#E03131"/><rect x="20" y="60" width="160" height="34" rx="6" fill="#F03E3E"/>
      <rect x="90" y="60" width="20" height="130" fill="#FFD43B"/>
      <path d="M100 60 C 70 20, 40 40, 60 58 Z M100 60 C 130 20, 160 40, 140 58 Z" fill="#FFD43B"/>
    </svg>` },
  {
    name: "Offer tag", svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 140">
      <path d="M50 10 L230 10 L230 130 L50 130 L10 70 Z" fill="#E03131"/>
      <circle cx="40" cy="70" r="9" fill="#FFF"/>
      <path d="M60 20 L220 20 L220 120 L60 120" fill="none" stroke="#FFD43B" stroke-width="3" stroke-dasharray="8 6"/>
    </svg>` },
];

// Ready-made labels: a shape with Marathi or English text on it (moved and resized together)
export const BADGES = [
  { text: "नवीन", shape: "starburst", fill: "#E03131", color: "#FFFFFF" },
  { text: "ऑफर", shape: "pill", fill: "#F59F00", color: "#1B1B1B" },
  { text: "सवलत", shape: "pill", fill: "#2B8A3E", color: "#FFFFFF" },
  { text: "मोफत", shape: "circle", fill: "#1C7ED6", color: "#FFFFFF" },
  { text: "आजच भेट द्या", shape: "pill", fill: "#1F2347", color: "#FFC94A" },
  { text: "SALE", shape: "starburst", fill: "#F03E3E", color: "#FFFFFF" },
];