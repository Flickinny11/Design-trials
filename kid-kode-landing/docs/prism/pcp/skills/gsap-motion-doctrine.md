# SKILL: gsap-motion-doctrine — motion with weight inside the createNode contract

> Deep guide (Amendment A registry). GSAP inside a Prism node module: the
> lifecycle contract, the trigger wiring that actually exists at runtime, and
> the numeric doctrine (DL6: motion with weight, NOTHING LINEAR on heroes).

## Lifecycle contract (non-negotiable)

Every timeline you create is killed in `userData.cleanup()`. Every primitive
result you invoke is cleaned there too. The pattern:

```js
import { gsap } from 'gsap';

export default function createNode(config, ctx) {
  const group = new ctx.THREE.Group();
  const timelines = [];
  const primResults = [];

  // ... build meshes ...

  const intro = gsap.timeline();
  intro.from(group.position, { y: group.position.y - 0.4, duration: 0.7, ease: 'power3.out' });
  intro.from(group.scale, { x: 0.96, y: 0.96, z: 0.96, duration: 0.9, ease: 'power4.out' }, '<0.1');
  timelines.push(intro);

  for (const ref of config.cinematicPrimitives ?? []) {
    const r = ctx.primitives[ref.name](group, ref.params);
    primResults.push(r);
  }

  group.userData.handlers = {
    onPointerOver: () => gsap.to(group.rotation, { x: -0.05, y: 0.08, duration: 0.3, ease: 'power2.out' }),
    onPointerOut: () => gsap.to(group.rotation, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.6)' }),
    onClick: () => { ctx.emit('activate', { nodeId: config.nodeId }); },
  };

  group.userData.cleanup = () => {
    timelines.forEach((t) => t.kill());
    primResults.forEach((r) => r.cleanup());
    group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose()); }
    });
  };
  return group;
}
```

## Triggers that exist (and the ones that don't)

- **Pointer/click** → `userData.handlers.onPointerOver / onPointerOut /
  onClick / onPointerDown / onPointerUp`. The host raycasts and calls these.
  NEVER `addEventListener` (verifier ADD_EVENT_LISTENER + runtime has no DOM).
- **Declared animation triggers** → `config.cinematicPrimitives[].trigger`
  (`load | hover | click | scroll | inview | time`) — the runtime's driver
  hub plays the primitive's timeline under its declared driver. You don't
  wire scroll listeners; you declare the trigger.
- **Cross-node events** → `ctx.emit(event, payload)` out;
  listening happens at graph level (behaviorSpec), not in module code.
- There is NO requestAnimationFrame in module scope. Per-frame work rides a
  primitive's `needsTick`/`onTick`, TSL `time` (preferred — zero JS/frame),
  or a gsap tween with an onUpdate.

## The numeric doctrine (DL6 + grammar corpus, proven ranges)

| Moment | Recipe | Why |
|---|---|---|
| Entrance | y +0.4→0 over 0.7s `power3.out`; opacity 0→1 over 0.5s `power2.out`; children stagger 80ms | rise-in with weight; linear entrances read mechanical |
| Settle | scale overshoot 1.04→1.0 over 0.9s `power4.out` (or `elastic.out(1, 0.6)` for playful registers) | weighted-settle — the physical "landing" |
| Press | scale 0.97, 120ms, `back.out(2)` then release | buttons carry mass (DL12) |
| Hover tilt | ≤6° toward cursor over 300ms `cubic-bezier(0.215,0.61,0.355,1)` | more than 6° reads toy-like |
| Idle | ONE slow transform: orbit 0.1–0.2 rad/s OR breathing scale ≤2% at 6–10s period | perpetual multi-axis motion = screensaver slop |
| Exit/dissolve | opacity + scale 0.96 over 0.4s `power2.in` | exits are faster than entrances |

Hard rules:
- `ease: 'none'` / `'linear'` is FORBIDDEN on hero/entrance/settle motion.
- Total intro choreography ≤1.2s — content must not be hostage to motion.
- Respect stagger direction: reveal toward the reading direction (top-left →
  bottom-right) unless the spec says otherwise.
- Every `gsap.to/from/timeline` target you animate must be reachable from
  the returned group (animating detached objects leaks timelines).

## Composing with primitives (the accelerant, not the cage)

`ctx.primitives` presets are pre-tuned to this doctrine (orbit, depth-rotate,
weighted params). Apply every primitive the config declares; add bespoke gsap
ONLY for what the library can't express (custom choreography, multi-element
sequencing). Bespoke motion still obeys the table above.
