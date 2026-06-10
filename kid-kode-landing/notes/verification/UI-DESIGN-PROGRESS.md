# UI DESIGN OVERHAUL — progress ledger (resumable)

Run started 2026-06-09 · model claude-fable-5 · branch `prism-editor-build` · NO commits (staged for Logan).
Design system: "Observatory Brass" — graphite/bone neutrals + brass accent + ice telemetry. NO purple, no flat fills.

| Wave | Surface | Files | Status | Evidence | Advocate |
|---|---|---|---|---|---|
| 0 | Design system (frozen contract) | `src/components/editor/design-system/*`, `layout.tsx`, `globals.css`, `tailwind.config.ts`, `/design-system` sheet | **DONE** | `ui-design/wave0-token-sheet.png`, `wave0-clip-{glass,refract,metal,ceramic,controls}.png` | self-critique pass (controls/metal strong; glass edge bumped +0.05 specular) |
| 1 | Animation catalog (tiles, headers, detail/control panel) | `animation-catalog/{CatalogGallery,PrimitiveTile,ControlPanel}.tsx`, `subjects.ts` + rig retint (purple/navy → brass/ice/graphite), mobile responsive fix | **DONE** | `ui-design/wave1-catalog-v2.png`, `wave1-catalog-v3{,-mobile}.png`, `wave1-clip-{tile-selected,tile-hover,detail,header}.png` | self-critique pass; advocate in Wave 3 |
| 2A | Canvas toolbar + keyframe shell | `overlays/CanvasToolbar.tsx` | **DONE** | `ui-design/wave2a-canvas-toolbar{,-mobile}.png`, `wave2a-toolbar-flyout.png`, `wave2a-keyframe-{shell,tracks}.png` | self-critique pass; advocate in Wave 3 |
| 2B | Inspector panels | `panels/{Inspector,HubInspector,ColorPicker}.tsx` (MaterialTab already DS; RightPane no markup) | **DONE** | `ui-design/wave2b-inspector{,-mobile}.png` | self-critique pass; advocate in Wave 3 |
| 2C | Overlays | `overlays/{SearchPalette,GalaxyFilterOverlay,AddNodeDialog,DetailCard,HubNav,Minimap,TopBar}.tsx` | **DONE** | `ui-design/wave2c-search-palette.png`, `wave2c-galaxy-filter.png`, `wave2c-add-node.png`, `wave2c-detail-card.png` (HubNav/Minimap/TopBar visible in wave2a/2e frames) | self-critique pass; advocate in Wave 3 |
| 2D | Mode toggle + HUD + loading | `src/app/page.tsx` | **DONE** | `ui-design/wave2d-boot-loading.png` (throttled capture), `wave2d-preview-app{,-mobile}.png` | self-critique pass; advocate in Wave 3 |
| 2E | Graph-scene purple retint (color-only) | `graph/{GraphScene,HubLighting,HubLabels}.tsx` (ArtifactNode.tsx: zero color literals, untouched) | **DONE** | `ui-design/wave2e-galaxy.png`, `wave2c-detail-card.png` (zoomed-hub colors) | self-critique pass; advocate in Wave 3 |
| 3 | Functional no-regression (312 catalog render/play/control, tsc, vitest) + advocate pass + mobile + perf | harness | pending | — | — |

Wave 2 verification notes (2026-06-09 session 2, resumed run):
- **Design-system fix shipped with 2B**: `materials.css` surface/edge/control classes forced `position: relative`
  at class specificity, out-cascading Tailwind's `.absolute` (materials.css loads last) → the restyled Inspector
  fell into document flow at top-left. Fixed by moving all `position: relative` declarations into one
  zero-specificity `:where(...)` rule — layout utilities now always win. Verified live: inspector rect
  x=1208 w=460 (12px right margin) in both galaxy and canvas modes.
- **Purple gate**: 37 frames scanned, threshold 0.10%. 36 clean. `wave2a-keyframe-tracks.png` = 0.178% —
  TRIAGED AS CONTENT: cluster confined to the scene viewport (x≈1100–1500, y≈600–900, the mock app's own
  neon-violet card artifacts, RGB ≈[109,64,151]); all chrome regions in the same frame are 0. Per the RUBRIC
  amendment, engine-rendered content is judged by the content rubric — chrome gate passes.
- tsc = 10 after all five waves (exact baseline; 9 in tests/ + 1 pre-existing GLProps in GraphScene.tsx).
- Sanctioned hex exceptions (commented in-file): CanvasToolbar light-data defaults (#ffffff, #404050 ground
  bounce — graph DATA, not paint); ColorPicker color-science tracks (hue spectrum, checkerboard, endpoints);
  GraphScene/HubLighting physical no-tint whites + content-lighting fallbacks.
- Pre-existing gaps flagged (NOT introduced, NOT fixed — out of restyle scope): mobile branch renders no
  view-mode toggle (phone users cannot leave preview-app); mobile preview-app shows no prev/next nav; small
  24–28px steppers in CanvasToolbar (pre-existing geometry). Candidates for a follow-up ergonomics task.
- HubLighting LEGACY_LIGHTS retint shifts default assembled-scene lighting slightly warm (cool-key e0edff→ice,
  warm-fill ffdbb8→brass) — material-lighting-probe pixel baselines may show a small delta (roles/intensities
  unchanged; 2-line revert if a Wave-3 gate trips).
- Transient single 404 during one capture session: not reproducible on clean load (0 responses ≥400).

Key constraints carried into every wave:
- Tilt never wraps a SharedViewport (scissor desync). Lift/scale only on live-preview tiles.
- All `data-*` attributes, `window.__catalog*` hooks, and control wiring preserved exactly.
- tsc baseline 10 / 0 new; backups under `notes/backups/ui-design-20260609/`.
- RUBRIC.md ANTI-SLOP amendment appended (additive) 2026-06-09.
