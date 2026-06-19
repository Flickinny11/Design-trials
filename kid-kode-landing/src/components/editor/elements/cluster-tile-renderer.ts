'use client';

// ClusterTileRenderer — the prebuilt-element-library hover-preview rig (§13,
// PREBUILT-LIBRARY-CONTRACT §5). It is the cluster-grade sibling of the
// animation-catalog `shared-tile-renderer.ts`: ONE persistent WebGPU context
// that every library tile draws through, each tile a transparent DOM "window"
// rendered via a scissored viewport on the one shared canvas.
//
// Why a separate rig from the animation-catalog one? A primitive tile renders a
// single synthetic SUBJECT (`buildSubject`) animated by ONE primitive. A
// library tile renders the REAL element CLUSTER: every member node assembled
// through the same `defaultRenderModeFactory` Canvas uses, posed at its
// `scenePosition`, with each member's INTEGRATED `animationBindings` playing.
// That is the "EVEN MORE robust than the primitive tiles" bar — the tile shows
// exactly what drag-to-place will instantiate, moving.
//
// Proven invariants carried verbatim from shared-tile-renderer.ts:
//   • one fixed full-viewport transparent <canvas> + one WebGPURenderer;
//   • each frame we read every tile's bounding rect and render its mini-scene
//     into that rect via setViewport/setScissor/clear/render (top-left origin,
//     CSS px, no manual dpr/flip — the WebGPU backend normalises both);
//   • off-screen tiles are culled (cheap at scale);
//   • a shared PMREM RoomEnvironment (procedural fallback) so PBR / glass shine;
//   • ACES tone-mapping, exposure ~1.15;
//   • device-lost wiring + a `__clusterRig` window hook for verification;
//   • per-tile render is wrapped in try/catch — the rig must NEVER throw.
//
// This module lives under src/components/editor/** (NOT the prism runtime), so
// FP-05's window/document restriction and the `@/` import allowlist do not
// apply — a single DOM-bound renderer + `@/` imports are exactly what belong
// here (same scope as shared-tile-renderer.ts).

import * as THREE from 'three';
import { WebGPURenderer } from 'three/webgpu';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { getSharedNodeContext } from '@/lib/prism/runtime/shared-context';
import { defaultRenderModeFactory } from '@/lib/prism/runtime/factories/default-factory';
import { createDriverHub } from '@/lib/prism/runtime/shared/drivers';
import { makeNodeDrivers, type NodeDrivers } from '@/lib/prism/runtime/shared/driver-dispatch';
import {
  attachAnimationBindings,
  BINDING_PLAYERS_KEY,
  type AnimationBindingPlayer,
} from '@/lib/prism/animatable/bindings';
import { buildClusterNodeInputs } from '@/lib/editor/elements/instantiate';
import {
  CLUSTER_PREVIEW_DEFAULT,
  type ElementClusterDefinition,
} from '@/lib/editor/elements/contract';
import type { NodeContext } from '@/lib/prism/runtime/shared/adapter';
import type { PrismNode, ScenePosition } from '@/lib/prism-graph/types';

const TILE_BG = new THREE.Color('#06070d');

export interface RegisterClusterOptions {
  element: HTMLElement;
  def: ElementClusterDefinition;
  /** Advance the clock this frame? (false = freeze at frozenPhase.) */
  getPlaying: () => boolean;
}

interface ClusterTile {
  id: number;
  element: HTMLElement;
  def: ElementClusterDefinition;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** The cluster group containing every member Object3D. */
  group: THREE.Group;
  /** Live binding players harvested from every member's userData. */
  players: AnimationBindingPlayer[];
  /** Per-member detach() handles (kill timelines / dispose animatables). */
  detachers: Array<() => void>;
  /** Per-member factory cleanup() (dispose geometries/materials). */
  cleanups: Array<() => void>;
  /** The loop length (seconds) the preview animation runs on. */
  loopSeconds: number;
  /** Phase (0..1) to hold at while not playing. */
  frozenPhase: number;
  elapsed: number;
  lastT: number;
}

export interface ClusterTileHandle {
  getGroup(): THREE.Group | null;
  /** Rebuild against a (possibly new) definition. Disposes the old members. */
  rebuild(def: ElementClusterDefinition): void;
  unregister(): void;
}

/** A throwaway id for preview-only member nodes (never enters the live graph). */
let previewSeq = 0;
function previewNodeId(): string {
  previewSeq += 1;
  return `cluster-preview-${previewSeq.toString(36)}`;
}

function applyScenePositionTo(obj: THREE.Object3D, sp: ScenePosition | undefined): void {
  if (!sp) return;
  obj.position.set(sp.x ?? 0, sp.y ?? 0, sp.z ?? 0);
  obj.rotation.set(sp.rotationX ?? 0, sp.rotationY ?? 0, sp.rotationZ ?? 0);
  obj.scale.set(sp.scaleX ?? 1, sp.scaleY ?? 1, sp.scaleZ ?? 1);
}

function disposeObject(root: THREE.Object3D): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose?.();
    const mat = mesh.material;
    if (mat) {
      const arr = Array.isArray(mat) ? mat : [mat];
      for (const m of arr) (m as { dispose?: () => void }).dispose?.();
    }
  });
}

class ClusterTileRenderer {
  private renderer: WebGPURenderer | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private env: THREE.Texture | null = null;
  private tiles = new Map<number, ClusterTile>();
  private nextId = 1;
  private rafId = 0;
  private prevTime = 0;
  private initPromise: Promise<void> | null = null;
  /** A rig-private driver hub so preview playback never touches the live
   *  scene's shared hub (pointer/scroll/event sources). */
  private drivers: NodeDrivers = makeNodeDrivers(createDriverHub());
  /** Shared NodeContext for every preview member (cached loaders + atlas;
   *  primitives wired so meshes/text read identically to Canvas). */
  private ctx: NodeContext = getSharedNodeContext({ runPrimitives: true });

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
    (renderer as unknown as { toneMappingExposure: number }).toneMappingExposure = 1.15;
    renderer.autoClear = false;
    await renderer.init();
    this.renderer = renderer;

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
    this.prevTime = typeof performance !== 'undefined' ? performance.now() : 0;
    this.loop();
  }

  /** Studio IBL (RoomEnvironment via PMREM) so PBR / glass members read
   *  photoreal. Procedural gradient fallback if PMREM is unavailable. */
  private buildEnv(renderer: WebGPURenderer): void {
    try {
      const pmrem = new THREE.PMREMGenerator(renderer as unknown as THREE.WebGLRenderer);
      pmrem.compileEquirectangularShader?.();
      const envScene = new RoomEnvironment();
      this.env = pmrem.fromScene(envScene, 0.04).texture;
      pmrem.dispose();
      (envScene as unknown as { dispose?: () => void }).dispose?.();
    } catch (err) {
      console.warn('[cluster-rig] PMREM env unavailable, using procedural fallback:', err);
      this.env = this.proceduralEnv();
    }
    if (!this.env) this.env = this.proceduralEnv();
    for (const t of this.tiles.values()) t.scene.environment = this.env;
  }

  private proceduralEnv(): THREE.Texture {
    const w = 16;
    const h = 64;
    const data = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) {
      const v = y / (h - 1);
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

  /** A 3-point lit scene + IBL (mirrors shared-tile-renderer.makeScene): warm
   *  key, cool steel fill, soft ambient — Chrome-Arc, NO purple. */
  private makeScene(): THREE.Scene {
    const scene = new THREE.Scene();
    scene.background = null;
    if (this.env) scene.environment = this.env;
    // Brighter IBL so transmissive glass + polished metal catch richer studio
    // reflections (advocate "glass reads flat/opaque" fix — env is what a clear
    // refractor reflects at its Fresnel rim).
    (scene as unknown as { environmentIntensity: number }).environmentIntensity = 1.85;
    scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const key = new THREE.DirectionalLight(0xffffff, 1.5);
    key.position.set(3, 4, 5);
    scene.add(key);
    // Cool steel fill against the warm key (DS.ice; the banned 0xa978ff purple
    // fill never appears).
    const fill = new THREE.DirectionalLight(0x7d9fb4, 0.5);
    fill.position.set(-4, -2, 2);
    scene.add(fill);
    // A soft warm rim from behind to separate dark meshes from the dark void.
    const rim = new THREE.DirectionalLight(0xffd9a0, 0.35);
    rim.position.set(0, 2, -5);
    scene.add(rim);
    this.addBackdrop(scene);
    return scene;
  }

  /** A far, dim lit STUDIO backdrop behind every cluster (mirrors the proven
   *  shared-tile-renderer glass-backdrop fix). Transmissive glass refracts only
   *  OPAQUE scene structure, so without bright structure a clear refractor reads
   *  as an opaque dark silhouette (the advocate's "pills read as grey not glass" /
   *  "near-black tiles" flag).
   *
   *  This used to place 4 hard emissive SPHERES in the background — which read
   *  as exposed yellow/blue LIGHT ORBS (the monitor/Logan "demo-rig-exposed"
   *  flag, P0). They are replaced by a premium photographer's seamless: a soft
   *  steel→ink gradient panel + soft VERTICAL SOFTBOX COLUMNS (warm-brass key
   *  left, cool-ice rim right, faint center back-light). Soft-edged columns read
   *  as studio strip-light reflections in chrome/glass — never as discrete bulbs
   *  — while still giving glass bright structure to bend and metal reflections to
   *  catch. Kept far (z≈-8) so non-glass elements are never washed. */
  private addBackdrop(scene: THREE.Scene): void {
    const group = new THREE.Group();
    group.name = 'cluster-backdrop';
    group.position.z = -8;

    const w = 20, h = 13;
    const panelGeo = new THREE.PlaneGeometry(w, h, 1, 1);
    // Bright studio seamless — this is the ONE OPAQUE surface behind the cluster,
    // so it is the ONLY thing transmissive glass refracts (the additive softbox
    // columns below are transparent → invisible to the transmission render-pass,
    // which captures opaque objects only). It MUST be bright or clear glass in
    // front refracts the void and reads solid/dark (the advocate "glass reads
    // opaque" flag). Bright cool-steel key → lifted graphite floor.
    // Moody field (keeps the deep-space Observatory tone); the BRIGHT bit glass
    // refracts is the central studio FILL below, not this full-field panel.
    const top = new THREE.Color('#3c4a62'); // moody steel key
    const bot = new THREE.Color('#161c28'); // deep graphite floor
    const colors = new Float32Array(4 * 3);
    [top, top, bot, bot].forEach((c, i) => { colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b; });
    panelGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const panel = new THREE.Mesh(panelGeo, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: true }));
    panel.position.z = -0.4;
    group.add(panel);

    // A soft BRIGHT OPAQUE central card directly behind the subject — pure studio
    // fill that the transmission pass DOES capture, so centred glass refracts a
    // luminous warm-ice field (clear glass → bright glass, not a dark slab). Soft
    // radial gradient via a canvas texture; opaque (no blending) so it lands in
    // the transmission RT. Kept mid-bright + behind the panel-plane subjects.
    const fillTex = this.studioFillTexture();
    const fill = new THREE.Mesh(
      new THREE.PlaneGeometry(11, 9),
      new THREE.MeshBasicMaterial({ map: fillTex, toneMapped: true }),
    );
    fill.position.set(0, 0.4, -0.2);
    group.add(fill);

    // Soft vertical softbox columns — studio strip-light reflections, not orbs.
    // Each is a tall thin quad carrying a soft-capsule emissive gradient (bright
    // core column, transparent toward every edge), additively blended so it
    // reads as light, not a painted bar. Warm-brass key left, cool-ice rim
    // right, AND a bright CENTRAL softbox directly behind the subject so centred
    // glass has bright, coloured structure to refract + disperse (the glass-
    // reads-opaque fix). Their soft edges never read as a bulb.
    const COLUMNS = [
      { c: '#e7c684', x: -6.0, y: 0.4, z: 0.2, w: 3.2, h: 12, i: 0.95 },  // warm key, left
      { c: '#aed2e2', x: 5.8, y: -0.3, z: 0.1, w: 2.8, h: 12, i: 0.78 },  // cool rim, right
      { c: '#e8dcc0', x: 0.0, y: 0.6, z: -1.2, w: 5.4, h: 11, i: 0.6 },   // BRIGHT central softbox (glass refracts this)
      { c: '#cfe0ea', x: 2.4, y: 1.8, z: -0.9, w: 2.4, h: 8, i: 0.34 },   // cool upper fill
      { c: '#d9bd86', x: -2.6, y: -2.4, z: -0.6, w: 2.2, h: 6, i: 0.26 }, // warm floor catch
    ];
    for (const col of COLUMNS) {
      const tex = this.softboxTexture();
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        color: new THREE.Color(col.c).multiplyScalar(col.i),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: true,
      });
      const quad = new THREE.Mesh(new THREE.PlaneGeometry(col.w, col.h), mat);
      quad.position.set(col.x, col.y, col.z);
      group.add(quad);
    }
    scene.add(group);
  }

  /** Cached soft-capsule alpha/light gradient for the studio softbox columns:
   *  a bright vertical core that fades to transparent toward every edge. Built
   *  once (Canvas2D), reused by every column tile. */
  private _softboxTex: THREE.Texture | null = null;
  private softboxTexture(): THREE.Texture {
    if (this._softboxTex) return this._softboxTex;
    const cv = document.createElement('canvas');
    cv.width = 64; cv.height = 256;
    const g = cv.getContext('2d')!;
    // Horizontal soft column: transparent → bright core → transparent.
    const lin = g.createLinearGradient(0, 0, 64, 0);
    lin.addColorStop(0.0, 'rgba(255,255,255,0)');
    lin.addColorStop(0.5, 'rgba(255,255,255,1)');
    lin.addColorStop(1.0, 'rgba(255,255,255,0)');
    g.fillStyle = lin;
    g.fillRect(0, 0, 64, 256);
    // Vertical soft falloff at the ends (multiply alpha).
    g.globalCompositeOperation = 'destination-in';
    const ver = g.createLinearGradient(0, 0, 0, 256);
    ver.addColorStop(0.0, 'rgba(0,0,0,0)');
    ver.addColorStop(0.18, 'rgba(0,0,0,1)');
    ver.addColorStop(0.82, 'rgba(0,0,0,1)');
    ver.addColorStop(1.0, 'rgba(0,0,0,0)');
    g.fillStyle = ver;
    g.fillRect(0, 0, 64, 256);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    this._softboxTex = tex;
    return tex;
  }

  /** Soft OPAQUE studio-fill gradient (bright warm-ice centre → mid steel rim).
   *  Opaque so the transmission render-pass captures it → transmissive glass in
   *  front refracts a luminous field instead of the void. Built once, reused. */
  private _studioFillTex: THREE.Texture | null = null;
  private studioFillTexture(): THREE.Texture {
    if (this._studioFillTex) return this._studioFillTex;
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 256;
    const g = cv.getContext('2d')!;
    g.fillStyle = '#2c374a';
    g.fillRect(0, 0, 256, 256);
    const rg = g.createRadialGradient(128, 110, 10, 128, 128, 170);
    rg.addColorStop(0.0, '#d8e0ea');   // bright cool-ice core
    rg.addColorStop(0.35, '#9fb0c6');  // steel
    rg.addColorStop(0.7, '#56657f');   // mid
    rg.addColorStop(1.0, '#2c374a');   // rim
    g.fillStyle = rg;
    g.fillRect(0, 0, 256, 256);
    // a faint warm wash lower-left for studio warmth
    const wg = g.createRadialGradient(80, 190, 8, 80, 190, 120);
    wg.addColorStop(0.0, 'rgba(224, 196, 140, 0.5)');
    wg.addColorStop(1.0, 'rgba(224, 196, 140, 0)');
    g.fillStyle = wg;
    g.fillRect(0, 0, 256, 256);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    this._studioFillTex = tex;
    return tex;
  }

  register(opts: RegisterClusterOptions): ClusterTileHandle {
    const id = this.nextId++;
    const scene = this.makeScene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);

    const tile: ClusterTile = {
      id,
      element: opts.element,
      def: opts.def,
      scene,
      camera,
      group: new THREE.Group(),
      players: [],
      detachers: [],
      cleanups: [],
      loopSeconds: CLUSTER_PREVIEW_DEFAULT.loopSeconds,
      frozenPhase: CLUSTER_PREVIEW_DEFAULT.frozenPhase,
      elapsed: 0,
      lastT: 0,
    };
    tile.element.dataset.clusterTilePlaying = 'false';
    this.tiles.set(id, tile);
    this.buildCluster(tile, opts.def, opts.getPlaying);

    return {
      getGroup: () => tile.group,
      rebuild: (def) => this.buildCluster(tile, def, opts.getPlaying),
      unregister: () => {
        this.disposeTile(tile);
        this.tiles.delete(id);
      },
    };
  }

  /** Re-express transmissive glass as alpha translucency for THIS rig (no
   *  transmission RT). Walks the built group; for any MeshPhysical material with
   *  transmission > 0.3, drops transmission, enables alpha (opacity ~0.52) so it
   *  composites against the bright studio backdrop, and keeps the glossy surface
   *  (clearcoat/roughness/env) intact. THREE material props only (no DOM). */
  private glassToTranslucent(root: THREE.Object3D): void {
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!(mesh as { isMesh?: boolean }).isMesh || !mesh.material) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        const pm = m as THREE.MeshPhysicalMaterial & { needsUpdate: boolean };
        const t = (pm as { transmission?: number }).transmission;
        if (typeof t === 'number' && t > 0.3) {
          (pm as { transmission: number }).transmission = 0.05;
          pm.transparent = true;
          pm.opacity = 0.52;
          pm.depthWrite = false;
          // a touch more clearcoat keeps the polished-glass highlight reading.
          if (typeof pm.clearcoat === 'number' && pm.clearcoat < 0.6) pm.clearcoat = 0.8;
          pm.needsUpdate = true;
        }
      }
    });
  }

  /** Assemble the cluster mini-scene: build each member's Object3D faithfully
   *  via the Canvas build path, pose it, collect its animation players. */
  private buildCluster(
    tile: ClusterTile,
    def: ElementClusterDefinition,
    getPlaying: () => boolean,
  ): void {
    // Tear down anything previously built (rebuild path).
    this.teardownTileContents(tile);

    tile.def = def;
    tile.loopSeconds = def.preview.loopSeconds ?? CLUSTER_PREVIEW_DEFAULT.loopSeconds;
    tile.frozenPhase = def.preview.frozenPhase ?? CLUSTER_PREVIEW_DEFAULT.frozenPhase;

    const group = new THREE.Group();
    group.name = `cluster:${def.id}`;
    tile.group = group;

    // `buildClusterNodeInputs` flares each member template into the SAME node
    // input shape drag-to-place produces (so the preview is faithful to what
    // lands). hubId/anchor are throwaway here — only the look fields matter.
    const inputs = buildClusterNodeInputs(def, 'preview', { x: 0, y: 0, z: 0 });

    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      // Shape a PrismNode from the input (the factory only reads the look
      // fields; a throwaway id + the input's own fields are enough).
      const node = {
        ...(input as Partial<PrismNode>),
        nodeId: previewNodeId(),
      } as PrismNode;

      let obj: THREE.Object3D;
      try {
        obj = defaultRenderModeFactory(node, this.ctx, { runPrimitives: true });
      } catch (err) {
        console.error(`[cluster-rig] member ${def.id}#${i} factory failed:`, err);
        continue;
      }
      applyScenePositionTo(obj, node.scenePosition);
      group.add(obj);

      const cleanup = (obj.userData as { cleanup?: () => void }).cleanup;
      if (typeof cleanup === 'function') tile.cleanups.push(cleanup);

      // Play the member's INTEGRATED animationBindings on the mounted object.
      // attachAnimationBindings exposes its live players under
      // root.userData[BINDING_PLAYERS_KEY]; we harvest them and drive
      // `player.animatable.seek(t)` ourselves each frame (deterministic
      // freeze/seek, independent of the gsap self-run clock).
      if (node.animationBindings && node.animationBindings.length > 0) {
        try {
          const detach = attachAnimationBindings({
            node,
            root: obj,
            drivers: this.drivers,
          });
          tile.detachers.push(detach);
          const players = (obj.userData as Record<string, unknown>)[
            BINDING_PLAYERS_KEY
          ] as AnimationBindingPlayer[] | undefined;
          if (Array.isArray(players)) tile.players.push(...players);
        } catch (err) {
          console.error(`[cluster-rig] member ${def.id}#${i} bindings failed:`, err);
        }
      }
    }

    // Make transmissive glass legible in THIS rig. The scissored multi-tile
    // WebGPU render has no transmission render-target, so MeshPhysical
    // `transmission` refracts a black RT → clear glass reads as a dark/opaque
    // slab (the advocate "glass reads flat" flag). Re-express high-transmission
    // members as ALPHA translucency, which composites against the bright studio
    // backdrop already in the framebuffer (reliable in any renderer). Surface
    // tint + clearcoat + env reflections are preserved, so it reads as real
    // polished glass. Preview-rig only — placed glass in the full-screen Canvas
    // keeps true transmission (its render DOES have the transmission RT).
    this.glassToTranslucent(group);

    tile.scene.add(group);
    this.frameCamera(tile);
    // Members can assemble ASYNC (MSDF text atlas, GLB/texture loads) after the
    // factory returns, so the build-time bounding box may exclude them and the
    // camera frames too tight (e.g. an MSDF headline overflowing the tile).
    // Re-fit a couple of times as late members land — cheap, and the tile is
    // frozen until hover so a small settle is imperceptible.
    if (typeof window !== 'undefined') {
      const reframe = () => { if (this.tiles.get(tile.id) === tile) this.frameCamera(tile); };
      window.setTimeout(reframe, 260);
      window.setTimeout(reframe, 720);
    }

    // Seed the frozen phase so a never-hovered tile shows a representative
    // mid-frame, not t=0.
    tile.elapsed = tile.frozenPhase * tile.loopSeconds;
    tile.lastT = tile.elapsed % tile.loopSeconds;
    this.seekPlayers(tile, tile.lastT);
    tile.element.dataset.clusterTilePlaying = getPlaying() ? 'true' : 'false';
  }

  /** Frame the preview camera around the cluster centroid using the def's
   *  `preview.camera` hint, with a sensible default that frames all members. */
  private frameCamera(tile: ClusterTile): void {
    const box = new THREE.Box3().setFromObject(tile.group);
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    if (box.isEmpty()) {
      center.set(0, 0, 0);
      size.set(1, 1, 1);
    } else {
      box.getCenter(center);
      box.getSize(size);
    }
    const cam = tile.def.preview.camera ?? {};
    const target = cam.target
      ? new THREE.Vector3(cam.target.x, cam.target.y, cam.target.z)
      : center.clone();

    // Default distance frames the cluster's bounding sphere comfortably.
    const radius = Math.max(0.5, 0.5 * size.length());
    const fov = (tile.camera.fov * Math.PI) / 180;
    const fitDistance = (radius / Math.sin(fov / 2)) * 1.15;
    const distance = cam.distance ?? fitDistance;
    // Polar from +Y, azimuth around Y — spherical → cartesian.
    const polar = cam.polar ?? Math.PI / 2.35; // slightly above the equator
    const azimuth = cam.azimuth ?? Math.PI * 0.12;
    const x = target.x + distance * Math.sin(polar) * Math.sin(azimuth);
    const y = target.y + distance * Math.cos(polar);
    const z = target.z + distance * Math.sin(polar) * Math.cos(azimuth);
    tile.camera.position.set(x, y, z);
    tile.camera.lookAt(target);
    tile.camera.updateProjectionMatrix();
  }

  /** Seek every harvested player to `t` seconds (modulo each animatable's own
   *  duration). Never throws through. */
  private seekPlayers(tile: ClusterTile, t: number): void {
    for (const p of tile.players) {
      try {
        const dur = p.animatable.duration();
        const d = Number.isFinite(dur) && dur > 0 ? dur : tile.loopSeconds;
        p.animatable.seek(t % d);
      } catch {
        /* a single bad seek must not break the rig */
      }
    }
  }

  private teardownTileContents(tile: ClusterTile): void {
    for (const detach of tile.detachers) {
      try {
        detach();
      } catch {
        /* ignore */
      }
    }
    tile.detachers = [];
    tile.players = [];
    for (const cleanup of tile.cleanups) {
      try {
        cleanup();
      } catch {
        /* ignore */
      }
    }
    tile.cleanups = [];
    if (tile.group.parent) tile.scene.remove(tile.group);
    disposeObject(tile.group);
    tile.group = new THREE.Group();
  }

  private disposeTile(tile: ClusterTile): void {
    this.teardownTileContents(tile);
    // Dispose the per-tile lit backdrop (added directly to the scene in makeScene).
    const backdrop = tile.scene.getObjectByName('cluster-backdrop');
    if (backdrop) {
      tile.scene.remove(backdrop);
      disposeObject(backdrop);
    }
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

    // Clear the whole buffer to transparent once (no ghosting in gaps).
    renderer.setScissorTest(false);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.setScissorTest(true);

    for (const tile of this.tiles.values()) {
      const rect = tile.element.getBoundingClientRect();
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

      // CSS-pixel, top-origin values pass straight through (the WebGPU backend
      // normalises origin + dpr; correct on the WebGL2 fallback too).
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
        console.error(`[cluster-rig] render(${tile.def.id}) failed:`, err);
      }
    }
  };

  private advance(tile: ClusterTile, delta: number): void {
    const playing = tile.element.dataset.clusterTilePlaying === 'true';
    let t: number;
    if (playing) {
      tile.elapsed += delta;
      t = tile.elapsed % tile.loopSeconds;
      tile.lastT = t;
    } else {
      t = tile.lastT;
    }
    this.seekPlayers(tile, t);
  }

  /** Set the play state for a tile by element (called by ClusterTile on
   *  hover/focus). Avoids a per-tile closure capture race. */
  setPlaying(element: HTMLElement, playing: boolean): void {
    element.dataset.clusterTilePlaying = playing ? 'true' : 'false';
  }

  private exposeHooks(): void {
    if (typeof window === 'undefined') return;
    (window as unknown as Record<string, unknown>).__clusterRig = {
      get ready() {
        return clusterRig.ready;
      },
      get tileCount() {
        return clusterRig.tiles.size;
      },
      get deviceLostCount() {
        return clusterRig.deviceLostCount;
      },
      get backend() {
        return clusterRig.backend;
      },
      debug: () =>
        [...clusterRig.tiles.values()].map((t) => {
          const r = t.element.getBoundingClientRect();
          return {
            id: t.def.id,
            members: t.group.children.length,
            players: t.players.length,
            top: Math.round(r.top),
            left: Math.round(r.left),
            w: Math.round(r.width),
            h: Math.round(r.height),
            connected: t.element.isConnected,
            playing: t.element.dataset.clusterTilePlaying === 'true',
          };
        }),
    };
  }

  dispose(): void {
    cancelAnimationFrame(this.rafId);
    if (typeof window !== 'undefined') window.removeEventListener('resize', this.resize);
    for (const tile of this.tiles.values()) this.disposeTile(tile);
    this.tiles.clear();
    this.env?.dispose();
    this._softboxTex?.dispose();
    this._softboxTex = null;
    this._studioFillTex?.dispose();
    this._studioFillTex = null;
    this.renderer?.dispose();
    this.renderer = null;
    this.ready = false;
    this.initPromise = null;
  }
}

// Module singleton — one cluster rig per page (mirrors `sharedRig`).
export const clusterRig = new ClusterTileRenderer();
