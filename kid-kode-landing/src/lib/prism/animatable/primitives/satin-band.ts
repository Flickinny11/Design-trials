// satin-band — a soft, wide satin highlight glides across the card surface.
// MEDIUM / GPU (shimmer). Swaps the host card's panel material for a
// MeshStandardNodeMaterial whose emissiveNode is a BROAD, FEATHERED band built
// from the directional projection of uv: band = pow(max(0, 1 - |dot(uv,dir) -
// uSweep| / width), softPow). seek() advances uSweep (looping) so the band
// glides; onParamChange() updates the live uniforms. Distinct from light-sweep /
// metallic-sheen (a narrow, hard specular line) by being WIDE and SOFT — a low-
// contrast satin sheen, not a crisp highlight.

import { Mesh, Color, Vector2, type Material } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec3, float, dot, abs, pow, max } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, str, clamp, type ControlValue, type PrimitiveDefinition } from '../contract';

const rgb = (hex: string): [number, number, number] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

const SCHEMA = [
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.1, max: 3, step: 0.1, default: 0.8 },
  { id: 'width', label: 'Width', type: 'knob', min: 0.2, max: 0.8, step: 0.01, default: 0.5 },
  { id: 'softness', label: 'Softness', type: 'knob', min: 0.1, max: 1, step: 0.01, default: 0.7 },
  { id: 'intensity', label: 'Intensity', type: 'knob', min: 0, max: 1.5, step: 0.05, default: 0.6 },
  { id: 'angleDeg', label: 'Angle', type: 'knob', min: 0, max: 360, step: 1, default: 35, unit: 'deg' },
  { id: 'tint', label: 'Tint', type: 'color', default: '#eef2ff' },
] as const;

// Map softness 0.1..1 -> softPow. Higher softness => SMALLER exponent =>
// broader, gentler feather (a satin falloff, not a hard edge).
const softnessToPow = (s: number): number => {
  const c = clamp(s, 0.1, 1);
  // s=1 (max soft) -> ~0.7 (very broad); s=0.1 (least soft) -> ~4 (tighter).
  return 0.7 + (1 - c) * 3.3;
};

export const satinBandPrimitive: PrimitiveDefinition = {
  name: 'satin-band',
  label: 'Satin Band',
  category: 'shimmer',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'time',
  description:
    'A soft, wide satin highlight glides across the surface — gentler and broader than a hard specular sweep.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'satin-band', category: 'shimmer', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const [r0, g0, b0] = rgb(str(params.tint, '#eef2ff'));

      const rad0 = (num(params.angleDeg, 35) * Math.PI) / 180;
      const uSweep = uniform(0);
      const uWidth = uniform(num(params.width, 0.5));
      const uSoftPow = uniform(softnessToPow(num(params.softness, 0.7)));
      const uIntensity = uniform(num(params.intensity, 0.6));
      const uDir = uniform(new Vector2(Math.cos(rad0), Math.sin(rad0)));
      const uR = uniform(r0);
      const uG = uniform(g0);
      const uB = uniform(b0);

      // Directional coordinate: project uv onto the sweep direction. The band is
      // centred at uSweep and falls off symmetrically over `width`. pow() with a
      // small softPow keeps the falloff BROAD and FEATHERED (satin), not a hard
      // specular line.
      const coord = dot(uv(), uDir);
      const dist = abs(coord.sub(uSweep)).div(uWidth);
      // band: 1 at the band centre, feathering to 0 by `width`.
      const band: any = pow(max(float(0), float(1).sub(dist)), uSoftPow);
      // Low-contrast satin: add tint * band * intensity to emissive.
      const emissiveNode = vec3(uR, uG, uB).mul(band).mul(uIntensity);

      const mat = new MeshStandardNodeMaterial({
        color: new Color('#7e8bb4'),
        roughness: 0.42,
        metalness: 0.55,
        transparent: true,
      });
      (mat as unknown as { emissiveNode: unknown }).emissiveNode = emissiveNode;

      // Park uniform handles so the host/inspector (and tests) can observe the
      // live animated values without a GPU readback.
      mat.userData.satin = { uSweep, uWidth, uSoftPow, uIntensity };

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // The sweep travels across the projected-uv range (roughly -1..2 to fully
      // clear a card of unit-ish uv) and loops, so the band continuously glides.
      const SPAN = 3;
      return {
        duration: () => Infinity,
        seek: (tt) => {
          const speed = num(params.speed, 0.8);
          // uSweep cycles -1 -> 2 (band enters and fully exits), then wraps.
          const cyc = ((tt * speed * 0.3) % 1 + 1) % 1;
          uSweep.value = -1 + cyc * SPAN;
          // Read params live so control changes apply without a rebuild.
          uWidth.value = num(params.width, 0.5);
          uSoftPow.value = softnessToPow(num(params.softness, 0.7));
          uIntensity.value = num(params.intensity, 0.6);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'width') uWidth.value = num(value, 0.5);
          else if (id === 'softness') uSoftPow.value = softnessToPow(num(value, 0.7));
          else if (id === 'intensity') uIntensity.value = num(value, 0.6);
          else if (id === 'angleDeg') {
            const r = (num(value, 35) * Math.PI) / 180;
            uDir.value.set(Math.cos(r), Math.sin(r));
          } else if (id === 'tint' && typeof value === 'string') {
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
