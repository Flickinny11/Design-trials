// decode-text — glyphs resolve out of a rapid scramble of jitter and flicker,
// locking into place left-to-right like a decryption reveal. HARD / text.
//
// CPU-driven and fully deterministic (index hash, NO Math.random). For each
// glyph i of N, a reveal threshold is (i+1)/(N+1) along the phase — every
// glyph (even a lone one) gets a scramble window, and ALL glyphs are locked
// strictly before p reaches 1. Before its threshold a glyph rapidly jitters
// its x/y offset (keyed to floor(t*rate)+i so it changes in discrete steps as
// the scramble clock ticks) and flickers opacity/emissive. As phase
// approaches the threshold the jitter amplitude ramps to 0; once passed the
// glyph locks (base pose, base opacity/emissive). The count of locked glyphs
// grows monotonically with t — a left-to-right sequential lock, distinct from
// whole-subject scramble and uniform-decay glitch-text.
//
// MOUNTED-ARTIFACT ROBUSTNESS (advocate-r1 "sticks mid-scramble" fix):
//
// 1. LIVE GLYPH ROW. The glyph row is re-synced on every seek (cheap O(N)
//    identity sweep over root.children): in the real app the subject is the
//    MSDF 'text-object' group whose glyph-* children mount ASYNCHRONOUSLY
//    after bindings.ts attaches (and setSpec rebuilds swap mesh identities).
//    Newly-arrived glyphs are captured lazily at their CURRENT (settled)
//    layout pose; glyphs that leave the row are settled back to base. An
//    empty Group simply waits for glyphs (it is never jittered wholesale); a
//    bare-Mesh subject is treated as a single glyph.
//
// 2. CANONICAL BASE HANDSHAKE. Each glyph's settled pose is recorded ONCE in
//    glyph.userData[DECODE_TEXT_BASE_KEY] (and each material's drive values in
//    material.userData[DECODE_TEXT_MATERIAL_BASE_KEY]), written only if
//    absent and refcounted across instances: a second instance created while
//    a first holds glyphs mid-jitter ADOPTS the stored canonical base instead
//    of reading the jittered transform, so glyphs can never "lock to wrong
//    positions". The record is deleted when the LAST live instance restores
//    (refs reaches 0) — after that, a fresh capture reads the (restored,
//    settled) layout again, so legitimate layout changes are picked up.
//
// 3. SUBJECT-RELATIVE AMPLITUDE. Jitter is sized from the glyph's own
//    measured extent (Box3, expressed in the row's local space) — never a
//    hardcoded world-unit amount — so the scramble reads identically on a
//    tiny caption and a hero headline.
//
// 4. FULL RESTORE. dispose() settles and releases EVERY glyph ever tracked
//    (including ones discovered mid-play): position, scale, opacity,
//    emissiveIntensity, the .transparent flag, and the userData records.

import { Box3, Mesh, Vector3, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { num, phase, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.5, max: 4, step: 0.1, default: 1.6, unit: 's' },
  { id: 'rate', label: 'Scramble', type: 'knob', min: 8, max: 40, step: 1, default: 22 },
  { id: 'intensity', label: 'Jitter', type: 'knob', min: 0, max: 1.2, step: 0.02, default: 0.5 },
] as const;

/** Deterministic per-(glyph,tick) hash in [-1,1]. No Math.random. */
const hash11 = (n: number): number => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
};

// ── Canonical-base records (cross-instance handshake, see header §2) ───────
/** glyph.userData key holding the canonical (settled) layout pose. */
export const DECODE_TEXT_BASE_KEY = 'prismDecodeTextBase';
/** material.userData key holding the canonical material drive values. */
export const DECODE_TEXT_MATERIAL_BASE_KEY = 'prismDecodeTextMaterialBase';

interface GlyphBaseRecord {
  x: number;
  y: number;
  sx: number;
  sy: number;
  sz: number;
  /** Live decode-text instances referencing this record. Deleted at 0. */
  refs: number;
}

interface MaterialBaseRecord {
  opacity: number;
  transparent: boolean;
  /** null when the material has no emissiveIntensity. */
  emissiveIntensity: number | null;
  /** Live decode-text instances referencing this record. Deleted at 0. */
  refs: number;
}

type AnimMaterial = Material & { opacity: number; emissiveIntensity?: number };

interface GlyphRef {
  obj: Object3D;
  base: GlyphBaseRecord;
  mats: AnimMaterial[];
  matBases: MaterialBaseRecord[];
  /** Jitter reference extent in the row's local units; null until measurable
   *  (e.g. a glyph whose geometry is still streaming) — re-measured on seek. */
  refSize: number | null;
}

// Module-level scratch (no per-seek allocation).
const _box = new Box3();
const _size = new Vector3();
const _scale = new Vector3();

/** Glyph extent expressed in the space its position is authored in (its
 *  parent's local space) — Box3 measures world, so divide the parent's world
 *  scale back out. Prefers height (the typographic constant across a row). */
function measureGlyphExtent(obj: Object3D): number | null {
  _box.setFromObject(obj);
  if (_box.isEmpty()) return null;
  _box.getSize(_size);
  const frame = obj.parent ?? obj;
  frame.getWorldScale(_scale);
  const sx = Math.abs(_scale.x) > 1e-9 ? _size.x / Math.abs(_scale.x) : _size.x;
  const sy = Math.abs(_scale.y) > 1e-9 ? _size.y / Math.abs(_scale.y) : _size.y;
  const ref = sy > 1e-6 ? sy : Math.max(sx, sy);
  return Number.isFinite(ref) && ref > 1e-6 ? ref : null;
}

export const decodeTextPrimitive: PrimitiveDefinition = {
  name: 'decode-text',
  label: 'Decode Text',
  category: 'text',
  difficulty: 'hard',
  subject: 'text',
  defaultDriver: 'time',
  description:
    'Glyphs resolve out of a rapid scramble of jitter and flicker, locking into place left-to-right like a decryption reveal.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'decode-text', category: 'text', schema: SCHEMA },
    (target, params) => {
      const root = target.subject ?? target.object;

      /** Every glyph this instance has EVER captured (drives dispose). */
      const tracked = new Map<Object3D, GlyphRef>();
      /** The current animation row, in left-to-right (child) order. */
      let row: GlyphRef[] = [];

      /** Settle a glyph to its canonical base (pose + material drive values).
       *  Leaves .transparent and the userData records alone — those belong to
       *  release(), since another live instance may still need them. */
      const settle = (g: GlyphRef): void => {
        g.obj.position.x = g.base.x;
        g.obj.position.y = g.base.y;
        g.obj.scale.set(g.base.sx, g.base.sy, g.base.sz);
        for (let m = 0; m < g.mats.length; m++) {
          g.mats[m].opacity = g.matBases[m].opacity;
          if (
            g.matBases[m].emissiveIntensity !== null &&
            typeof g.mats[m].emissiveIntensity === 'number'
          ) {
            g.mats[m].emissiveIntensity = g.matBases[m].emissiveIntensity as number;
          }
        }
      };

      /** Capture a glyph, adopting an existing canonical base record (so a
       *  mid-jitter pose left by another instance is never read as truth) or
       *  writing one from the current settled layout. Idempotent per glyph
       *  within this instance via `tracked`. */
      const capture = (obj: Object3D): GlyphRef => {
        const ud = obj.userData as Record<string, unknown>;
        let base = ud[DECODE_TEXT_BASE_KEY] as GlyphBaseRecord | undefined;
        if (base) {
          base.refs += 1;
        } else {
          base = {
            x: obj.position.x,
            y: obj.position.y,
            sx: obj.scale.x,
            sy: obj.scale.y,
            sz: obj.scale.z,
            refs: 1,
          };
          ud[DECODE_TEXT_BASE_KEY] = base;
        }

        const mats: AnimMaterial[] = [];
        const matBases: MaterialBaseRecord[] = [];
        obj.traverse((o) => {
          const m = (o as Mesh).material;
          if (!m) return;
          for (const mat of Array.isArray(m) ? m : [m]) {
            const am = mat as AnimMaterial;
            const mud = am.userData as Record<string, unknown>;
            let mb = mud[DECODE_TEXT_MATERIAL_BASE_KEY] as MaterialBaseRecord | undefined;
            if (mb) {
              mb.refs += 1;
            } else {
              mb = {
                opacity: am.opacity,
                transparent: am.transparent,
                emissiveIntensity:
                  typeof am.emissiveIntensity === 'number' ? am.emissiveIntensity : null,
                refs: 1,
              };
              mud[DECODE_TEXT_MATERIAL_BASE_KEY] = mb;
            }
            am.transparent = true; // needed for the flicker; restored by release()
            mats.push(am);
            matBases.push(mb);
          }
        });

        const g: GlyphRef = { obj, base, mats, matBases, refSize: measureGlyphExtent(obj) };
        tracked.set(obj, g);
        return g;
      };

      /** Settle + decrement the canonical records; delete them at refs 0 so
       *  the NEXT capture reads the (now restored) layout fresh. */
      const release = (g: GlyphRef): void => {
        settle(g);
        g.base.refs -= 1;
        if (g.base.refs <= 0) {
          delete (g.obj.userData as Record<string, unknown>)[DECODE_TEXT_BASE_KEY];
        }
        for (let m = 0; m < g.mats.length; m++) {
          const mb = g.matBases[m];
          mb.refs -= 1;
          if (mb.refs <= 0) {
            g.mats[m].transparent = mb.transparent;
            delete (g.mats[m].userData as Record<string, unknown>)[
              DECODE_TEXT_MATERIAL_BASE_KEY
            ];
          }
        }
      };

      /** The objects that SHOULD form the decode row right now: the root's
       *  children when it has any (the MSDF glyph units / catalog tiles); a
       *  bare-Mesh subject is itself the single glyph; an empty Group means
       *  the artifact is still streaming — wait, never jitter the root. */
      const desiredRow = (): Object3D[] => {
        if (root.children.length > 0) return root.children;
        return (root as Mesh).isMesh ? [root] : [];
      };

      /** Re-sync the row against the live scene graph. Cheap when nothing
       *  changed (length + identity sweep); on change, captures newcomers at
       *  their settled pose and settles leavers back to base. */
      const syncRow = (): void => {
        const want = desiredRow();
        if (want.length === row.length) {
          let same = true;
          for (let i = 0; i < want.length; i++) {
            if (row[i].obj !== want[i]) {
              same = false;
              break;
            }
          }
          if (same) return;
        }
        const wantSet = new Set(want);
        for (const g of row) {
          if (!wantSet.has(g.obj)) settle(g); // left the row — never freeze displaced
        }
        row = want.map((obj) => tracked.get(obj) ?? capture(obj));
      };

      syncRow(); // eager initial capture (settled subjects animate from frame 0)

      return {
        duration: () => num(params.duration, 1.6),
        seek: (t) => {
          syncRow();
          const N = row.length;
          if (N === 0) return; // glyphs still streaming in — nothing to drive yet

          const p = phase(t, num(params.duration, 1.6));
          const rate = num(params.rate, 22);
          const intensity = num(params.intensity, 0.5);
          // Discrete scramble clock — jitter changes in steps as it ticks.
          const tick = Math.floor(t * rate);

          for (let i = 0; i < N; i++) {
            const g = row[i];
            // (i+1)/(N+1): every glyph scrambles, all locked before p=1, and
            // the lock order is strictly left-to-right.
            const reveal = (i + 1) / (N + 1);
            if (p >= reveal) {
              settle(g); // locked: EXACT base pose, base opacity/emissive
              continue;
            }
            // Pre-reveal: jitter amplitude ramps to 0 approaching the threshold,
            // sized from the glyph's own extent (never hardcoded world units).
            if (g.refSize === null) g.refSize = measureGlyphExtent(g.obj);
            const ramp = 1 - p / reveal; // 1 → 0 approaching reveal
            const a = intensity * (g.refSize ?? 0) * ramp;
            const hx = hash11(i * 7.1 + tick * 1.7);
            const hy = hash11(i * 3.3 + tick * 2.9 + 11);
            const hf = hash11(i * 5.7 + tick * 0.91 + 53); // flicker
            g.obj.position.x = g.base.x + hx * a;
            g.obj.position.y = g.base.y + hy * a;
            const s = 1 + hf * 0.12 * ramp;
            g.obj.scale.set(g.base.sx * s, g.base.sy * s, g.base.sz * s);
            const flick = 0.35 + 0.5 * (hf * 0.5 + 0.5);
            for (let m = 0; m < g.mats.length; m++) {
              g.mats[m].opacity = g.matBases[m].opacity * flick;
              if (
                g.matBases[m].emissiveIntensity !== null &&
                typeof g.mats[m].emissiveIntensity === 'number'
              ) {
                g.mats[m].emissiveIntensity =
                  (g.matBases[m].emissiveIntensity as number) * (1 + (hf * 0.5 + 0.5) * 2.5);
              }
            }
          }
        },
        dispose: () => {
          // Restore EVERY glyph ever tracked — including ones discovered
          // mid-play — and hand the canonical records back (deleted at refs 0).
          for (const g of tracked.values()) release(g);
          tracked.clear();
          row = [];
        },
      };
    },
  ),
};
