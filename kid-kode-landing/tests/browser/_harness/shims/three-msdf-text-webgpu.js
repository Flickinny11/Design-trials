// Smoke-test shim for `three-msdf-text-webgpu`.
//
// `bundle.ts` (T05 §11 L444-L445) bundles `three-msdf-text-webgpu` into
// the runtime; the spec's importmap intentionally does NOT expose it as a
// CDN specifier. The T09 mock-app load smoke runs without bundling, so
// this shim resolves the bare specifier with a no-op class. Real text
// rendering is exercised in T07 / T10 / vitest under tests/integration/.
export class MSDFText {
  constructor(opts = {}) { this.opts = opts; }
  dispose() {}
}
export default { MSDFText };
