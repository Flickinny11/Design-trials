// LoaderCache — wraps Three's TextureLoader + GLTFLoader with URL-keyed
// caches so codegen-emitted node modules can request assets synchronously
// from inside `createNode` (the contract requires sync return — async I/O
// happens via these cached loaders).
//
// Spec: PRISM-RENDERER-MIGRATION-SPEC.md §8 (createNode contract) and §11
// (Bundle Assembly). Implemented in T02.

export interface LoaderCacheHandle {
  // Anticipated surface (T02):
  //   textureLoader: (url: string) => THREE.Texture
  //   glbLoader: (url: string) => Promise<GLTF>
  //   dispose(): void
  readonly __t01Stub: true;
}

export function createLoaderCache(): LoaderCacheHandle {
  throw new Error('createLoaderCache: not implemented (T02)');
}
