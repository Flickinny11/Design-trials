// lightning-bolt — forked lightning cracks across the plane in sudden bright
// flashes. HARD / GPU primitive. Swaps the host plane's material for a
// MeshBasicNodeMaterial whose colorNode builds a jagged vertical bolt path
// (sum of sines of uv.y), draws a thin bright line via exp(-|uv.x - path|/
// thickness), adds a couple of branch bolts, and gates the whole thing with a
// step()-based flash so the bolt only lights up in sudden strikes (mostly
// dark). seek() advances the time uniform; onParamChange() updates live
// uniforms. A CPU-observable uFlash uniform mirrors the GPU flash gate so the
// effect is testable headless.

import { Mesh, type Material } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec3, float, sin, abs, exp, fract, step, floor } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'strikeRate', label: 'Strike Rate', type: 'knob', min: 0.2, max: 6, step: 0.1, default: 2, unit: '/s' },
  { id: 'thickness', label: 'Thickness', type: 'knob', min: 0.005, max: 0.05, step: 0.001, default: 0.02 },
  { id: 'branches', label: 'Branches', type: 'knob', min: 0, max: 4, step: 1, default: 2 },
] as const;

// Deterministic hash of a strike index — drives per-flash randomness so the
// flash gate is reproducible across reseeks.
const hashStrike = (n: number): number => {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

export const lightningBoltPrimitive: PrimitiveDefinition = {
  name: 'lightning-bolt',
  label: 'Lightning',
  category: 'volumetric',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'Forked lightning cracks across the scene in sudden bright flashes, branching jagged bolts that flicker and vanish.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'lightning-bolt', category: 'volumetric', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uTime = uniform(0);
      const uStrikeRate = uniform(num(params.strikeRate, 2));
      const uThickness = uniform(num(params.thickness, 0.02));
      const uBranches = uniform(num(params.branches, 2));
      // CPU-observable flash gate (0 mostly, 1 during a strike). Mirrors the
      // GPU step()-flash so headless tests can assert the bolt lights up.
      const uFlash = uniform(0);

      const u = uv();

      // Jagged vertical bolt path: x-offset at height uv.y = sum of sines.
      const f1 = float(11.0);
      const f2 = float(27.0);
      const seed = float(1.37);
      const boltPath = sin(u.y.mul(f1).add(seed))
        .add(sin(u.y.mul(f2)).mul(0.5))
        .mul(0.12)
        .add(0.5);

      // Main bolt: bright thin line centred on boltPath.
      const main = exp(abs(u.x.sub(boltPath)).div(uThickness).negate());

      // Two branch bolts: offset jagged paths, present when branches > 0/1.
      const branchPathA = sin(u.y.mul(f2).add(float(4.1)))
        .add(sin(u.y.mul(f1).mul(1.3)).mul(0.5))
        .mul(0.16)
        .add(0.34);
      const branchA = exp(abs(u.x.sub(branchPathA)).div(uThickness).negate())
        .mul(step(float(0.5), uBranches));

      const branchPathB = sin(u.y.mul(f1).add(float(2.7)))
        .add(sin(u.y.mul(f2).mul(0.8)).mul(0.5))
        .mul(0.18)
        .add(0.68);
      const branchB = exp(abs(u.x.sub(branchPathB)).div(uThickness).negate())
        .mul(step(float(1.5), uBranches));

      let bolt: any = main;
      bolt = bolt.add(branchA.mul(0.7));
      bolt = bolt.add(branchB.mul(0.7));

      // Flash gate: the bolt only lights up in sudden bright flashes. Most of
      // the time fract(...) sits below the threshold so the scene is dark. The
      // per-strike hash shifts the gate phase so strikes feel random.
      const strikePhase = uTime.mul(uStrikeRate);
      const strikeHash = fract(sin(floor(strikePhase).mul(12.9898)).mul(43758.5453));
      const flash = step(float(0.85), fract(strikePhase.add(strikeHash)));

      // Bright blue-white bolt color.
      const color = vec3(0.55, 0.7, 1.0).add(vec3(0.45, 0.3, 0.0));
      const colorNode = color.mul(bolt).mul(flash);
      const opacityNode = bolt.mul(flash);

      const mat = new MeshBasicNodeMaterial({ transparent: true });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
      (mat as unknown as { opacityNode: unknown }).opacityNode = opacityNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // CPU mirror of the GPU flash gate for the given time + strike rate.
      // The per-strike hash shifts the gate phase so strikes feel random while
      // staying deterministic across reseeks.
      const flashAt = (tt: number, rate: number): number => {
        const phase = tt * rate + hashStrike(Math.floor(tt * rate));
        const fr = phase - Math.floor(phase);
        return fr >= 0.85 ? 1 : 0;
      };

      return {
        duration: () => Infinity,
        seek: (tt) => {
          uTime.value = tt;
          // Read params live so control changes apply without a rebuild.
          uStrikeRate.value = num(params.strikeRate, 2);
          uThickness.value = num(params.thickness, 0.02);
          uBranches.value = num(params.branches, 2);
          const fl = flashAt(tt, num(params.strikeRate, 2));
          uFlash.value = fl;
          // Mirror the flash gate onto shared scratch so the host/tests can
          // observe the strike on CPU (headless has no real GPU).
          target.userData.flash = fl;
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'strikeRate') uStrikeRate.value = num(value, 2);
          else if (id === 'thickness') uThickness.value = num(value, 0.02);
          else if (id === 'branches') uBranches.value = num(value, 2);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
        },
      };
    },
  ),
};
