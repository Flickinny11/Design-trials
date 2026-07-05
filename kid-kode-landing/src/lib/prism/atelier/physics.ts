'use client';
// ORRERY No.7 — Atelier drag physics (F5.2b).
// A minimal Rapier rigid-body harness for the dragged chip: a spring-damper
// pulls the body toward a moving target (the pointer, biased toward the watch
// socket when near), giving the chip real momentum + a magnetic settle. Rapier
// runs as a headless physics step alongside three/webgpu — no renderer of its
// own. Lazy-inits the inlined-WASM compat build; callers degrade gracefully to
// direct positioning until ready. Spec §3.2 B (magnetic snap).
type Rapier = typeof import('@dimforge/rapier3d-compat');
type World = import('@dimforge/rapier3d-compat').World;
type RigidBody = import('@dimforge/rapier3d-compat').RigidBody;

let rapier: Rapier | null = null;
let initPromise: Promise<Rapier> | null = null;

export function rapierReady(): Rapier | null {
  return rapier;
}

export function ensureRapier(): Promise<Rapier> {
  if (rapier) return Promise.resolve(rapier);
  if (!initPromise) {
    initPromise = import('@dimforge/rapier3d-compat').then(async (mod) => {
      await mod.init();
      rapier = mod;
      if (typeof window !== 'undefined') {
        (window as unknown as { __ATELIER_RAPIER_READY__?: boolean }).__ATELIER_RAPIER_READY__ = true;
      }
      return mod;
    });
  }
  return initPromise;
}

export interface ChipSim {
  world: World;
  body: RigidBody;
}

/** A zero-gravity world with one damped dynamic body at `start`, given a small
 *  initial spin so the dragged chip visibly TUMBLES with real angular momentum. */
export function makeChipSim(R: Rapier, start: { x: number; y: number; z: number }): ChipSim {
  const world = new R.World({ x: 0, y: 0, z: 0 });
  const bodyDesc = R.RigidBodyDesc.dynamic()
    .setTranslation(start.x, start.y, start.z)
    .setLinearDamping(6.0)
    .setAngularDamping(1.2)
    .setCanSleep(false);
  const body = world.createRigidBody(bodyDesc);
  world.createCollider(R.ColliderDesc.cuboid(0.18, 0.18, 0.18), body);
  body.setAngvel({ x: 2.6, y: 3.4, z: 1.8 }, true); // visible tumble
  return { world, body };
}

export interface ChipPose {
  x: number; y: number; z: number;
  qx: number; qy: number; qz: number; qw: number;
}

/** Spring the body toward `target`, step the world by `dt`, return pose (pos+rot). */
export function stepChipToward(
  sim: ChipSim,
  target: { x: number; y: number; z: number },
  dt: number,
  stiffness = 90,
): ChipPose {
  const p = sim.body.translation();
  // critically-damped-ish spring force toward target (mass≈1, damping via setLinearDamping)
  sim.body.applyImpulse(
    {
      x: (target.x - p.x) * stiffness * dt,
      y: (target.y - p.y) * stiffness * dt,
      z: (target.z - p.z) * stiffness * dt,
    },
    true,
  );
  sim.world.timestep = Math.min(dt, 1 / 30);
  sim.world.step();
  const n = sim.body.translation();
  const r = sim.body.rotation();
  return { x: n.x, y: n.y, z: n.z, qx: r.x, qy: r.y, qz: r.z, qw: r.w };
}

export function disposeChipSim(sim: ChipSim): void {
  try {
    sim.world.free();
  } catch {
    /* already freed */
  }
}
