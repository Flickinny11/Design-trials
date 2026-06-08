// acrylic-edge — a thick acrylic block whose chamfered borders are edge-lit, like
// an illuminated acrylic sign: bright light piped to the rim, clear glassy center.
// HARD / GPU primitive (glass). Swaps the host card panel's material for a
// transmissive MeshPhysicalNodeMaterial tuned for acrylic (transmission=1, high
// thickness, roughness 0, ior~1.49) and adds an emissiveNode that concentrates a
// bright edge glow at the uv borders:
//
//   edge = smoothstep(glowWidth, 0, min(uv.x, min(1-uv.x, min(uv.y, 1-uv.y))))
//   emissive += edgeColor * edge * intensity * (0.8 + 0.2*sin(uTime))
//
// The center stays clear (edge → 0 away from the border); only the rim lights up,
// and it breathes with uTime. DISTINCT from bevel-glass (refraction-only normal
// chamfer) — this is edge-lit *emissive* acrylic. seek() advances uTime and reads
// knobs live; onParamChange() mirrors uniforms structurally. dispose() restores
// the swapped material and disposes the created one.

import { Mesh, Color, type Material } from 'three';
import { MeshPhysicalNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec3, float, min, sub, sin, smoothstep } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, str, clamp, type ControlValue, type PrimitiveDefinition } from '../contract';

const rgb = (hex: string): [number, number, number] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

const SCHEMA = [
  { id: 'glowWidth', label: 'Glow Width', type: 'knob', min: 0.03, max: 0.3, step: 0.005, default: 0.12 },
  { id: 'edgeColor', label: 'Edge Color', type: 'color', default: '#33e6ff' },
  { id: 'thickness', label: 'Thickness', type: 'fader', min: 0.3, max: 3, step: 0.05, default: 1.6 },
  { id: 'intensity', label: 'Intensity', type: 'knob', min: 0, max: 4, step: 0.05, default: 2 },
] as const;

export const acrylicEdgePrimitive: PrimitiveDefinition = {
  name: 'acrylic-edge',
  label: 'Acrylic Edge Glow',
  category: 'glass',
  difficulty: 'hard',
  subject: 'card',
  defaultDriver: 'time',
  description:
    'A thick acrylic block with bright edge-lit glow — light piped to the chamfered borders like an illuminated sign.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'acrylic-edge', category: 'glass', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const [r0, g0, b0] = rgb(str(params.edgeColor, '#33e6ff'));

      const uTime = uniform(0);
      const uGlowWidth = uniform(num(params.glowWidth, 0.12));
      const uIntensity = uniform(num(params.intensity, 2));
      // Live breathing intensity factor (0.8 + 0.2*sin(uTime)) — observable on CPU.
      const uPulse = uniform(0.8);
      const uR = uniform(r0);
      const uG = uniform(g0);
      const uB = uniform(b0);

      // Edge field: distance to the nearest of the 4 uv borders (0 at a border,
      // 0.5 at the center along each axis). smoothstep(glowWidth, 0, dist) is 1 at
      // the border, ramping to 0 by the inner edge of the glow band — the center
      // stays dark, the rim lights up.
      const u = uv();
      const dx = min(u.x, sub(float(1), u.x));
      const dy = min(u.y, sub(float(1), u.y));
      const distEdge = min(dx, dy);
      const edge = smoothstep(uGlowWidth, float(0), distEdge);

      // emissive += edgeColor * edge * intensity * (0.8 + 0.2*sin(uTime))
      const breathe = float(0.8).add(sin(uTime).mul(0.2));
      const emissiveNode = vec3(uR, uG, uB)
        .mul(edge)
        .mul(uIntensity)
        .mul(breathe);

      const mat = new MeshPhysicalNodeMaterial({
        transparent: true,
        transmission: 1.0,
        thickness: clamp(num(params.thickness, 1.6), 0.3, 3),
        roughness: 0.0,
        metalness: 0.0,
        ior: 1.49, // acrylic / PMMA
        clearcoat: 1.0,
        clearcoatRoughness: 0.04,
        envMapIntensity: 1.2,
      });
      (mat as unknown as { emissiveNode: unknown }).emissiveNode = emissiveNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Publish uniform handles to the shared scratch space so the host (and
      // tests) can observe the live animation state without reaching the TSL graph.
      target.userData.acrylicEdge = { uTime, uGlowWidth, uIntensity, uPulse, uR, uG, uB };

      const syncEdgeColor = (hex: string) => {
        const [r, g, b] = rgb(hex);
        uR.value = r;
        uG.value = g;
        uB.value = b;
      };

      return {
        // Continuous edge-glow breathe → Infinity (purely stateful, per contract).
        duration: () => Infinity,
        seek: (tt) => {
          uTime.value = tt;
          // 0.8 + 0.2*sin(uTime): the rim brightness breathes with the clock.
          uPulse.value = 0.8 + 0.2 * Math.sin(tt);
          // Read params live so control changes apply without a rebuild.
          uGlowWidth.value = clamp(num(params.glowWidth, 0.12), 0.03, 0.3);
          uIntensity.value = num(params.intensity, 2);
          mat.thickness = clamp(num(params.thickness, 1.6), 0.3, 3);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'glowWidth') uGlowWidth.value = clamp(num(value, 0.12), 0.03, 0.3);
          else if (id === 'intensity') uIntensity.value = num(value, 2);
          else if (id === 'thickness') mat.thickness = clamp(num(value, 1.6), 0.3, 3);
          else if (id === 'edgeColor' && typeof value === 'string') syncEdgeColor(value);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
        },
      };
    },
  ),
};
