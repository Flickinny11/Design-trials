# Spec Amendment 0002 — Hub Mockup Background

**Status:** APPROVED — implemented in P1 of harness lock-in plan.
**Authored:** 2026-05-05
**Supersedes:** none. Extends `docs/prism/PRISM-RENDERER-MIGRATION-SPEC.md` §11 (Bundle Assembly) and §12 (Hub Manager).
**Affects schema + runtime mount path. Additive only — no breaking changes.**

---

## Why this exists

The renderer-migration spec defines per-hub `layout` (viewport, content height, background color) at §11–§12 but does not specify how a hub's *visual backdrop* — the page mockup that segmented elements overlay — is referenced from the hub.

Today (`src/components/editor/graph/GraphScene.tsx:62`) the hub mockup texture is fetched from a single hardcoded URL (`/prism-assets/scifi-mockup-v1.png`) and shared across all hubs via a module-level promise (`HUB_MOCKUP_TEXTURE_PROMISE`). This violates one-graph-two-views: each hub should own its own mockup as schema data, not as a shared static asset.

It also blocks the harness from supporting multiple hubs — adding a second hub today would render with the same backdrop as the first.

The mockup background is itself an element (per spec invariant 8 — "Images are elements; code is behavior") at the hub level: it is the page that nodes visually compose on top of. It belongs in the schema.

---

## §11.A Hub Mockup Background *(ADDITIVE FIELD)*

### A.1 Schema

`PrismHubLayout` gains one optional field:

```ts
export interface PrismHubLayout {
  viewportWidth: number;
  viewportHeight: number;
  contentHeight: number;
  backgroundColor: string;
  /** ADDITIVE 2026-05-05: URL of the rendered hub mockup image. The runtime
   *  composes it as a backdrop plane behind the hub's nodes. The editor's
   *  HubHulls textures the hub-hull sphere with the same image so the editor
   *  view and preview view show the same artifact (one graph, two views).
   *  Optional: when null, hubs render without a backdrop (Stage 0 pre-mockup
   *  state). */
  mockupUrl?: string | null;
}
```

### A.2 Runtime placement contract (preview view)

When `hub.layout.mockupUrl` is non-null, `mountFromGraphSource` (P7) MUST add a `THREE.Mesh` to the hub's group at `z = -2` (deepest layer) before iterating per-node createNode factories. The plane is sized to cover the hub's `viewportWidth × viewportHeight` in scene units. Texture is loaded via `ctx.textureLoader.loadTexture(mockupUrl)`. The plane's `userData.cleanup` disposes its own geometry and unparents (texture is owned by the loader cache).

Per-node `scenePosition` z-values therefore stack on top of the backdrop:

| Layer | z range | Purpose |
|---|---|---|
| Backdrop | -2 | Hub mockup |
| parallax-plane backdrops | -1 | Depth-displacement plates |
| sprite/plane elements | 0 | Standard UI elements |
| mesh elements | +1 | 3D heroes |
| MSDF text overlays | +1.1..+2 | Labels, captions |

Nodes with no explicit `scenePosition.z` default to identity (z=0).

### A.3 Editor placement contract (editor view)

`HubHulls` (currently inlined in `src/components/editor/graph/GraphScene.tsx:370–503`) MUST read `hub.layout.mockupUrl` per hub and texture its inner mockup sphere from a per-hub-keyed texture cache (`Map<hubId, Promise<CanvasTexture>>`). When `mockupUrl` is null, the hull renders with the existing procedural fallback (no mockup texture). The shared `HUB_MOCKUP_TEXTURE_PROMISE` singleton is removed.

### A.4 Schema migration / legacy

Pre-amendment graphs (e.g. `home-hub.legacy.json` archived in P4) lack `mockupUrl`. The field is optional with default `null`; consumers MUST tolerate absence. `compiledToGraphSource` (`src/lib/prism/runtime/mount.ts:82–115`) passes `mockupUrl: null` for legacy `.prism`-bundled hubs.

### A.5 Asset URL conventions

`mockupUrl` is a URL string consumable by `THREE.TextureLoader` — typically a path under `/public/` (e.g. `/prism-mock/home/mockup.png`) or an absolute https URL. Format: PNG / JPEG / AVIF. Recommended dimensions: hub `viewportWidth × viewportHeight` (e.g. 1440×900 for desktop hubs), but the renderer accepts any aspect ratio and lets the plane geometry stretch.

### A.6 Engine contract (production)

When the production prism engine generates a hub, after FLUX.2 mockup generation (§5.0 of the build spec) and SAM 3.1 segmentation (§5.0–§5.2), the engine writes the rendered mockup PNG to a stable URL and sets `hub.layout.mockupUrl` to that URL in the emitted graph JSON. SAM bounding boxes are used to derive per-node `scenePosition` values relative to the same coordinate space.

---

## What does NOT change

- Spec §1.4 forbidden patterns (no PIXI.Text, no innerHTML, etc.) — unaffected.
- Renderer invariants — unaffected.
- Existing `PrismHubLayout` consumers that don't read `mockupUrl` continue to work (additive optional field).
- The legacy `loadPrism` / `.prism` artifact path — unaffected (loader passes null).
- Cinematic primitives library — unaffected.

---

## Verification

- `npx tsc --noEmit` clean after schema change.
- `loadFromHomeHub` (`src/lib/prism-graph/loader.ts:16`) passes `mockupUrl` through to the materialized `GraphSource.hubs[*].layout`.
- `compiledToGraphSource` passes `mockupUrl: null` for legacy compiled graphs.
- Test fixture in `tests/unit/live-graph-shape.test.ts` (P3) asserts the hand-authored `live-graph.json` carries a non-null `mockupUrl` and that consumers read it correctly.
