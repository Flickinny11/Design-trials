// PROD-FINISH shared image-analysis helpers (sharp-based, no new dep).
// All luma values are Rec.709 on sRGB 0..255.
import sharp from 'sharp';

const LUMA = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

// Decode a PNG to a FULL-RES luma grid. Region means, corner texture, and the
// diagonal background scans all run off this single buffer (one decode/image).
export async function loadRawFull(pngPath) {
  const { data, info } = await sharp(pngPath).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const luma = new Float32Array(width * height);
  for (let i = 0, p = 0; i < width * height; i++, p += channels) {
    luma[i] = LUMA(data[p], data[p + 1], data[p + 2]);
  }
  return { width, height, luma };
}

// Mean + std of luma in a normalized rect [x0,y0,x1,y1] (0..1).
export function regionStats(grid, x0, y0, x1, y1) {
  const { width, height, luma } = grid;
  const ix0 = Math.max(0, Math.floor(x0 * width));
  const iy0 = Math.max(0, Math.floor(y0 * height));
  const ix1 = Math.min(width, Math.ceil(x1 * width));
  const iy1 = Math.min(height, Math.ceil(y1 * height));
  let sum = 0, n = 0;
  for (let y = iy0; y < iy1; y++)
    for (let x = ix0; x < ix1; x++) { sum += luma[y * width + x]; n++; }
  const mean = n ? sum / n : 0;
  let v = 0;
  for (let y = iy0; y < iy1; y++)
    for (let x = ix0; x < ix1; x++) { const d = luma[y * width + x] - mean; v += d * d; }
  const std = n ? Math.sqrt(v / n) : 0;
  return { mean, std, n };
}

// Mean absolute luma diff between two grids over a normalized rect, plus the
// peak luma of grid A in that rect. Used for the hero hide-diff: a hero that is
// genuinely drawn changes its bbox region when moved off-frame (meanAbsDiff up),
// and a lit metal hero has bright specular pixels (peak up). Background-robust.
export function regionDiff(gridA, gridB, x0, y0, x1, y1) {
  const { width, height, luma: la } = gridA;
  const lb = gridB.luma;
  const ix0 = Math.max(0, Math.floor(x0 * width));
  const iy0 = Math.max(0, Math.floor(y0 * height));
  const ix1 = Math.min(width, Math.ceil(x1 * width));
  const iy1 = Math.min(height, Math.ceil(y1 * height));
  let sum = 0, n = 0, peak = 0, changed = 0;
  for (let y = iy0; y < iy1; y++)
    for (let x = ix0; x < ix1; x++) {
      const i = y * width + x;
      const d = Math.abs(la[i] - lb[i]);
      sum += d; n++;
      if (la[i] > peak) peak = la[i];
      if (d > 16) changed++;
    }
  return { meanAbsDiff: n ? sum / n : 0, peak, changedFrac: n ? changed / n : 0, n };
}

// Whole-frame corner/edge/center metrics.
export function atmosphereMetrics(grid) {
  const m = 0.07; // corner/edge sample inset (7% boxes)
  const corners = {
    tl: regionStats(grid, 0, 0, m, m),
    tr: regionStats(grid, 1 - m, 0, 1, m),
    bl: regionStats(grid, 0, 1 - m, m, 1),
    br: regionStats(grid, 1 - m, 1 - m, 1, 1),
  };
  const edges = {
    top: regionStats(grid, 0.5 - m, 0, 0.5 + m, m),
    bottom: regionStats(grid, 0.5 - m, 1 - m, 0.5 + m, 1),
    left: regionStats(grid, 0, 0.5 - m, m, 0.5 + m),
    right: regionStats(grid, 1 - m, 0.5 - m, 1, 0.5 + m),
  };
  const center = regionStats(grid, 0.5 - m, 0.5 - m, 0.5 + m, 0.5 + m);
  const cornerMeans = Object.values(corners).map((c) => c.mean);
  const cornerStds = Object.values(corners).map((c) => c.std);
  const sceneRef = (edges.top.mean + edges.bottom.mean + edges.left.mean + edges.right.mean) / 4;
  const cornerDivergence = Math.max(...cornerMeans.map((cm) => Math.abs(cm - sceneRef)));
  const minCornerStd = Math.min(...cornerStds);
  const maxCornerStd = Math.max(...cornerStds);
  const cornerSpread = Math.max(...cornerMeans) - Math.min(...cornerMeans);
  return { corners, edges, center, sceneRef, cornerDivergence, minCornerStd, maxCornerStd, cornerSpread, cornerMeans };
}

// Sample mean luma of a small normalized box centered at (px,py).
function boxMean(grid, px, py, half = 0.012) {
  const s = regionStats(grid, px - half, py - half, px + half, py + half);
  return s.mean;
}

// Background radial profiles along the 4 DIAGONALS (center → each corner). The
// diagonals avoid the central content cluster AND the top/bottom-center chrome,
// so the profile is (almost) pure app-surface. Returns per-diagonal sample
// arrays of {t, mean} for t in [0,1].
export function diagonalProfiles(grid, n = 30) {
  const corners = [ [0, 0], [1, 0], [0, 1], [1, 1] ];
  const profiles = corners.map(([cx, cy]) => {
    const arr = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const px = 0.5 + (cx - 0.5) * t;
      const py = 0.5 + (cy - 0.5) * t;
      // shrink the sample box near the very edge so it stays in-frame
      const half = Math.min(0.012, Math.min(px, 1 - px, py, 1 - py) * 0.9 + 0.0001);
      arr.push({ t, mean: boxMean(grid, px, py, Math.max(0.002, half)) });
    }
    return arr;
  });
  return profiles;
}

function smooth(arr, win = 2) {
  const n = arr.length, out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0, c = 0;
    for (let k = -win; k <= win; k++) { const j = i + k; if (j >= 0 && j < n) { s += arr[j]; c++; } }
    out[i] = s / c;
  }
  return out;
}

// From the diagonal profiles, derive the OUTER-region (t >= tMin) signatures of
// the BACKGROUND. The profile is heavily smoothed first so that high-frequency
// nebula sparkle (legitimate, desired texture) does NOT register as an edge —
// only a SUSTAINED radial ramp (the elliptical pool boundary / a hard vignette
// step) survives smoothing and shows up as ovalEdge.
//  - ovalEdge: max abs step between adjacent SMOOTHED outer samples.
//  - banding: # of staircase steps (quantized plateaus bounded by >=1.5 jumps)
//    on the smoothed outer profile.
export function diagonalMetrics(profiles, tMin = 0.42) {
  let ovalEdge = 0, banding = 0;
  // radial contrast: how much brighter/darker the CORNER (outer) is vs the
  // POOL band (mid). A big positive value = a bright skybox halo ringing a dark
  // central pool = the "oval pasted on a background" look. Averaged over the 4
  // diagonals; signed (corner - pool).
  const poolBand = (p) => p.t >= 0.30 && p.t <= 0.52;
  const cornerBand = (p) => p.t >= 0.84;
  const radialDeltas = profiles.map((prof) => {
    const pool = prof.filter(poolBand).map((p) => p.mean);
    const corner = prof.filter(cornerBand).map((p) => p.mean);
    const avg = (a) => a.reduce((s, x) => s + x, 0) / (a.length || 1);
    return avg(corner) - avg(pool);
  });
  const radialContrast = Math.max(...radialDeltas.map(Math.abs));
  const cornerHalo = Math.max(...radialDeltas); // signed: bright-corner halo
  for (const prof of profiles) {
    const outerRaw = prof.filter((p) => p.t >= tMin).map((p) => p.mean);
    const outer = smooth(outerRaw, 2);
    for (let i = 1; i < outer.length; i++) {
      ovalEdge = Math.max(ovalEdge, Math.abs(outer[i] - outer[i - 1]));
    }
    let runStart = 0;
    const q = (x) => Math.round(x);
    for (let i = 1; i <= outer.length; i++) {
      if (i === outer.length || q(outer[i]) !== q(outer[i - 1])) {
        const runLen = i - runStart;
        if (runLen >= 4) {
          const before = runStart > 0 ? Math.abs(q(outer[runStart]) - q(outer[runStart - 1])) : 0;
          const after = i < outer.length ? Math.abs(q(outer[i]) - q(outer[i - 1])) : 0;
          if (before >= 1.5 || after >= 1.5) banding++;
        }
        runStart = i;
      }
    }
  }
  return { ovalEdge, banding, radialContrast, cornerHalo };
}
