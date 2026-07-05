// shatter-assemble — glass shards fly in from all directions and lock together
// into the solid card: shatter played in reverse. CATALOG primitive
// (hard / displacement, subject:'card'). CPU-driven & observable.
//
// At build we cover the card's footprint with a deterministic grid of small
// plane fragments parented to target.object, and hide the host subject. Each
// fragment k has a deterministic scattered start derived from an index hash
// (outward offset + spin — no Math.random). seek(t) lerps each fragment from
// its scatter pose to its rest pose using an easeOut phase with a slight
// per-shard stagger, ramps opacity in, and lerps rotation to zero. The card
// reads as broken glass reassembling.
//
// DISTINCT from: shatter (explodes outward), voxelize (3D cubes),
// crumble (gravity fall). Here shards converge inward and the spin settles.

import {
  Group,
  Mesh,
  PlaneGeometry,
  MeshStandardMaterial,
  Color,
  type Material,
  type Object3D,
} from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, clamp, phase, type PrimitiveDefinition } from '../contract';

// Card footprint the fragment grid covers (matches the subject card extents in
// subjects.ts: w 1.74 × h 1.12). We sit the shards just proud of z=0.
const CARD_W = 1.74;
const CARD_H = 1.12;
const FRONT_Z = 0.08;
const FRAG_COLOR = '#3a4a7a';
const FRAG_EMISSIVE = '#1b2747';

/** Deterministic 0..1 hash from a single seed (no Math.random). */
const hash1 = (n: number): number => {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.4, max: 4, step: 0.1, default: 1.4, unit: 's' },
  { id: 'fragments', label: 'Fragments', type: 'knob', min: 3, max: 9, step: 1, default: 6 },
  { id: 'scatter', label: 'Scatter', type: 'fader', min: 1, max: 6, step: 0.1, default: 3 },
  {
    id: 'curve',
    label: 'Curve',
    type: 'curve',
    default: 'expoOut',
    options: ['easeOut', 'expoOut', 'backOut', 'elasticOut'],
  },
] as const;

const MAX_GRID = 9; // max cells per axis -> MAX_GRID^2 fragment meshes allocated

interface FragData {
  mesh: Mesh;
  mat: MeshStandardMaterial;
  restX: number;
  restY: number;
  /** Unit outward direction (from card centre to the cell centre). */
  dirX: number;
  dirY: number;
  /** Deterministic per-shard scatter distance multiplier + spin + stagger. */
  distK: number;
  spin: number; // radians of start rotation
  zSpin: number; // radians of start z-rotation
  stagger: number; // 0..~0.35 phase delay
  active: boolean;
}

/** Collect transparent-capable materials on a subtree (for hide/restore). */
function materialsOf(root: Object3D): Material[] {
  const out: Material[] = [];
  root.traverse((o) => {
    const m = (o as Mesh).material;
    if (m) {
      const arr = Array.isArray(m) ? m : [m];
      for (const mat of arr) out.push(mat);
    }
  });
  return out;
}

export const shatterAssemblePrimitive: PrimitiveDefinition = {
  name: 'shatter-assemble',
  label: 'Shatter Assemble',
  category: 'displacement',
  difficulty: 'hard',
  subject: 'card',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'Glass shards fly in from all directions and lock together into the solid card — shatter played in reverse.',
  create: defineAnimatable(
    { name: 'shatter-assemble', category: 'displacement', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject;

      // Hide the host card while shards assemble; remember the prior opacities
      // and transparency flags so dispose() restores them exactly.
      const subjMats = subject ? materialsOf(subject) : [];
      const subjPrev = subjMats.map((m) => ({
        mat: m as Material & { opacity: number; transparent: boolean },
        opacity: (m as Material & { opacity: number }).opacity,
        transparent: m.transparent,
      }));
      for (const m of subjMats) {
        m.transparent = true;
        (m as Material & { opacity: number }).opacity = 0;
      }

      // Fragment group — owned by this primitive, parented to target.object.
      const group = new Group();
      group.name = 'shatter-assemble-fragments';
      target.object.add(group);

      // Allocate MAX_GRID^2 fragment meshes once; the live `fragments` control
      // toggles how many participate (others are parked/hidden). Each fragment
      // is a small plane sized to the current grid; we rebuild geometry size on
      // grid change via onParamChange (structural), but pose math stays in seek.
      const frags: FragData[] = [];
      for (let i = 0; i < MAX_GRID * MAX_GRID; i++) {
        const mat = new MeshStandardMaterial({
          color: new Color(FRAG_COLOR),
          emissive: new Color(FRAG_EMISSIVE),
          emissiveIntensity: 0.35,
          roughness: 0.28,
          metalness: 0.4,
          envMapIntensity: 1.1,
          transparent: true,
          opacity: 0,
        });
        const mesh = new Mesh(new PlaneGeometry(1, 1), mat);
        mesh.name = `shard-${i}`;
        mesh.visible = false;
        group.add(mesh);
        frags.push({
          mesh,
          mat,
          restX: 0,
          restY: 0,
          dirX: 0,
          dirY: 0,
          distK: 1,
          spin: 0,
          zSpin: 0,
          stagger: 0,
          active: false,
        });
      }

      // (Re)compute the grid layout for a given cell count per axis. Sets each
      // fragment's rest position, outward direction, plane size, and the
      // deterministic per-shard scatter constants.
      let currentGrid = -1;
      const layoutGrid = (gridN: number) => {
        const g = Math.max(3, Math.min(MAX_GRID, Math.round(gridN)));
        if (g === currentGrid) return;
        currentGrid = g;
        const cellW = CARD_W / g;
        const cellH = CARD_H / g;
        const count = g * g;
        for (let i = 0; i < frags.length; i++) {
          const f = frags[i];
          if (i >= count) {
            f.active = false;
            f.mesh.visible = false;
            continue;
          }
          f.active = true;
          f.mesh.visible = true;
          const cx = i % g;
          const cy = Math.floor(i / g);
          // Cell centre relative to card centre.
          const restX = -CARD_W / 2 + cellW * (cx + 0.5);
          const restY = -CARD_H / 2 + cellH * (cy + 0.5);
          f.restX = restX;
          f.restY = restY;
          // Outward unit direction from centre (fallback up for the centre cell).
          const len = Math.hypot(restX, restY) || 1;
          f.dirX = restX / len;
          f.dirY = restY / len;
          // Deterministic per-shard constants (index hashes — no randomness).
          f.distK = 0.6 + hash1(i * 1.37 + 2.1) * 0.9; // 0.6..1.5
          f.spin = (hash1(i * 2.71 + 5.3) - 0.5) * 2.4; // ~±1.2 rad x-tilt
          f.zSpin = (hash1(i * 3.91 + 9.7) - 0.5) * 3.0; // ~±1.5 rad z-roll
          f.stagger = hash1(i * 4.53 + 1.9) * 0.32; // 0..0.32 phase delay
          // Size the plane to the cell (slight gap so seams read as shards).
          f.mesh.geometry.dispose();
          f.mesh.geometry = new PlaneGeometry(cellW * 0.94, cellH * 0.94);
        }
      };
      layoutGrid(num(params.fragments, 6));

      const applyFrame = (t: number) => {
        const dur = num(params.duration, 1.4);
        const scatter = num(params.scatter, 3);
        const curve = (params.curve as string) || 'expoOut';
        const base = phase(t, dur); // 0..1 master phase
        for (const f of frags) {
          if (!f.active) {
            f.mesh.position.set(0, 0, -1000);
            (f.mat as Material & { opacity: number }).opacity = 0;
            continue;
          }
          // Per-shard staggered phase: shards with larger stagger start later,
          // all converge by p=1.
          const sp = clamp((base - f.stagger) / (1 - f.stagger || 1), 0, 1);
          const e = ease(curve as Parameters<typeof ease>[0], sp);
          // Scatter offset shrinks from (scatter * distK) at e=0 to 0 at e=1.
          const off = scatter * f.distK * (1 - e);
          f.mesh.position.x = f.restX + f.dirX * off;
          f.mesh.position.y = f.restY + f.dirY * off;
          f.mesh.position.z = FRONT_Z + (1 - e) * 0.4 * f.distK; // shards float in from front
          // Rotation lerps from a deterministic spin to zero.
          f.mesh.rotation.x = f.spin * (1 - e);
          f.mesh.rotation.z = f.zSpin * (1 - e);
          // Opacity ramps in (a touch ahead of position so shards are visible).
          (f.mat as Material & { opacity: number }).opacity = clamp(e * 1.15, 0, 1);
        }
      };
      applyFrame(0);

      return {
        duration: () => num(params.duration, 1.4),
        seek: (t) => applyFrame(t),
        onParamChange: (id) => {
          if (id === 'fragments') layoutGrid(num(params.fragments, 6));
        },
        dispose: () => {
          // Restore the host subject's materials.
          for (const p of subjPrev) {
            p.mat.opacity = p.opacity;
            p.mat.transparent = p.transparent;
          }
          // Tear down the fragment group.
          target.object.remove(group);
          for (const f of frags) {
            f.mesh.geometry.dispose();
            f.mat.dispose();
          }
        },
      };
    },
  ),
};
