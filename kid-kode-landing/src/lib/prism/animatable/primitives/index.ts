// Catalog manifest — imports every primitive definition and registers it.
// Importing this module populates the Animatable registry (side-effect on first
// import). Ordered simple→heavy so the picker reads as a coherent catalog.

import { registerPrimitive } from '../registry';
import type { PrimitiveDefinition } from '../contract';

// transform / tween
import { slidePrimitive } from './slide';
import { scalePopPrimitive } from './scale-pop';
import { spinPrimitive } from './spin';
import { fadePrimitive } from './fade';
// scroll
import { parallaxPrimitive } from './parallax';
import { pinRevealPrimitive } from './pin-reveal';
// pointer
import { magneticPrimitive } from './magnetic';
import { tiltPrimitive } from './tilt';
// text
import { splitStaggerPrimitive } from './split-stagger';
import { scramblePrimitive } from './scramble';
import { dissolveToDustPrimitive } from './dissolve-to-dust';
// surface motion
import { wavePrimitive } from './wave';
import { ripplePrimitive } from './ripple';
import { maskWipePrimitive } from './mask-wipe';
import { blurInPrimitive } from './blur-in';
import { shimmerPrimitive } from './shimmer';
import { displacementTransitionPrimitive } from './displacement-transition';
// glass / light
import { glassRefractionPrimitive } from './glass-refraction';
import { fresnelGlowPrimitive } from './fresnel-glow';
import { causticsPrimitive } from './caustics';
import { godrayPrimitive } from './godray';
import { smokePrimitive } from './smoke';
// particles
import { dustParticlesPrimitive } from './dust-particles';
import { sparksPrimitive } from './sparks';

export const ALL_PRIMITIVES: PrimitiveDefinition[] = [
  slidePrimitive,
  scalePopPrimitive,
  spinPrimitive,
  fadePrimitive,
  parallaxPrimitive,
  pinRevealPrimitive,
  magneticPrimitive,
  tiltPrimitive,
  splitStaggerPrimitive,
  scramblePrimitive,
  dissolveToDustPrimitive,
  wavePrimitive,
  ripplePrimitive,
  maskWipePrimitive,
  blurInPrimitive,
  shimmerPrimitive,
  displacementTransitionPrimitive,
  glassRefractionPrimitive,
  fresnelGlowPrimitive,
  causticsPrimitive,
  godrayPrimitive,
  smokePrimitive,
  dustParticlesPrimitive,
  sparksPrimitive,
];

let registered = false;
export function registerAllPrimitives(): void {
  if (registered) return;
  for (const def of ALL_PRIMITIVES) registerPrimitive(def);
  registered = true;
}

registerAllPrimitives();
