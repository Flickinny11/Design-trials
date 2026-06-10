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
import { buildSubject, setTextSubjectAtlas } from '@/lib/prism/animatable/subjects';
import { getFontRegistry } from '@/lib/prism/text/font-registry';
import type {
  Animatable,
  AnimatableTarget,
  ParamState,
  PrimitiveDefinition,
} from '@/lib/prism/animatable/contract';

const TILE_BG = new THREE.Color('#06070d');

// Clear / colourless transmissive primitives that the CATALOG-PARALLEL-VERIFY
// report flagged as near-black on the pure-dark backdrop: with nothing lit
// BEHIND the subject, a perfectly clear refractor has nothing to bend, so it
// reads as an unlit silhouette. We give every 'glass'-category tile a small
// LIT BACKDROP (a soft emissive gradient panel + a few bright bokeh blobs, a
// short distance behind the subject at z<0) so the refraction cone has
// something to sample. Cheap, IBL-lit standard materials only — no new shaders.
// Gating on the category covers the explicitly-flagged clear ids
// (crystal-ball, liquid-glass, liquid-fill-glass, refraction-warp,
// water-droplet) plus the rest of the glass family, and only the glass family
// (non-glass tiles are untouched).
const GLASS_BOKEH_COLORS = ['#8fb0c4', '#ecd49d', '#9fe0c4', '#ffd98a', '#ddba77']; // ice + brass bokeh (Observatory Brass; purple banned)

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
  /** Lit backdrop added behind glass-category subjects (else null). */
  glassBackdrop: THREE.Group | null;
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
  /** True once the Inter MSDF atlas is injected (text tiles = real glyphs). */
  textAtlasReady = false;
  /** Names of the def's that currently have a lit glass backdrop (diagnostic). */
  glassBackdropTiles = new Set<string>();

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

    // Inject the Inter-400 MSDF atlas so buildSubject('text') assembles REAL
    // letterforms (INV-11). Awaited before ready/loop, so no frame ever paints
    // the proxy boxes; tiles registered while the renderer was still booting
    // are rebuilt against the atlas. On failure: log once, keep proxy glyphs —
    // the rig must never crash over a font fetch.
    await this.preloadTextAtlas();

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

  /** Resolve + inject the shared Inter atlas for the 'text' subject. The atlas
   *  texture is registry-owned (`userData.prismShared`) — tile disposal only
   *  ever disposes per-unit geometry/materials, never the atlas texture. */
  private async preloadTextAtlas(): Promise<void> {
    try {
      const atlas = await getFontRegistry().resolveAtlas('Inter', 400);
      setTextSubjectAtlas(atlas);
      this.textAtlasReady = true;
      for (const tile of this.tiles.values()) {
        if (tile.def.subject === 'text') this.buildInstance(tile, tile.def, tile.opts.params);
      }
    } catch (err) {
      console.warn('[catalog-rig] Inter MSDF atlas unavailable — text tiles fall back to proxy glyphs:', err);
    }
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
    // Cool steel fill against the warm key — classic studio pairing that keeps
    // previews inside the Observatory Brass palette (design-system DS.ice400;
    // the old 0xa978ff purple fill is banned chrome).
    const fill = new THREE.DirectionalLight(0x7d9fb4, 0.5);
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
      glassBackdrop: null,
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
    // Tear down any previous glass backdrop before (maybe) rebuilding it for
    // the new def — a rebuild can swap a glass def for a non-glass one.
    this.removeGlassBackdrop(tile);

    const { object, subject } = buildSubject(def.subject, { volumetric: def.volumetric });
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
    // Give clear/transmissive glass tiles something lit to refract through.
    if (def.category === 'glass') this.addGlassBackdrop(tile);
    tile.opts.onInstance?.(inst);
  }

  /** Build a cheap, IBL-lit backdrop a short distance behind the subject so a
   *  perfectly clear refractor has bright structure to bend. Glass tiles only. */
  private addGlassBackdrop(tile: Tile): void {
    const group = new THREE.Group();
    group.name = 'glass-backdrop';
    // Sit it behind the subject (camera is at z≈3.2 looking down -z), close
    // enough to fill the refraction cone but far enough to stay out of focus.
    // Brought a touch closer than the pilot (was -1.6) so the on-axis centre
    // has bright structure to magnify rather than reading through to black.
    group.position.z = -1.35;

    // Soft emissive gradient panel — a vertex-coloured plane (top cool key →
    // bottom deep ink) lit purely by its own emissive, so it never blows out.
    // The base floor is lifted off pure-ink (was #0a0e22) so even a dead-centre
    // refraction ray that misses every highlight still lands on lit material,
    // not near-black.
    const w = 4.6;
    const h = 4.6;
    const panelGeo = new THREE.PlaneGeometry(w, h, 1, 1);
    const top = new THREE.Color('#2e3a4e'); // steel (was AI-slop navy)
    const bot = new THREE.Color('#11151f');
    const colors = new Float32Array(4 * 3);
    // PlaneGeometry vertex order: top-left, top-right, bottom-left, bottom-right.
    [top, top, bot, bot].forEach((c, i) => {
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    });
    panelGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const panel = new THREE.Mesh(
      panelGeo,
      new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: true }),
    );
    panel.name = 'glass-backdrop-panel';
    group.add(panel);

    // GUARANTEED on-axis hero: a large bright OPAQUE emissive sphere sitting
    // dead-centre (x=0,y=0) just in front of the panel. This is the element the
    // subject's geometric centre refracts/magnifies. It MUST be opaque: three.js
    // renders the transmission sample (what a transmissive MeshPhysicalMaterial
    // refracts) from OPAQUE scene objects only — transparent objects are excluded
    // from the transmission render target — so a transparent/additive hero would
    // be invisible THROUGH the glass (the bug this fixes: clear centres read
    // black because only the dark panel sat behind them in the transmission
    // pass). An emissive sphere reads as a soft glowing core when magnified by a
    // clear lens rather than a hard-edged disc. Bright but not white-hot, so the
    // refracted centre is premium, not blown out.
    const hero = new THREE.Mesh(
      new THREE.SphereGeometry(0.78, 32, 24),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#a9c2d1'),
        emissive: new THREE.Color('#cfdde6'),
        emissiveIntensity: 1.5,
        roughness: 0.5,
        metalness: 0,
        envMapIntensity: 0.6,
      }),
    );
    hero.name = 'glass-backdrop-hero';
    hero.position.set(0, 0, 0.25);
    group.add(hero);

    // A few bright bokeh blobs in front of the panel — these are the high-
    // frequency highlights the glass sparkles on. Emissive standard spheres so
    // they also catch the shared env a touch. Deterministic placement (seeded
    // by tile id) so the gallery is stable across renders. The FIRST blob is
    // pinned near the axis (small jitter only) so off-centre magnification also
    // catches a coloured highlight right next to the hero disc.
    let seed = (tile.id * 2654435761) >>> 0;
    const rand = (): number => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0xffffffff;
    };
    const BOKEH = 5;
    for (let i = 0; i < BOKEH; i++) {
      const color = new THREE.Color(GLASS_BOKEH_COLORS[i % GLASS_BOKEH_COLORS.length]);
      const r = 0.18 + rand() * 0.34;
      const blob = new THREE.Mesh(
        new THREE.SphereGeometry(r, 20, 14),
        new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 2.2,
          roughness: 0.4,
          metalness: 0,
          envMapIntensity: 0.8,
        }),
      );
      if (i === 0) {
        // Near-axis highlight: small jitter so the centre always has colour.
        blob.position.set((rand() - 0.5) * 0.7, (rand() - 0.5) * 0.7, 0.35 + rand() * 0.3);
      } else {
        blob.position.set((rand() - 0.5) * 3.0, (rand() - 0.5) * 3.0, 0.2 + rand() * 0.5);
      }
      group.add(blob);
    }

    tile.scene.add(group);
    tile.glassBackdrop = group;
    this.glassBackdropTiles.add(tile.def.name);
  }

  /** Lazily-built soft radial disc texture (bright opaque core → transparent
   *  rim) used as the guaranteed on-axis hero element behind glass subjects.
   *  Cached + shared across tiles; disposed with the rig. */
  private softDisc: THREE.Texture | null = null;
  private softDiscTexture(): THREE.Texture {
    if (this.softDisc) return this.softDisc;
    const size = 128;
    const data = new Uint8Array(size * size * 4);
    const c = (size - 1) / 2;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = (x - c) / c;
        const dy = (y - c) / c;
        const d = Math.min(1, Math.sqrt(dx * dx + dy * dy));
        // Smooth bright-core falloff: full at centre, 0 at the rim. Square the
        // (1-d) ramp for a soft, premium glow rather than a hard edge.
        const a = Math.pow(Math.max(0, 1 - d), 2.2);
        const i = (y * size + x) * 4;
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
        data[i + 3] = Math.round(255 * a);
      }
    }
    const tex = new THREE.DataTexture(data, size, size);
    tex.needsUpdate = true;
    this.softDisc = tex;
    return tex;
  }

  private removeGlassBackdrop(tile: Tile): void {
    if (!tile.glassBackdrop) return;
    tile.scene.remove(tile.glassBackdrop);
    disposeObject(tile.glassBackdrop);
    this.glassBackdropTiles.delete(tile.def.name);
    tile.glassBackdrop = null;
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
    this.removeGlassBackdrop(tile);
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
      // True when the 'text' subject is building real MSDF letterforms.
      get textAtlasReady() {
        return sharedRig.textAtlasReady;
      },
      // Which def's currently have a lit glass backdrop (verification hook for
      // the clear-glass refraction fix).
      get glassBackdropTiles() {
        return [...sharedRig.glassBackdropTiles];
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
    this.softDisc?.dispose();
    this.softDisc = null;
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
