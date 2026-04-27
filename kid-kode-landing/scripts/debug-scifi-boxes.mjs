import { readFileSync } from "node:fs";
import sharp from "sharp";

const seg = JSON.parse(
  readFileSync("notes/mockup-candidates/scifi-segmentation.json", "utf-8"),
);
const m = await sharp("notes/mockup-candidates/scifi-mockup-v1.png").metadata();
const MW = m.width,
  MH = m.height;

const COLOR_BY_KEY = {
  crystal: "#00ffff",
  frame: "#ff00ff",
  panel: "#ffff00",
  artifact: "#ff8800",
  emblem: "#ff0088",
  orb: "#00ff88",
  sphere: "#8800ff",
  pedestal: "#ffffff",
  relic: "#88ffff",
  platform: "#ff88ff",
};

const rects = seg.results
  .map((r, i) => {
    const [cx, cy, w, h] = r.box;
    return {
      x: (cx - w / 2) * MW,
      y: (cy - h / 2) * MH,
      w: w * MW,
      h: h * MH,
      key: r.key,
      i,
      score: r.score,
    };
  })
  .sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y));

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${MW}" height="${MH}">${rects
  .map(
    (r, idx) => `
    <rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="none" stroke="${COLOR_BY_KEY[r.key] ?? "#ff0000"}" stroke-width="4"/>
    <text x="${r.x + 6}" y="${r.y + 22}" font-family="Arial" font-size="20" fill="${COLOR_BY_KEY[r.key] ?? "#ff0000"}">${idx}: ${r.key} ${Math.round(r.w)}x${Math.round(r.h)}</text>
  `,
  )
  .join("")}</svg>`;

await sharp("notes/mockup-candidates/scifi-mockup-v1.png")
  .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
  .toFile("notes/mockup-candidates/scifi-debug.png");

console.log(
  `debug overlay: notes/mockup-candidates/scifi-debug.png (${rects.length} rects)`,
);
