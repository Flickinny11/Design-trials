# Editor ↔ Runtime Bridge

> **Audit completed:** T-ED-01 (iter 12). Canonical source of truth is
> `src/lib/prism/player/boot.ts` (search for `globalThis.__prism = {`,
> currently lines ~311-323). When the runtime surface changes, update
> this file in the same commit — `tests/editor/T-ED-01.test.mjs` locks
> field names and shapes against drift.

## Purpose

The 3D node editor (`src/components/editor/**`) must drive off a generic,
introspectable surface exposed by the PixiJS runtime. No editor code is
allowed to reference mock-app-specific nodeIds — the
`anti-drift-check.sh` PreToolUse hook blocks hardcoded strings like
`"hero-card-bg"`, `"navbar-link-*"`, `"feature-card-*"`, etc. inside the
editor directory.

Everything the editor needs about the loaded `.prism` must come from
`window.__prism`. This file is the contract.

## window.__prism — canonical shape

The runtime hangs an instance of this on `globalThis.__prism` after
`mount()` completes. Editor code may import these types from the
respective modules under `src/lib/prism/player/` (and `../shr` for
`Shr`).

```ts
// src/lib/prism/player/boot.ts (PrismDebugHandle, exported).
import type { CompiledGraph }  from '@/lib/prism/player/prism-loader';
import type { NodeInstance }   from '@/lib/prism/player/module-registry';
import type { EventBus }       from '@/lib/prism/player/event-bus';
import type { ScrollViewport } from '@/lib/prism/player/scroll-viewport';
import type { HubRouter }      from '@/lib/prism/player/hub-router';
import type { BreakpointName } from '@/lib/prism/player/breakpoints';
import type { Shr }            from '@/lib/prism/shr';

// boot.ts exports this as `PrismDebugHandle`; we re-name it here to
// `PrismBridge` for editor-side ergonomics. The two are the same type.
export interface PrismBridge {
  /** Hub-scoped scroll/section router. Same instance returned by mount(). */
  router: HubRouter;

  /** Scroll viewport (root + content containers, scrollTo, getScrollY). */
  viewport: ScrollViewport;

  /** Single shared event bus — every node, the router, and SHR all use this. */
  events: EventBus;

  /** Compiled graph from the loaded .prism. nodes is a flat array (NOT a Map). */
  graph: CompiledGraph;

  /**
   * Live PixiJS instances for every materialized node, keyed by nodeId.
   * NOTE: this is RUNTIME instances (PixiJS containers + teardown handles).
   * The graph node *definitions* live on `graph.nodes` (a flat array).
   * Editor code that wants O(1) graph-def lookup must build its own
   * `Map<string, NodeDef>` over `graph.nodes`.
   */
  nodes: Map<string, NodeInstance>;

  /** 'desktop-wide' | 'desktop' | 'tablet' | 'mobile' — classified from container width. */
  currentBreakpoint: BreakpointName;

  /**
   * NodeIds filtered out at the current breakpoint. Mutated in place by
   * boot.ts via .splice() on breakpoint reflow — this is an Array, not
   * a Set. Treat as ReadonlyArray<string> from editor code.
   */
  hiddenNodeIds: string[];

  /** Self-Healing Runtime handle — break/repair node, suspect ledger. */
  shr: Shr;
}

declare global {
  // eslint-disable-next-line no-var
  var __prism: PrismBridge | undefined;
  // eslint-disable-next-line no-var
  var __prismBreakNode: ((nodeId: string) => void) | undefined;
}
```

### `__prismBreakNode` is a sibling, not a property

`__prismBreakNode(nodeId)` is the §9 dev-tool API. It is hung off
`globalThis.__prismBreakNode` directly — it is **not** a property of
`window.__prism`. Editor code that reaches it through the bridge must
go via `window.__prism.shr.breakNode(nodeId)` instead. The two paths
are equivalent but distinct entry points; do not write
`__prism.__prismBreakNode(...)`, that property does not exist.

## Known events (currently emitted)

The runtime fires these on `window.__prism.events` today. Editor
panels can subscribe with `events.on(name, handler)` and unsubscribe
with the returned function.

| Event                     | Source module                        | Payload shape                                          |
|---------------------------|--------------------------------------|--------------------------------------------------------|
| `'navigate'`              | navbar-link, navbar-logo, footer-link, footer-logo | `{ source: nodeId, target?: string }`        |
| `'active-section-changed'`| `player/hub-router.ts`               | `{ sectionId: string, activeNavLinkId: string \| null }` |
| `'external-navigate'`     | footer-social                        | `{ source: nodeId }`                                   |
| `'open-modal'`            | navbar-signin-btn                    | `{ source: nodeId, target: 'signin-modal' }`           |
| `'theme-changed'`         | theme-selector-button                | `{ source: nodeId, theme: string }`                    |
| `'notifications-toggled'` | notifications-toggle                 | `{ source: nodeId, isOn: boolean }`                    |
| `'build-flow-started'`    | hero-card-cta                        | `{ source: nodeId }`                                   |
| `'node-click-failed'`     | `shr/index.ts`                       | `{ source: nodeId, attemptCount: number }`             |
| `'repair-started'`        | `shr/index.ts`                       | `{ source: nodeId }`                                   |
| `'repair-completed'`      | `shr/index.ts`                       | `{ source: nodeId }`                                   |
| `'video:play'`            | video-slot (T-VID-01)                | `{ nodeId: string, src: string }` *(payload key differs from the `{ source, ... }` convention used by every other event in this table — see `nodes/video-slot.js:38`)* |

The event bus also exposes `_recentEmissions` (ReadonlyArray, ring of
256, entry shape `{ event: string, payload: unknown, at: number }`) —
useful for an editor "event log" panel that needs to sort by `at`
without subscribing retroactively.

## Gaps — needed by editor, not yet exposed

The audit deliberately distinguishes "in the surface today" (above)
from "needed by upcoming T-ED-* tasks but missing":

- **`'node-selected'` event** — T-ED-02 wires `pointerdown` on every
  node container to `events.emit('node-selected', { nodeId })`. The
  Inspector (T-ED-03) and Minimap (T-ED-08) both subscribe.
- **`'breakpoint-change'` event** — boot.ts mutates
  `__prism.currentBreakpoint` on reflow but does not announce it on
  the bus. Editor panels currently must poll. Add an emit inside
  `applyLayout()` to close this.
- **Persistent write-back API (T-ED-11)** — the Inspector edits
  transforms live (T-ED-04), but no API exists to save them back to
  `src/lib/prism/mock-app-source/hubs/home-hub.json`. T-ED-11 owns
  the dev-only `/api/save-graph` route + the Inspector "Save" button.
- **Manifest hubs surface (T-ED-07)** — `bundle.manifest.hubs` is
  reachable as `MountResult.bundle.manifest.hubs` from the `mount()`
  return value, but it is **not** mirrored onto `window.__prism`.
  PrismHost must expose it (proposed: `__prism.manifest =
  bundle.manifest`) before HubNav can render disabled tabs for hubs
  not in the current `.prism`.
- **Drag-on-preview commit semantics (T-ED-10)** — pointermove on a
  selected container should mirror `container.position` into
  `graph.nodes[id].transform`. Needs a documented
  `__prism.setNodeTransform(nodeId, partial)` so the editor doesn't
  reach into private state.
- **Editor-genericity audit (T-ED-09)** — needs a sidecar script
  (`scripts/audit-editor-genericity.mjs`) and a 16th `verify:prism`
  check, neither of which is on the surface today.

## How the editor reaches the bridge

PrismHost mounts the runtime and the bridge appears asynchronously.
Editor panels should poll-for-presence (or wait on a custom
`prism-mounted` event the host can dispatch) rather than reading at
module-evaluation time:

```ts
function withBridge<T>(fn: (b: PrismBridge) => T): Promise<T> {
  return new Promise((resolve) => {
    const tick = () => {
      const b = (window as unknown as { __prism?: PrismBridge }).__prism;
      if (b) resolve(fn(b));
      else requestAnimationFrame(tick);
    };
    tick();
  });
}
```

Single source of truth for this contract: `tests/editor/T-ED-01.test.mjs`
locks the field names and shapes against drift between this doc and
`boot.ts`. If you change one, run the test and update the other in the
same commit.
