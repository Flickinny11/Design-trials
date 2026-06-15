# POLISH MICRO-PASS — resumable ledger

Branch: `prism-editor-build`. Model contract: **claude-opus-4-8** (verify runtime modelUsage at every resume; write MODEL-MISMATCH here if not).

## Model checks
- 2026-06-14 start — runtime opus-4-8 confirmed (environment). `.ralph-model` marker = opus-4-7 is the separate inert Ralph-loop enforcement, not this pass. OK.

## Scope (ranked)
- **PA** Galaxy: hub-worlds must read as heroes (bigger + sharper + 5 distinct identities); node spheres subordinate (smaller/simpler, orbiting).
- **PB** Arrival hero: artifact must not occlude headline/intro; recompose via `responsiveScenePos`/`scenePosition` (schema, not hardcode); keep hero present+lit (heroes 20/20).
- **PC** glance-icon badges (custom 3D glyphs per contentType) · label LOD declutter at detail zoom · edges thinner/softer/curved/brass (kill bright-white) · planet texture sharpness · hero image-plane matte (kill bbox halo).

## Root-cause notes (recon)
- PA: `GraphScene.tsx` HubHull `innerRadius = min(hubDiameter/2 * 0.45, 32)`. Smallest hub diameter ≈ 24+3.2√n+6(depth-1). For n≈8/depth2 ⇒ R≈19.5 ⇒ innerRadius≈8.8; node sphere `radius=4.5` ⇒ ratio≈1.95 (< 2.5 gate). Levers: galaxy node radius 4.5→~2.8, planet innerRadius factor 0.45→~0.5 with floor ~10, sharper surface, 5 identities.
- PB: `public/prism-mock/home/live-graph.json` nodes `orr-arrival-headline` (sp.y -1.95), `orr-arrival-sub` (sp.y 0.82), `orr-arrival-watch` (sp.y -1.45, scale 2.2 → ~7u tall, swallows headline). Recompose so watch silhouette clears both text rects on desktop/tablet/constrained/mobile.
- Edges: `Edge` (intra-hub) `<line>`+`lineBasicMaterial`, straight, `EDGE_COLORS[type] || DS.textHi` (bright bone fallback), baseOpacity 0.62 → harsh white. GalaxyHubTethers already tubes/brass.
- Labels: `<Html>` DOM overlays (pre-existing editor chrome, NOT runtime MSDF — adjust opacity only, do not convert). `galaxy-label-lod.ts` gates by zoomLevel only; need per-label distance/focus fade at L2+.
- Badges: `NodeContentIcons` only shows integration/function brand dots; need a per-node contentType glyph (image/text/3d-object/integration) on every dormant node.
- Hero matte: image planes use `buildUnlitMaterial({transparent:true})` (material-system.ts) / MeshBasicMaterial — faint rect halo = straight-alpha edge. Fix premultiplied/alpha edge, runtime-scoped, careful (heroes 20/20 risk).

## Verification infra (reuse)
- `__PRISM_DEBUG_STORES__` = {graphSource, graphEditor, previewState}; `__PRISM_EDITOR_GET_NODE_SCREEN_RECT__(id)` (preview-app/canvas only — galaxy planets/spheres NOT registered ⇒ need additive galaxy probe).
- `scripts/prod-finish/heroes.mjs` (5×4=20, cov≥.008/diff≥6/peak≥90) + `atmosphere.mjs` (20, corner metrics) + `_imglib.mjs`. `scripts/_galaxy-fps.mjs` (real-chrome FPS).
- Boot: `npm run dev`/prod server; harnesses take `--url=`.

## Waves
- [x] Wave A (parallel, separate files): A1 schema types ✓ · A2 content-glyphs (`NodeContentBadge`) ✓ · A3 HubPlanet 5 identities+sharp ✓ · A4 `computePerLabelLod` ✓ · A5 hero-matte → deferred to factory per D3 ✓ · A6 PB hero recompose ✓.
- [x] Wave B (serial, GraphScene.tsx + factory + data):
      - PA: galaxy node radius 4.5→2.6; planet innerRadius floor `min(max(R*0.5,9),40)` (ratio≈3.5×); inner-sphere `userData.galaxyNodeSphere` tag.
      - PC badges: `NodeContentBadge contentType={deriveContentType(sourceNode)}` below each dormant node.
      - PC label-LOD: distance-rank pre-pass + `computePerLabelLod` → Html opacity×scale (galaxy only).
      - PC edges: `Edge` now curved (QuadraticBezier 14-seg, 8% bow), brass-tinted (lerp→brass300), softer opacity (0.2/0.32).
      - PC matte: additive `visual.opaque?` → default-factory `transparent:!opaque`; flagged on 4 macro planes (brass/sapphire/meteorite/pour).
      - Galaxy probe: `__PRISM_GALAXY_PROBE__` in EditorDiagnostics (dev-only).
      - **tsc: 9 (baseline, 0 new).**
- [x] Wave C verification COMPLETE:
      - Numeric: PA 2/2 (ratio 3.43) · PB 4/4 (occl 0, watch lit) · PC PASS (harshWhite<0.1%, badges 12/12, label-overlap 0) · heroes 20/20 · atmosphere 20/20 · 60Hz desktop+mobile (webgpu).
      - Advocate (opus-4-8, real app): PA PLEASED · PC PLEASED · PB PLEASED (after fix). 0 MUST-FIX outstanding.
      - Reviewer (fresh-context diff): CLEAN, 0 MUST-FIX.
      - No-regression: tsc 9 · vitest 3349/0 · prod build ✓ · secret clean · fal $0 · live-graph 0 pollution.
- [x] PB MUST-FIX round (advocate-found): root cause = autosave-injected `jelly-collide-sim` ×4 on headline → white placeholder boxes. Rebased live-graph on clean HEAD + v4 recompose (text upper band clear of chrome, watch centre-lower hero). PB re-judge PLEASED.
- [x] Reviewer NOTE fix: Edge `getPoint` reuses a target Vector3 (no per-sample alloc).

## STATUS: ALL THREE GATE LAYERS PASS — run complete.

## Verification notes
- Dev server: `npm run dev -- -p 4799` (NODE_ENV unset → hooks live). Harnesses: `--url=http://localhost:4799`.
- Galaxy probe contract: `window.__PRISM_GALAXY_PROBE__()` → `{ hubs:[{screenRadiusPx,cx,cy}], nodes:[{screenRadiusPx,cx,cy}], viewport }`.

## No-regression baseline (to confirm at gate)
- tsc baseline (9 errors per memory), prod next build 18/18, vitest 3349/0, secret-leak clean, no fal token, atmosphere 20/20, heroes 20/20, node-editor A-E.
