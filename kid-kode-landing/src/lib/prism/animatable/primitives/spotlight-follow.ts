// spotlight-follow — a bright specular hotspot tracks the pointer across the
// card surface, like a light gliding over glass. HARD / pointer primitive.
// Swaps the card's material for a MeshStandardNodeMaterial whose emissiveNode
// adds a soft radial highlight centred at uPointer (a vec2 in 0..1 uv space):
//   emissive += tint * smoothstep(radius, 0, length(uv - uPointer)) * intensity
// seek() reads userData.pointer and updates uPointer, plus advances a faint
// idle drift so the hotspot is never fully static. onParamChange() and live
// param reads keep radius/intensity/tint tweakable with no rebuild.

import { Mesh, Color, Vector2, type Material } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec3, vec2, float, length, smoothstep } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, str, clamp, type ControlValue, type PrimitiveDefinition } from '../contract';

const rgb = (hex: string): [number, number, number] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

const SCHEMA = [
  { id: 'radius', label: 'Radius', type: 'fader', min: 0.1, max: 0.6, step: 0.01, default: 0.32 },
  { id: 'intensity', label: 'Intensity', type: 'knob', min: 0, max: 4, step: 0.05, default: 2 },
  { id: 'tint', label: 'Tint', type: 'color', default: '#e8f0ff' },
] as const;

export const spotlightFollowPrimitive: PrimitiveDefinition = {
  name: 'spotlight-follow',
  label: 'Spotlight Follow',
  category: 'pointer',
  difficulty: 'hard',
  subject: 'card',
  defaultDriver: 'pointer',
  description:
    'A bright specular hotspot tracks the pointer across the card surface, like a light gliding over glass.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'spotlight-follow', category: 'pointer', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const [r0, g0, b0] = rgb(str(params.tint, '#e8f0ff'));

      // Live uniforms. uPointer is the hotspot centre in 0..1 uv space.
      const uPointer = uniform(new Vector2(0.5, 0.5));
      const uRadius = uniform(clamp(num(params.radius, 0.32), 0.1, 0.6));
      const uIntensity = uniform(num(params.intensity, 2));
      const uR = uniform(r0);
      const uG = uniform(g0);
      const uB = uniform(b0);

      // Soft radial highlight: bright at the pointer centre, falling to 0 at the
      // edge of `radius`. smoothstep(radius, 0, d) -> 1 when d==0, 0 when d>=radius.
      const u = uv();
      const d = length(u.sub(vec2(uPointer)));
      const glow = smoothstep(uRadius, float(0), d).mul(uIntensity);
      const emissiveNode = vec3(uR, uG, uB).mul(glow);

      const mat = new MeshStandardNodeMaterial({
        transparent: true,
        metalness: 0.45,
        roughness: 0.3,
      });
      (mat as unknown as { emissiveNode: unknown }).emissiveNode = emissiveNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Expose the live uniform handles on shared scratch space (contract:
      // userData is host-shared) so the driver/host — and CPU tests — can
      // observe the hotspot centre and intensity without a renderer.
      target.userData.spotlightUniforms = { uPointer, uIntensity, uRadius };

      const readPointer = (): { x: number; y: number } => {
        const p = target.userData.pointer as { x: number; y: number } | undefined;
        return {
          x: clamp(typeof p?.x === 'number' ? p.x : 0.5, 0, 1),
          y: clamp(typeof p?.y === 'number' ? p.y : 0.5, 0, 1),
        };
      };

      return {
        // Stateful / pointer-driven: animates continuously across t.
        duration: () => Infinity,
        seek: (t) => {
          const p = readPointer();
          // Faint idle drift so the hotspot is never fully static, layered on
          // top of the pointer position (small ellipse, stays in [0,1]).
          const driftX = Math.cos(t * 0.8) * 0.06;
          const driftY = Math.sin(t * 1.1) * 0.05;
          (uPointer.value as Vector2).set(
            clamp(p.x + driftX, 0, 1),
            clamp(p.y + driftY, 0, 1),
          );
          // Read controls live so changes apply with no rebuild.
          uRadius.value = clamp(num(params.radius, 0.32), 0.1, 0.6);
          uIntensity.value = num(params.intensity, 2);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'radius') uRadius.value = clamp(num(value, 0.32), 0.1, 0.6);
          else if (id === 'intensity') uIntensity.value = num(value, 2);
          else if (id === 'tint' && typeof value === 'string') {
            const [r, g, b] = rgb(value);
            uR.value = r;
            uG.value = g;
            uB.value = b;
          }
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
        },
      };
    },
  ),
};
