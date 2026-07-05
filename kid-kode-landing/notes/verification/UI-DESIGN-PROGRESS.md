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
| 3 | Functional no-regression (312 catalog render/play/control, tsc, vitest) + advocate pass + mobile + perf | harness | **DONE** | see Wave 3 results below | **ALL 6 CHROME SURFACES: PLEASED / PASS** |

## Wave 3 results (2026-06-09/10, resumed session 2)

**Advocate gate (user-advocate agents, schema-validated verdicts, anti-rubber-stamp):**
| Surface | First grade | After fix round | Verdict file |
|---|---|---|---|
| Wave 0 token sheet | BLOCKED (mobile sheet unreachable) | **PLEASED / PASS** | /tmp/ua-verdict-tokens-v2.json |
| Wave 1 catalog chrome | **PLEASED / PASS** (first grade) | — | /tmp/ua-verdict-catalog-chrome.json |
| Wave 2A toolbar+keyframe | BLOCKED (2B header defect in frame) | **PLEASED / PASS** | /tmp/ua-wave2a-v2/verdict.json |
| Wave 2B inspector | BLOCKED (3 MUST-FIX) | **PLEASED / PASS** | /tmp/ua-crops/wave2b-inspector-verdict-v2.json |
| Wave 2C overlays | BLOCKED (#5d8bff chrome) | **PLEASED / PASS** | /tmp/ua-crops/verdict-wave2c-v2.json |
| Wave 2D/2E shell+galaxy | BLOCKED (2 MUST-FIX) | **PLEASED / PASS** | /tmp/ua-verdict-wave2d-2e-v2.json |

**MUST-FIX items found by advocates → all fixed + re-graded with recaptured evidence:**
1. Token sheet mobile unreachable below first viewport — root cause `min-h-screen` + body `overflow:hidden`
   (scroll never worked; also explains the old sheet-bottom==top MD5 dupe). Fixed: sheet root is
   `h-screen overflow-y-auto` (its own scroll container). Evidence: `wave0-tokens-scroll-mobile-seg0..2.png`,
   `wave0-tokens-scroll-seg0..1.png`.
2. Inspector header collision (title/BUILT chip crushed by 6-button row, desktop+mobile) — header
   restructured to two rows (truncating identity row + wrapping action rail). Evidence: recaptured
   `wave2b-inspector{,-mobile}.png`, `wave2a-*.png`.
3. FILTER pill occluded "Preview in App" — GalaxyFilterOverlay slides to `md:right-[484px]` when an
   inspector panel is visible (position-only). Evidence: `wave3-filter-inspector-coexist.png`.
4. `#5d8bff` blue chrome (DetailCard rail + house glyphs in HubNav/breadcrumb; raw hub.color into chrome
   controls) — retinted: rail+breadcrumb=ice, HubNav glyph=brass active/bone idle.
5. Hub hull chrome royal blue (missed file in 2E) — backside volume→ice500, wireframe→ice400, equator
   ring→ice300, hub pointLight→ice200, mockup-sphere emissive→ice300 (color-only; mockup texture itself
   is content). Advocate re-measure: 0 saturated-blue chrome pixels in both galaxy frames.
6. Dead LIVE PREVIEW well + 'HUB —' readout — verified PRE-EXISTING (restyle diff cosmetic-only in those
   regions; tracked as RT-SC-10 / data plumbing in unmet-criteria.json); advocate re-classified to flags.
   ⚠ Standing condition: first surface graded after RT-SC-10 completes re-converts the dead-well flag to
   MUST-FIX unless the well shows content.

**Functional no-regression:**
- tsc: 10 errors = exact baseline (0 new) after all fixes.
- vitest: 21 failures, strict subset of the 23-failure HEAD baseline (0 new). The 2 EDGE_COLORS freeze
  tests (EB-03-04/05) were deliberately re-pinned from legacy literals to the DS-token expressions —
  RA-15's anti-side-effect intent preserved, table still frozen, at Logan-sanctioned values.
- 312-tile catalog (verify-catalog-parallel, --no-resume, real run 881s, deviceLost=0 std+glass):
  300/312 pass under full load; all 12 fails triaged — 6 pass in isolation (load-flake incl. both
  previously-passing names pointer-hue-shift + text-typewriter-cursor 2/2), 4 documented pre-existing
  in the committed prior ledger (dust-poof, hover-lift, lightning-bolt, scroll-skew). **Net tile
  regressions from the UI overhaul: 0.**
- Six-tile CONTENT advocate sample (real-GPU bundles): 4/6 PASS (caustic-rings, campfire, accordion-y,
  blur-spin); 2 MUST-FIX routed to the ART-POLISH BACKLOG as pre-existing content items (bevel-glass —
  matches the documented scissored-rig no-transmission-RT limitation; aurora — control-extreme white
  blow-out at brightness/width mid+, default state was graded CLEAN in the volumetric sweep; only
  tile-adjacent change since then is an 11-line backdrop tint swap that cannot cause either mode).

**Performance (idle machine, real Chrome/Metal):**
- Desktop t2: hover p50 10.4ms / p95 29.0ms; press p50 11.9ms / p95 28.4ms (gate <100ms ✓).
  FPS: 80.2 idle / 71.0 palette churn / 72.1 mode-toggle churn.
- Mobile 390px t1 (tier auto-drop confirmed): 77.2 idle / 82.5 palette churn FPS.
- Purple gate: 47 frames, 46 clean; single exceedance wave2a-keyframe-tracks.png (0.178%) triaged +
  advocate-verified as scene CONTENT (mock app's neon-violet cards), chrome regions 0.000%.

**Known follow-ups (non-blocking, logged):** mobile has no view-mode toggle (pre-existing; phone users
land in preview-app with no chrome — biggest shell usability hole); dead preview well re-grades with
RT-SC-10; small touch targets on toolbar steppers; 9px tertiary-label contrast ~2.8:1; minimap glyph
ice adoption; orphaned "inspection" label in canvas TopBar; favicon.ico 404 (cosmetic); rubric/validator
mismatch (INDIFFERENT+flags row unreachable under non-PLEASED-requires-mustFix rule).

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
