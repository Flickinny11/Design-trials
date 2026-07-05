import { describe, it, expect } from 'vitest';
import {
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Scene,
  type Material,
  type Object3D,
} from 'three';
import { decodeTextPrimitive } from '@/lib/prism/animatable/primitives/decode-text';
import type { AnimatableTarget } from '@/lib/prism/animatable/contract';
import { makeTarget, runConformance } from './_conformance';

type Mat = Material & { opacity: number; emissiveIntensity?: number };

function glyphRow(target: { subject: Object3D | null; object: Object3D }): Object3D[] {
  const root = target.subject ?? target.object;
  return root.children.length > 0 ? [...root.children] : [root];
}

/** Count glyphs at their locked base position (offset ~0) for phase p. */
function lockedCount(glyphs: Object3D[], bases: Array<{ x: number; y: number }>): number {
  let c = 0;
  for (let i = 0; i < glyphs.length; i++) {
    const dx = glyphs[i].position.x - bases[i].x;
    const dy = glyphs[i].position.y - bases[i].y;
    if (Math.hypot(dx, dy) < 1e-6) c++;
  }
  return c;
}

describe('decode-text primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(decodeTextPrimitive).dispose();
  });

  it('plays: locked-glyph count grows left-to-right over time', () => {
    const target = makeTarget(decodeTextPrimitive);
    const glyphs = glyphRow(target);
    const bases = glyphs.map((g) => ({ x: g.position.x, y: g.position.y }));
    const inst = decodeTextPrimitive.create(target);
    const dur = inst.duration();

    inst.seek(0.001);
    const earlyLocked = lockedCount(glyphs, bases);
    // Record a pre-reveal glyph's offset at an early frame (last glyph not yet revealed).
    const last = glyphs[glyphs.length - 1];
    inst.seek(dur * 0.1);
    const preOffset = Math.hypot(last.position.x - bases[bases.length - 1].x, last.position.y - bases[bases.length - 1].y);

    inst.seek(dur * 0.6);
    const midLocked = lockedCount(glyphs, bases);

    inst.seek(dur);
    const endLocked = lockedCount(glyphs, bases);
    const lockedOffset = Math.hypot(last.position.x - bases[bases.length - 1].x, last.position.y - bases[bases.length - 1].y);

    // More glyphs locked as time advances; all locked at the end.
    expect(midLocked).toBeGreaterThan(earlyLocked);
    expect(endLocked).toBe(glyphs.length);
    // A pre-reveal glyph's offset differs from its locked (zero) state.
    expect(preOffset).toBeGreaterThan(lockedOffset + 0.01);
    expect(lockedOffset).toBeLessThan(1e-6);
    inst.dispose();
  });

  it('controls change output: higher jitter intensity means larger pre-reveal offset', () => {
    const target = makeTarget(decodeTextPrimitive);
    const glyphs = glyphRow(target);
    const bases = glyphs.map((g) => ({ x: g.position.x, y: g.position.y }));
    const last = glyphs.length - 1;
    const inst = decodeTextPrimitive.create(target);
    const dur = inst.duration();

    inst.setControl('intensity', 0.04);
    inst.seek(dur * 0.05);
    const small = Math.hypot(glyphs[last].position.x - bases[last].x, glyphs[last].position.y - bases[last].y);

    inst.setControl('intensity', 1.2);
    inst.seek(dur * 0.05);
    const large = Math.hypot(glyphs[last].position.x - bases[last].x, glyphs[last].position.y - bases[last].y);

    expect(large).toBeGreaterThan(small + 0.05);
    inst.dispose();
  });
});

// ── Regression suite: mounted-artifact realities (bindings.ts) ──────────────
// In the real app the subject is the MSDF 'text-object' group whose glyph-*
// children mount ASYNCHRONOUSLY after attach, and instances can overlap
// (double-attach / mode toggle). These tests reproduce the advocate-r1
// "sticks mid-scramble / locks to wrong positions" bug.

/** A mounted-artifact-shaped target: empty 'text-object' group (glyphs still
 *  streaming in), exactly what bindings.ts hands a text primitive. */
function makeStreamingTextTarget(): { target: AnimatableTarget; row: Group } {
  const scene = new Scene();
  const object = new Group();
  object.name = 'primitive-root';
  const row = new Group();
  row.name = 'text-object';
  object.add(row);
  scene.add(object);
  return {
    target: { object, subject: row, scene, userData: { pointer: { x: 0.5, y: 0.5 }, scroll: 0.5 } },
    row,
  };
}

/** A glyph unit like text-object.ts builds: a Mesh at its layout position.
 *  transparent:false on purpose — the primitive must restore the flag. */
function makeGlyph(i: number): Mesh {
  const mesh = new Mesh(
    new BoxGeometry(0.2, 0.46, 0.1),
    new MeshStandardMaterial({
      color: '#cd9f55',
      emissive: '#141921',
      emissiveIntensity: 0.7,
      transparent: false,
      opacity: 1,
    }),
  );
  mesh.name = `glyph-${i}`;
  mesh.position.set(-0.6 + i * 0.27, 0.03 * i, 0);
  return mesh;
}

function offsetOf(g: Object3D, base: { x: number; y: number }): number {
  return Math.hypot(g.position.x - base.x, g.position.y - base.y);
}

describe('decode-text regressions (late glyphs, instance overlap, exact final lock)', () => {
  it('animates glyphs ADDED after create() and ends them locked at their own base', () => {
    const { target, row } = makeStreamingTextTarget();
    const inst = decodeTextPrimitive.create(target);
    const dur = inst.duration();

    // Attach ran before the artifact finished streaming — no glyphs yet.
    inst.seek(dur * 0.05);

    const glyphs = [0, 1, 2, 3, 4].map(makeGlyph);
    const bases = glyphs.map((g) => ({ x: g.position.x, y: g.position.y }));
    for (const g of glyphs) row.add(g);

    // Mid-scramble: the late-arrived glyphs must be tracked and visibly driven.
    inst.seek(dur * 0.1);
    const driven = glyphs.filter(
      (g, i) =>
        offsetOf(g, bases[i]) > 1e-4 ||
        Math.abs(g.scale.x - 1) > 1e-4 ||
        (g.material as Mat).opacity !== 1,
    );
    expect(driven.length, 'late-arrived glyphs are animated').toBeGreaterThan(0);

    // Final frame: every glyph EXACTLY at its own base, opacity 1.
    inst.seek(dur);
    glyphs.forEach((g, i) => {
      expect(g.position.x).toBeCloseTo(bases[i].x, 10);
      expect(g.position.y).toBeCloseTo(bases[i].y, 10);
      expect(g.scale.x).toBeCloseTo(1, 10);
      expect((g.material as Mat).opacity).toBe(1);
    });
    inst.dispose();
  });

  it('a second instance never adopts a mid-scramble pose as base (lock-to-wrong-position bug)', () => {
    const target = makeTarget(decodeTextPrimitive);
    const glyphs = glyphRow(target);
    const bases = glyphs.map((g) => ({ x: g.position.x, y: g.position.y }));

    const a = decodeTextPrimitive.create(target);
    const dur = a.duration();
    a.seek(dur * 0.12); // mid-scramble — glyphs displaced
    expect(
      glyphs.some((g, i) => offsetOf(g, bases[i]) > 1e-4),
      'sanity: instance A actually displaced glyphs',
    ).toBe(true);

    // Double-attach: B is created while A holds glyphs in jittered poses.
    const b = decodeTextPrimitive.create(target);
    a.dispose();
    b.seek(dur); // run B to completion

    glyphs.forEach((g, i) => {
      expect(g.position.x, `glyph ${i} locks at the TRUE base`).toBeCloseTo(bases[i].x, 10);
      expect(g.position.y, `glyph ${i} locks at the TRUE base`).toBeCloseTo(bases[i].y, 10);
    });
    b.dispose();

    // Canonical-base bookkeeping leaves no residue once the last instance is gone.
    for (const g of glyphs) {
      expect(Object.keys(g.userData)).toHaveLength(0);
      const mats = Array.isArray((g as Mesh).material)
        ? ((g as Mesh).material as Material[])
        : [(g as Mesh).material as Material];
      for (const m of mats) expect(Object.keys(m.userData)).toHaveLength(0);
    }
  });

  it('at t >= duration every glyph (including the last) is exactly at base with opacity/emissive restored', () => {
    const target = makeTarget(decodeTextPrimitive);
    const glyphs = glyphRow(target);
    const bases = glyphs.map((g) => ({
      x: g.position.x,
      y: g.position.y,
      sx: g.scale.x,
      mats: ((Array.isArray((g as Mesh).material)
        ? (g as Mesh).material
        : [(g as Mesh).material]) as Mat[]).map((m) => ({
        m,
        opacity: m.opacity,
        emissive: m.emissiveIntensity,
      })),
    }));

    const inst = decodeTextPrimitive.create(target);
    const dur = inst.duration();
    inst.seek(dur * 0.4); // scramble
    for (const t of [dur, dur * 2]) {
      inst.seek(t);
      glyphs.forEach((g, i) => {
        expect(offsetOf(g, bases[i])).toBeLessThan(1e-9);
        expect(g.scale.x).toBeCloseTo(bases[i].sx, 10);
        for (const rec of bases[i].mats) {
          expect(rec.m.opacity).toBe(rec.opacity);
          if (typeof rec.emissive === 'number') {
            expect(rec.m.emissiveIntensity).toBe(rec.emissive);
          }
        }
      });
    }
    inst.dispose();
  });

  it('dispose restores EVERYTHING for create-time AND late-discovered glyphs (pose, opacity, transparent, userData)', () => {
    const { target, row } = makeStreamingTextTarget();
    // Two glyphs present at create (transparent:false must round-trip)…
    const initial = [0, 1].map(makeGlyph);
    for (const g of initial) row.add(g);

    const inst = decodeTextPrimitive.create(target);
    const dur = inst.duration();
    inst.seek(dur * 0.08);

    // …three more land mid-play (async MSDF mount).
    const late = [2, 3, 4].map(makeGlyph);
    for (const g of late) row.add(g);
    inst.seek(dur * 0.12); // tracked + displaced

    inst.dispose();

    for (const g of [...initial, ...late]) {
      const i = Number(g.name.split('-')[1]);
      expect(g.position.x).toBeCloseTo(-0.6 + i * 0.27, 10);
      expect(g.position.y).toBeCloseTo(0.03 * i, 10);
      expect(g.scale.x).toBeCloseTo(1, 10);
      const m = g.material as Mat;
      expect(m.opacity).toBe(1);
      expect(m.transparent, 'transparent flag restored').toBe(false);
      expect(m.emissiveIntensity).toBe(0.7);
      expect(Object.keys(g.userData)).toHaveLength(0);
      expect(Object.keys(m.userData)).toHaveLength(0);
    }
  });
});
