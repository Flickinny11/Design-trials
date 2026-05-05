// shaders barrel — re-exports the 6 TSL shader factories.
// Spec: PRISM-RENDERER-MIGRATION-SPEC.md §11 L407-L422 (file paths).

export { displacementShader } from './displacement.tsl';
export { dissolveShader } from './dissolve.tsl';
export { voronoiParticleShader } from './voronoi-particle.tsl';
export { twistedWaveShader } from './twisted-wave.tsl';
export { radialBlurShader } from './radial-blur.tsl';
export { rgbShiftShader } from './rgb-shift.tsl';
