# Editor ↔ Runtime Bridge

> **Status: stub.** T-ED-01 will audit `src/lib/prism/player/boot.ts`, catalog every property hung off `window.__prism`, and fill in this document with the actual TypeScript shape. Do not commit to consumers until T-ED-01 is done.

## Purpose

The 3D node editor (`src/components/editor/**`) must drive off a generic, introspectable surface exposed by the PixiJS runtime. No editor code is allowed to reference mock-app-specific nodeIds — the `anti-drift-check.sh` PreToolUse hook blocks hardcoded strings like `"hero-card-bg"`, `"navbar-link-*"`, `"feature-card-*"`, etc. inside the editor directory.

Everything the editor needs about the loaded `.prism` must come from `window.__prism`. This file is the contract.

## Expected shape (to be confirmed by T-ED-01)

```ts
// To be written by T-ED-01. Placeholder only:

interface PrismBridge {
  graph: {
    hubId: string;
    nodes: Map<string, PrismGraphNode>;
    layout: { viewportWidth: number; contentHeight: number; /* + breakpoints */ };
  };
  nodes: Map<string, PrismRuntimeNode>;   // live PixiJS containers + sprites
  events: EventEmitter;                    // node-selected, node-hover, etc.
  viewport: PIXI.Container;                // the scroll-viewport root
  currentBreakpoint: 'mobile' | 'tablet' | 'desktop' | 'desktop-wide';
  hiddenNodeIds: Set<string>;              // nodes filtered out at current breakpoint
  hubRouter: { routes: Map<string, number>; navigate: (id: string) => void };
}
```

## Known events (to verify)

- `node-selected` — fired by pointerdown on any node container (T-ED-02)
- `breakpoint-change` — fired by ResizeObserver in PrismHost when `currentBreakpoint` changes
- (others TBD by T-ED-01 audit)

## Gaps the editor needs (to be identified by T-ED-01)

Flag anything the editor wants to read or mutate that isn't currently exposed. Examples to check:
- Persistent write-back API for transforms (T-ED-11)
- Enumerated list of selectable node types (subtypes) for filter UIs
- Current `.prism` manifest (hubs array) — needed for HubNav (T-ED-07)
