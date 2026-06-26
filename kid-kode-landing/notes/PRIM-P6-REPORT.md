# PRISM PRIMITIVE SYSTEM — PHASE P-6 — LIBRARY UX — RUN REPORT

Status: **RUN COMPLETE.** Branch `prism-editor-build`. Route **`/library`**. WebGPU
(auto-falls-back to WebGL2), the founder-approved chassis glass idiom. Builds on
committed P-1..P-5; production + P-1..P-5 untouched. Spec:
`docs/prism/PRISM-PRIMITIVE-TEMPLATE-SYSTEM-SPEC.md` §7 (+ §0 / §5 / §10).

## One line
A 3D-native, in-canvas **LIBRARY/PALETTE** (ZERO DOM) that browses + searches every
building block shipped in P-1..P-5 — each entry a **live spinning 3D preview** built
from the real engine factories — and lets you **drag a tile onto the canvas to
instantiate it as a node**, **select it to edit its full schema** in an in-canvas
Inspector, with one **chrome panel dogfooded from the Pane primitive itself**.

## What shipped (spec §7)
- **§7.1 — in-canvas palette, zero DOM, browsable + searchable, live previews.** A
  worn-alloy instrument shelf (`LibraryPalette`) on a `WebGPURenderer` canvas: section
  tabs · search bar · materials family sub-tabs · a grid of `LibraryTile` previews.
  Each tile renders the **real miniaturized artifact** (parametric geometry / a
  registry-material sphere on a lit socket / a glass slab / a member assembly) with a
  continuous idle spin + hover flip — the cube-button mechanic generalized. Search is
  zero-DOM: clicking the bar focuses it and a window-keystroke listener builds the
  query (MaterialPromptPanel idiom), filtering tiles live. `no-dom-ui-gate` PASS (14
  files).
- **§7.2 — the four sections.** Primitives (Pane/Cube/Sphere) · Composites (Nav
  Header / Footer / Card subgraphs) · Materials (the full ~73-entry registry by family,
  **incl. Fluids** as a sub-group, and the prompt-to-texture *Generated* outputs) ·
  Saved (the user's own, via the Inspector SAVE). Catalog = 81 entries.
- **§7.3 — drag-to-canvas → node; select → Inspector exposes the FULL schema.** A real
  pointer drag (`DragGhost` follows the z=0 plane with a drop ring; tap defers to a
  quick-add; OrbitControls frozen during the gesture) instantiates the entry as
  node(s). The Inspector exposes the **full** editable schema at P-1/P-3 parity:
  - primitives: width / height / thickness / cornerRadius / **bevel** / **subdiv** +
    **contrast** faders + **+HOLE/−HOLE cutout** chips (sphere: radius / segments /
    contrast);
  - fluids: the full §3.2 surface — 9 faders (viscosity / surfaceTension / flowSpeed /
    flowDirection / turbulence / thickness / ior / damping / opacity) + pattern-cycle /
    REACTS-toggle / TINT-cycle chips;
  - a material swatch row re-skins a primitive (full registry browsable in the palette).
  Faders are worn-cube knobs on milled channels (the keyframe vocabulary), driven by a
  trusted pointer.
- **§7.4 — DOGFOOD.** `LibraryDogfoodPanel` renders a **NODE EDITOR** chrome panel
  whose glass pane is **literally** the P-1 Pane primitive — the same
  `buildPaneGeometry` + glass material a customer places, backed by a **real registered
  node** (`lib-chrome-pane`, present in `nodes()`, rendered + Node-Law-tagged). On it,
  a mini node-graph (INPUT/TRANSFORM/OUTPUT worn cubes + glass wire connectors + MSDF
  labels) built from more primitives. Clicking it selects the chrome node → the
  Inspector proves the chrome itself is a node (INV-0.1).

## Node Law (§0) — held by the gate
`use-library-store` is the single canvas spine: every instance projects to real
`PrismNode`(s) via `schemaToNode` / `memberToNode` (primitives/fluids → 1; composites →
N members). New gate mode **`node-authorship-gate.mjs --library`**: primitive drop
+1 node, composite drop +5-node subgraph (INV-0.4), canvas + galaxy both 0 orphans / 0
unrealized, classifier self-test live. **8/8 checks, 0 hard-fail.** P-1 (`--lab`) and
P-3 (`--fluid`) **not regressed**.

## Verification (VERIFICATION-STANDARD.md, headless)
- **Behavioral pass — 17/17** (`notes/verify-prim-p6.mjs`, trusted pointer + real
  keystrokes): classifier self-test · browse all 4 sections (3/3/13 live tiles) +
  Gems family (7 live gem previews) · search "gold" → 2 matches via real keystrokes ·
  drag primitive (+1 node) / material (+1) / composite (+5 subgraph), all authored ok=
  true · Inspector opens with the full fader set · fader drives width 3.2→5.0 · material
  reskin · dogfood chrome is a node + selectable · galaxy/canvas two-state 0 orphans.
  **0 console / page errors.**
- **Three fresh-context judges — ALL CLEAN, 0 MUST-FIX:**
  - **user-advocate (blocking): PLEASED**, gate PASS, per-axis high; "looks like a real
    high-end 3D tool and does everything it claims." 2 non-blocking polish flags.
  - **aesthetic: PASS** — materials clear **F-4** (real worn-metal + faceted-gem
    PBR/transmission, not toy plastic); shelf/tabs/search/tiles/inspector/dogfood match
    the locked `/toolbar-chassis` + `/keyframe-editor` worn-metal + real-glass +
    engraved-MSDF language.
  - **spec-conformance: CONFORMS** — §7.1/§7.2/§7.3/§7.4 + §0/§5/§10 all conform. (The
    one MUST-FIX it first raised — §7.3 inspector completeness — was fixed and
    re-verified CLEARED.)
- **Hard gates:** no-dom-ui PASS · node-authorship `--library` 8/8 · tsc 0-new (baseline
  10) · 0 console errors.
- **Frames:** `notes/verification/prim-p6/` — `bh-00..bh-08` interaction frames,
  `w4-*` inspector frames, `ref-toolbar-chassis.png` / `ref-keyframe-editor.png`
  (locked-aesthetic baselines), `behavioral-metrics.json`.

## Files
New: `src/components/editor/library/{use-library-store,library-catalog,tile-helpers,
LibraryLabScene,LibraryPalette,LibraryTile,LibrarySearchBar,LibraryCanvasNode,
LibraryInspector,LibraryDogfoodPanel,DragGhost}` + `src/app/library/{page,layout,
library.css}`. Gate: `scripts/node-authorship-gate.mjs` (+`--library` mode).
Harness: `notes/verify-prim-p6.mjs`.

## Commits
`c713a719` w-palette → `334c9619` w-drag → `c5805513` w-dogfood → `0a0d057e` w-verify
(full-schema inspector fix).

## Notes / honest caveats
- Headless frames render on the **WebGL2 fallback** backend (transmission/refraction is
  flatter than the founder's real **WebGPU** GPU, where it reads richer). Judged
  accordingly; nothing looks wrong on either.
- Fluid **previews** in tiles are static premium-glass slabs (a live `FluidFieldSim`
  per thumbnail would be too costly); a **dropped** fluid is a real live liquid-glass
  surface node.
- Prompt-to-texture **outputs** are browsable/instantiable in the Materials *Generated*
  family; the generation *authoring* affordance lives at `/material-lab` (P-2 scope).
- Non-blocking advocate polish (future): larger engraved tile/subtitle labels.
