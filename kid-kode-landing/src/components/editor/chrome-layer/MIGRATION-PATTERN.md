# Chrome-layer slab migration pattern (UI-FIDELITY-2 W2)

How to convert a CSS chrome surface to a GPU-rendered slab. Follow exactly;
the pilots (TopBar, CanvasToolbar dock, FlyoutShell, Inspector) are the
reference implementations — read them first.

## The pattern

```tsx
import { useChromeSlab } from '@/components/editor/chrome-layer';

function MySurface() {
  // 1. Hook at the TOP of the component (before any early return — hooks rule).
  const slab = useChromeSlab({ material: 'metal', radius: 13, brushAxis: 'y' });
  ...
  // 2. Attach to the element whose painted surface should become GPU-rendered.
  return <div ref={slab.ref} className="ds-metal ds-grain ds-edge ...">
}
```

That's all. At tier t2 with the canvas live, the hook adds `.ds-slab-hosted`
(materials.css makes the CSS background/frost/keyline transparent; layout,
text, box-shadow and input remain DOM) and registers the rect with the GPU
layer, which draws the real material behind the DOM each frame. Below t2 the
hook is inert and the v1 CSS stands — NEVER remove the existing `ds-*`
classes; they are the t0/t1 fallback (INV-9).

## Options → existing CSS class mapping

| CSS today | options |
|---|---|
| `.ds-glass` / `--heavy` / `--refract` | `{ material: 'glass', radius: 18, frost: 0.5–0.7, accent: 0–1 }` (accent 1 on brass-edged heroes) |
| `.ds-metal ds-grain` | `{ material: 'metal', radius: 13, brushAxis: 'x' (wide) or 'y' (tall) }` |
| `.ds-ceramic` | `{ material: 'ceramic', radius: 18 }` (DetailCard/keyframe body 13–18; keys 9) |
| `.ds-well` | `{ material: 'well', radius: 13 }` |
| `.ds-smoked` pills | `{ material: 'glass', radius: 999, frost: 0.35 }` |
| pills (`rounded-full`/`--ds-r-pill`) | `radius: 999` (the SDF clamps to half-extent) |
| active/selected brass state | `slab.update({ accent: 1 })` in an effect on the state, or pass at registration if static |

Radii follow the element's CSS: ds-xs 6, ds-sm 9, ds-md 13, ds-lg 18, ds-xl 24.

## Buttons / keys (interactive elements)

`useChromeSlab` already wires pointerenter/leave/down/up on the host element →
GPU hover/press (damped, with magnetic border glow). For active state driven by
React (e.g. the dock's active group key), call `slab.update({ accent: active ? 1 : 0 })`
inside a `useEffect` on that state.

For LISTS of buttons rendered in a map, you cannot call a hook per item in a
loop — extract a small component per item (preferred, matches existing code
style) and put the hook inside it.

## Hard rules

1. NEVER remove or rename existing `ds-*` classes or inline fallback styles.
2. NEVER edit `materials.css` or anything in `design-system/` — the
   suppression block already exists.
3. Hooks before early returns. If a component returns null early, the hook
   still runs first (the pilot Inspector.tsx shows this).
4. Radix/portal content (ColorPicker popover): the hook works on portaled
   elements too (rects are read from getBoundingClientRect each frame) — attach
   to the portaled panel element.
5. Elements inside scrolling containers ARE safe to slab: the layer resolves
   ancestor overflow clips at registration and SDF-intersects the clip window
   per frame in the shader (the slab crops exactly like its DOM twin). One
   caveat: the clip is the ancestor's border-box rect — if a container pairs
   overflow with large padding the crop line is the box edge, not the padding
   edge.
6. Boot/loading surface: the canvas does not exist yet during boot — leave it
   CSS (it is exempt from slab migration; boot choreography is a separate W2
   task).
7. `tsc` must stay at 0 new errors (`npm run typecheck:gate`).
8. Do not run the dev server or capture screenshots — central verification
   happens after integration.

## Known z-order note

Slabs draw in two GPU families: opaque (metal/ceramic/well) then glass (which
refracts opaque slabs under it). Within a family, draw order follows
registration order; pass `order` in options if a slab must draw above another
overlapping slab of the same family (higher = later = on top).
