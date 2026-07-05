import { describe, it, expect } from 'vitest';
import { Color, Mesh, MeshStandardMaterial, Texture } from 'three';
import { hoverDisplacementMapPrimitive } from '@/lib/prism/animatable/primitives/hover-displacement-map';
import { makeTarget, runConformance } from './_conformance';

type Uniform<T = number> = { value: T };
interface ReliefStash {
  /** Persisted pointer-proximity envelope (0 idle → ~0.7-0.9 at the engaged pin). */
  uProx: Uniform;
  /** Relief depth in LOCAL units (reliefDepth × shortSide). */
  uDepth: Uniform;
  /** Pattern scale uniform. */
  uScale: Uniform;
  /** Active pattern index (0 noise / 1 concentric / 2 diagonal-weave). */
  uPattern: Uniform;
  /** CPU mirror of the embossed relief height at the subject center — what the
   *  chrome rides; the load-bearing "is the relief actually deepening?" probe. */
  reliefAt: (sx: number, sy: number) => number;
  /** Peak |relief| sampled across the panel at the current state. */
  peakRelief: () => number;
}

/** Drive the rig pointer the way the catalog harness does: pinned engaged at
 *  {0.62, 0.5}, repeated seeks at the same t, then disengaged (absent). */
const ENGAGED = { x: 0.62, y: 0.5 };

describe('hover-displacement-map primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(hoverDisplacementMapPrimitive).dispose();
  });

  it('declares the texture-preserving displacement contract (mountable)', () => {
    expect(hoverDisplacementMapPrimitive.category).toBe('displacement');
    expect(hoverDisplacementMapPrimitive.mountable).toBe(true);
    expect(hoverDisplacementMapPrimitive.subject).toBe('card');
    expect(hoverDisplacementMapPrimitive.defaultDriver).toBe('pointer');
  });

  it('idle (pointer disengaged, t=0) leaves the surface essentially flat and legible', () => {
    const target = makeTarget(hoverDisplacementMapPrimitive);
    delete (target.userData as Record<string, unknown>).pointer; // disengaged
    const inst = hoverDisplacementMapPrimitive.create(target);
    const stash = target.userData.hoverDisplacementMap as ReliefStash;

    // The idle frame is pinned at t=0, pointer absent: the proximity envelope
    // starts at 0 and the relief must be flat — no sampled frame may be empty
    // and the rest frame must be undistorted.
    inst.seek(0);
    expect(stash.uProx.value).toBeLessThan(1e-6);
    expect(stash.peakRelief()).toBeLessThan(1e-4);

    // Many disengaged seeks: the envelope must settle back toward 0.
    for (let i = 0; i < 240; i++) inst.seek(i * 0.05);
    expect(stash.uProx.value).toBeLessThan(0.02);
    expect(stash.peakRelief()).toBeLessThan(1e-3);
    inst.dispose();
  });

  it('embosses under the pointer: relief deepens with proximity (3 stimulus values)', () => {
    // The relief depth at the settled state must be a concrete, growing function
    // of how near the cursor is to the subject center — the §11 "deepening as
    // the cursor nears" requirement, sampled at three distances.
    const sample = (px: number): number => {
      const target = makeTarget(hoverDisplacementMapPrimitive);
      const inst = hoverDisplacementMapPrimitive.create(target);
      const stash = target.userData.hoverDisplacementMap as ReliefStash;
      // Settle the proximity envelope at this pointer x (repeated engaged seeks).
      for (let i = 0; i < 200; i++) {
        (target.userData as Record<string, unknown>).pointer = { x: px, y: 0.5 };
        inst.seek(1 + i * 0.05);
      }
      const relief = stash.peakRelief();
      inst.dispose();
      return relief;
    };

    const far = sample(0.5 + 0.46); // cursor well off the card center → low proximity
    const mid = sample(0.62); // the harness engaged pin → proximity 0.7-0.9
    const near = sample(0.5); // dead center → maximum proximity

    expect(near).toBeGreaterThan(1e-3); // a real embossed relief exists
    expect(near).toBeGreaterThan(mid); // nearer cursor → deeper relief
    expect(mid).toBeGreaterThan(far); // engaged pin still embosses more than far
  });

  it('engaged relief is at SUBSTANTIAL amplitude (well above the discoverability floor)', () => {
    // At the harness engaged pin the relief must be a real, sizeable emboss — not
    // a faint accidental wobble. As a fraction of the subject's short side the
    // peak relief must read clearly (depth 0.16 × prox ~0.79 × |field|~0.4-0.5).
    const target = makeTarget(hoverDisplacementMapPrimitive);
    const inst = hoverDisplacementMapPrimitive.create(target);
    const stash = target.userData.hoverDisplacementMap as ReliefStash;
    for (let i = 0; i < 200; i++) {
      (target.userData as Record<string, unknown>).pointer = { ...ENGAGED };
      inst.seek(1 + i * 0.05);
    }
    // The proximity envelope sits high at the pin, and the peak relief is a clear
    // emboss (≥ 1.5% of the short side ≈ 0.16 default depth × 0.79 prox × ~0.15
    // peak field margin) — comfortably above any discoverability floor.
    expect(stash.uProx.value).toBeGreaterThan(0.6);
    expect(stash.peakRelief()).toBeGreaterThan(0.012);
    inst.dispose();
  });

  it('proximityRange visibly DEEPENS the relief at the FROZEN engaged pin (the dead-control fix)', () => {
    // The advocate found proximityRange byte-identical low→high. The harness pins
    // the SAME engaged pointer {0.62,0.5} and sweeps the control. So at that exact
    // pin, a wider range MUST yield a deeper settled relief — this is the precise
    // proof the previously-dead control now reshapes the engaged frame.
    const settledAt = (range: number): { prox: number; relief: number } => {
      const target = makeTarget(hoverDisplacementMapPrimitive);
      const inst = hoverDisplacementMapPrimitive.create(target);
      const stash = target.userData.hoverDisplacementMap as ReliefStash;
      inst.setControl('proximityRange', range);
      for (let i = 0; i < 200; i++) {
        (target.userData as Record<string, unknown>).pointer = { ...ENGAGED };
        inst.seek(1 + i * 0.05);
      }
      const out = { prox: stash.uProx.value, relief: stash.peakRelief() };
      inst.dispose();
      return out;
    };
    const tight = settledAt(0.4); // narrowest reach
    const wide = settledAt(1.5); // widest reach
    // At the SAME engaged pin, the wider range engages markedly more proximity and
    // a markedly deeper relief — a large, unmistakable spread (not byte-identical).
    expect(wide.prox).toBeGreaterThan(tight.prox + 0.25);
    expect(wide.relief).toBeGreaterThan(tight.relief * 1.5);
    // And onParamChange writes the new range into the live param so the next
    // engaged seek converges toward the new (higher) target: switching from the
    // tight to the wide range on an already-engaged instance lifts the envelope.
    const target = makeTarget(hoverDisplacementMapPrimitive);
    const inst = hoverDisplacementMapPrimitive.create(target);
    const stash = target.userData.hoverDisplacementMap as ReliefStash;
    let tk = 1;
    inst.setControl('proximityRange', 0.4);
    for (let i = 0; i < 200; i++) {
      (target.userData as Record<string, unknown>).pointer = { ...ENGAGED };
      inst.seek((tk += 0.05));
    }
    const proxTight = stash.uProx.value;
    inst.setControl('proximityRange', 1.5);
    // Advance time so the envelope integrates toward the new, higher target.
    for (let i = 0; i < 60; i++) {
      (target.userData as Record<string, unknown>).pointer = { ...ENGAGED };
      inst.seek((tk += 0.05));
    }
    expect(stash.uProx.value).toBeGreaterThan(proxTight + 0.1);
    inst.dispose();
  });

  it('proximityRange is LIVE under the EXACT advocate capture protocol (single pinned seek + frozen control sweep)', () => {
    // The advocate capture pins the engaged pose with ONE seek(t=1), then sweeps
    // each slider via setControl→onParamChange→apply(lastT) with NO further time
    // advance (dt=0). The OLD temporal integrator was frozen at dt=0 so the
    // proximityRange frames came out byte-identical (the DEAD control). This test
    // reproduces that exact protocol and asserts the standing relief now changes.
    const target = makeTarget(hoverDisplacementMapPrimitive);
    const inst = hoverDisplacementMapPrimitive.create(target);
    const stash = target.userData.hoverDisplacementMap as ReliefStash;

    // Pin the engaged pose with a SINGLE seek (exactly as the capture does).
    (target.userData as Record<string, unknown>).pointer = { ...ENGAGED };
    inst.seek(1);
    // Snapping on engage means one pinned seek already stands at a real relief.
    expect(stash.uProx.value).toBeGreaterThan(0.2);
    expect(stash.peakRelief()).toBeGreaterThan(1e-3);

    // FROZEN control sweep — no seek between slider positions, just setControl
    // (which re-applies at lastT=1 with dt=0, exactly like the harness).
    const reliefAtRange = (range: number): { prox: number; relief: number } => {
      inst.setControl('proximityRange', range);
      return { prox: stash.uProx.value, relief: stash.peakRelief() };
    };
    const low = reliefAtRange(0.4); // narrowest reach → shallow standing relief
    const mid = reliefAtRange(0.9);
    const high = reliefAtRange(1.5); // widest reach → deep standing relief

    // At the SAME frozen pinned pose, a wider range stands at a markedly deeper
    // relief — the previously byte-identical control is now unmistakably live.
    expect(high.prox).toBeGreaterThan(low.prox + 0.3);
    expect(mid.prox).toBeGreaterThan(low.prox + 0.05);
    expect(high.prox).toBeGreaterThan(mid.prox + 0.05);
    expect(high.relief).toBeGreaterThan(low.relief * 1.5);
    // The relief magnitude is a STRICTLY monotone function of the range across
    // the sweep — no plateau, no dead segment (the meanAbsDiff=0 failure mode).
    expect(mid.relief).toBeGreaterThan(low.relief);
    expect(high.relief).toBeGreaterThan(mid.relief);
    inst.dispose();
  });

  it('patternScale stays a LOW-FREQUENCY tactile emboss at the slider MAX (no starfield aliasing)', () => {
    // The grain/starfield defect: at high patternScale the relief aliased into a
    // per-pixel sparkle. The slider must map through a BOUNDED effective
    // frequency so even the max is a coherent emboss whose wavelength stays
    // several vertices wide on the sheet — adjacent samples differ by only a
    // small fraction of the peak, never full-amplitude white noise.
    const target = makeTarget(hoverDisplacementMapPrimitive);
    const inst = hoverDisplacementMapPrimitive.create(target);
    const stash = target.userData.hoverDisplacementMap as ReliefStash;
    inst.setControl('pattern', 'noise');
    inst.setControl('reliefDepth', 0.3);
    inst.setControl('patternScale', 6); // the slider MAX — worst case for grain
    for (let i = 0; i < 50; i++) {
      (target.userData as Record<string, unknown>).pointer = { x: 0.5, y: 0.5 };
      inst.seek(1 + i * 0.05);
    }
    const peak = stash.peakRelief();
    expect(peak).toBeGreaterThan(1e-3);
    // Dense scan at the sheet resolution; the per-step change must stay a small
    // fraction of the peak even at the slider max (a starfield would step by the
    // full peak between neighbours).
    let maxStep = 0;
    let prev = stash.reliefAt(-0.4, 0.06);
    for (let i = 1; i <= 200; i++) {
      const x = -0.4 + i * 0.004;
      const cur = stash.reliefAt(x, 0.06);
      maxStep = Math.max(maxStep, Math.abs(cur - prev));
      prev = cur;
    }
    expect(maxStep).toBeLessThan(peak * 0.34);
    inst.dispose();
  });

  it('the relief is a COHERENT smooth field, not per-vertex stipple', () => {
    // The grain defect: adjacent samples of the OLD white-noise differed by ~full
    // amplitude (white noise). The smooth (bilinear, smoothstep-faded) value noise
    // must be C1-continuous — adjacent samples a small fraction of the wavelength
    // apart differ by only a SMALL fraction of the local relief magnitude.
    const target = makeTarget(hoverDisplacementMapPrimitive);
    const inst = hoverDisplacementMapPrimitive.create(target);
    const stash = target.userData.hoverDisplacementMap as ReliefStash;
    inst.setControl('pattern', 'noise');
    inst.setControl('patternScale', 2.4);
    inst.setControl('reliefDepth', 0.3);
    for (let i = 0; i < 200; i++) {
      (target.userData as Record<string, unknown>).pointer = { x: 0.5, y: 0.5 };
      inst.seek(1 + i * 0.05);
    }
    // Sample a dense scan line; the max step between neighbours 0.005 (subject-
    // local) apart must be a small fraction of the peak relief — coherent, not
    // a stipple field that flips full-amplitude between adjacent vertices.
    const peak = stash.peakRelief();
    expect(peak).toBeGreaterThan(1e-3);
    let maxStep = 0;
    let prev = stash.reliefAt(-0.4, 0.06);
    for (let i = 1; i <= 160; i++) {
      const x = -0.4 + i * 0.005;
      const cur = stash.reliefAt(x, 0.06);
      maxStep = Math.max(maxStep, Math.abs(cur - prev));
      prev = cur;
    }
    // A white-noise field would step by ~the full peak between neighbours; a
    // coherent field steps by well under a third of it.
    expect(maxStep).toBeLessThan(peak * 0.34);
    inst.dispose();
  });

  it('proximity envelope rises with engagement and persists across repeated seeks', () => {
    const target = makeTarget(hoverDisplacementMapPrimitive);
    const inst = hoverDisplacementMapPrimitive.create(target);
    const stash = target.userData.hoverDisplacementMap as ReliefStash;

    // Repeated seeks at the SAME engaged pin must hold a steady, real proximity
    // (the harness drives the control sweep this way).
    for (let i = 0; i < 200; i++) {
      (target.userData as Record<string, unknown>).pointer = { ...ENGAGED };
      inst.seek(1 + i * 0.05);
    }
    expect(stash.uProx.value).toBeGreaterThan(0.5); // engaged pin sits 0.7-0.9
    // It stays steady on yet more seeks at the same point (no drift to 0).
    inst.seek(1 + 200 * 0.05);
    expect(stash.uProx.value).toBeGreaterThan(0.5);
    inst.dispose();
  });

  it('controls reshape the relief at the pinned engaged state', () => {
    const target = makeTarget(hoverDisplacementMapPrimitive);
    const inst = hoverDisplacementMapPrimitive.create(target);
    const stash = target.userData.hoverDisplacementMap as ReliefStash;
    const settle = () => {
      for (let i = 0; i < 200; i++) {
        (target.userData as Record<string, unknown>).pointer = { ...ENGAGED };
        inst.seek(1 + i * 0.05);
      }
    };

    // Relief depth: drives the emboss height at the same engaged state, and
    // onParamChange must re-apply at the last seek (control gate pins one t).
    inst.setControl('reliefDepth', 0.03);
    settle();
    const shallow = stash.peakRelief();
    inst.setControl('reliefDepth', 0.28);
    const deep = stash.peakRelief();
    expect(deep).toBeGreaterThan(shallow + 1e-3);

    // Pattern scale: the scale uniform follows its control.
    inst.setControl('patternScale', 2);
    const lowScale = stash.uScale.value;
    inst.setControl('patternScale', 9);
    expect(stash.uScale.value).toBeGreaterThan(lowScale + 1);

    // Pattern dropdown: switching patterns reshapes the relief field (a
    // different procedural map → a different peak at the same engaged state).
    inst.setControl('reliefDepth', 0.2);
    inst.setControl('pattern', 'noise');
    settle();
    const noisePeak = stash.peakRelief();
    const noiseIdx = stash.uPattern.value;
    inst.setControl('pattern', 'concentric');
    settle();
    const concentricPeak = stash.peakRelief();
    const concentricIdx = stash.uPattern.value;
    inst.setControl('pattern', 'diagonal-weave');
    settle();
    const weavePeak = stash.peakRelief();
    const weaveIdx = stash.uPattern.value;
    // The pattern index moved across all three, and every pattern produces a
    // real (non-empty) relief at the engaged state.
    expect(new Set([noiseIdx, concentricIdx, weaveIdx]).size).toBe(3);
    expect(noisePeak).toBeGreaterThan(1e-3);
    expect(concentricPeak).toBeGreaterThan(1e-3);
    expect(weavePeak).toBeGreaterThan(1e-3);

    // Proximity range: a wider range engages the relief from farther away, so at
    // an off-center pin the relief is stronger with a wider range.
    const offCenter = () => {
      for (let i = 0; i < 200; i++) {
        (target.userData as Record<string, unknown>).pointer = { x: 0.8, y: 0.5 };
        inst.seek(1 + i * 0.05);
      }
    };
    inst.setControl('proximityRange', 0.5);
    offCenter();
    const tight = stash.peakRelief();
    inst.setControl('proximityRange', 1.4);
    offCenter();
    const wide = stash.peakRelief();
    expect(wide).toBeGreaterThan(tight + 1e-4);

    inst.dispose();
  });

  it('preserves the subject look: shares .map by reference when present', () => {
    const target = makeTarget(hoverDisplacementMapPrimitive);
    const panel = target.subject as Mesh;
    const liveMat = panel.material as MeshStandardMaterial;
    const tex = new Texture();
    liveMat.map = tex;
    liveMat.needsUpdate = true;

    const inst = hoverDisplacementMapPrimitive.create(target);
    // Seek so the sheet builds/rebinds against the live (now-textured) material.
    (target.userData as Record<string, unknown>).pointer = { ...ENGAGED };
    inst.seek(1);

    // The overlay sheet must exist and its colorNode must reference the SAME
    // Texture instance — never a clone, never an invented fill.
    const overlay = target.object.getObjectByName('hover-displacement-map-overlay');
    expect(overlay, 'overlay group exists').toBeTruthy();
    const sheet = overlay!.getObjectByName('hover-displacement-map-sheet') as Mesh;
    expect(sheet, 'sheet exists').toBeTruthy();
    expect(sheetMatColorReferences(sheet, tex)).toBe(true);

    inst.dispose();
    tex.dispose();
  });

  it('preserves the subject look: copies color + PBR scalars when map-less', () => {
    const target = makeTarget(hoverDisplacementMapPrimitive);
    const panel = target.subject as Mesh;
    const liveMat = panel.material as MeshStandardMaterial;
    liveMat.map = null;
    liveMat.color = new Color('#cd9f55');
    liveMat.roughness = 0.21;
    liveMat.metalness = 0.66;

    const inst = hoverDisplacementMapPrimitive.create(target);
    (target.userData as Record<string, unknown>).pointer = { ...ENGAGED };
    inst.seek(1);

    const overlay = target.object.getObjectByName('hover-displacement-map-overlay');
    const sheet = overlay!.getObjectByName('hover-displacement-map-sheet') as Mesh;
    const sheetMat = sheet.material as MeshStandardMaterial;
    // PBR scalars copied so it shades identically under the rig lights.
    expect(sheetMat.roughness).toBeCloseTo(0.21, 5);
    expect(sheetMat.metalness).toBeCloseTo(0.66, 5);
    inst.dispose();
  });

  it('co-treats chrome: header/rows become bent clones, the dot a rigid clone', () => {
    const target = makeTarget(hoverDisplacementMapPrimitive);
    const inst = hoverDisplacementMapPrimitive.create(target);
    (target.userData as Record<string, unknown>).pointer = { ...ENGAGED };
    inst.seek(1);

    const overlay = target.object.getObjectByName('hover-displacement-map-overlay');
    expect(overlay).toBeTruthy();
    // The catalog card has a header bar + 3 content rows (wide → bent) and an
    // accent dot (small → rigid). The card look must ride the relief, not vanish.
    const bent = overlay!.children.filter((c) =>
      c.name.startsWith('hover-displacement-map-chrome-bent'),
    );
    const rigid = overlay!.children.filter((c) =>
      c.name.startsWith('hover-displacement-map-chrome-rigid'),
    );
    expect(bent.length).toBeGreaterThanOrEqual(1); // header + rows ride the relief
    expect(rigid.length).toBeGreaterThanOrEqual(1); // the dot is posed rigidly
    inst.dispose();
  });

  it('dispose restores the subject exactly and re-shows it', () => {
    const target = makeTarget(hoverDisplacementMapPrimitive);
    const panel = target.subject as Mesh;
    const origMat = panel.material;
    const origVisible = panel.visible;
    const childCount = target.object.children.length;

    const inst = hoverDisplacementMapPrimitive.create(target);
    (target.userData as Record<string, unknown>).pointer = { ...ENGAGED };
    for (let i = 0; i < 30; i++) inst.seek(1 + i * 0.05);
    inst.dispose();

    // The subject's own material is never swapped; it is visible again; the
    // overlay group is gone; userData stash cleared.
    expect(panel.material).toBe(origMat);
    expect(panel.visible).toBe(origVisible);
    expect(target.object.getObjectByName('hover-displacement-map-overlay')).toBeFalsy();
    expect(target.object.children.length).toBe(childCount);
    expect(target.userData.hoverDisplacementMap).toBeUndefined();
  });
});

/** Walk a sheet material's colorNode tree shallowly looking for a texture node
 *  bound to `tex` (the shifted-UV double-read path keeps the map on a node, not
 *  the material's .map slot). */
function sheetMatColorReferences(sheet: Mesh, tex: Texture): boolean {
  const mat = sheet.material as { colorNode?: unknown };
  const seen = new Set<unknown>();
  const walk = (n: unknown, depth: number): boolean => {
    if (!n || typeof n !== 'object' || depth > 6 || seen.has(n)) return false;
    seen.add(n);
    if ((n as { value?: unknown }).value === tex) return true;
    for (const v of Object.values(n as Record<string, unknown>)) {
      if (walk(v, depth + 1)) return true;
    }
    return false;
  };
  return walk(mat.colorNode, 0);
}
