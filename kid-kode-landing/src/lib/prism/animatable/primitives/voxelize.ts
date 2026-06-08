// voxelize — the card dissolves into a grid of NxM small cubes that fly in from
// deterministically scattered positions/rotations and reassemble into the flat
// card surface, opacity rising as they settle. HARD / displacement primitive.
//
// CPU-driven and observable: each voxel's position is lerp(scatterPos, gridPos,
// assembleEase(phase)) so a mid-frame differs from t=0 and from the settled end.
// All per-voxel randomness comes from an index hash (no Math.random) so the
// effect is deterministic. The host card subject is hidden while the voxels
// render; dispose() restores it and frees the voxel geometry/material.
//
// DISTINCT from crumble (gravity fall) / shatter: voxels converge to a flat
// grid from a scattered cloud — no gravity, no fracture shards.

import {
  Group,
  Mesh,
  BoxGeometry,
  Color,
  Euler,
  MeshStandardMaterial,
  type Material,
  type Object3D,
} from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, str, clamp, phase, type EaseName, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 4, step: 0.1, default: 1.4, unit: 's' },
  { id: 'gridN', label: 'Resolution', type: 'knob', min: 4, max: 12, step: 1, default: 7 },
  { id: 'scatter', label: 'Scatter', type: 'fader', min: 1, max: 6, step: 0.1, default: 3 },
  { id: 'direction', label: 'Direction', type: 'dropdown', default: 'in',
    options: [
      { value: 'in', label: 'Assemble In' },
      { value: 'out', label: 'Scatter Out' },
    ],
  },
  {
    id: 'curve',
    label: 'Curve',
    type: 'curve',
    default: 'backOut',
    options: ['linear', 'easeOut', 'expoOut', 'backOut', 'elasticOut'],
  },
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

export const voxelizePrimitive: PrimitiveDefinition = {
  name: 'voxelize',
  label: 'Voxelize',
  category: 'displacement',
  difficulty: 'hard',
  subject: 'card',
  defaultDriver: 'time',
  description:
    'The card breaks into a grid of small cubes that scatter outward then reassemble into the flat surface.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'voxelize', category: 'displacement', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject;

      // Build a grid of small cube meshes (a Group). We use the max resolution
      // so live gridN changes can hide/show cells without a rebuild; cells
      // outside the active grid are parked invisible.
      const MAXN = 12;
      const voxels = new Group();
      voxels.name = 'voxelize-grid';

      interface Cell {
        mesh: Mesh;
        mat: MeshStandardMaterial & { opacity: number };
        col: number;
        row: number;
        // deterministic scatter offset + rotation, scaled by `scatter` in seek
        sx: number;
        sy: number;
        sz: number;
        rx: number;
        ry: number;
        rz: number;
      }
      const cells: Cell[] = [];

      // Cube edge sized to the finest grid so it never overflows the card; at
      // coarser grids the cells visibly tile the flat surface.
      const cube = new BoxGeometry(1, 1, 1);

      for (let r = 0; r < MAXN; r++) {
        for (let c = 0; c < MAXN; c++) {
          const i = r * MAXN + c;
          // Tint voxels across the card palette deterministically.
          const hue = hash(i, 7);
          const baseColor = hue < 0.18 ? ACCENT : hue < 0.32 ? VIOLET : PANEL;
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
          const mesh = new Mesh(cube, mat);
          mesh.visible = false;

          // Deterministic unit scatter direction + spin (no Math.random).
          const a = hash(i, 1) * Math.PI * 2;
          const b = hash(i, 2) * Math.PI - Math.PI / 2;
          const rad = 0.4 + hash(i, 3) * 0.6;
          cells.push({
            mesh,
            mat,
            col: c,
            row: r,
            sx: Math.cos(a) * Math.cos(b) * rad,
            sy: Math.sin(b) * rad,
            sz: Math.sin(a) * Math.cos(b) * rad,
            rx: (hash(i, 4) - 0.5) * Math.PI * 2,
            ry: (hash(i, 5) - 0.5) * Math.PI * 2,
            rz: (hash(i, 6) - 0.5) * Math.PI * 2,
          });
          voxels.add(mesh);
        }
      }

      target.object.add(voxels);
      setSubjectVisible(subject, false);

      const settledEuler = new Euler(0, 0, 0);

      // Lay out / pose every cell for a given phase p (0 = scattered, 1 = grid).
      // direction 'out' reverses the lerp endpoints (settled -> scattered).
      const apply = (pRaw: number) => {
        const n = Math.round(clamp(num(params.gridN, 7), 4, 12));
        const scatter = num(params.scatter, 3);
        const dirOut = str(params.direction, 'in') === 'out';
        const curve = str(params.curve, 'backOut') as EaseName;

        // assembleEase(phase): in -> converge to grid; out -> 1 - p so grid
        // disassembles. We ease the convergence parameter.
        const conv = dirOut ? 1 - ease(curve, pRaw) : ease(curve, pRaw);

        const cellW = CARD_W / n;
        const cellH = CARD_H / n;
        const edge = Math.min(cellW, cellH) * 0.86;

        for (const cell of cells) {
          const active = cell.col < n && cell.row < n;
          cell.mesh.visible = active;
          if (!active) continue;

          // Grid slot center on the flat card face (z ~ 0).
          const gx = -CARD_W / 2 + cellW * (cell.col + 0.5);
          const gy = -CARD_H / 2 + cellH * (cell.row + 0.5);
          const gz = 0;

          // Scattered target = grid slot pushed out along the hash direction.
          const ox = cell.sx * scatter;
          const oy = cell.sy * scatter;
          const oz = cell.sz * scatter + 0.6; // bias toward viewer so it reads

          // position = lerp(scatterPos, gridPos, conv)
          cell.mesh.position.set(
            gx + ox * (1 - conv),
            gy + oy * (1 - conv),
            gz + oz * (1 - conv),
          );

          // rotation: scattered spin -> settled (axis-aligned) as conv -> 1.
          cell.mesh.rotation.set(
            settledEuler.x + cell.rx * (1 - conv),
            settledEuler.y + cell.ry * (1 - conv),
            settledEuler.z + cell.rz * (1 - conv),
          );

          // scale: cube edge sized to the active grid.
          cell.mesh.scale.setScalar(edge);

          // opacity rises as voxels settle into the surface.
          cell.mat.opacity = clamp(0.15 + conv * 0.85, 0, 1);
        }
      };

      // Prime at scattered state.
      apply(0);

      return {
        duration: () => num(params.duration, 1.4),
        seek: (t) => {
          apply(phase(t, num(params.duration, 1.4)));
        },
        onParamChange: (id) => {
          // Resolution / scatter / direction change re-pose at the current
          // primed state so the grid updates without a rebuild. Re-apply at the
          // settled end (p=1) so the editor preview shows the assembled grid.
          if (id === 'gridN' || id === 'scatter' || id === 'direction' || id === 'curve') {
            apply(1);
          }
        },
        dispose: () => {
          target.object.remove(voxels);
          cube.dispose();
          for (const cell of cells) (cell.mat as Material).dispose();
          setSubjectVisible(subject, true);
        },
      };
    },
  ),
};
