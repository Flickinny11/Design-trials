// SceneRoot — Three.js WebGPU scene + camera + lights + render loop, with
// automatic WebGL2 fallback. Owns the canvas DPR/resize lifecycle.
//
// Spec: PRISM-RENDERER-MIGRATION-SPEC.md §11 (Bundle Assembly) and §12 (Hub
// Manager). Implemented in T02; Phase 1 (T01) ships type stubs only so the
// adapter and codegen layers can typecheck against a stable contract.

export interface SceneRootHandle {
  // Implementation lands in T02. Anticipated surface:
  //   - mount(canvas: HTMLCanvasElement): Promise<void>
  //   - addHub(hubGroup: Object3D): void
  //   - removeHub(hubGroup: Object3D): void
  //   - dispose(): void
  // Kept opaque here so consumers don't depend on a placeholder shape.
  readonly __t01Stub: true;
}

export function createSceneRoot(): SceneRootHandle {
  throw new Error('createSceneRoot: not implemented (T02)');
}
