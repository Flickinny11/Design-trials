// tiles-assemble — the flat card face is rebuilt as an NxM grid of thin, flat
// tile meshes that flip and fly in from depth, snapping into their grid slots
// like a mosaic locking together. HARD / displacement primitive.
//
// CPU-driven and observable: each tile k has a deterministic start (index hash
// -> z pushed back by `depth`, a flip rotation about a per-tile axis, and a
// small xy offset). As its local phase advances it lerps position -> grid slot,
// rotation -> 0 (flat), and ramps opacity. The reveal is a DIAGONAL SWEEP: a
// tile's stagger = (col + row) / (N + M), so the top-left corner settles first
// and the wave travels to the bottom-right. All randomness is index-hash based
// (no Math.random) so reseeking is reproducible. The host card subject is
// hidden while the tiles render; dispose() restores it and frees the geometry.
//
// DISTINCT from voxelize (3D cubes scatter in random directions then converge):
// tiles are FLAT quads that FLIP-in from depth on a per-tile axis with a
// directional diagonal stagger — a mosaic snapping flat, not a cube cloud.

import {
  Group,
  Mesh,
  BoxGeometry,
  Color,
  MeshStandardMaterial,
  type Material,
  type Object3D,
} from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, clamp, phase, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.4, max: 4, step: 0.1, default: 1.6, unit: 's' },
  { id: 'grid', label: 'Grid', type: 'knob', min: 3, max: 10, step: 1, default: 6 },
  { id: 'depth', label: 'Depth', type: 'fader', min: 2, max: 8, step: 0.1, default: 4, unit: 'z' },
] as const;

// Deterministic hash in [0,1) from an integer index + salt — no Math.random.
function hash(i: number, salt: number): number {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

const CARD_W = 1.74;
const CARD_H = 1.12;
const ACCENT = '#5d8bff';
const VIOLET = '#a978ff';
const PANEL = '#33406a';

/** Set subject (and its chrome subtree) visibility. */
function setSubjectVisible(subject: Object3D | null, visible: boolean) {
  if (!subject) return;
  subject.visible = visible;
}

export const tilesAssemblePrimitive: PrimitiveDefinition = {
  name: 'tiles-assemble',
  label: 'Tiles Assemble',
  category: 'displacement',
  difficulty: 'hard',
  subject: 'card',
  defaultDriver: 'time',
  description:
    'A grid of flat tiles flips and flies in from depth, assembling into the flat card face like a mosaic snapping together.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'tiles-assemble', category: 'displacement', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject;

      // Build the tile grid at max resolution; live `grid` changes hide/show
      // cells rather than rebuild. Each tile is a thin, FLAT box (mosaic chip).
      const MAXN = 10;
      const tiles = new Group();
      tiles.name = 'tiles-assemble-grid';

      interface Tile {
        mesh: Mesh;
        mat: MeshStandardMaterial & { opacity: number };
        col: number;
        row: number;
        // deterministic start offsets / flip (unit-ish; scaled in seek)
        ox: number; // small xy drift at start
        oy: number;
        flipX: number; // flip rotation about X (radians)
        flipY: number; // flip rotation about Y (radians)
        spin: number; // small in-plane twist about Z
      }
      const cellsList: Tile[] = [];

      // Unit flat tile (thin in z); scaled per active grid in seek.
      const tileGeo = new BoxGeometry(1, 1, 0.06);

      for (let r = 0; r < MAXN; r++) {
        for (let c = 0; c < MAXN; c++) {
          const i = r * MAXN + c;
          const hue = hash(i, 7);
          const baseColor = hue < 0.2 ? ACCENT : hue < 0.36 ? VIOLET : PANEL;
          const mat = new MeshStandardMaterial({
            color: new Color(baseColor),
            emissive: new Color('#101a3a'),
            emissiveIntensity: 0.4,
            roughness: 0.34,
            metalness: 0.42,
            envMapIntensity: 1.1,
            transparent: true,
            opacity: 0,
          }) as MeshStandardMaterial & { opacity: number };
          const mesh = new Mesh(tileGeo, mat);
          mesh.visible = false;

          // Deterministic start: a flip about X or Y (so the flat tile arrives
          // edge-on and rotates to face-on), a small in-plane twist, and a tiny
          // xy drift — all hash-derived, no Math.random.
          const flipX = (hash(i, 1) - 0.5) * Math.PI * 1.6; // up to ~+/-144deg
          const flipY = (hash(i, 2) - 0.5) * Math.PI * 1.6;
          cellsList.push({
            mesh,
            mat,
            col: c,
            row: r,
            ox: (hash(i, 3) - 0.5) * 0.5,
            oy: (hash(i, 4) - 0.5) * 0.5,
            flipX,
            flipY,
            spin: (hash(i, 5) - 0.5) * Math.PI * 0.5,
          });
          tiles.add(mesh);
        }
      }

      target.object.add(tiles);
      setSubjectVisible(subject, false);

      // Pose every tile for a global phase p in [0,1].
      const apply = (p: number) => {
        const n = Math.round(clamp(num(params.grid, 6), 3, 10));
        const depth = num(params.depth, 4);

        const cellW = CARD_W / n;
        const cellH = CARD_H / n;
        // Flat tile footprint with a small gap so the mosaic grout reads.
        const sx = cellW * 0.9;
        const sy = cellH * 0.9;

        const denom = n + n; // (N + M); square grid here
        const SPREAD = 0.45; // fraction of the timeline a single tile takes

        for (const tile of cellsList) {
          const active = tile.col < n && tile.row < n;
          tile.mesh.visible = active;
          if (!active) continue;

          // Diagonal-sweep stagger: top-left (col+row small) leads.
          const stagger = (tile.col + tile.row) / denom; // 0..~1
          const start = stagger * (1 - SPREAD);
          // Per-tile local phase, clamped + eased (easeOut: snaps into place).
          const localRaw = clamp((p - start) / SPREAD, 0, 1);
          const e = ease('easeOut', localRaw);

          // Flat grid slot on the card face (z ~ 0).
          const gx = -CARD_W / 2 + cellW * (tile.col + 0.5);
          const gy = -CARD_H / 2 + cellH * (tile.row + 0.5);

          // Start: pushed back by `depth` along z + small xy drift.
          // position = lerp(startPos, gridPos, e)
          const startX = gx + tile.ox;
          const startY = gy + tile.oy;
          const startZ = -depth;
          tile.mesh.position.set(
            startX + (gx - startX) * e,
            startY + (gy - startY) * e,
            startZ + (0 - startZ) * e,
          );

          // Rotation: flip/twist -> 0 (flat, facing +z) as e -> 1.
          const inv = 1 - e;
          tile.mesh.rotation.set(
            tile.flipX * inv,
            tile.flipY * inv,
            tile.spin * inv,
          );

          // Flat scale (thin tile sized to the active cell).
          tile.mesh.scale.set(sx, sy, 1);

          // Opacity ramps as the tile flies in and settles.
          tile.mat.opacity = clamp(0.1 + e * 0.9, 0, 1);
        }
      };

      // Prime at start (everything back in depth, edge-on).
      apply(0);

      return {
        duration: () => num(params.duration, 1.6),
        seek: (t) => {
          apply(phase(t, num(params.duration, 1.6)));
        },
        onParamChange: (id) => {
          // Resolution / depth change re-poses at the settled end so the editor
          // preview shows the assembled mosaic without a rebuild.
          if (id === 'grid' || id === 'depth') {
            apply(1);
          }
        },
        dispose: () => {
          target.object.remove(tiles);
          tileGeo.dispose();
          for (const tile of cellsList) (tile.mat as Material).dispose();
          setSubjectVisible(subject, true);
        },
      };
    },
  ),
};
