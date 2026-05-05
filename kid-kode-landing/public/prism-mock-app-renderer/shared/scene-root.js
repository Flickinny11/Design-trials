import { Scene, PerspectiveCamera, AmbientLight, DirectionalLight, HemisphereLight } from 'three';
import { WebGPURenderer } from 'three/webgpu';

export async function createSceneRoot({ canvas, width, height, backgroundColor = 0x000000 } = {}) {
  const scene = new Scene();
  const camera = new PerspectiveCamera(35, width / height, 0.1, 1000);
  camera.position.set(0, 0, 8);
  scene.add(new AmbientLight(0xffffff, 0.6));
  scene.add(new HemisphereLight(0xffffff, 0x222244, 0.4));
  const key = new DirectionalLight(0xffffff, 1.2);
  key.position.set(5, 8, 6);
  scene.add(key);
  const renderer = new WebGPURenderer({ canvas, antialias: true });
  await renderer.init();
  renderer.setSize(width, height);
  const dpr = (typeof globalThis !== 'undefined' && globalThis.devicePixelRatio) || 1;
  renderer.setPixelRatio(Math.min(dpr, 2));
  scene.background = null;
  let running = true;
  renderer.setAnimationLoop(() => { if (running) renderer.render(scene, camera); });
  return {
    scene, camera, renderer,
    resize(w, h) { camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h); },
    dispose() { running = false; renderer.setAnimationLoop(null); renderer.dispose && renderer.dispose(); },
  };
}
