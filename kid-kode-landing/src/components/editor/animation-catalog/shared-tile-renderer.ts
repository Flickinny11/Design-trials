'use client';

// SharedTileRenderer — ONE persistent WebGPU context that every catalog preview
// tile draws through (catalog-prep, 2026-06-07).
//
// The ULTRACODE pilot proved that mounting/unmounting a separate WebGPU context
// per tile churns GL contexts and triggers "device lost" under headless
// swiftshader (33 events before it routed everything through a single detail
// canvas). This rig generalises that fix so the full 300-tile catalog is clean:
//
//   • one fixed, full-viewport <canvas> + one WebGPURenderer (WebGL2 fallback);
//   • each tile is a transparent DOM "window"; on every frame we read its
//     bounding rect and render its mini-scene into that rect via a scissored
//     viewport (the classic DOM-synced multi-view technique — identical API on
//     WebGLRenderer and WebGPURenderer: setViewport/setScissor/clear/render);
//   • off-screen tiles are culled, so 300 tiles cost only what's visible;
//   • a shared PMREM environment map (RoomEnvironment, procedural fallback) is
//     assigned to every scene so glass / refraction / PBR materials shine.
//
// Result: register/unregister a tile = add/remove an entry in a Map. Zero GL
// contexts are created or destroyed after init, so device-lost stays at 0.
//
// This module lives under src/components/editor/** (NOT the prism runtime), so
// the FP-05 window/document restriction and the import allowlist do not apply —
// a single DOM-bound renderer is exactly what belongs here.

import * as THREE from 'three';
import { WebGPURenderer } from 'three/webgpu';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildSubject } from '@/lib/prism/animatable/subjects';
import type {
  Animatable,
  AnimatableTarget,
  ParamState,
  PrimitiveDefinition,
} from '@/lib/prism/animatable/contract';

const TILE_BG = new THREE.Color('#06070d');

export interface RegisterOptions {
  element: HTMLElement;
  def: PrimitiveDefinition;
  params?: Partial<ParamState>;
  /** Advance the clock this frame? (false = freeze in place.) */
  getPlaying: () => boolean;
  /** Phase (0..1) to hold a never-played tile at, so it isn't a blank t=0. */
  frozenPhase?: number;
  onInstance?: (inst: Animatable | null) => void;
}

interface Tile {
  id: number;
  element: HTMLElement;
  def: PrimitiveDefinition;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  target: AnimatableTarget;
  inst: Animatable | null;
  elapsed: number;
  lastT: number;
  opts: RegisterOptions;
}

export interface TileHandle {
  getInstance(): Animatable | null;
  /** Rebuild with a new definition / params (disposes the old instance). */
  rebuild(def: PrimitiveDefinition, params?: Partial<ParamState>): void;
  unregister(): void;
}

class SharedTileRenderer {
  private renderer: WebGPURenderer | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private env: THREE.Texture | null = null;
  private tiles = new Map<number, Tile>();
  private nextId = 1;
  private rafId = 0;
  private prevTime = 0;
  private initPromise: Promise<void> | null = null;

  ready = false;
  backend: 'webgpu' | 'webgl' | 'unknown' = 'unknown';
  deviceLostCount = 0;

  /** Idempotent: bind the rig to a canvas and start the loop. */
  acquire(canvas: HTMLCanvasElement): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.canvas = canvas;
    this.initPromise = this.init(canvas);
    return this.initPromise;
  }

  private async init(canvas: HTMLCanvasElement): Promise<void> {
    const renderer = new WebGPURenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    (renderer as unknown as { toneMapping: THREE.ToneMapping }).toneMapping =
      THREE.ACESFilmicToneMapping;
    // Slightly hotter exposure so transmissive glass and PBR cards read premium
    // (the pilot's glass was dark for lack of any IBL).
    (renderer as unknown as { toneMappingExposure: number }).toneMappingExposure = 1.15;
    renderer.autoClear = false;
    await renderer.init();
    this.renderer = renderer;

    // Backend + device-lost wiring (covers both WebGPU and the WebGL2 fallback).
    try {
      const backendName = (renderer.backend?.constructor?.name || '').toLowerCase();
      this.backend = backendName.includes('webgpu') ? 'webgpu' : 'webgl';
    } catch {
      this.backend = 'unknown';
    }
    canvas.addEventListener('webglcontextlost', () => {
      this.deviceLostCount += 1;
    });
    try {
      const device = (renderer.backend as unknown as { device?: { lost?: Promise<unknown> } })?.device;
      device?.lost?.then(() => {
        this.deviceLostCount += 1;
      });
    } catch {
      /* no device.lost on this backend */
    }

    this.buildEnv(renderer);
    this.resize();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this.resize);
    }
    this.exposeHooks();
    this.ready = true;
    this.prevTime = (typeof performance !== 'undefined' ? performance.now() : 0);
    this.loop();
  }

  /** Studio IBL so transmissive glass / PBR read well. Falls back to a simple
   *  procedural gradient env if PMREM is unavailable on this backend. */
  private buildEnv(renderer: WebGPURenderer): void {
    try {
      const pmrem = new THREE.PMREMGenerator(renderer as unknown as THREE.WebGLRenderer);
      pmrem.compileEquirectangularShader?.();
      const envScene = new RoomEnvironment();
      this.env = pmrem.fromScene(envScene, 0.04).texture;
      pmrem.dispose();
      envScene.dispose?.();
    } catch (err) {
      console.warn('[catalog-rig] PMREM env unavailable, using procedural fallback:', err);
      this.env = this.proceduralEnv();
    }
    if (!this.env) this.env = this.proceduralEnv();
    for (const t of this.tiles.values()) t.scene.environment = this.env;
  }

  /** Vertical studio-ish gradient equirect, used only if PMREM fails. */
  private proceduralEnv(): THREE.Texture {
    const w = 16;
    const h = 64;
    const data = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) {
      const v = y / (h - 1);
      // top: cool key light → bottom: deep ink.
      const r = Math.round(40 + 150 * Math.pow(1 - v, 1.5));
      const g = Math.round(48 + 150 * Math.pow(1 - v, 1.4));
      const b = Math.round(70 + 170 * Math.pow(1 - v, 1.2));
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
        data[i + 3] = 255;
      }
    }
    const tex = new THREE.DataTexture(data, w, h);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.needsUpdate = true;
    return tex;
  }

  private makeScene(): THREE.Scene {
    const scene = new THREE.Scene();
    scene.background = null;
    if (this.env) scene.environment = this.env;
    // Push the IBL a bit hotter so glass/refraction/PBR clearly catch the studio
    // environment (the headline "glass now shines" upgrade over the pilot).
    (scene as unknown as { environmentIntensity: number }).environmentIntensity = 1.6;
    scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(3, 4, 5);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xa978ff, 0.5);
    fill.position.set(-4, -2, 2);
    scene.add(fill);
    return scene;
  }

  register(opts: RegisterOptions): TileHandle {
    const id = this.nextId++;
    const scene = this.makeScene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(0, 0, 3.2);

    const tile: Tile = {
      id,
      element: opts.element,
      def: opts.def,
      scene,
      camera,
      target: { object: new THREE.Group(), subject: null, scene, userData: {} },
      inst: null,
      elapsed: 0,
      lastT: 0,
      opts,
    };
    this.tiles.set(id, tile);
    this.buildInstance(tile, opts.def, opts.params);

    return {
      getInstance: () => tile.inst,
      rebuild: (def, params) => this.buildInstance(tile, def, params),
      unregister: () => {
        this.disposeTile(tile);
        this.tiles.delete(id);
      },
    };
  }

  private buildInstance(tile: Tile, def: PrimitiveDefinition, params?: Partial<ParamState>): void {
    // Tear down any previous instance + subject.
    if (tile.inst) {
      try {
        tile.inst.dispose();
      } catch (err) {
        console.error(`[catalog-rig] ${tile.def.name} dispose() failed:`, err);
      }
    }
    if (tile.target.object.parent) tile.scene.remove(tile.target.object);
    disposeObject(tile.target.object);

    const { object, subject } = buildSubject(def.subject);
    const target: AnimatableTarget = { object, subject, scene: tile.scene, userData: {} };
    let inst: Animatable | null = null;
    try {
      inst = def.create(target, params);
      inst.seek(0);
    } catch (err) {
      console.error(`[animatable] ${def.name} create() failed:`, err);
    }
    tile.def = def;
    tile.target = target;
    tile.inst = inst;
    // Seed the frozen phase so a never-played tile shows a mid-frame, not t=0.
    const dur = inst ? safeDuration(inst.duration()) : 4;
    tile.elapsed = (tile.opts.frozenPhase ?? 0.45) * dur;
    tile.lastT = tile.elapsed % dur;
    tile.scene.add(object);
    tile.opts.onInstance?.(inst);
  }

  private disposeTile(tile: Tile): void {
    if (tile.inst) {
      try {
        tile.inst.dispose();
      } catch {
        /* already torn down */
      }
    }
    tile.scene.remove(tile.target.object);
    disposeObject(tile.target.object);
  }

  private resize = (): void => {
    if (!this.renderer || typeof window === 'undefined') return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
  };

  private loop = (): void => {
    this.rafId = requestAnimationFrame(this.loop);
    const renderer = this.renderer;
    const canvas = this.canvas;
    if (!renderer || !canvas || typeof window === 'undefined') return;

    const now = performance.now();
    const delta = Math.min((now - this.prevTime) / 1000, 0.05);
    this.prevTime = now;

    const winW = window.innerWidth;
    const winH = window.innerHeight;
    const bufH = canvas.height; // device px

    // Clear the whole buffer to transparent once (no ghosting in gaps).
    renderer.setScissorTest(false);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.setScissorTest(true);

    for (const tile of this.tiles.values()) {
      const rect = tile.element.getBoundingClientRect();
      // Cull anything off-screen or zero-area (handles 300 tiles cheaply).
      if (
        rect.width <= 0 ||
        rect.height <= 0 ||
        rect.bottom <= 0 ||
        rect.right <= 0 ||
        rect.top >= winH ||
        rect.left >= winW
      ) {
        continue;
      }
      this.advance(tile, delta);

      // WebGPURenderer normalizes setViewport/setScissor to a TOP-LEFT origin
      // (WebGPU-native), and also multiplies by pixelRatio internally — so we
      // pass CSS-pixel, top-origin values straight through (no manual y-flip,
      // no manual dpr). This is correct on both the WebGPU path and the WebGL2
      // fallback (the backend handles the GL bottom-left flip).
      const x = Math.floor(rect.left);
      const w = Math.floor(rect.width);
      const h = Math.floor(rect.height);
      const yGl = Math.floor(rect.top);

      renderer.setViewport(x, yGl, w, h);
      renderer.setScissor(x, yGl, w, h);
      renderer.setClearColor(TILE_BG, 1);
      renderer.clear();

      tile.camera.aspect = w / h;
      tile.camera.updateProjectionMatrix();
      try {
        renderer.render(tile.scene, tile.camera);
      } catch (err) {
        console.error(`[catalog-rig] render(${tile.def.name}) failed:`, err);
      }
    }
  };

  private advance(tile: Tile, delta: number): void {
    const inst = tile.inst;
    if (!inst) return;
    const dur = safeDuration(inst.duration());
    let t: number;
    if (tile.opts.getPlaying()) {
      tile.elapsed += delta;
      t = tile.elapsed % dur;
      tile.lastT = t;
    } else {
      t = tile.lastT;
    }
    const ph = t / dur;
    // Synthetic pointer/scroll so pointer- and scroll-driven primitives animate.
    tile.target.userData.pointer = { x: Math.cos(ph * Math.PI * 2), y: Math.sin(ph * Math.PI * 2) };
    tile.target.userData.scroll = ph;
    try {
      inst.seek(t);
    } catch {
      /* error already logged on create */
    }
  }

  private exposeHooks(): void {
    if (typeof window === 'undefined') return;
    (window as unknown as Record<string, unknown>).__catalogRig = {
      get ready() {
        return sharedRig.ready;
      },
      get tileCount() {
        return sharedRig.tiles.size;
      },
      get deviceLostCount() {
        return sharedRig.deviceLostCount;
      },
      get backend() {
        return sharedRig.backend;
      },
      // On-demand per-tile rects (diagnostic; useful when scaling to 300).
      debug: () =>
        [...sharedRig.tiles.values()].map((t) => {
          const r = t.element.getBoundingClientRect();
          return { name: t.def.name, top: Math.round(r.top), left: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height), connected: t.element.isConnected };
        }),
    };
  }

  dispose(): void {
    cancelAnimationFrame(this.rafId);
    if (typeof window !== 'undefined') window.removeEventListener('resize', this.resize);
    for (const tile of this.tiles.values()) this.disposeTile(tile);
    this.tiles.clear();
    this.env?.dispose();
    this.renderer?.dispose();
    this.renderer = null;
    this.ready = false;
    this.initPromise = null;
  }
}

function safeDuration(d: number): number {
  return Number.isFinite(d) ? Math.max(0.05, d) : 4;
}

function disposeObject(root: THREE.Object3D): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose?.();
    const mat = mesh.material;
    if (mat) {
      const arr = Array.isArray(mat) ? mat : [mat];
      for (const m of arr) m.dispose?.();
    }
  });
}

// Module singleton — one rig per page.
export const sharedRig = new SharedTileRenderer();
