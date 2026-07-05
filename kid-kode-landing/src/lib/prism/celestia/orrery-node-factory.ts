// ORRERY No.7 — the Celestia orrery complication, AS A GRAPH-NODE ARTIFACT (FIX3 / G2).
//
// This is the headless `createNode(config, ctx): THREE.Object3D` factory that the
// `orr-celestia-orrery` node's `codeRef: 'builtin:orrery-complication'` resolves to
// (via coderef-registry → buildPerNodeFactory). It is a faithful, behaviour-exact
// port of the former React/R3F `OrreryComplicationRig.tsx`: SAME emissive sun +
// additive glow shell, SAME 4 PBR planets orbiting on tilted brass rings (real
// depth — planets pass BEHIND the sun), SAME time controls (window.__ORRERY__:
// setTime / setSpeed / scrub) and drag-to-scrub. The orrery is now a real,
// selectable/editable graph node — not a hardcoded JSX sibling (PRISM-MASTER-SPEC
// Law 0). SC-V-O1..O3 preserved.
//
// React-coupling resolved (mirrors watch-node-factory.ts, the FIX2 template):
//   • useFrame              → getSharedDriverHub().frame.add (SceneDriverHost ticks it)
//   • useThree().gl/camera  → eliminated (the orrery never used the camera; drag
//                              reads clientX off window pointer events, gated on
//                              the DriverHub hover flag so it only scrubs over the
//                              built view, exactly like the rig's canvas listener)
//   • useGraphEditorStore   → eliminated (mount is hub-gated: the node only mounts
//                              when s4-celestia is the active hub; interactivity is
//                              gated on ctx.drivers, present only for the built-state
//                              surface — so exactly ONE interactive orrery exists)
//
// This module lives under src/lib/prism/celestia/ (OUTSIDE the FP-05 runtime scope:
// anti-drift-check.sh scopes the window.* forbid to runtime/ + mock-app-source/nodes/
// + prism-player/ only), so writing window.__ORRERY__ here is sanctioned — it is the
// documented control/inspect handle that SC-V-O2 + the verification harness consume.
'use client';

import {
  Group, Mesh, SphereGeometry, TorusGeometry, MeshStandardMaterial, AdditiveBlending,
  Color, DoubleSide, BackSide, type Object3D,
} from 'three';
import { getSharedDriverHub } from '@/lib/prism/runtime/shared-context';
import type { NodeContext } from '@/lib/prism/runtime/shared/adapter';
import type { PrismNode } from '@/lib/prism-graph/types';

const TILT = -0.5; // look down on the orbital plane → 3D ellipses (rig parity)

interface PlanetDef {
  color: string; metalness: number; roughness: number; emissive?: string;
  r: number; size: number; speed: number; phase: number;
}
// Identical to OrreryComplicationRig.PLANETS.
const PLANETS: PlanetDef[] = [
  { color: '#caa15a', metalness: 1, roughness: 0.35, r: 1.05, size: 0.15, speed: 0.62, phase: 0.4 },   // brass
  { color: '#d7dde6', metalness: 0.25, roughness: 0.5, r: 1.62, size: 0.24, speed: 0.41, phase: 2.1 }, // marble
  { color: '#7db1d6', metalness: 0.2, roughness: 0.3, emissive: '#16334d', r: 2.25, size: 0.2, speed: 0.29, phase: 4.0 }, // ice world
  { color: '#2c2f37', metalness: 0.9, roughness: 0.25, r: 2.95, size: 0.17, speed: 0.2, phase: 5.2 },  // obsidian
];

interface OrreryControl {
  time: number; speed: number;
  setSpeed: (s: number) => void;
  scrub: (d: number) => void;
  setTime: (t: number) => void;
}

// ── the codeRef factory: createNode(config, ctx) → THREE.Object3D ─────────────
// Synchronous per the spec §8 contract. `ctx.drivers` is present ONLY for the
// built-state (scene) surface (canvas + preview-app share one cached instance);
// galaxy uses the topology force-graph, so no artifact instance mounts there. The
// interactive instance owns the frame loop, the window control handle, and the
// drag listeners; a non-interactive instance (defensive) is a static selectable
// solar system with no handle and no listeners.
export default function createOrreryNode(config: PrismNode, ctx: NodeContext): Object3D {
  const root = new Group();
  root.name = `node:${config.nodeId}`;
  root.userData.nodeId = config.nodeId;
  root.userData.prismNodeId = config.nodeId;
  root.userData.handlers = {};

  // The TILT lives on a CHILD group: buildPerNodeFactory's placeholder owns the
  // node's scenePosition, and graftAs resets THIS returned root's transform to
  // identity — so the tilt must be inside, not on the root.
  const tilt = new Group();
  tilt.rotation.x = TILT;
  root.add(tilt);

  // ── disposables (the factory owns disposal; React no longer does) ───────────
  const geoms: Array<{ dispose: () => void }> = [];
  const mats: Array<{ dispose: () => void }> = [];

  // sun + additive glow shell
  const sunGeo = new SphereGeometry(0.34, 48, 48);
  const sunMat = new MeshStandardMaterial({ color: new Color('#ffd27a'), emissive: new Color('#ffba4d'), emissiveIntensity: 2.4, roughness: 0.4, metalness: 0 });
  const sun = new Mesh(sunGeo, sunMat);
  tilt.add(sun);
  const glowGeo = new SphereGeometry(0.62, 32, 32);
  const glowMat = new MeshStandardMaterial({ color: new Color('#ffcf80'), emissive: new Color('#ffb347'), emissiveIntensity: 1.1, transparent: true, opacity: 0.32, side: BackSide, blending: AdditiveBlending, depthWrite: false });
  tilt.add(new Mesh(glowGeo, glowMat));
  geoms.push(sunGeo, glowGeo); mats.push(sunMat, glowMat);

  // orbital rings (tilted with the group → read as 3D ellipses)
  const ringMat = new MeshStandardMaterial({ color: new Color('#caa15a'), emissive: new Color('#7a5a22'), emissiveIntensity: 0.6, metalness: 1, roughness: 0.4, transparent: true, opacity: 0.5, side: DoubleSide });
  mats.push(ringMat);
  for (let i = 0; i < PLANETS.length; i++) {
    const ringGeo = new TorusGeometry(PLANETS[i].r, 0.006, 8, 160);
    const ring = new Mesh(ringGeo, ringMat);
    ring.rotation.set(Math.PI / 2, 0, 0);
    tilt.add(ring);
    geoms.push(ringGeo);
  }

  // planets (each a Group wrapping a mesh, so the orbit transform is on the group)
  const planetGroups: Group[] = [];
  for (let i = 0; i < PLANETS.length; i++) {
    const p = PLANETS[i];
    const planetGeo = new SphereGeometry(p.size, 40, 40);
    const planetMat = new MeshStandardMaterial({ color: new Color(p.color), metalness: p.metalness, roughness: p.roughness, emissive: new Color(p.emissive ?? '#000000'), emissiveIntensity: p.emissive ? 0.5 : 0, envMapIntensity: 1.3 });
    const pg = new Group();
    const pm = new Mesh(planetGeo, planetMat);
    pm.castShadow = true;
    pg.add(pm);
    tilt.add(pg);
    planetGroups.push(pg);
    geoms.push(planetGeo); mats.push(planetMat);
  }

  // ── time state ──────────────────────────────────────────────────────────────
  let time = 0;
  let speed = 1;
  let dragging = false;
  let lastX = 0;

  // Place the planets at the current `time` (also the single static-frame seed).
  const placeAt = (t: number) => {
    for (let i = 0; i < PLANETS.length; i++) {
      const p = PLANETS[i];
      const a = t * p.speed + p.phase;
      planetGroups[i].position.set(Math.cos(a) * p.r, 0, Math.sin(a) * p.r);
    }
  };
  placeAt(0);

  const interactive = ctx.drivers != null;
  if (!interactive) {
    root.userData.cleanup = () => {
      for (const g of geoms) g.dispose();
      for (const m of mats) m.dispose();
    };
    return root;
  }

  // ── window.__ORRERY__ control handle (SC-V-O2) ──────────────────────────────
  const handle: OrreryControl = {
    get time() { return time; },
    get speed() { return speed; },
    setSpeed: (s: number) => { speed = s; },
    scrub: (d: number) => { time += d; },
    setTime: (t: number) => { time = t; },
  };
  (window as unknown as { __ORRERY__?: unknown }).__ORRERY__ = handle;

  // ── drag-to-scrub (rig parity) — clientX delta off window pointer events,
  //    gated on the DriverHub hover flag so it only scrubs over the built view. ─
  const hub = getSharedDriverHub();
  const onDown = (e: PointerEvent) => { if (!hub.pointer.active) return; dragging = true; lastX = e.clientX; };
  const onMove = (e: PointerEvent) => { if (!dragging) return; const dx = e.clientX - lastX; lastX = e.clientX; time += dx * 0.012; };
  const onUp = () => { dragging = false; };
  window.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);

  // ── per-frame: advance time (unless dragging), orbit + spin (rig parity) ────
  const frameOff = hub.frame.add((dtMs: number) => {
    const dt = dtMs / 1000;
    if (!dragging) time += Math.min(dt, 1 / 30) * speed * 0.6;
    const t = time;
    for (let i = 0; i < PLANETS.length; i++) {
      const p = PLANETS[i];
      const a = t * p.speed + p.phase;
      planetGroups[i].position.set(Math.cos(a) * p.r, 0, Math.sin(a) * p.r); // orbit in X-Z (tilted by parent)
      planetGroups[i].rotation.y += dt * 0.6; // planet spin
    }
    sun.rotation.y += dt * 0.15;
  });

  root.userData.cleanup = () => {
    frameOff();
    window.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    const w = window as unknown as { __ORRERY__?: unknown };
    if (w.__ORRERY__ === handle) delete w.__ORRERY__;
    for (const g of geoms) g.dispose();
    for (const m of mats) m.dispose();
  };

  return root;
}
