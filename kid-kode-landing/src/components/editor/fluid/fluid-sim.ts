'use client';

// PRISM FLUID SYSTEM — P-3 — THE GPU FLUID FIELD (spec §3.1).
//
// A real GPU fluid SIMULATION that EVOLVES STATE frame-to-frame with NO CPU
// round-trip. Two RenderTargets are ping-ponged through a TSL fragment pass that
// integrates a DAMPED WAVE-EQUATION height field coupled to an advecting velocity
// field — a screen-space, shallow-water-style solver:
//
//     h_next = (2 - a)·h - (1 - a)·h_prev + c²·∇²h  + advection + forcing + splat
//
// Because h_next depends on BOTH h AND h_prev (2nd-order state memory), ripples
// genuinely PROPAGATE and REFLECT off the ClampToEdge walls and decay — this is a
// real explicit-Euler PDE integrator, never static procedural noise. It is the
// verified-everywhere core: float RenderTargets + fragment passes are WebGL2-safe,
// so it runs identically on the WebGPU backend AND the headless WebGL2 fallback
// (compute()/StorageTexture would be WebGPU-only — that is the MLS-MPM volume's
// gated enhancement, not this core).
//
// Field encoding (RGBA HalfFloat): R = height h · G = h_prev · B,A = velocity.xy.
// The FluidSurface material samples ∇height → normal warp + relief → the
// transmission glass refracts the flow. Isolated editor-chrome.

import * as THREE from 'three';
import { QuadMesh, MeshBasicNodeMaterial, RenderTarget } from 'three/webgpu';
import { Fn, texture, uv, uniform, vec2, vec4, float, mix } from 'three/tsl';

export interface FluidSimParams {
  viscosity: number;       // 0..1 — velocity neighbour diffusion (togetherness)
  surfaceTension: number;  // 0..1 — height curvature relaxation (beading)
  flowSpeed: number;       // 0..2 — wave speed + advection magnitude
  flowDirection: number;   // radians — directional heading
  patternWeights: [number, number, number, number]; // one-hot: dir|swirl|turb|radial
  turbulence: number;      // 0..1 — curl-noise agitation
  damping: number;         // 0..1 — energy retention per step (1 = no decay)
  liquidPhase: number;     // 0..1 — liquid-glass timeline (0 = settled slab, 1 = flowing)
  reactsToInteraction: number; // 0/1 gate
}

const DEFAULTS: FluidSimParams = {
  viscosity: 0.7,
  surfaceTension: 0.6,
  flowSpeed: 0.6,
  flowDirection: Math.PI * 0.5,
  patternWeights: [0, 1, 0, 0],
  turbulence: 0.32,
  damping: 0.985,
  liquidPhase: 1,
  reactsToInteraction: 1,
};

export class FluidFieldSim {
  readonly size: number;
  private rtA: RenderTarget;
  private rtB: RenderTarget;
  private read: RenderTarget;
  private write: RenderTarget;
  private quad: QuadMesh;
  private updateMat: MeshBasicNodeMaterial;

  /** the texture node the surface material samples — its .value is the latest field. */
  readonly fieldTexNode: ReturnType<typeof texture>;
  /** the texture node the update pass reads (value-swapped each step to ping-pong). */
  private srcTexNode: ReturnType<typeof texture>;

  private u = {
    dt: uniform(1 / 60),
    time: uniform(0),
    texel: uniform(new THREE.Vector2()),
    viscosity: uniform(DEFAULTS.viscosity),
    surfaceTension: uniform(DEFAULTS.surfaceTension),
    flowSpeed: uniform(DEFAULTS.flowSpeed),
    flowDir: uniform(new THREE.Vector2(0, 1)),
    pattern: uniform(new THREE.Vector4(0, 1, 0, 0)),
    turbulence: uniform(DEFAULTS.turbulence),
    damping: uniform(DEFAULTS.damping),
    liquidPhase: uniform(DEFAULTS.liquidPhase),
    pointer: uniform(new THREE.Vector2(-1, -1)),
    pointerVel: uniform(new THREE.Vector2(0, 0)),
    splat: uniform(0),
  };

  constructor(size = 192) {
    this.size = size;
    const opts: THREE.RenderTargetOptions = {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
      stencilBuffer: false,
      generateMipmaps: false,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
    };
    this.rtA = new RenderTarget(size, size, opts);
    this.rtB = new RenderTarget(size, size, opts);
    this.read = this.rtA;
    this.write = this.rtB;
    this.u.texel.value.set(1 / size, 1 / size);

    this.srcTexNode = texture(this.read.texture);
    this.fieldTexNode = texture(this.read.texture);

    this.updateMat = new MeshBasicNodeMaterial();
    this.updateMat.colorNode = this.buildUpdateNode();
    this.quad = new QuadMesh(this.updateMat);
  }

  // ── the TSL fragment update (wave integrate + advect + force + viscosity + splat) ──
  private buildUpdateNode() {
    const U = this.u;
    const src = this.srcTexNode;

    return Fn(() => {
      const p = uv().toVar();
      const tx = U.texel;

      const here = src.sample(p).toVar();
      const right = src.sample(p.add(vec2(tx.x, 0))).toVar();
      const left = src.sample(p.sub(vec2(tx.x, 0))).toVar();
      const upN = src.sample(p.add(vec2(0, tx.y))).toVar();
      const downN = src.sample(p.sub(vec2(0, tx.y))).toVar();

      const h = here.x.toVar();
      const hPrev = here.y.toVar();
      const vel = here.zw.toVar();

      // ── velocity: pattern force + turbulence, diffuse (viscosity), damp ──
      const c = vec2(0.5, 0.5);
      const rel = p.sub(c);
      const dir = U.flowDir; // directional
      const swirl = vec2(rel.y.negate(), rel.x).mul(2.2); // tangential vortex
      const radial = rel.mul(2.4);
      const tFreq = float(7.0);
      const tt = U.time.mul(0.6);
      const turbV = vec2(
        rel.y.mul(tFreq).add(tt).sin().sub(p.x.mul(tFreq).add(tt.mul(0.7)).cos()),
        rel.x.mul(tFreq).sub(tt).sin().add(p.y.mul(tFreq).sub(tt.mul(0.7)).cos()),
      ).mul(0.5);
      const force = dir.mul(U.pattern.x)
        .add(swirl.mul(U.pattern.y))
        .add(turbV.mul(U.pattern.z))
        .add(radial.mul(U.pattern.w));
      vel.addAssign(force.mul(U.flowSpeed).mul(U.dt).mul(1.6));
      vel.addAssign(turbV.mul(U.turbulence).mul(U.dt).mul(1.2));
      const neighVel = right.zw.add(left.zw).add(upN.zw).add(downN.zw).mul(0.25);
      vel.assign(mix(vel, neighVel, U.viscosity.mul(0.55)));
      vel.mulAssign(U.damping);
      vel.assign(vel.clamp(-3.0, 3.0));

      // ── damped wave equation: ripples propagate from h & h_prev memory ──
      const lap = right.x.add(left.x).add(upN.x).add(downN.x).sub(h.mul(4.0));
      const c2 = U.flowSpeed.mul(0.5).add(0.3).mul(U.flowSpeed.mul(0.5).add(0.3)).mul(0.32); // (waveSpeed)² clamped for CFL
      const a = float(1.0).sub(U.damping).mul(0.5).clamp(0, 0.85); // attenuation: high damping → long-lived
      const hNext = float(2.0).sub(a).mul(h)
        .sub(float(1.0).sub(a).mul(hPrev))
        .add(c2.mul(lap)).toVar();

      // ── directional advection: the velocity field carries the surface ──
      const back = p.sub(vel.mul(U.dt).mul(U.flowSpeed).mul(5.0).mul(tx));
      const hAdv = src.sample(back).x;
      hNext.assign(mix(hNext, hAdv, float(0.16)));

      // ── DRIVEN FLOW FORCING — a continuous, param-shaped source so the surface
      //    visibly FLOWS (and every param visibly changes the look). flowSpeed sets
      //    the wave speed AND ripple frequency; turbulence injects high-freq chaos;
      //    viscosity (below) smooths it back into cohesive swells. ──
      const perp = vec2(dir.y.negate(), dir.x);
      const along = p.sub(c).dot(dir);
      const across = p.sub(c).dot(perp);
      const ph = U.time.mul(U.flowSpeed.mul(2.2).add(0.4));
      const kFreq = float(7.0).add(U.flowSpeed.mul(5.0)).add(U.turbulence.mul(14.0));
      const swell = along.mul(kFreq).sub(ph).sin().mul(0.16);
      const cross = across.mul(kFreq.mul(0.7)).add(ph.mul(0.6)).sin().mul(0.10);
      const chop = along.add(across).mul(kFreq.mul(2.1)).sub(ph.mul(1.7)).sin()
        .mul(U.turbulence.mul(0.16).add(0.02));
      const drive = swell.add(cross).add(chop).mul(U.flowSpeed.mul(0.4).add(0.25));
      hNext.addAssign(drive.mul(0.5));

      // ── surface tension: pull crests toward neighbour mean (rounded menisci) ──
      const neighH = right.x.add(left.x).add(upN.x).add(downN.x).mul(0.25);
      // viscosity ALSO smooths the height field (togetherness = cohesive sheet).
      hNext.assign(mix(hNext, neighH, U.surfaceTension.mul(0.22).add(U.viscosity.mul(0.14))));

      // ── interaction splat: inject a height + velocity impulse at the pointer ──
      const d = p.sub(U.pointer).length();
      const ring = float(0.10).sub(d).max(0.0).mul(10.0).min(1.0).mul(U.splat);
      hNext.addAssign(ring.mul(0.7));
      vel.addAssign(U.pointerVel.mul(ring).mul(2.0));

      // gentle decay so the field neither saturates nor dies; settle to a flat slab
      // as the liquid-glass phase → 0 (the expand timeline).
      hNext.mulAssign(float(0.992));
      hNext.mulAssign(U.liquidPhase.mul(0.92).add(0.08));
      hNext.assign(hNext.clamp(-1.2, 1.2));

      return vec4(hNext, h, vel);
    })();
  }

  setParams(p: FluidSimParams) {
    this.u.viscosity.value = p.viscosity;
    this.u.surfaceTension.value = p.surfaceTension;
    this.u.flowSpeed.value = p.flowSpeed;
    this.u.flowDir.value.set(Math.cos(p.flowDirection), Math.sin(p.flowDirection));
    this.u.pattern.value.set(p.patternWeights[0], p.patternWeights[1], p.patternWeights[2], p.patternWeights[3]);
    this.u.turbulence.value = p.turbulence;
    this.u.damping.value = p.damping;
    this.u.liquidPhase.value = p.liquidPhase;
    if (!p.reactsToInteraction) this.u.splat.value = 0;
  }

  /** inject a splat at uv (0..1) with a velocity (uv/sec). */
  splat(x: number, y: number, vx: number, vy: number, strength = 1) {
    this.u.pointer.value.set(x, y);
    this.u.pointerVel.value.set(vx, vy);
    this.u.splat.value = strength;
  }
  clearSplat() {
    this.u.splat.value = 0;
  }

  /** one ping-pong step. Call inside useFrame; restores the prior target after. */
  step(renderer: THREE.WebGLRenderer, dt: number, time: number) {
    this.u.dt.value = Math.min(dt, 1 / 30);
    this.u.time.value = time;
    this.srcTexNode.value = this.read.texture;
    const r = renderer as unknown as {
      getRenderTarget: () => THREE.RenderTarget | null;
      setRenderTarget: (t: THREE.RenderTarget | null) => void;
    };
    const prevTarget = r.getRenderTarget();
    r.setRenderTarget(this.write as unknown as THREE.RenderTarget);
    this.quad.render(renderer as never);
    r.setRenderTarget(prevTarget);
    const tmp = this.read; this.read = this.write; this.write = tmp;
    this.fieldTexNode.value = this.read.texture;
    this.u.splat.value *= 0.85;
  }

  dispose() {
    this.rtA.dispose();
    this.rtB.dispose();
    this.updateMat.dispose();
    this.quad.geometry.dispose();
  }
}
