// scroll-stagger-rise — the card is subdivided into N horizontal sub-bands
// (small child planes parented to the subject). As scroll advances, each band
// b reveals when scroll crosses b/N: its opacity ramps 0 -> 1 and its
// position.y rises from below (baseY - lift) up to its settled offset across a
// per-band window. The `stagger` knob widens the gap between successive bands'
// reveal points so rows arrive one by one (list-row arrival), the `bands` knob
// chooses how many rows, and `lift` sets how far each row travels.
//
// DISTINCT from scroll-fade-stack (which fades/lifts the WHOLE card through one
// band): here the card is decomposed into independent rows that arrive in
// sequence. Reads userData.scroll live each seek; CPU-driven and observable
// (a band's opacity & position.y change across scroll). Scroll/card/medium.
//
// Structural control: `bands` rebuilds the child planes (onParamChange).

import {
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Color,
  type Object3D,
} from 'three';
import { defineAnimatable } from '../base';
import { clamp, num, type ControlValue, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'bands', label: 'Bands', type: 'knob', min: 3, max: 8, step: 1, default: 5 },
  { id: 'stagger', label: 'Stagger', type: 'knob', min: 0, max: 0.5, step: 0.01, default: 0.18 },
  { id: 'lift', label: 'Lift', type: 'fader', min: 0.3, max: 3, step: 0.1, default: 1.2 },
] as const;

const BAND_COLOR = '#7ea2ff';

/** Read the host-supplied scroll value (0..1), tolerant of shape. */
function readScroll(userData: Record<string, unknown>): number {
  const s = userData.scroll;
  if (typeof s === 'number' && Number.isFinite(s)) return clamp(s, 0, 1);
  return 0.5;
}

export const scrollStaggerRisePrimitive: PrimitiveDefinition = {
  name: 'scroll-stagger-rise',
  label: 'Scroll Stagger Rise',
  category: 'scroll',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'scroll',
  schema: SCHEMA,
  description:
    'Bands of the card rise and fade in staggered as scroll advances, like list rows arriving one by one.',
  create: defineAnimatable(
    { name: 'scroll-stagger-rise', category: 'scroll', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;

      // Container for our generated band planes, parented to the subject so it
      // co-moves under any outer transform.
      const bandGroup = new Group();
      bandGroup.name = 'stagger-rise-bands';
      subject.add(bandGroup);

      // The base position each band settles to (offset slightly in front of the
      // card face so the rows read clearly).
      const FACE_Z = 0.085;
      const BAND_W = 1.3;
      const BAND_H = 0.13;
      const BAND_GAP = 0.05;

      interface BandRec {
        mesh: Mesh;
        material: MeshBasicMaterial;
        settledY: number;
      }
      let bands: BandRec[] = [];

      const buildBands = (count: number) => {
        // Tear down any existing bands.
        for (const b of bands) {
          bandGroup.remove(b.mesh);
          b.mesh.geometry.dispose();
          b.material.dispose();
        }
        bands = [];

        const n = Math.max(1, Math.round(count));
        // Stack the rows vertically, centered.
        const stride = BAND_H + BAND_GAP;
        const total = n * BAND_H + (n - 1) * BAND_GAP;
        for (let i = 0; i < n; i++) {
          const material = new MeshBasicMaterial({
            color: new Color(BAND_COLOR),
            transparent: true,
            opacity: 0,
            depthWrite: false,
          });
          const mesh = new Mesh(new PlaneGeometry(BAND_W, BAND_H), material);
          // Top row first (i=0 highest).
          const settledY = total / 2 - BAND_H / 2 - i * stride;
          mesh.position.set(0, settledY, FACE_Z);
          mesh.name = `stagger-band-${i}`;
          bandGroup.add(mesh);
          bands.push({ mesh, material, settledY });
        }
      };

      buildBands(num(params.bands, 5));

      const apply = (scroll: number) => {
        const n = bands.length;
        if (n === 0) return;
        const stagger = clamp(num(params.stagger, 0.18), 0, 0.5);
        const lift = num(params.lift, 1.2);

        // Each band b reveals when scroll passes its reveal point, then completes
        // its arrival across a window. We lay reveal points + windows out so the
        // LAST band finishes exactly at scroll=1: the bands occupy [0,1] minus
        // the `stagger` head-start gaps between successive rows.
        //
        // Per-band reveal start grows with i; the stagger knob lengthens the gap
        // between successive arrivals (offsets) relative to each band's own
        // arrival window. With offset = stagger * window, the last band starts at
        // (n-1)*stagger*window and must finish by 1 => window*(1 + (n-1)*stagger) = 1.
        const window = 1 / (1 + (n - 1) * stagger);
        const offset = stagger * window;

        for (let i = 0; i < n; i++) {
          const b = bands[i];
          const revealStart = i * offset;
          const w = clamp((scroll - revealStart) / Math.max(1e-4, window), 0, 1);

          // Opacity ramps 0 -> 1; position.y rises from below up to settled.
          b.material.opacity = w;
          b.mesh.position.y = b.settledY - lift * (1 - w);
        }
      };

      return {
        // Stateful, scroll-driven: animate continuously. Map the master clock to
        // a scroll sweep when no live host scroll is present so the tile plays.
        duration: () => Infinity,
        seek: (t) => {
          const ud = target.userData;
          const hasScroll = typeof ud.scroll === 'number' && Number.isFinite(ud.scroll as number);
          const scroll = hasScroll ? readScroll(ud) : clamp((t % 4) / 4, 0, 1);
          apply(scroll);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'bands') {
            buildBands(num(value, 5));
          }
        },
        dispose: () => {
          for (const b of bands) {
            bandGroup.remove(b.mesh);
            b.mesh.geometry.dispose();
            b.material.dispose();
          }
          bands = [];
          subject.remove(bandGroup);
        },
      };
    },
  ),
};
