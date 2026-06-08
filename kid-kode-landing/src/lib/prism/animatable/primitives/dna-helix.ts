// dna-helix — particles trace a rotating double helix with rungs: a twisting
// DNA ladder spinning about its vertical axis. CATALOG primitive
// (hard / particles, subject:'empty'). Builds a THREE.Points into
// target.object.
//
// Each strand particle i is mapped to a normalized height h = i/N along y, and a
// strand index = i%2. Its angle = h*twist*2PI + uTime*spin + strand*PI, so the
// two strands stay PI apart (a double helix) and the whole structure rotates as
// uTime advances. Position = (cos(angle)*radius, (h-0.5)*length,
// sin(angle)*radius). Periodic "rung" particles bridge the two strands at fixed
// height intervals (interpolating between strand-0 and strand-1 positions at
// that height), drawing the ladder steps.
//
// seek advances uTime = t * spin-derived rotation and rewrites the position
// attribute. DETERMINISTIC: no Math.random — the geometry is a pure function of
// (index, t, params). Looping/continuous → duration() = Infinity.

import {
  Points,
  BufferGeometry,
  BufferAttribute,
  PointsMaterial,
  Color,
  AdditiveBlending,
} from 'three';
import { defineAnimatable } from '../base';
import { num, type PrimitiveDefinition } from '../contract';

// Fixed build-time allocation. STRAND_PER is per strand; total strand particles
// = STRAND_PER * 2. Rung steps each emit RUNG_PER bridging particles.
const STRAND_PER = 110; // particles per strand
const RUNG_STEPS = 16; // number of ladder rungs
const RUNG_PER = 7; // bridging particles per rung
const STRAND_TOTAL = STRAND_PER * 2;
const RUNG_TOTAL = RUNG_STEPS * RUNG_PER;
const MAX_COUNT = STRAND_TOTAL + RUNG_TOTAL;
const LENGTH = 2.6; // total vertical extent of the helix

const SCHEMA = [
  { id: 'spin', label: 'Spin', type: 'knob', min: 0, max: 4, step: 0.05, default: 1.2 },
  { id: 'twist', label: 'Twist', type: 'knob', min: 2, max: 8, step: 0.1, default: 4, unit: 'turns' },
  { id: 'radius', label: 'Radius', type: 'fader', min: 0.3, max: 2, step: 0.01, default: 0.7 },
  { id: 'size', label: 'Size', type: 'knob', min: 0.01, max: 0.12, step: 0.001, default: 0.05 },
] as const;

export const dnaHelixPrimitive: PrimitiveDefinition = {
  name: 'dna-helix',
  label: 'DNA Helix',
  category: 'particles',
  difficulty: 'hard',
  subject: 'empty',
  defaultDriver: 'time',
  description:
    'Particles trace a rotating double helix with rungs, a twisting DNA ladder spinning about its vertical axis.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'dna-helix', category: 'particles', schema: SCHEMA },
    (target, params) => {
      const positions = new Float32Array(MAX_COUNT * 3);
      const colors = new Float32Array(MAX_COUNT * 3);
      const geometry = new BufferGeometry();
      const posAttr = new BufferAttribute(positions, 3);
      geometry.setAttribute('position', posAttr);

      // Two-tone coloring: strand 0 cool, strand 1 warm, rungs neutral. Set once
      // (color is per-vertex and static; only positions animate).
      const cA = new Color('#5d8bff'); // strand 0
      const cB = new Color('#a978ff'); // strand 1
      const cR = new Color('#9fe7ff'); // rungs
      for (let i = 0; i < STRAND_PER; i++) {
        // strand 0 occupies even indices, strand 1 odd indices
        const i0 = i * 2;
        const i1 = i * 2 + 1;
        colors[i0 * 3] = cA.r; colors[i0 * 3 + 1] = cA.g; colors[i0 * 3 + 2] = cA.b;
        colors[i1 * 3] = cB.r; colors[i1 * 3 + 1] = cB.g; colors[i1 * 3 + 2] = cB.b;
      }
      for (let r = 0; r < RUNG_TOTAL; r++) {
        const idx = STRAND_TOTAL + r;
        colors[idx * 3] = cR.r; colors[idx * 3 + 1] = cR.g; colors[idx * 3 + 2] = cR.b;
      }
      geometry.setAttribute('color', new BufferAttribute(colors, 3));

      const material = new PointsMaterial({
        size: num(params.size, 0.05),
        sizeAttenuation: true,
        vertexColors: true,
        transparent: true,
        opacity: 0.95,
        blending: AdditiveBlending,
        depthWrite: false,
      });

      const points = new Points(geometry, material);
      points.name = 'dna-helix';
      target.object.add(points);

      // Compute (x,z) for a strand at normalized height h (0..1) + strand offset.
      const strandPos = (
        h: number,
        strand: 0 | 1,
        twist: number,
        spin: number,
        t: number,
        radius: number,
      ): [number, number] => {
        const angle = h * twist * Math.PI * 2 + t * spin + strand * Math.PI;
        return [Math.cos(angle) * radius, Math.sin(angle) * radius];
      };

      return {
        duration: () => Infinity,
        seek: (t) => {
          // Live param reads so control changes take effect with no rebuild.
          const spin = num(params.spin, 1.2);
          const twist = num(params.twist, 4);
          const radius = num(params.radius, 0.7);
          material.size = num(params.size, 0.05);

          // Strand particles: even index = strand 0, odd index = strand 1.
          for (let i = 0; i < STRAND_PER; i++) {
            const h = STRAND_PER <= 1 ? 0 : i / (STRAND_PER - 1);
            const y = (h - 0.5) * LENGTH;

            const [x0, z0] = strandPos(h, 0, twist, spin, t, radius);
            const i0 = i * 2;
            positions[i0 * 3] = x0;
            positions[i0 * 3 + 1] = y;
            positions[i0 * 3 + 2] = z0;

            const [x1, z1] = strandPos(h, 1, twist, spin, t, radius);
            const i1 = i * 2 + 1;
            positions[i1 * 3] = x1;
            positions[i1 * 3 + 1] = y;
            positions[i1 * 3 + 2] = z1;
          }

          // Rung particles: at each step height, bridge strand 0 -> strand 1 with
          // RUNG_PER particles linearly interpolated between the two strand
          // endpoints at that height.
          for (let r = 0; r < RUNG_STEPS; r++) {
            const h = RUNG_STEPS <= 1 ? 0.5 : r / (RUNG_STEPS - 1);
            const y = (h - 0.5) * LENGTH;
            const [ax, az] = strandPos(h, 0, twist, spin, t, radius);
            const [bx, bz] = strandPos(h, 1, twist, spin, t, radius);
            for (let k = 0; k < RUNG_PER; k++) {
              const f = RUNG_PER <= 1 ? 0.5 : k / (RUNG_PER - 1);
              const idx = STRAND_TOTAL + r * RUNG_PER + k;
              positions[idx * 3] = ax + (bx - ax) * f;
              positions[idx * 3 + 1] = y;
              positions[idx * 3 + 2] = az + (bz - az) * f;
            }
          }

          posAttr.needsUpdate = true;
        },
        dispose: () => {
          target.object.remove(points);
          geometry.dispose();
          material.dispose();
        },
      };
    },
  ),
};
