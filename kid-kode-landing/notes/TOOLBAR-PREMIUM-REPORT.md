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

## 5. Progress log

- 2026-07-01 — Oriented, harness up (chrome-devtools MCP on :3000), before-frames captured,
  plan written. Starting galaxy labels, then icons, then materials.
