'use client';

// PRISM PRIMITIVE SYSTEM — P-5 — 3D COMPOSITION helpers (spec §6).
//
// The geometry of composition: STACK (parent-child world-root resolution + z-layer),
// SNAP/ALIGN (grid + face/edge/center alignment with in-engine guide lines), and the
// footprints those snaps align to. Pure functions — no React, no THREE side effects —
// so the store + renderers + the headless gate all agree on the same math.
//
//   • effectiveRoot(c)  — a composite's WORLD root = its own root composed up the
//                         parentCompositeId chain, plus a per-zLayer forward push. A
//                         stacked child reads its parent's effective root, so moving
//                         the parent moves the child (spec §6.1, "move together").
//   • compositeBounds   — the assembly's XY footprint (for alignment + auto-stack).
//   • computeSnap       — snap a dragged root to the grid AND to alignment with other
//                         composites (center / left / right / top / bottom), emitting
//                         the guide lines the renderer draws (spec §6.3).

import type { CompositeSchema, LabHub } from './composite-schema';
import { compositeMembers } from './composite-schema';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

// composition tuning (world units).
export const GRID_STEP = 0.5; // grid cell the move-drag snaps to
export const SNAP_EPS = 0.26; // alignment tolerance — within this, snap + show a guide
export const STACK_EPS = 1.3; // drop-proximity that auto-stacks one composite onto another
export const Z_LAYER_STEP = 0.16; // forward push per z-layer (keeps stacked layers crisp)
export const STACK_Z_OFFSET = 0.34; // forward offset applied to a child when it stacks

// ── parent-child world resolution (STACK) ────────────────────────────────────────
// Walk the parentCompositeId chain to compose a composite's WORLD root. Guarded
// against cycles. zLayer adds a small forward (z) push so layered panes stay crisp.
export function effectiveRoot(
  c: CompositeSchema,
  byId: Map<string, CompositeSchema>,
  seen: Set<string> = new Set(),
): Vec3 {
  const zPush = (c.zLayer ?? 0) * Z_LAYER_STEP;
  if (!c.parentCompositeId || seen.has(c.compositeId)) {
    return { x: c.root.x, y: c.root.y, z: c.root.z + zPush };
  }
  seen.add(c.compositeId);
  const parent = byId.get(c.parentCompositeId);
  if (!parent) return { x: c.root.x, y: c.root.y, z: c.root.z + zPush };
  const pr = effectiveRoot(parent, byId, seen);
  return { x: pr.x + c.root.x, y: pr.y + c.root.y, z: pr.z + c.root.z + zPush };
}

// Is `maybe` a descendant of `rootId` (so we never stack a composite onto its own
// child — that would create a cycle)?
export function isDescendant(
  maybe: CompositeSchema,
  rootId: string,
  byId: Map<string, CompositeSchema>,
): boolean {
  let cur: CompositeSchema | undefined = maybe;
  const seen = new Set<string>();
  while (cur?.parentCompositeId && !seen.has(cur.compositeId)) {
    if (cur.parentCompositeId === rootId) return true;
    seen.add(cur.compositeId);
    cur = byId.get(cur.parentCompositeId);
  }
  return false;
}

// ── footprint (for alignment + auto-stack proximity) ─────────────────────────────
export interface Bounds {
  halfW: number;
  halfH: number;
}
export function compositeBounds(c: CompositeSchema, hubs: LabHub[]): Bounds {
  const members = compositeMembers(c, hubs);
  let halfW = 0.4;
  let halfH = 0.4;
  for (const m of members) {
    halfW = Math.max(halfW, Math.abs(m.local.x) + m.width / 2);
    halfH = Math.max(halfH, Math.abs(m.local.y) + m.height / 2);
  }
  return { halfW, halfH };
}

// ── snap + alignment guides (spec §6.3) ──────────────────────────────────────────
export interface AlignGuide {
  axis: 'x' | 'y';
  /** the world coordinate the guide line sits at. */
  value: number;
  /** the span (other axis) the guide line stretches across, so it reads as a tie. */
  from: number;
  to: number;
  kind: 'center' | 'edge';
}

export interface SnapResult {
  x: number;
  y: number;
  guides: AlignGuide[];
  snappedX: boolean;
  snappedY: boolean;
}

interface Candidate {
  value: number;
  span: [number, number]; // the other-axis extent of the target (for the guide line)
  kind: 'center' | 'edge';
}

// Snap a moving composite's proposed root (x,y) to (a) alignment with any OTHER
// composite's center/edges, then (b) the grid as a fallback. Emits guide lines for
// whichever axes snapped to an alignment. Edge candidates use the moving composite's
// own half-extent so its EDGE lines up with the target's edge (face/edge snap).
export function computeSnap(
  movingId: string,
  x: number,
  y: number,
  composites: CompositeSchema[],
  byId: Map<string, CompositeSchema>,
  hubs: LabHub[],
  opts: { grid: boolean; align: boolean },
): SnapResult {
  const moving = byId.get(movingId);
  if (!moving) return { x, y, guides: [], snappedX: false, snappedY: false };
  const mb = compositeBounds(moving, hubs);

  const xCands: Candidate[] = [];
  const yCands: Candidate[] = [];

  if (opts.align) {
    for (const c of composites) {
      if (c.compositeId === movingId) continue;
      if (c.parentCompositeId === movingId || isDescendant(c, movingId, byId)) continue; // skip own subtree
      const er = effectiveRoot(c, byId);
      const b = compositeBounds(c, hubs);
      const xSpan: [number, number] = [er.y - b.halfH, er.y + b.halfH];
      const ySpan: [number, number] = [er.x - b.halfW, er.x + b.halfW];
      // center alignment
      xCands.push({ value: er.x, span: xSpan, kind: 'center' });
      yCands.push({ value: er.y, span: ySpan, kind: 'center' });
      // edge alignment — the moving composite's edge lines up with the target's edge.
      xCands.push({ value: er.x - b.halfW + mb.halfW, span: xSpan, kind: 'edge' });
      xCands.push({ value: er.x + b.halfW - mb.halfW, span: xSpan, kind: 'edge' });
      yCands.push({ value: er.y - b.halfH + mb.halfH, span: ySpan, kind: 'edge' });
      yCands.push({ value: er.y + b.halfH - mb.halfH, span: ySpan, kind: 'edge' });
    }
  }

  const pick = (
    v: number,
    cands: Candidate[],
    axis: 'x' | 'y',
  ): { value: number; guide: AlignGuide | null } => {
    let best: Candidate | null = null;
    let bestD = SNAP_EPS;
    for (const c of cands) {
      const d = Math.abs(c.value - v);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    if (best) {
      const guide: AlignGuide = {
        axis,
        value: best.value,
        from: Math.min(best.span[0], axis === 'x' ? y : x) - 0.4,
        to: Math.max(best.span[1], axis === 'x' ? y : x) + 0.4,
        kind: best.kind,
      };
      return { value: best.value, guide };
    }
    return { value: v, guide: null };
  };

  const rx = pick(x, xCands, 'x');
  const ry = pick(y, yCands, 'y');

  let outX = rx.value;
  let outY = ry.value;
  const guides: AlignGuide[] = [];
  if (rx.guide) guides.push(rx.guide);
  if (ry.guide) guides.push(ry.guide);

  // grid fallback — only on axes that did not align (so alignment always wins).
  if (opts.grid) {
    if (!rx.guide) outX = Math.round(x / GRID_STEP) * GRID_STEP;
    if (!ry.guide) outY = Math.round(y / GRID_STEP) * GRID_STEP;
  }

  return { x: outX, y: outY, guides, snappedX: !!rx.guide, snappedY: !!ry.guide };
}

// Nearest composite to a dropped one whose footprint overlaps within STACK_EPS — the
// auto-stack target on drop (null = stays free). Never returns the moving composite's
// own subtree.
export function nearestStackTarget(
  movingId: string,
  composites: CompositeSchema[],
  byId: Map<string, CompositeSchema>,
  hubs: LabHub[],
): CompositeSchema | null {
  const moving = byId.get(movingId);
  if (!moving) return null;
  const me = effectiveRoot(moving, byId);
  let best: CompositeSchema | null = null;
  let bestD = STACK_EPS;
  for (const c of composites) {
    if (c.compositeId === movingId) continue;
    if (c.parentCompositeId === movingId || isDescendant(c, movingId, byId)) continue;
    const er = effectiveRoot(c, byId);
    const b = compositeBounds(c, hubs);
    // proximity: inside the target footprint (a touch padded) in XY.
    const dx = Math.max(0, Math.abs(er.x - me.x) - b.halfW);
    const dy = Math.max(0, Math.abs(er.y - me.y) - b.halfH);
    const d = Math.hypot(dx, dy);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}
