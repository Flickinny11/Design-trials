// THREE-D-BACKGROUNDS — TSL volumetric nebula (the premium procedural core, A3).
//
// A camera-centred inverted sphere whose fragment shader RAYMARCHES a world-
// anchored 3D density field from the camera outward (DESIGN-REFERENCES §9 +
// QUEUE-PREP-RESEARCH §A3). The modern physically-inspired recipe:
//   • Beer-Lambert absorption — transmittance *= exp(-density · σ · ds).
//   • Henyey-Greenstein phase — forward-biased in-scatter toward a key light.
//   • Light-marching — a short secondary march toward the light per sample for
//     genuine self-shadowing (skipped on T0 for cost).
// Because the field is sampled in WORLD space (ro = world camera position), the
// nebula PARALLAXES as the camera flies through it (C1) — near wisps shift more
// than far gas — instead of reading as a flat skybox plane (FP-1). Step counts
// are tier-gated (D4): a full march on T2, a short march on T0.
//
// One renderer (INV-1): a `MeshBasicNodeMaterial` from `three/webgpu`, TSL only
// (INV: no raw GLSL), runs on the WebGPU backend AND the WebGL2 fallback. No
// text, no DOM in the render path. Observatory-Brass palette only (INV-9).

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import {
  Fn,
  Loop,
  If,
  Break,
  uniform,
  vec3,
  vec4,
  float,
  exp,
  dot,
  mix,
  max,
  pow,
  clamp as tslClamp,
  smoothstep,
  normalize,
  cameraPosition,
  positionWorld,
  mx_fractal_noise_float,
} from 'three/tsl';
import type { BackgroundPalette } from '@/lib/editor/backgrounds/palettes';
import type { BackgroundLayerParams } from '@/lib/prism-graph/types';
import type { TierBudget } from '@/lib/editor/backgrounds/tier';

type TNode = any; // eslint-disable-line @typescript-eslint/no-explicit-any

const SPHERE_RADIUS = 450; // camera-centred shell; always fills the frustum.
const MARCH_DIST = 560; // world units the primary ray covers.
const ABSORPTION = 0.5; // σ — extinction per unit density·distance. Lower → the
                        // ray accumulates over more samples (layered depth +
                        // soft cores) instead of saturating on the first hit.

function hexToVec3(hex: string): TNode {
  const c = new THREE.Color(hex);
  return vec3(c.r, c.g, c.b);
}

export interface VolumetricNebulaLayerProps {
  palette: BackgroundPalette;
  params: BackgroundLayerParams;
  budget: TierBudget;
  renderOrder?: number;
  /** When true the nebula is a TRANSLUCENT veil (alpha = gas coverage) so an
   *  image/parallax-plate behind it shows through the dark dust voids (hybrid,
   *  C5). When false (default) it is the OPAQUE backdrop (its own dark base
   *  fills the voids; the flat skybox is suppressed). */
  overBackdrop?: boolean;
  /** Veil strength in overBackdrop mode: scales the gas alpha so the plate leads
   *  and the veil is a subtle accent (1 = full coverage). Ignored when opaque. */
  veilOpacity?: number;
}

export function VolumetricNebulaLayer({
  palette,
  params,
  budget,
  renderOrder = -2,
  overBackdrop = false,
  veilOpacity = 1,
}: VolumetricNebulaLayerProps) {
  const camera = useThree((s) => s.camera);
  const meshRef = useRef<THREE.Mesh>(null);

  // Live uniforms — updated on param change + per frame (time), no rebuild.
  const uniforms = useMemo(
    () => ({
      uTime: uniform(0),
      uDensity: uniform(0.6),
      uDrift: uniform(0.5),
      uIntensity: uniform(0.7),
      uVeil: uniform(1),
    }),
    [],
  );

  // Structural: the shader is rebuilt when palette or tier-step-count changes
  // (Loop bounds are compile-time). Live sliders flow through the uniforms.
  const material = useMemo(() => {
    const STEPS = Math.max(6, Math.round(budget.raymarchSteps));
    const LIGHT_STEPS = Math.max(0, Math.round(budget.lightMarchSteps));
    const stepSize = MARCH_DIST / STEPS;

    const base = hexToVec3(palette.base);
    const gasDeep = hexToVec3(palette.gas[0]);
    const gasMid = hexToVec3(palette.gas[1]);
    const gasWisp = hexToVec3(palette.gas[2]);
    const glow = hexToVec3(palette.glow);

    const lightDir = normalize(vec3(0.42, 0.66, 0.5));
    const G = 0.42; // Henyey-Greenstein forward anisotropy.
    const g2 = G * G;

    // World-anchored, slowly drifting 3D density field. Because the shell is
    // camera-centred and we march outward, the dominant variation is angular
    // (rd·t ≫ camera offset) → distinct cloud BANKS sweep across the sky. A
    // large-scale envelope concentrates gas; a finer fractal carves wisps.
    // Frequency is tuned to the ~10–20 unit content scale so 2–3 banks read
    // across the frame rather than one uniform haze.
    // Full density — primary march samples (3 + 3 octaves of domain-warped
    // fractal noise). Tuned to the ~10–20 unit content scale: distinct cloud
    // banks with generous DARK DUST VOIDS so content reads on top.
    const density = Fn(([p]: [TNode]): TNode => {
      const drift = (uniforms.uDrift as TNode).mul(uniforms.uTime).mul(0.8);
      const q = (p as TNode).mul(0.02).add(vec3(drift.mul(0.06), drift.mul(0.02), drift.mul(0.04)));
      const env = mx_fractal_noise_float(q.mul(0.5), 3).mul(0.5).add(0.5);
      const detail = mx_fractal_noise_float(q.mul(1.9).add(vec3(11.2, 3.4, 7.1)), 3).mul(0.5).add(0.5);
      const field = env.mul(0.7).add(detail.mul(0.5)); // ~0..1.2
      const thr = float(0.66).sub((uniforms.uDensity as TNode).mul(0.2));
      const shaped = smoothstep(thr, float(1.12), field);
      const d = pow(shaped, float(1.7));
      return d.mul((uniforms.uDensity as TNode).mul(0.5).add(0.6)).mul(2.0);
    });

    // Cheap density (2 octaves) for the self-shadow light-march taps — the
    // shadow term is low-frequency, so a coarse field is visually identical at a
    // fraction of the cost (the light-march dominated the per-fragment budget).
    const densityCheap = Fn(([p]: [TNode]): TNode => {
      const q = (p as TNode).mul(0.02);
      const env = mx_fractal_noise_float(q.mul(0.5), 2).mul(0.5).add(0.5);
      const thr = float(0.66).sub((uniforms.uDensity as TNode).mul(0.2));
      const d = pow(smoothstep(thr, float(1.05), env), float(1.5));
      return d.mul((uniforms.uDensity as TNode).mul(0.5).add(0.6)).mul(2.0);
    });

    const render = Fn((): TNode => {
      const ro: TNode = cameraPosition;
      const rd: TNode = normalize((positionWorld as TNode).sub(cameraPosition));

      const transmittance = float(1).toVar();
      const scattered = vec3(0, 0, 0).toVar();
      const t = float(8).toVar();

      // Henyey-Greenstein phase for the primary ray vs the key light.
      const cosT = dot(rd, lightDir);
      const denom = pow(float(1 + g2).sub(float(2 * G).mul(cosT)), float(1.5));
      const phase = float((1 - g2) / (4 * Math.PI)).div(max(denom, float(1e-3))).add(0.06);

      // Self-shadow via a short fixed light-march, UNROLLED on the JS side into
      // N forward density taps toward the key (no nested TSL Loop — that mis-
      // compiled to black). LIGHT_STEPS is the tier-gated tap count (0 on T0).
      const shadowStep = (SPHERE_RADIUS * 0.16) / Math.max(1, LIGHT_STEPS);
      const selfShadow = (p: TNode): TNode => {
        let lt: TNode = float(1);
        for (let k = 1; k <= LIGHT_STEPS; k++) {
          const lp: TNode = p.add(lightDir.mul(shadowStep * k));
          lt = lt.mul(exp(densityCheap(lp).mul(-ABSORPTION).mul(shadowStep)));
        }
        return lt;
      };

      Loop({ start: 0, end: STEPS, type: 'int' }, () => {
        const p: TNode = ro.add(rd.mul(t));
        const d: TNode = density(p);
        If(d.greaterThan(0.001), () => {
          const lt: TNode = LIGHT_STEPS > 0 ? selfShadow(p) : float(1);
          // In-scatter: gas tone graded deep→mid→wisp by local density, lifted
          // by the lit transmittance + glow at the brightest, hottest samples.
          const tone: TNode = mix(gasDeep, gasMid, tslClamp(d.mul(1.4), float(0), float(1)));
          const tone2: TNode = mix(tone, gasWisp, tslClamp(d.sub(0.5).mul(2.2), float(0), float(1)));
          // Hot filament cores: dense, self-lit samples glow toward the palette
          // glow colour (premium bright veins through the gas).
          const core: TNode = glow.mul(pow(d, float(2.2))).mul(1.5);
          const lit: TNode = tone2.mul(lt.mul(0.55).add(0.35)).add(core.mul(lt));
          const contribution: TNode = transmittance
            .mul(d)
            .mul(stepSize)
            .mul(ABSORPTION)
            .mul(phase)
            .mul((uniforms.uIntensity as TNode).mul(0.7).add(0.5))
            .mul(3.1);
          scattered.addAssign(lit.mul(contribution));
          transmittance.mulAssign(exp(d.mul(-ABSORPTION).mul(stepSize)));
        });
        t.addAssign(float(stepSize));
        If(transmittance.lessThan(0.015), () => {
          Break();
        });
      });

      // gas coverage (0 = clear void, 1 = thick gas).
      const coverage: TNode = float(1).sub(transmittance);
      if (overBackdrop) {
        // Translucent veil: emission only, alpha = gas coverage scaled by the
        // veil strength so the plate leads. Plate shows through the voids.
        const veilA: TNode = tslClamp(coverage.mul(uniforms.uVeil as TNode), float(0), float(1));
        return vec4(scattered.mul((uniforms.uVeil as TNode).mul(0.5).add(0.5)).add(gasDeep.mul(coverage).mul(0.1)), veilA);
      }
      // Opaque backdrop: deep palette-tinted sky fills voids (no flat-black void,
      // the flat skybox is suppressed when a nebula is present).
      const skyTint: TNode = base.mul(1.25).add(gasDeep.mul(0.22));
      return vec4(skyTint.mul(transmittance).add(scattered), float(1));
    });

    const rendered = render();
    const mat = new MeshBasicNodeMaterial({
      side: THREE.BackSide,
      transparent: overBackdrop,
      depthWrite: false,
      toneMapped: false,
      fog: false,
    });
    (mat as unknown as { colorNode: unknown }).colorNode = (rendered as TNode).rgb;
    if (overBackdrop) (mat as unknown as { opacityNode: unknown }).opacityNode = (rendered as TNode).a;
    return mat;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [palette.id, budget.raymarchSteps, budget.lightMarchSteps, overBackdrop]);

  useEffect(() => () => material.dispose(), [material]);

  // Push live param values into the uniforms on change (no rebuild).
  useEffect(() => {
    uniforms.uDensity.value = typeof params.density === 'number' ? params.density : 0.6;
    uniforms.uDrift.value = typeof params.drift === 'number' ? params.drift : 0.5;
    uniforms.uIntensity.value = typeof params.intensity === 'number' ? params.intensity : 0.7;
    uniforms.uVeil.value = veilOpacity;
  }, [params.density, params.drift, params.intensity, veilOpacity, uniforms]);

  // Keep the shell centred on the camera (infinite-environment feel) + advance
  // the drift clock.
  useFrame((_, delta) => {
    uniforms.uTime.value += delta;
    if (meshRef.current) meshRef.current.position.copy(camera.position);
  });

  return (
    <mesh ref={meshRef} renderOrder={renderOrder} frustumCulled={false} material={material}>
      <sphereGeometry args={[SPHERE_RADIUS, 48, 32]} />
    </mesh>
  );
}
