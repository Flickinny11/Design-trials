# UI DESIGN OVERHAUL — progress ledger (resumable)

Run started 2026-06-09 · model claude-fable-5 · branch `prism-editor-build` · NO commits (staged for Logan).
Design system: "Observatory Brass" — graphite/bone neutrals + brass accent + ice telemetry. NO purple, no flat fills.

| Wave | Surface | Files | Status | Evidence | Advocate |
|---|---|---|---|---|---|
| 0 | Design system (frozen contract) | `src/components/editor/design-system/*`, `layout.tsx`, `globals.css`, `tailwind.config.ts`, `/design-system` sheet | **DONE** | `ui-design/wave0-token-sheet.png`, `wave0-clip-{glass,refract,metal,ceramic,controls}.png` | self-critique pass (controls/metal strong; glass edge bumped +0.05 specular) |
| 1 | Animation catalog (tiles, headers, detail/control panel) | `animation-catalog/{CatalogGallery,PrimitiveTile,ControlPanel}.tsx`, `subjects.ts` + rig retint (purple/navy → brass/ice/graphite), mobile responsive fix | **DONE** | `ui-design/wave1-catalog-v2.png`, `wave1-catalog-v3{,-mobile}.png`, `wave1-clip-{tile-selected,tile-hover,detail,header}.png` | self-critique pass; advocate in Wave 3 |
| 2A | Canvas toolbar + keyframe shell | `overlays/CanvasToolbar.tsx` | pending | — | — |
| 2B | Inspector panels | `panels/{Inspector,HubInspector,RightPane,MaterialTab,ColorPicker}.tsx` | pending | — | — |
| 2C | Overlays | `overlays/{SearchPalette,GalaxyFilterOverlay,AddNodeDialog,DetailCard,HubNav,Minimap,TopBar}.tsx` | pending | — | — |
| 2D | Mode toggle + HUD + loading | `src/app/page.tsx` | pending | — | — |
| 2E | Graph-scene purple retint (color-only) | `graph/{GraphScene,HubLighting,HubLabels,ArtifactNode}.tsx` (inventory first) | pending | — | — |
| 3 | Functional no-regression (312 catalog render/play/control, tsc, vitest) + advocate pass + mobile + perf | harness | pending | — | — |

Key constraints carried into every wave:
- Tilt never wraps a SharedViewport (scissor desync). Lift/scale only on live-preview tiles.
- All `data-*` attributes, `window.__catalog*` hooks, and control wiring preserved exactly.
- tsc baseline 10 / 0 new; backups under `notes/backups/ui-design-20260609/`.
- RUBRIC.md ANTI-SLOP amendment appended (additive) 2026-06-09.
