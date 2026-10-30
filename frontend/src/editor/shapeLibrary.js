// Shapes panel (like Canva's): every shape is an SVG path in a 100 x 100 box. Most are computed from a few
// numbers; the rest are short hand-written paths. makeShapePath turns one into an editable Fabric Path.
import { Path } from "fabric";

const round = (n) => Math.round(n * 10) / 10;
const poly = (pts) => `M${pts.map(([x, y]) => `${round(x)} ${round(y)}`).join("L")}Z`;
const onCircle = (n, r, rot = -90, cx = 50, cy = 50) =>
  Array.from({ length: n }, (_, i) => {
    const a = ((360 / n) * i + rot) * (Math.PI / 180);
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
const regular = (n, rot) => poly(onCircle(n, 46, rot));
const star = (n, inner) => poly(Array.from({ length: n * 2 }, (_, i) => onCircle(n * 2, i % 2 ? inner : 48)[i]));
const scallop = (n, a = 48, b = 42) => poly(Array.from({ length: n * 4 }, (_, i) => onCircle(n * 4, [a, a, b, b][i % 4])[i]));
const gear = (teeth) => poly(Array.from({ length: teeth * 4 }, (_, i) => onCircle(teeth * 4, [48, 48, 36, 36][i % 4], -90 - 360 / (teeth * 8))[i]));
const flower = (petals) => onCircle(petals, 27).map(([x, y]) => `M${round(x + 20)} ${round(y)}a20 20 0 1 0 -40 0a20 20 0 1 0 40 0Z`).join("") + "M50 30a20 20 0 1 0 .01 0Z";
const flipX = (pts) => pts.map(([x, y]) => [100 - x, y]);
const swapXY = (pts) => pts.map(([x, y]) => [y, x]);

const RIGHT = [[5, 35], [55, 35], [55, 10], [95, 50], [55, 90], [55, 65], [5, 65]];

export const SHAPE_GROUPS = [
  { name: "Basic", shapes: [
    { name: "Square", d: "M5 5H95V95H5Z" },
    { name: "Rounded square", d: "M25 5H75Q95 5 95 25V75Q95 95 75 95H25Q5 95 5 75V25Q5 5 25 5Z" },
    { name: "Circle", d: "M5 50a45 45 0 1 0 90 0a45 45 0 1 0 -90 0Z" },
    { name: "Oval", d: "M3 50a47 32 0 1 0 94 0a47 32 0 1 0 -94 0Z" },
    { name: "Triangle", d: poly([[50, 6], [95, 92], [5, 92]]) },
    { name: "Right triangle", d: poly([[5, 95], [5, 5], [95, 95]]) },
    { name: "Diamond", d: poly([[50, 3], [97, 50], [50, 97], [3, 50]]) },
    { name: "Pentagon", d: regular(5) },
    { name: "Hexagon", d: regular(6, 0) },
    { name: "Heptagon", d: regular(7) },
    { name: "Octagon", d: regular(8, -67.5) },
    { name: "Trapezoid", d: poly([[25, 20], [75, 20], [95, 80], [5, 80]]) },
    { name: "Parallelogram", d: poly([[25, 20], [95, 20], [75, 80], [5, 80]]) },
    { name: "Semicircle", d: "M5 70A45 45 0 0 1 95 70Z" },
    { name: "Quarter circle", d: "M5 95V5A90 90 0 0 1 95 95Z" },
    { name: "Ring", d: "M5 50a45 45 0 1 0 90 0a45 45 0 1 0 -90 0ZM28 50a22 22 0 1 1 44 0a22 22 0 1 1 -44 0Z", rule: "evenodd" },
    { name: "Frame", d: "M5 5H95V95H5ZM20 20V80H80V20Z", rule: "evenodd" },
    { name: "Crescent", d: "M60 5A45 45 0 1 0 95 65A38 38 0 1 1 60 5Z" },
    { name: "Heart", d: "M50 92C10 62 4 36 22 20C36 8 50 18 50 30C50 18 64 8 78 20C96 36 90 62 50 92Z" },
    { name: "Plus", d: poly([[35, 5], [65, 5], [65, 35], [95, 35], [95, 65], [65, 65], [65, 95], [35, 95], [35, 65], [5, 65], [5, 35], [35, 35]]) },
  ] },
  { name: "Stars", shapes: [
    { name: "Star 4", d: star(4, 14) },
    { name: "Star 5", d: star(5, 20) },
    { name: "Star 6", d: star(6, 26) },
    { name: "Star 8", d: star(8, 32) },
    { name: "Fat star", d: star(5, 30) },
    { name: "Burst 12", d: star(12, 38) },
    { name: "Burst 16", d: star(16, 40) },
    { name: "Burst 24", d: star(24, 42) },
    { name: "Scallop 8", d: scallop(8) },
    { name: "Scallop 12", d: scallop(12, 48, 44) },
    { name: "Seal", d: scallop(16, 48, 45) },
    { name: "Sparkle", d: "M50 3C54 34 66 46 97 50C66 54 54 66 50 97C46 66 34 54 3 50C34 46 46 34 50 3Z" },
  ] },
  { name: "Arrows", shapes: [
    { name: "Arrow right", d: poly(RIGHT) },
    { name: "Arrow left", d: poly(flipX(RIGHT)) },
    { name: "Arrow up", d: poly(swapXY(flipX(RIGHT))) },
    { name: "Arrow down", d: poly(swapXY(RIGHT)) },
    { name: "Double arrow", d: poly([[5, 50], [30, 20], [30, 38], [70, 38], [70, 20], [95, 50], [70, 80], [70, 62], [30, 62], [30, 80]]) },
    { name: "Chevron", d: poly([[20, 5], [55, 5], [90, 50], [55, 95], [20, 95], [55, 50]]) },
    { name: "Pentagon arrow", d: poly([[5, 25], [65, 25], [95, 50], [65, 75], [5, 75]]) },
    { name: "Notched arrow", d: poly([[5, 25], [65, 25], [95, 50], [65, 75], [5, 75], [25, 50]]) },
    { name: "Triangle arrow", d: poly([[15, 5], [95, 50], [15, 95]]) },
    { name: "Bent arrow", d: "M5 95V45Q5 30 20 30H62V8L95 40L62 72V50H28V95Z" },
  ] },
  { name: "Callouts", shapes: [
    { name: "Speech bubble", d: "M12 8H88Q96 8 96 16V58Q96 66 88 66H44L24 90V66H12Q4 66 4 58V16Q4 8 12 8Z" },
    { name: "Round bubble", d: "M50 8C25 8 6 24 6 44s19 36 44 36c4 0 8 0 11-1L84 94 78 70C90 62 94 54 94 44 94 24 75 8 50 8Z" },
    { name: "Bubble left", d: "M12 8H88Q96 8 96 16V58Q96 66 88 66H34L10 90V66H12Q4 66 4 58V16Q4 8 12 8Z" },
    { name: "Bubble right", d: "M12 8H88Q96 8 96 16V58Q96 66 88 66H90V90L66 66H12Q4 66 4 58V16Q4 8 12 8Z" },
    { name: "Box callout", d: "M5 8H95V66H58L50 92L42 66H5Z" },
    { name: "Shout", d: star(10, 30) },
  ] },
  { name: "Banners", shapes: [
    { name: "Swallowtail", d: poly([[5, 25], [95, 25], [82, 50], [95, 75], [5, 75], [18, 50]]) },
    { name: "Flag", d: "M15 5V95H25V50H90L70 28L90 5Z" },
    { name: "Pennant", d: poly([[10, 10], [95, 50], [10, 90]]) },
    { name: "Tag", d: "M5 20Q5 10 15 10H70L95 50L70 90H15Q5 90 5 80Z" },
    { name: "Label", d: "M5 20Q5 10 15 10H85Q95 10 95 20V80Q95 90 85 90H15Q5 90 5 80Z" },
    { name: "Shield", d: "M50 4L90 16V50C90 74 72 90 50 97C28 90 10 74 10 50V16Z" },
  ] },
  { name: "Decorative", shapes: [
    { name: "Flower", d: flower(6) },
    { name: "Flower 8", d: flower(8) },
    { name: "Gear", d: gear(8) },
    { name: "Cog 12", d: gear(12) },
    { name: "Lightning", d: poly([[58, 4], [20, 55], [45, 55], [36, 96], [80, 40], [54, 40]]) },
    { name: "Drop", d: "M50 5C50 5 15 45 15 62a35 35 0 0 0 70 0C85 45 50 5 50 5Z" },
    { name: "Leaf", d: "M10 90C10 40 40 10 92 8C94 60 64 90 10 90Z" },
    { name: "Cloud", d: "M28 78a20 20 0 0 1-2-40a26 26 0 0 1 50-4a22 22 0 0 1 0 44Z" },
    { name: "Check", d: poly([[5, 55], [20, 40], [38, 58], [80, 12], [95, 28], [38, 90]]) },
    { name: "Cross", d: poly([[18, 5], [50, 37], [82, 5], [95, 18], [63, 50], [95, 82], [82, 95], [50, 63], [18, 95], [5, 82], [37, 50], [5, 18]]) },
    { name: "Wave", d: "M0 50Q12.5 25 25 50T50 50T75 50T100 50V90H0Z" },
    { name: "Blob", d: "M71 12C86 22 96 40 90 58C84 76 66 92 46 92C26 92 8 78 8 58C8 40 20 30 28 20C38 8 56 2 71 12Z" },
  ] },
];

// a 100 x 100 path as an editable Fabric shape, about `width` px wide
export function makeShapePath(shape, fill = "#F26B0F", width = 320) {
  const obj = new Path(shape.d, { fill, fillRule: shape.rule || "nonzero" });
  obj.scaleToWidth(width);
  return obj;
}
