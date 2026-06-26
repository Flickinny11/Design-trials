'use client';

// PRISM PRIMITIVE SYSTEM — parametric geometry builders (spec §1.5).
//
// Geometry is GENERATED FROM SCHEMA NUMBERS and rebuilt LIVE on edit — never a
// baked GLB for these clean forms (F-3). Built on Three parametric geometry
// (ExtrudeGeometry / Shape / Path holes / SphereGeometry); cutouts are parametric
// rounded-rect HOLES, not live-CSG (F-8). The Pane builder is the same
// roundedRect + ExtrudeGeometry technique as the founder-approved chassis
// GlassPane, generalized to arbitrary width/height/thickness/corner/bevel/cutouts.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three-stdlib';
import type { PrimitiveParams } from './primitive-schema';

// Append a rounded-rect contour (centered at cx,cy) to a Shape or Path.
// (Lifted verbatim from chassis/GlassPane so the pane reads identically.)
function roundedRect(
  ctx: THREE.Shape | THREE.Path,
  cx: number,
  cy: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.max(0.0001, Math.min(r, Math.min(w, h) / 2 - 0.0001));
  const x = cx - w / 2;
  const y = cy - h / 2;
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.absarc(x + w - rr, y + rr, rr, -Math.PI / 2, 0, false);
  ctx.lineTo(x + w, y + h - rr);
  ctx.absarc(x + w - rr, y + h - rr, rr, 0, Math.PI / 2, false);
  ctx.lineTo(x + rr, y + h);
  ctx.absarc(x + rr, y + h - rr, rr, Math.PI / 2, Math.PI, false);
  ctx.lineTo(x, y + rr);
  ctx.absarc(x + rr, y + rr, rr, Math.PI, Math.PI * 1.5, false);
}

// PANE — an extruded rounded-rect with a small front/back bevel (the milled-glass
// rim) and one rounded-rect Path hole per cutout. Centered on z=0 (symmetric
// front↔back) so transmission reads the same both faces.
export function buildPaneGeometry(p: PrimitiveParams): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  roundedRect(shape, 0, 0, p.width, p.height, p.cornerRadius);

  for (const c of p.cutouts) {
    const hole = new THREE.Path();
    roundedRect(hole, c.x, c.y, c.w, c.h, c.r);
    shape.holes.push(hole);
  }

  const bevel = Math.min(p.bevel, p.depth / 2 - 0.001);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.01, p.depth - bevel * 2),
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 4,
    curveSegments: Math.max(6, Math.round(p.segments)),
  });
  geo.center();
  geo.computeVertexNormals();
  // aoMap/uv1 parity (worn material consumes uv1 via the mesh).
  if (geo.attributes.uv && !geo.attributes.uv1) {
    geo.setAttribute('uv1', geo.attributes.uv);
  }
  return geo;
}

// CUBE / BUTTON — a rounded-cornered box, parametric w/h/d + corner radius (the
// same rounded-cube the chassis buttons use, generalized). `segments` drives the
// corner smoothness. Built imperatively so live edits rebuild + selection edges
// derive from the same geometry.
export function buildCubeGeometry(p: PrimitiveParams): THREE.BufferGeometry {
  const w = Math.max(0.05, p.width);
  const h = Math.max(0.05, p.height);
  const d = Math.max(0.05, p.depth);
  const maxR = Math.min(w, h, d) / 2 - 0.001;
  const r = Math.max(0.001, Math.min(p.cornerRadius, maxR));
  const smooth = Math.max(2, Math.min(8, Math.round(p.segments)));
  const geo = new RoundedBoxGeometry(w, h, d, smooth, r) as unknown as THREE.BufferGeometry;
  if (geo.attributes.uv && !geo.attributes.uv1) {
    geo.setAttribute('uv1', geo.attributes.uv);
  }
  return geo;
}

// SPHERE — parametric radius + tessellation.
export function buildSphereGeometry(p: PrimitiveParams): THREE.BufferGeometry {
  const seg = Math.max(8, Math.round(p.segments));
  const geo = new THREE.SphereGeometry(Math.max(0.05, p.radius), seg, Math.max(6, Math.round(seg / 2)));
  if (geo.attributes.uv && !geo.attributes.uv1) {
    geo.setAttribute('uv1', geo.attributes.uv);
  }
  return geo;
}

// A stable cutout id (deterministic per pane — index based at add time).
let cutoutSeq = 0;
export function mintCutoutId(): string {
  cutoutSeq += 1;
  return `cut-${cutoutSeq}`;
}
