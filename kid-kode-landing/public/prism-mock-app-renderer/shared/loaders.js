import { TextureLoader } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export function createLoaderCache() {
  const tex = new TextureLoader();
  const glb = new GLTFLoader();
  const texCache = new Map();
  const glbCache = new Map();
  return {
    loadTexture(url) {
      let p = texCache.get(url);
      if (!p) { p = tex.loadAsync(url); texCache.set(url, p); }
      return p;
    },
    loadGLB(url) {
      let p = glbCache.get(url);
      if (!p) { p = glb.loadAsync(url); glbCache.set(url, p); }
      return p;
    },
    dispose() {
      for (const p of texCache.values()) p.then((t) => t.dispose && t.dispose()).catch(() => {});
      texCache.clear();
      glbCache.clear();
    },
  };
}
