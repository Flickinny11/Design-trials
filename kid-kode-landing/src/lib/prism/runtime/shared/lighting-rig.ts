// Lighting rig — the scene-wide Material+Lighting subsystem core
// (PRISM-CANVAS-EDITOR-SPEC §10, INV-8/INV-9; runtime INV-R14).
//
// One rig per scene. It owns:
//   • environment/IBL (PMREM studio env from environment-ibl) — tier T0 floor.
//   • a configurable light list (ambient + key/fill/rim directional + point/spot
//     + hemisphere), driven from a LightingSpec or a sensible default 3-point rig.
//   • soft shadows (PCFSoft / VSM) — tier T1+.
//   • a capability-gated T2 post pipeline (native TSL GTAO + SSGI) that degrades
//     cleanly to T1 (plain render) when the backend can't hold it — never the
//     default path (INV-9), never a crash / device-loss.
//
// DOM-free (INV-R12). The renderer + scene + camera are injected. The caller
// (scene-root / a probe page) drives `render()` once per frame.

import {
  AmbientLight,
  Color,
  DirectionalLight,
  HemisphereLight,
  PCFSoftShadowMap,
  PointLight,
  SpotLight,
  VSMShadowMap,
  Vector3,
  type Camera,
  type Light,
  type Object3D,
  type Scene,
} from 'three';
import { PostProcessing } from 'three/webgpu';
import { buildEnvironmentIBL, type EnvironmentIBLHandle } from './environment-ibl';
import {
  detectCapabilityTier,
  type CapabilityProfile,
} from './capability-tier';
import { UNLIT_LAYER } from './material-system';
import {
  LIGHTING_SPEC_DEFAULT,
  type LightingSpec,
  type LightingTier,
  type LightingTierPreference,
  type PrismLight,
  type PrismVec3,
} from '../../../prism-graph/types';

export interface LightingRigOptions {
  /** Author/hub tier preference; `'auto'` lets the detector choose. */
  tier?: LightingTierPreference;
  /** Mobile/low-power hint forwarded to the capability detector. */
  isMobile?: boolean;
  /** Initial spec to apply (per-hub lightingSpec). */
  spec?: LightingSpec | null;
  /** Render target size for the T2 post pipeline. */
  size?: { width: number; height: number };
}

export interface LightingRigHandle {
  /** The resolved capability profile (tier, backend, shadows, screenSpaceGI). */
  readonly profile: CapabilityProfile;
  /** Replace the whole configuration from a LightingSpec (per-hub / per-element). */
  applyLightingSpec(spec?: LightingSpec | null): void;
  /** Add one light; returns its id. */
  addLight(light: PrismLight): string;
  /** Patch an existing light live (color/intensity/position/…). */
  updateLight(id: string, patch: Partial<PrismLight>): void;
  /** Remove a light by id. */
  removeLight(id: string): void;
  /** Current light list (the spec form, for the toolbar). */
  getLights(): PrismLight[];
  /** Change tier preference at runtime (re-resolves the profile + post pipeline). */
  setTier(tier: LightingTierPreference): void;
  /**
   * Render one frame. Returns true if the rig rendered (T2 post path); false if
   * the caller should perform the normal `renderer.render(scene, camera)`.
   */
  render(): boolean;
  /** Resize the post pipeline render targets. */
  setSize(width: number, height: number): void;
  /** Dispose lights, env, and the post pipeline. */
  dispose(): void;
}

let lightSeq = 0;
function nextLightId(type: string): string {
  lightSeq += 1;
  return `${type}-${lightSeq}`;
}

function vec(v: PrismVec3 | undefined, fallback: [number, number, number]): Vector3 {
  if (!v) return new Vector3(...fallback);
  return new Vector3(v.x, v.y, v.z);
}

/** The default 3-point rig used when a spec carries no lights. */
function defaultLightList(): PrismLight[] {
  return [
    { id: 'key', type: 'directional', color: '#ffffff', intensity: 1.3, position: { x: 5, y: 8, z: 6 }, castShadow: true },
    { id: 'fill', type: 'directional', color: '#9ec5ff', intensity: 0.45, position: { x: -6, y: 2, z: 4 } },
    { id: 'rim', type: 'rim', color: '#ffd9a8', intensity: 0.7, position: { x: -3, y: 5, z: -7 } },
  ];
}

/** Materialize a PrismLight into a THREE light object. */
function buildLightObject(light: PrismLight): Light {
  const color = new Color(light.color ?? '#ffffff');
  const intensity = light.intensity ?? 1;
  switch (light.type) {
    case 'ambient':
      return new AmbientLight(color, intensity);
    case 'hemisphere':
      return new HemisphereLight(color, new Color(light.groundColor ?? '#202028'), intensity);
    case 'point': {
      const l = new PointLight(color, intensity, light.distance ?? 0, light.decay ?? 2);
      l.position.copy(vec(light.position, [0, 4, 4]));
      l.castShadow = Boolean(light.castShadow);
      return l;
    }
    case 'spot': {
      const l = new SpotLight(
        color, intensity, light.distance ?? 0,
        light.angle ?? Math.PI / 6, light.penumbra ?? 0.3, light.decay ?? 2,
      );
      l.position.copy(vec(light.position, [0, 6, 4]));
      l.target.position.copy(vec(light.target, [0, 0, 0]));
      l.castShadow = Boolean(light.castShadow);
      return l;
    }
    case 'directional':
    case 'rim':
    default: {
      const l = new DirectionalLight(color, intensity);
      // `rim` is a back-positioned directional preset (edge light).
      const fallback: [number, number, number] = light.type === 'rim' ? [-3, 5, -7] : [5, 8, 6];
      l.position.copy(vec(light.position, fallback));
      if (light.target) l.target.position.copy(vec(light.target, [0, 0, 0]));
      l.castShadow = Boolean(light.castShadow);
      return l;
    }
  }
}

/** Configure a casting light's shadow camera + softness. */
function configureShadow(light: Light, softness: number, useVSM: boolean): void {
  const anyLight = light as unknown as {
    castShadow?: boolean;
    shadow?: {
      mapSize: { set: (w: number, h: number) => void };
      radius: number;
      bias: number;
      camera: { near: number; far: number; left?: number; right?: number; top?: number; bottom?: number };
    };
  };
  if (!anyLight.castShadow || !anyLight.shadow) return;
  anyLight.shadow.mapSize.set(1024, 1024);
  // softness 0..1 → radius. VSM honors larger blur radii than PCFSoft.
  anyLight.shadow.radius = (useVSM ? 12 : 6) * Math.max(0.0001, softness) + 1;
  anyLight.shadow.bias = -0.0005;
  anyLight.shadow.camera.near = 0.5;
  anyLight.shadow.camera.far = 60;
  if (typeof anyLight.shadow.camera.left === 'number') {
    anyLight.shadow.camera.left = -20;
    anyLight.shadow.camera.right = 20;
    anyLight.shadow.camera.top = 20;
    anyLight.shadow.camera.bottom = -20;
  }
}

export function createLightingRig(
  scene: Scene,
  camera: Camera,
  renderer: unknown,
  options: LightingRigOptions = {},
): LightingRigHandle {
  let profile = detectCapabilityTier(renderer, {
    preference: options.tier ?? options.spec?.tier ?? 'auto',
    isMobile: options.isMobile,
  });

  const env: EnvironmentIBLHandle = buildEnvironmentIBL(renderer as never);
  let spec: LightingSpec = { ...LIGHTING_SPEC_DEFAULT, ...(options.spec ?? {}) };
  let lights: PrismLight[] = [];
  const mounted = new Map<string, Light>();
  let size = options.size ?? { width: 800, height: 600 };

  // ---- environment / IBL (T0 floor) -------------------------------------
  (scene as unknown as { environment: unknown }).environment = env.texture;
  (scene as unknown as { environmentIntensity: number }).environmentIntensity =
    spec.envIntensity ?? 1;

  // ---- shadow map config on the renderer (T1+) --------------------------
  function configureRendererShadows(): void {
    const r = renderer as unknown as {
      shadowMap?: { enabled: boolean; type: number };
    };
    if (!r.shadowMap) return;
    if (profile.shadows) {
      r.shadowMap.enabled = true;
      const veryShadowSoft = (spec.shadowSoftness ?? 0.5) > 0.66;
      r.shadowMap.type = veryShadowSoft ? VSMShadowMap : PCFSoftShadowMap;
    } else {
      r.shadowMap.enabled = false;
    }
  }

  function mountLights(list: PrismLight[]): void {
    for (const obj of mounted.values()) {
      scene.remove(obj);
      const t = (obj as unknown as { target?: Object3D }).target;
      if (t && t.parent) scene.remove(t);
    }
    mounted.clear();
    const useVSM = (spec.shadowSoftness ?? 0.5) > 0.66;
    const budget = profile.maxDynamicLights;
    let dynamicCount = 0;
    for (const light of list) {
      const isDynamic = light.type !== 'ambient' && light.type !== 'hemisphere';
      // At T0 (budget 0) only ambient/hemisphere fill is mounted — IBL does the
      // rest. T1/T2 mount dynamic lights up to the tier budget (INV-9).
      if (isDynamic && dynamicCount >= budget) continue;
      const obj = buildLightObject(light);
      // Only honor shadow casting when the tier supports shadows.
      if (!profile.shadows) (obj as unknown as { castShadow: boolean }).castShadow = false;
      configureShadow(obj, spec.shadowSoftness ?? 0.5, useVSM);
      scene.add(obj);
      const target = (obj as unknown as { target?: Object3D }).target;
      if (target) scene.add(target);
      mounted.set(light.id, obj);
      if (isDynamic) dynamicCount += 1;
    }
    // Always provide an ambient floor if the spec has none, so nothing is pitch
    // black at T0.
    if (!list.some((l) => l.type === 'ambient')) {
      const amb = new AmbientLight(new Color('#ffffff'), spec.ambientIntensity ?? 0.25);
      scene.add(amb);
      mounted.set('__ambient_floor', amb);
    }
  }

  // ---- T2 post pipeline (capability-gated, best-effort) -----------------
  let post: PostProcessing | null = null;
  function buildPostPipeline(): void {
    teardownPost();
    if (!profile.screenSpaceGI) return; // T0/T1 use the plain render path.
    try {
      // Lazy require of the TSL nodes so a backend that can't compile them only
      // pays at construction (caught below → graceful T1 fallback).
      void buildT2(scene, camera, renderer).then((p) => {
        post = p;
      }).catch(() => {
        post = null; // clean fallback to T1
      });
    } catch {
      post = null;
    }
  }
  function teardownPost(): void {
    if (post) {
      (post as unknown as { dispose?: () => void }).dispose?.();
      post = null;
    }
  }

  function applyAll(): void {
    lights = (spec.lights && spec.lights.length > 0 ? spec.lights : defaultLightList()).map((l) => ({ ...l }));
    (scene as unknown as { environmentIntensity: number }).environmentIntensity = spec.envIntensity ?? 1;
    configureRendererShadows();
    mountLights(lights);
    buildPostPipeline();
  }

  applyAll();

  return {
    get profile() {
      return profile;
    },
    applyLightingSpec(next) {
      spec = { ...LIGHTING_SPEC_DEFAULT, ...(next ?? {}) };
      if (next?.tier) {
        profile = detectCapabilityTier(renderer, { preference: next.tier, isMobile: options.isMobile });
      }
      applyAll();
    },
    addLight(light) {
      const id = light.id || nextLightId(light.type);
      const entry = { ...light, id };
      spec = { ...spec, lights: [...(spec.lights ?? defaultLightList()), entry] };
      applyAll();
      return id;
    },
    updateLight(id, patch) {
      const list = (spec.lights && spec.lights.length > 0 ? spec.lights : defaultLightList());
      spec = { ...spec, lights: list.map((l) => (l.id === id ? { ...l, ...patch, id } : l)) };
      applyAll();
    },
    removeLight(id) {
      const list = (spec.lights && spec.lights.length > 0 ? spec.lights : defaultLightList());
      spec = { ...spec, lights: list.filter((l) => l.id !== id) };
      applyAll();
    },
    getLights() {
      return lights.map((l) => ({ ...l }));
    },
    setTier(tier) {
      profile = detectCapabilityTier(renderer, { preference: tier, isMobile: options.isMobile });
      spec = { ...spec, tier };
      applyAll();
    },
    render() {
      if (post) {
        try {
          (post as unknown as { render: () => void }).render();
          return true;
        } catch {
          // A post failure must never bring down the loop — fall back to plain.
          teardownPost();
          return false;
        }
      }
      return false;
    },
    setSize(width, height) {
      size = { width, height };
      if (post) (post as unknown as { setSize?: (w: number, h: number) => void }).setSize?.(width, height);
    },
    dispose() {
      teardownPost();
      for (const obj of mounted.values()) {
        scene.remove(obj);
        const t = (obj as unknown as { target?: Object3D }).target;
        if (t && t.parent) scene.remove(t);
        (obj as unknown as { dispose?: () => void }).dispose?.();
      }
      mounted.clear();
      (scene as unknown as { environment: unknown }).environment = null;
      env.dispose();
      void size;
    },
  };
}

/**
 * Construct the T2 screen-space pipeline (native TSL GTAO + SSGI). Async so the
 * heavy display nodes are imported only when T2 is actually selected; any failure
 * rejects and the caller degrades to T1. Confirmed against three r184
 * (examples/jsm/tsl/display/{GTAONode,SSGINode}).
 */
async function buildT2(scene: Scene, camera: Camera, renderer: unknown): Promise<PostProcessing> {
  const tsl = await import('three/tsl');
  const { ao } = await import('three/examples/jsm/tsl/display/GTAONode.js');
  const { ssgi } = await import('three/examples/jsm/tsl/display/SSGINode.js');
  const { pass, mrt, output, transformedNormalView, mix, step, oneMinus, float } = tsl as unknown as {
    pass: (s: Scene, c: Camera) => {
      setMRT: (m: unknown) => void;
      getTextureNode: (k?: string) => unknown;
    };
    mrt: (m: Record<string, unknown>) => unknown;
    output: unknown;
    transformedNormalView: unknown;
    mix: (a: unknown, b: unknown, t: unknown) => unknown;
    step: (edge: unknown, x: unknown) => unknown;
    oneMinus: (x: unknown) => unknown;
    float: (n: number) => unknown;
  };

  const post = new PostProcessing(renderer as never);
  const scenePass = pass(scene, camera);
  scenePass.setMRT(mrt({ output, normal: transformedNormalView }));
  const color = scenePass.getTextureNode('output');
  const normal = scenePass.getTextureNode('normal');
  const depth = scenePass.getTextureNode('depth');

  // Screen-space GI carries the beauty; GTAO multiplies ambient occlusion.
  const giNode = (ssgi as unknown as (b: unknown, d: unknown, n: unknown, c: Camera) => { mul: (x: unknown) => unknown })(
    color, depth, normal, camera,
  );
  const aoPass = (ao as unknown as (d: unknown, n: unknown, c: Camera) => { getTextureNode: () => unknown })(
    depth, normal, camera,
  );
  const giAoResult = giNode.mul(aoPass.getTextureNode());

  // ── criterion 17 @ T2 — exclude UNLIT image planes from screen-space GI ──
  // Render a MASK pass that contains ONLY the unlit layer (clone the camera and
  // restrict its layer mask to UNLIT_LAYER). The pass's DEPTH texture is the
  // robust coverage signal: where a tagged unlit plane is drawn, depth < 1;
  // everywhere else (incl. the scene background, which the renderer draws at the
  // far plane) depth == 1. This is immune to the scene's opaque background and
  // to whatever alpha the color RT clears to. coverage = oneMinus(step(thr,
  // depth)) → 1 over unlit planes, 0 elsewhere. mix(giAoResult, color, coverage):
  // coverage=1 → original beauty 'color' (byte-identical to T0/T1), coverage=0 →
  // the GI/AO result. Wrapped in try/catch so any unsupported node API degrades
  // cleanly to the un-masked GI result (still a valid T2 render).
  let outputNode: unknown = giAoResult;
  try {
    const maskCam = (camera as unknown as { clone: () => Camera }).clone();
    maskCam.layers.disableAll();
    maskCam.layers.enable(UNLIT_LAYER);
    const maskPass = pass(scene, maskCam);
    const maskDepth = maskPass.getTextureNode('depth');
    // threshold just below the far plane so only real geometry (depth<1) counts.
    const coverage = oneMinus(step(float(0.999999), maskDepth));
    outputNode = mix(giAoResult, color, coverage);
  } catch {
    outputNode = giAoResult; // un-masked GI (still a valid T2 render).
  }

  (post as unknown as { outputNode: unknown }).outputNode = outputNode;
  return post;
}
