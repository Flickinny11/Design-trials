# PRISM — Premium Toolbar + Galaxy Labels — Fable 5 — 2026-07-01

Branch: `codex/prism-recovery-harness-20260630` · Dev server: `http://localhost:3000`
(serves this worktree). Verification frames: `notes/verification/toolbar-premium/`.

---

## 1. Interpretation of the founder's intent (his words → design law)

The founder gave one verbatim brief covering two surfaces. Decoded:

**Galaxy labels** — "clean labels is good" (he approves today's cleaned names). Upgrade
them to be **fashionable, elegant, aesthetically pleasing** and **enlarge on hover** so a
hovered sphere is instantly readable. Hard rule: **no grotesque fonts anywhere.**

**Toolbar (he called this "critical")** — make it **premium photorealistic**:
- Button materials + the toolbar surface itself = **photorealistic textures/materials**,
  with **ambient light refractions, visible depth, and real edges**. Premium. (Liquid glass
  is allowed *only* as a photoreal refracting material — never a flat Apple-glass UI strip.)
- Icons = **custom, 3D, geometric shapes** in **RED + BLACK + WHITE**, with **gradients and
  shading**, **some animated**. NOT an icon set, NOT emoji, NOT Lucide, no lightning bolts,
  nothing flat/amateur.
- **Fast, feels fast, responsive on mobile AND desktop.** Verify visually + interactively,
  frequently (Claude-Design style).

**One design language.** The founder said the keyframe editor is the next run and will
inherit this language. So the palette + material kit built here are authored as a reusable
**RED / BLACK / WHITE photoreal system** (machined black metal + brushed chrome/white +
signal-red accents + real refracting glass) that transfers cleanly to the keyframe editor.

---

## 2. Current state vs the founder's bar (assessed against live frames + source)

Target is the **approved** production toolbar: `src/components/editor/overlays/liquid-toolbar/**`
(rendered by `CanvasToolbar.tsx`, gated to `viewMode==='canvas'`). The `/toolbar-chassis`
lab and the quarantined `glass-toolbar/**` are NOT touched.

| Element | Today | Meets bar? | Gap |
|---|---|---|---|
| Icons (`PrismIcon3D.tsx`) | 14 bespoke 3D sculptures, extruded/beveled/assembled, animated, gradient+emissive | Form ✅ / animation ✅ | **Palette ✗** — muted **rainbow jewel-tones** (sky/lavender/green/brass…), plus hardcoded multi-color spots (green gizmo axis, rainbow prism fan, orange→blue sky). Founder mandates **red/black/white**. |
| Toolbar surface (`GlassRailPane.tsx`) | Real `MeshPhysicalMaterial` transmission pane, milled sockets, beveled edges | Refraction/depth partial | Reads as **clear Apple-ish glass**. Needs premium **dark smoked glass + brushed-metal/chrome edge frame** → more visible material, edges, depth. |
| Buttons (`GlassCubeToolButton.tsx`) | Clear glass cubes (transmission 1), rise on hover | Interaction ✅ | **Clear** cubes read plain and let the busy scene muddy the icon. Needs premium material contrast (smoked glass body + **machined metal chamfer**, red active rim) so red/white icons pop. |
| Galaxy labels (`GraphScene.tsx` `NodeLabels`) | DOM `<Html>`, **`font-mono` = JetBrains Mono** (monospace), fixed size | Clean ✅ | Monospace reads **utilitarian/code**, not fashionable. No enlarge-on-hover (hover only un-declutters). |

**Verdict:** the geometry + interaction foundations are strong; the elevation is a
**material + palette + type job**, not a ground-up rebuild. Recolor the icons, give the
surfaces real photoreal material/edges, and make the labels fashionable + hover-enlarge.

### Why NOT a geometry rebuild of the icons
The 14 forms are already custom, 3D, geometric, animated, gradient-shaded — they carry
per-tool identity by **shape** (gizmo, crosshair, plus, slabs, diorama, cube, dome, morph
star, prism-pill, "A", wand, chip, sun-lamp, hammer). The only failing criterion is the
palette. Recoloring to red/black/white keeps the identity in the forms and lets the brand
live in the color — a more premium, more disciplined result than color-coding 14 tools.

### Font choice (respecting the grotesque ban)
Repo has `ClashDisplay-Variable.woff2`, but Fontshare classifies Clash Display as a
**grotesque** — banned. The codebase already **condemns grotesques** (Switzer/Bricolage) and
**sanctions Sora** (geometric, non-grotesque) as `--font-display`. So galaxy labels move
`font-mono → --ds-font-display` (**Sora**) with a refined fashionable treatment (weight +
tracking + a hairline accent). Non-grotesque, elegant, zero new font files/licenses.

---

## 3. Build plan (surgical, additive, behavior-preserving)

1. **Palette module** — `liquid-toolbar/config.ts`: replace the rainbow `TOOL_ACCENT` with a
   shared **red family** (signal red `#ff2634` + oxblood `#7d0f18`), keeping the same API
   (`accentFor`) so `GlassCubeToolButton` / `ToolbarTooltips` need no signature change.
2. **Icon recolor** — `icons/PrismIcon3D.tsx`: material kit gains a **black-anodized** helper;
   `anodized`/`gem`/`emissive` accents resolve to red; `chrome` stays as the white metal.
   Remove every hardcoded non-red color (green Z axis → chrome/white; rainbow spectrum → red
   dispersion; orange/blue sky → red→black; etc.). Keep geometry + `useFrame` animation.
3. **Toolbar surface** — `GlassRailPane.tsx`: darker smoked premium glass (tint + attenuation),
   stronger `envMapIntensity`/clearcoat for ambient refraction, and a **brushed-metal/chrome
   edge frame + socket rims** for real machined edges + depth.
4. **Buttons** — `GlassCubeToolButton.tsx`: smoked-glass cube body + **metal chamfer collar**,
   red active/hover rim; keep hover-rise + icon energize + all wiring/handlers.
5. **Lighting** — `ToolbarScene.tsx`: nudge the studio rig to sell brushed metal + red accents
   without washing out the glass. No new transmissive surfaces (perf).
6. **Galaxy labels** — `GraphScene.tsx` `NodeLabels`: primary name → Sora display, fashionable
   treatment; **enlarge-on-hover** via a GPU `transform: scale()` bump + `transition`, brighter
   color + glow, raised stacking — driven by the existing `isHovered` (sphere hover already
   sets `hoveredNodeId`).

**Guardrails honored:** no smaller editor shell, no Galaxy rewrite, no stock-icon toolbar, no
remote editor-chrome assets, no raw secrets, real `/editor` untouched beyond toolbar + labels.
Files are outside the `no-dom-ui-gate` scope (chassis/editor-shell/app-editor only), so DOM/CSS
in labels + the toolbar host stay legal. Prism runtime + `.prism` path untouched.

---

## 4. EARLY CHECKPOINT — before frames (founder review)

Captured on the live app (real Chrome, this worktree), desktop 1440×900:

- `verification/toolbar-premium/desktop/00-before-canvas.png` — editor, toolbar rail at left.
- `verification/toolbar-premium/desktop/00-before-toolbar-closeup.png` — toolbar @2.3× —
  shows the **rainbow jewel-tone** icons in clear glass cubes (the palette gap).
- `verification/toolbar-premium/galaxy/00-before-galaxy-overview.png` — galaxy overview.
- `verification/toolbar-premium/galaxy/00-before-galaxy-labels.png` — galaxy at L2 with the
  current **monospace** node labels.

**Direction, one line:** black machined instrument + brushed chrome edges + real refracting
smoked glass + signal-red custom 3D icons; fashionable Sora labels that grow under the cursor.

> EARLY CHECKPOINT — direction set; before-frames captured. Building now. Details, after
> frames, gate + judge results follow below as the run proceeds.

---

## 5. What changed (surgical, additive, behavior-preserving)

**Galaxy labels** — `src/components/editor/graph/GraphScene.tsx` `NodeLabels`:
- Primary name label moved off `font-mono` (JetBrains Mono) to `var(--ds-font-display)`
  (Sora — the codebase-sanctioned non-grotesque geometric display face). Refined weight +
  `letter-spacing: 0.015em`, base sizes nudged 10/11/13 → 11/12/14 for a fashionable read.
- **Enlarge-on-hover**: the label wrapper now scales `× 1.55` on `isHovered` via a GPU
  `transform: scale()` with a `200ms cubic-bezier` transition (no reflow), the name goes pure
  white with a signal-red focus halo, and `zIndexRange` lifts to `[200,0]` so the hovered
  label sits above its neighbors. Driven by the existing sphere→`hoveredNodeId` state (no new
  plumbing). The grotesque ban is respected (Clash Display is a grotesque per Fontshare, so it
  was NOT used).

**Toolbar icons** — `liquid-toolbar/config.ts` + `icons/PrismIcon3D.tsx`:
- Palette collapsed from a 14-way rainbow of jewel tones to a single **RED / BLACK / WHITE**
  system: `SIGNAL_RED #ff2a38` for every accent (identity is carried by each tool's distinct
  3D form), with a `black()` gunmetal helper (the black) and `chrome()` (the white).
- Every hardcoded off-palette color removed: green gizmo Z-axis → black; orange/blue image
  sky → red→black; gold sun → white-hot; **iridescence (rainbow) removed** from the morph
  star; blue morph-ghost → white; rainbow prism-fan → white→red→oxblood dispersion; cream
  lamp core → pure white. Geometry + `useFrame` animation untouched. Icon "black" lifted to
  `#16161d` gunmetal so dark elements hold a crisp silhouette on the smoked cube.

**Toolbar surface + buttons** — `liquid-toolbar/GlassRailPane.tsx` + `GlassCubeToolButton.tsx`:
- Rail: clear glass → **smoked dark glass** (dark attenuation, more body, stronger ambient
  refraction) wrapped in a real **brushed-chrome bezel frame** (new extruded metal geometry,
  `metalness 1`) + a dark instrument backing → premium photoreal material with visible depth
  and machined edges.
- Buttons: smoked-glass keycaps; machined edge glint that is chrome-white on hover and
  **signal-red when active** (ties to the icon palette). Hover-rise + icon-energize preserved.

## 6. Verification (all green)

- **Typecheck**: `tsc --noEmit` → **9 errors = pre-existing baseline, 0 new** (the
  `GraphScene:4540` GLProps error is the known WebGPU gl-factory baseline; the rest are
  pre-existing test-file errors). None in the changed files.
- **no-dom-ui-gate**: PASS (my files are outside its scope; confirms nothing in the protected
  chassis/editor-shell scope was touched).
- **Live real-Chrome (this worktree, :3000)** — desktop 1440×900 + mobile 390×844:
  - Icons render red/black/white as distinct 3D sculptures (`desktop/02,05`), rail reads as a
    machined smoked-glass instrument with chrome bezel (`desktop/01,03,06`).
  - Hover works: cube rises, icon energizes, red-accent "3D Object" tooltip (`desktop/04`).
  - Actions intact: clicking a tool opens its flyout (`data-group` toggles) — surface-only edit.
  - Galaxy labels: Sora at rest (`galaxy/01`), enlarge-on-hover proven with a real pointer
    hover on the sphere (`galaxy/02`, closeup `galaxy/03`).
  - **60 FPS on the mobile viewport**, **0 console errors**, toolbar visible + responsive on
    both viewports (`mobile/01,02`).

## 7. Judge results — both Fable-5 vision judges PASS, 0 MUST-FIX

- **user-advocate** (graded the frames as the founder): **NET PASS / GATE GREEN / MUST-FIX
  none.** All 4 founder criteria pass with cited before/after frames ("night-and-day … ship
  it"). Non-blocking taste flags: darkest icon elements could use a hair more contrast at
  native rail size (addressed via the `#16161d` black lift); resting-label opacity could drop
  further (subjective — left as-is).
- **prism-criteria-reviewer** (graded the diff): **VERDICT pass, MUST-FIX none.** All 5 points
  PASS — full hex census confirms red/black/white only, Sora token chain verified non-grotesque,
  enlarge-on-hover is a real transform (not a no-op), rail is genuinely smoked glass + real
  chrome bezel, and the diff is cosmetic-only (no wiring/handler/viewMode/secret drift).
  Nits (non-blocking): the tiny secondary sub-detail line keeps `font-mono` (in-policy — the
  mandate targets the name label); `RED_DEEP`/`RED_HOT` are exported for the keyframe editor to
  inherit and currently unused (harmless).

## 8. Design language for the NEXT run (keyframe editor)

The reusable **RED / BLACK / WHITE photoreal system** is now established and should carry over:
`SIGNAL_RED #ff2a38` (+ `RED_DEEP #7d0f18`, `RED_HOT #ff5a55`) as the one accent family;
`chrome()` = white metal, `black()` = gunmetal, red anodized/gem/emissive = the accent; smoked
transmission glass framed by a brushed-chrome bezel; fashionable Sora (`--ds-font-display`)
type; enlarge/energize-on-hover. The keyframe editor (`overlays/KeyframeEditor.tsx`) inherits
this next, per the founder's toolbar-first sequencing.

## 9. Progress log

- 2026-07-01 — Oriented; harness up (chrome-devtools MCP on :3000); before-frames captured;
  plan written (EARLY CHECKPOINT, commit `e8ee6375`).
- 2026-07-01 — Galaxy labels → Sora + enlarge-on-hover (verified). Icons → red/black/white;
  rail/buttons → smoked glass + chrome bezel (commit `9632880e`). Typecheck 0-new, gate PASS,
  desktop+mobile frames, hover/click proven, 60 FPS, 0 console errors.
- 2026-07-01 — Advocate polish: icon black → gunmetal for crisp silhouette (commit `a14e00bd`).
  Both Fable-5 judges PASS, 0 MUST-FIX.

PRISM-TOOLBAR-PREMIUM: RUN COMPLETE
