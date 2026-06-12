// P2 TOOLBAR WIRING — animationBindings PLAYBACK (canvas-spec §8.2 Driver
// model + §8.3 catalog; the "plays in Preview via the existing Driver model"
// half of the Animation picker).
//
// `attachAnimationBindings()` is the binding player. For each
// `AnimationBinding` on a node (sorted by `order`, criterion 13) it:
//
//   1. Looks up the catalog primitive in the Animatable registry
//      (`registerAllPrimitives()` is idempotent-called first).
//   2. Builds a live `Animatable` whose target is the MOUNTED artifact:
//      `subject` = the most representative mounted child (the group named
//      'text-object' for renderMode:'text' nodes — its glyph-* children are
//      what the text primitives traverse — else the first Mesh descendant);
//      `object` = a fresh Group added UNDER the artifact root, which is where
//      subject:'empty' definitions (particles, …) self-generate their content.
//   3. Applies `binding.params` through the Animatable's ControlSchema
//      surface — the same `setControl(id, value)` call the catalog
//      ControlPanel pushes live tweaks through (INV-5).
//   4. Wraps the Animatable in the SAME `PrimitiveResult` shape the STEP7
//      factory dispatch consumes (a gsap timeline whose linear proxy tween
//      drives `anim.seek(t)`; `needsTick`/`onTick` for Infinity-duration
//      stateful primitives) and attaches it via `drivers.attach(result,
//      trigger, { nodeId })` — the exact API default-factory.ts uses.
//
// Driver semantics (AnimationDriverKind → CinematicPrimitiveTrigger):
//   - 'time'    → 'time'. Finite timelines self-run looped on the gsap master
//                 clock (deterministic in preview); Infinity-duration
//                 primitives advance on the shared FrameDriver tick, which
//                 GraphScene's SceneDriverHost drives once per rendered frame.
//   - 'scroll'  → 'scroll'. Dispatch scrubs timeline progress by live scroll;
//                 scroll-category primitives ALSO read `userData.scroll`
//                 (0..1), which this player live-feeds from the shared hub.
//   - 'pointer' → 'hover'. Dispatch plays forward on hover-in / reverses on
//                 hover-out (AssembledSceneNode pushes `hover:<nodeId>`);
//                 pointer-category primitives ALSO read `userData.pointer`
//                 ({x,y} in 0..1), live-fed from the hub's NDC pointer.
//   - 'state'   → 'hover' (the StateDriver's live state input today).
//   - 'event'   → 'click' (replays on the node-addressed click event).
//
// INV-6: changing `driver` NEVER mutates keyframes — the timeline (the proxy
// tween over the Animatable's own duration) is built identically for every
// driver; only playback wiring differs (play/progress/reverse/restart, the
// same calls driver-dispatch.ts is allowed to make).
//
// HONESTY / skip policy: rig-dependent material-swap categories (glass,
// caustics, volumetric, smoke, shimmer, mask, blur, displacement — every one
// of which replaces `subject.material` with its own TSL shader, destroying a
// mounted artifact's baked look, and several of which depend on the catalog
// rig's env/transmission setup) are skipped with a console.debug, never a
// crash. A binding naming a nonexistent primitive is likewise skipped
// (forward-compat with future catalog versions).
//
// DOM-free (no window/document); relative imports only (dep-guard).

import { gsap } from 'gsap';
import {
  Group,
  Mesh,
  Quaternion,
  Scene,
  Vector3,
  type Material,
  type Object3D,
} from 'three';
import type {
  AnimationBinding,
  AnimationDriverKind,
  PrismNode,
} from '../../prism-graph/types';
import type { CinematicPrimitiveTrigger } from '../../prism-graph/cinematic-primitives';
import type { NodeDrivers } from '../runtime/shared/driver-dispatch';
import type { PrimitiveResult } from '../runtime/shared/primitives/types';
import { TEXT_OBJECT_NAME } from '../text/contract';
import type { Animatable, PrimitiveCategory } from './contract';
import { getPrimitive } from './registry';
import { registerAllPrimitives } from './primitives';

// ── Skip policy ────────────────────────────────────────────────────────────
/** Categories that cannot sensibly run on a mounted artifact: every primitive
 *  in these categories swaps `subject.material` for its own TSL shader (audit
 *  2026-06-10: glass 21/21, volumetric 22/22, mask 15/15, shimmer 21/21,
 *  caustics 12/12, smoke 15/15 swap), which would replace the artifact's
 *  baked look; several additionally expect the catalog rig's env-map /
 *  transmission setup. Bindings in these categories are skipped with a
 *  console.debug — never a scene crash. */
export const UNMOUNTABLE_CATEGORIES: ReadonlySet<PrimitiveCategory> = new Set([
  'glass',
  'caustics',
  'volumetric',
  'smoke',
  'shimmer',
  'mask',
  'blur',
  'displacement',
] as PrimitiveCategory[]);

// ── Driver mapping (see header) ────────────────────────────────────────────
const DRIVER_TO_TRIGGER: Record<AnimationDriverKind, CinematicPrimitiveTrigger> = {
  time: 'time',
  scroll: 'scroll',
  pointer: 'hover',
  state: 'hover',
  event: 'click',
};

// ── Diagnostics surface (root.userData) ────────────────────────────────────
/** Key under `root.userData` where the live players are exposed for
 *  diagnostics + tests. Removed again by detach(). */
export const BINDING_PLAYERS_KEY = 'animationBindingPlayers';

export interface AnimationBindingPlayer {
  bindingId: string;
  primitive: string;
  driver: AnimationDriverKind;
  animatable: Animatable;
  result: PrimitiveResult;
}

// ── Subject-subtree snapshot/restore ───────────────────────────────────────
// Primitives mutate the mounted subject (transforms, visibility, material
// opacity; a handful in allowed categories swap a material). Their dispose()
// restores its own bases in most cases — the snapshot is belt-and-braces so
// toggling preview → canvas always returns the artifact to its authored pose.
interface SubtreeSnapshot {
  transforms: Array<{
    obj: Object3D;
    position: Vector3;
    quaternion: Quaternion;
    scale: Vector3;
    visible: boolean;
  }>;
  materials: Array<{ mesh: Mesh; material: Material | Material[] }>;
  materialProps: Array<{ material: Material; opacity: number; transparent: boolean }>;
}

function snapshotSubtree(root: Object3D): SubtreeSnapshot {
  const snap: SubtreeSnapshot = { transforms: [], materials: [], materialProps: [] };
  root.traverse((obj) => {
    snap.transforms.push({
      obj,
      position: obj.position.clone(),
      quaternion: obj.quaternion.clone(),
      scale: obj.scale.clone(),
      visible: obj.visible,
    });
    const mesh = obj as Mesh;
    if (mesh.isMesh && mesh.material) {
      snap.materials.push({ mesh, material: mesh.material });
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        snap.materialProps.push({
          material: m,
          opacity: (m as Material & { opacity: number }).opacity,
          transparent: m.transparent,
        });
      }
    }
  });
  return snap;
}

function restoreSubtree(snap: SubtreeSnapshot): void {
  for (const t of snap.transforms) {
    t.obj.position.copy(t.position);
    t.obj.quaternion.copy(t.quaternion);
    t.obj.scale.copy(t.scale);
    t.obj.visible = t.visible;
  }
  for (const m of snap.materials) {
    m.mesh.material = m.material;
  }
  for (const p of snap.materialProps) {
    (p.material as Material & { opacity: number }).opacity = p.opacity;
    p.material.transparent = p.transparent;
  }
}

// ── Mounted-artifact target resolution ─────────────────────────────────────
/** The most representative mounted child: for renderMode:'text' nodes the
 *  group named 'text-object' (its glyph-* children are what the text
 *  primitives traverse); otherwise the first Mesh descendant. */
function resolveMountedSubject(node: PrismNode, root: Object3D): Object3D | null {
  if ((node.renderMode as string) === 'text') {
    let textGroup: Object3D | null = null;
    root.traverse((o) => {
      if (!textGroup && o.name === TEXT_OBJECT_NAME) textGroup = o;
    });
    if (textGroup) return textGroup;
  }
  let mesh: Object3D | null = null;
  root.traverse((o) => {
    if (!mesh && (o as Mesh).isMesh) mesh = o;
  });
  return mesh;
}

/** Nearest ancestor Scene (the artifact root lives in the live R3F scene by
 *  the time the attach effect runs). Falls back to an inert Scene so a
 *  primitive that wants `target.scene` never crashes in a detached mount. */
function findScene(root: Object3D): Scene {
  let cur: Object3D | null = root;
  while (cur) {
    if ((cur as Scene).isScene) return cur as Scene;
    cur = cur.parent;
  }
  return new Scene();
}

// ── The binding player ─────────────────────────────────────────────────────
export interface AttachAnimationBindingsOptions {
  /** The (composed) node whose `animationBindings` should play. */
  node: PrismNode;
  /** The mounted artifact root (GraphScene: `popRef.current`). */
  root: Object3D;
  /** The shared driver surface — the same `NodeDrivers` the factory consumes
   *  (`makeNodeDrivers(getSharedDriverHub())`). */
  drivers: NodeDrivers;
}

/**
 * Attach every binding in `node.animationBindings` to the mounted artifact and
 * the node's declared Drivers. Returns an idempotent `detach()` that kills
 * timelines, disposes Animatables, detaches driver wiring, restores the
 * subject subtree, and removes any group this player added.
 */
export function attachAnimationBindings(
  opts: AttachAnimationBindingsOptions,
): () => void {
  const { node, root, drivers } = opts;
  registerAllPrimitives(); // idempotent — safe to re-call on every attach

  const bindings = [...(node.animationBindings ?? [])].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0),
  );

  const players: AnimationBindingPlayer[] = [];
  const teardowns: Array<() => void> = [];
  const myResults = new Set<PrimitiveResult>();

  const pending: AnimationBinding[] = [];
  const tryAttach = (binding: AnimationBinding): boolean => {
    try {
      const attached = attachOneBinding(node, root, drivers, binding);
      if (attached === 'no-subject') return false; // retryable — artifact still streaming in
      if (attached) {
        players.push(attached.player);
        teardowns.push(attached.dispose);
        myResults.add(attached.player.result);
        (root.userData as Record<string, unknown>)[BINDING_PLAYERS_KEY] = players;
      }
      return true; // attached OR permanently skipped (unknown/unmountable)
    } catch (err) {
      // A broken binding must never crash the scene — skip it.
      console.debug(
        `[animation-bindings] '${binding.primitive}' (${binding.id}) on ${node.nodeId} failed to attach — skipped:`,
        err,
      );
      return true;
    }
  };

  for (const binding of bindings) {
    if (!tryAttach(binding)) pending.push(binding);
  }

  // W3 — late-subject retry: GLB meshes and MSDF glyphs mount asynchronously
  // AFTER the attach effect runs; without this, their bindings were skipped
  // forever ("no mountable subject"). Poll briefly until the subject lands.
  let retryTimer: ReturnType<typeof setInterval> | null = null;
  if (pending.length > 0) {
    let tries = 0;
    retryTimer = setInterval(() => {
      tries++;
      for (let i = pending.length - 1; i >= 0; i--) {
        if (tryAttach(pending[i])) pending.splice(i, 1);
      }
      if (pending.length === 0 || tries >= 80) {
        if (pending.length > 0) {
          console.debug(
            `[animation-bindings] ${pending.length} binding(s) on ${node.nodeId} never found a subject (artifact empty after retries)`,
          );
        }
        if (retryTimer) clearInterval(retryTimer);
        retryTimer = null;
      }
    }, 250);
  }

  let detached = false;
  return () => {
    if (detached) return;
    detached = true;
    if (retryTimer) {
      clearInterval(retryTimer);
      retryTimer = null;
    }
    for (const t of teardowns) {
      try {
        t();
      } catch {
        /* one bad teardown must not block the rest */
      }
    }
    // Diagnostics registry hygiene: drop ONLY this player's results, preserving
    // anything the factory (cinematicPrimitives, runPrimitives:true) registered
    // for the same node.
    const remaining = drivers.hub
      .getNodeResults(node.nodeId)
      .filter((r) => !myResults.has(r));
    drivers.hub.clearNodeResults(node.nodeId);
    for (const r of remaining) drivers.hub.registerNodeResult(node.nodeId, r);
    myResults.clear();
    delete (root.userData as Record<string, unknown>)[BINDING_PLAYERS_KEY];
  };
}

// ── Single-binding attach ──────────────────────────────────────────────────
function attachOneBinding(
  node: PrismNode,
  root: Object3D,
  drivers: NodeDrivers,
  binding: AnimationBinding,
): { player: AnimationBindingPlayer; dispose: () => void } | null | 'no-subject' {
  const def = getPrimitive(binding.primitive);
  if (!def) {
    // Forward-compat: a graph authored against a future catalog must not crash.
    console.debug(
      `[animation-bindings] unknown primitive '${binding.primitive}' (${binding.id}) on ${node.nodeId} — skipped`,
    );
    return null;
  }
  if (UNMOUNTABLE_CATEGORIES.has(def.category) && def.mountable !== true) {
    console.debug(
      `[animation-bindings] '${def.name}' (category '${def.category}') cannot run on a mounted artifact — skipped on ${node.nodeId}`,
    );
    return null;
  }

  // Target: subject = mounted representative child; object = fresh group UNDER
  // the artifact root (subject:'empty' definitions self-generate into it).
  const subject = def.subject === 'empty' ? null : resolveMountedSubject(node, root);
  if (def.subject !== 'empty' && !subject) {
    // e.g. a cold-atlas text node whose glyphs haven't mounted yet, or a GLB
    // whose mesh is still streaming in — the caller retries these (W3 fix:
    // async artifacts used to lose their bindings permanently).
    return 'no-subject';
  }

  const object = new Group();
  object.name = `animation-binding:${binding.id}`;
  root.add(object);

  const hub = drivers.hub;
  const target = {
    object,
    subject,
    scene: findScene(root),
    // Catalog driver-input convention: pointer {x,y} in 0..1, scroll 0..1.
    // Seed with the hub's current values, then live-feed below.
    userData: {
      pointer: {
        x: (hub.pointer.ndc.x + 1) / 2,
        y: (hub.pointer.ndc.y + 1) / 2,
      },
      scroll: hub.scroll.progress,
    } as Record<string, unknown>,
  };

  const snapshot = subject ? snapshotSubtree(subject) : null;

  // Build with schema defaults, then apply binding.params through the
  // ControlSchema surface — the same setControl() path the catalog
  // ControlPanel pushes live tweaks through (structural params re-apply via
  // the primitive's own onParamChange).
  const anim = def.create(target);
  if (binding.params) {
    for (const [id, value] of Object.entries(binding.params)) {
      anim.setControl(id, value);
    }
  }

  // PrimitiveResult — the exact shape the STEP7 dispatch consumes. The
  // timeline is a linear proxy tween over the Animatable's own duration whose
  // onUpdate drives anim.seek(t): identical keyframes for every driver
  // (INV-6); the driver only plays it.
  const dur = anim.duration();
  const finite = Number.isFinite(dur) && dur > 0;
  let dead = false;
  let elapsed = 0;
  const proxy = { t: 0 };
  const timeline = gsap.timeline({ paused: true });
  if (finite) {
    timeline.to(proxy, {
      t: dur,
      duration: dur,
      ease: 'none',
      onUpdate: () => {
        if (!dead) anim.seek(proxy.t);
      },
    });
  }

  // Declared before dispose() so the closure is always assignment-safe even
  // if a later step throws (no TDZ on an early dispose).
  const liveInputUnsubs: Array<() => void> = [];
  let detachDriver: () => void = () => {};

  const dispose = (): void => {
    if (dead) return;
    dead = true;
    for (const un of liveInputUnsubs) {
      try {
        un();
      } catch {
        /* ignore */
      }
    }
    try {
      detachDriver();
    } catch {
      /* ignore */
    }
    try {
      timeline.kill();
    } catch {
      /* ignore */
    }
    try {
      anim.dispose();
    } catch {
      /* ignore */
    }
    if (snapshot) restoreSubtree(snapshot);
    if (object.parent) object.parent.remove(object);
  };

  const result: PrimitiveResult = {
    timeline: timeline as PrimitiveResult['timeline'],
    cleanup: dispose,
    // Infinity-duration (purely stateful) primitives advance on the shared
    // FrameDriver — the master clock SceneDriverHost ticks per rendered frame.
    // Their live inputs (userData.pointer / userData.scroll) are fed below.
    ...(finite
      ? {}
      : {
          needsTick: true,
          onTick: (delta: number) => {
            if (dead) return;
            elapsed += delta;
            anim.seek(elapsed);
          },
        }),
  };

  // Live driver-input feeds (catalog userData convention).
  liveInputUnsubs.push(
    hub.pointer.subscribe((ndc) => {
      target.userData.pointer = { x: (ndc.x + 1) / 2, y: (ndc.y + 1) / 2 };
    }),
    hub.scroll.subscribe((p) => {
      target.userData.scroll = p;
    }),
  );

  // Attach exactly the way the factory does (STEP7).
  hub.registerNodeResult(node.nodeId, result);
  const trigger = DRIVER_TO_TRIGGER[binding.driver] ?? 'time';
  detachDriver = drivers.attach(result, trigger, { nodeId: node.nodeId });

  // TimeDriver: finite timelines self-run looped on the gsap master clock —
  // playback-only calls (repeat/play), keyframes untouched (INV-6).
  if (binding.driver === 'time' && finite) {
    timeline.repeat(-1);
    timeline.play(0);
  }

  return {
    player: {
      bindingId: binding.id,
      primitive: binding.primitive,
      driver: binding.driver,
      animatable: anim,
      result,
    },
    dispose,
  };
}
