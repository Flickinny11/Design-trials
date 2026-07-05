'use client';

// PRISM FLUID SYSTEM — P-3 — THE LIQUID-GLASS SURFACE MATERIAL (spec §3.3).
//
// "Liquid glass" is NOT a one-off animation — it is the fluid field (fluid-sim.ts)
// applied to the founder-approved TRANSMISSION GLASS (the /toolbar-chassis pane:
// transmission 1, ior ~1.5, clearcoat 1, cool #bfe3ea attenuation under the shared
// StudioEnv IBL). The evolving height field perturbs the glass NORMAL and POSITION,
// so the slab refracts + warps the environment behind it AS THE FLUID FLOWS. The
// liquid-glass timeline (liquidPhase 0→1) raises this from a settled slab to a fully
// flowing sheet — the P-4 nav-dropdown expansion is one instance of exactly this.
//
// A MeshPhysicalNodeMaterial (TSL/WebGPU; auto-falls-back to WebGL2) — never a flat
// DOM/CSS effect, never cartoonish plastic.

import * as THREE from 'three';
import { MeshPhysicalNodeMaterial } from 'three/webgpu';
import {
  Fn, texture, uv, uniform, vec2, vec3, float,
  positionLocal, normalLocal, transformNormalToView,
} from 'three/tsl';

function makeUniforms(size: number) {
  return {
    texelX: uniform(1 / size),
    texelY: uniform(1 / size),
    relief: uniform(0.18),         // height → vertex displacement amplitude
    normalStrength: uniform(1.0),  // gradient → normal warp strength
    liquidPhase: uniform(1),       // 0 = flat slab, 1 = flowing
  };
}
export type FluidSurfaceUniforms = ReturnType<typeof makeUniforms>;

export interface FluidSurfaceMaterial {
  material: MeshPhysicalNodeMaterial;
  uniforms: FluidSurfaceUniforms;
  applyGlass: (p: {
    ior: number;
    thickness: number;
    tint: string;
    opacity: number;
    roughness?: number;
  }) => void;
}

// Build the liquid-glass surface material bound to a fluid field texture node.
// `fieldTexNode` is FluidFieldSim.fieldTexNode (its .value tracks the latest field).
export function buildFluidSurfaceMaterial(
  fieldTexNode: ReturnType<typeof texture>,
  size: number,
): FluidSurfaceMaterial {
  const uniforms = makeUniforms(size);
  const m = new MeshPhysicalNodeMaterial();

  // ── the approved premium transmission glass (chassis pane recipe) ──
  m.transmission = 1;
  m.ior = 1.45;
  m.thickness = 1.4;
  m.roughness = 0.05;
  m.metalness = 0;
  m.clearcoat = 1;
  m.clearcoatRoughness = 0.12;
  m.attenuationColor = new THREE.Color('#bfe3ea');
  m.attenuationDistance = 1.5;
  m.envMapIntensity = 1.15;
  m.specularIntensity = 0.9;
  m.dispersion = 1.2;
  // a whisper of thin-film iridescence so the flowing crests catch a premium
  // soap-film sheen (the "liquid" tell) — kept low so it never goes oil-slick.
  m.iridescence = 0.35;
  m.iridescenceIOR = 1.3;
  m.iridescenceThicknessRange = [130, 420];
  m.transparent = true;
  m.side = THREE.DoubleSide;

  const sampleH = (ox: unknown, oy: unknown) =>
    fieldTexNode.sample(uv().add(vec2(ox as never, oy as never))).x;

  // ── POSITION: displace the surface along its normal by the fluid height (real
  //    relief so silhouette + contact shadow + transmission path respond) ──
  m.positionNode = Fn(() => {
    const h = fieldTexNode.sample(uv()).x;
    return positionLocal.add(normalLocal.mul(h.mul(uniforms.relief).mul(uniforms.liquidPhase)));
  })();

  // ── NORMAL: perturb the glass normal by the height GRADIENT → the slab lenses
  //    the StudioEnv behind it AS THE FLUID FLOWS (the refraction reads the flow).
  //    Sample over a few texels so the finite difference is a meaningful slope. ──
  m.normalNode = Fn(() => {
    const e = 2.5;
    const hL = sampleH(uniforms.texelX.mul(-e), 0);
    const hR = sampleH(uniforms.texelX.mul(e), 0);
    const hD = sampleH(0, uniforms.texelY.mul(-e));
    const hU = sampleH(0, uniforms.texelY.mul(e));
    const s = uniforms.normalStrength.mul(uniforms.liquidPhase);
    const n = vec3(hL.sub(hR).mul(s), hD.sub(hU).mul(s), float(1.0)).normalize();
    return transformNormalToView(n);
  })();

  // ── EMISSIVE: a SUBTLE cool luminous crest where the fluid lifts — so the flow
  //    reads even when the WebGL2 transmission pass is faint (premium liquid glass
  //    has a faint inner light; kept low so it never goes glowy-plastic). ──
  m.emissiveNode = Fn(() => {
    const h = fieldTexNode.sample(uv()).x;
    const crest = h.mul(uniforms.liquidPhase).clamp(0, 1);
    return vec3(0.16, 0.40, 0.54).mul(crest).mul(0.14);
  })();

  const applyGlass: FluidSurfaceMaterial['applyGlass'] = (p) => {
    m.ior = p.ior;
    m.thickness = p.thickness;
    m.transmission = p.opacity;
    m.attenuationColor = new THREE.Color(p.tint);
    if (p.roughness != null) m.roughness = p.roughness;
    // deeper slabs attenuate (tint) more; thinner read clearer.
    m.attenuationDistance = THREE.MathUtils.lerp(1.9, 1.0, THREE.MathUtils.clamp((p.thickness - 0.2) / 2.3, 0, 1));
    // relief + refraction scale with thickness + ior so the params read visibly.
    uniforms.relief.value = 0.16 + p.thickness * 0.22;
    uniforms.normalStrength.value = (1.4 + (p.ior - 1) * 2.6) * 3.4;
    m.needsUpdate = true;
  };

  return { material: m, uniforms, applyGlass };
}
