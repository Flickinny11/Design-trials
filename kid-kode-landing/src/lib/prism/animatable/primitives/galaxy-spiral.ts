// galaxy-spiral — a spiral galaxy slowly rotates: luminous arms of stars wind
// around a bright glowing core in deep space. HARD / volumetric primitive.
// Swaps the host plane's material for a MeshBasicNodeMaterial whose density is
// built in polar coordinates: cos((ang - r*winding - uTime*spin)*arms) sharpened
// into arm bands, an exp() core glow, plus hashed star sparkle, palette warm-
// white core -> blue/violet arms -> dark. opacityNode = density. seek() advances
// the time uniform so the spiral slowly rotates; params read live each frame.
// DISTINCT from a nebula cloud: structured, rotating spiral arms.

import { Mesh, type Material } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import {
  uniform,
  uv,
  vec3,
  float,
  sin,
  cos,
  pow,
  exp,
  atan,
  length,
  smoothstep,
  fract,
  mix,
  clamp as tslClamp,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'spin', label: 'Spin', type: 'knob', min: 0, max: 2, step: 0.05, default: 0.5 },
  { id: 'arms', label: 'Arms', type: 'knob', min: 2, max: 6, step: 1, default: 3 },
  { id: 'winding', label: 'Winding', type: 'knob', min: 2, max: 10, step: 0.1, default: 5 },
] as const;

export const galaxySpiralPrimitive: PrimitiveDefinition = {
  name: 'galaxy-spiral',
  label: 'Galaxy Spiral',
  category: 'volumetric',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'A spiral galaxy slowly rotates — luminous arms of stars winding around a bright glowing core in deep space.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'galaxy-spiral', category: 'volumetric', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uTime = uniform(0);
      const uSpin = uniform(num(params.spin, 0.5));
      const uArms = uniform(num(params.arms, 3));
      const uWinding = uniform(num(params.winding, 5));

      // Polar coordinates centered on the plane.
      const centered = uv().sub(0.5);
      const r = length(centered);
      const ang = atan(centered.y, centered.x);

      // Spiral arm bands: cosine of the wound angle, raised to a power to sharpen
      // into bright filaments. The uTime*spin term rotates the whole spiral.
      const wound = ang.sub(r.mul(uWinding)).sub(uTime.mul(uSpin)).mul(uArms);
      const arm = pow(cos(wound).mul(0.5).add(0.5), float(3.5));

      // Bright glowing core that falls off exponentially from the center.
      const core = exp(r.mul(-9.0));

      // Arms fade out toward the rim; combine with the core glow.
      const armField = arm.mul(smoothstep(0.5, 0.0, r));
      const density = armField.add(core);

      // Hashed star sparkle keyed on position + slow time for a twinkle.
      const hp = centered.mul(140.0);
      const hash = fract(sin(hp.x.mul(12.9898).add(hp.y.mul(78.233))).mul(43758.5453));
      const twinkle = sin(hash.mul(30.0).add(uTime.mul(2.0))).mul(0.5).add(0.5);
      const star = pow(hash, float(40.0)).mul(twinkle).mul(smoothstep(0.5, 0.05, r));

      // Palette: warm-white core -> blue/violet arms -> dark space at the rim.
      const warmWhite = vec3(1.0, 0.92, 0.78);
      const armColor = vec3(0.42, 0.55, 1.0);
      const violet = vec3(0.62, 0.4, 0.95);
      const coreMix = tslClamp(core.mul(1.4), float(0), float(1));
      const armTint = mix(armColor, violet, smoothstep(0.0, 0.45, r));
      const baseColor = mix(armTint, warmWhite, coreMix);
      const starColor = vec3(0.9, 0.95, 1.0).mul(star.mul(3.0));
      const colorNode = baseColor.mul(density.add(star)).add(starColor);

      const opacityNode = tslClamp(density.add(star.mul(2.0)), float(0), float(1));

      const mat = new MeshBasicNodeMaterial({ transparent: true });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
      (mat as unknown as { opacityNode: unknown }).opacityNode = opacityNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Expose the driven uniform handles on the shared scratch space so the
      // host (and tests) can observe the animation's CPU state without a GPU.
      target.userData.galaxySpiral = { uTime, uSpin, uArms, uWinding };

      return {
        // Looping/stateful: the spiral rotates continuously.
        duration: () => Infinity,
        seek: (tt: number) => {
          uTime.value = tt;
          // Read params live so control changes apply without a rebuild.
          uSpin.value = num(params.spin, 0.5);
          uArms.value = num(params.arms, 3);
          uWinding.value = num(params.winding, 5);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'spin') uSpin.value = num(value, 0.5);
          else if (id === 'arms') uArms.value = num(value, 3);
          else if (id === 'winding') uWinding.value = num(value, 5);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
        },
      };
    },
  ),
};
