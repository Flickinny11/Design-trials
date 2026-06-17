# P2 C12 — True-3D brass hero button — VERIFIED

**Problem (from P0 map):** TopBar's primary "Add Node" CTA called `useChromeSlab({hero:true,
heroStyle:'brass', heroDepthPx:10, accent:1})`, but `ChromeSlabOptions` had no `hero*` fields — the
options were silently dropped (a "FALSE feature" divergence) AND a pre-existing tsc error
(`'hero' does not exist in type 'ChromeSlabOptions'`). The key rendered as a flat metal slab, and was
additionally **occluded by the full-width masthead rail** (same opaque mesh, depthTest off, rail drew
later) — so the brass never showed at all.

**Change (extend the chrome-layer, gated — REUSE not reinvent):**
- `registry.ts` — `ChromeSlabOptions` gains `hero?`, `heroDepthPx?`, `heroStyle?`.
- `ChromeSlabLayer.tsx` — `writeInstance` packs the hero amount into the reserved `aMisc.w`
  (`hero ? min(1, heroDepthPx/12) : 0`).
- `material.ts` (`slabCommon` + `createOpaqueSlabMaterial`) — gated on `misc.w`:
  - **size-relative chamfer** (`min(size)·0.2·hero`) so a flat brass top cap always survives;
  - **steep extruded-wall normal** (strength 2.1) so the chamfer catches the pointer-light specular;
  - **vertical extrusion shade** (top cap lifted, base shaded) → reads as a raised 3D form;
  - **form-following brass emissive** (0.87 cap → 0.32 base) so the 0.92-metal brass face reads as a
    lit brass key against the dark scene instead of near-black;
  - **brighter lit chamfer edge**.
  All terms multiply/add by `hero`, which is **0 for every non-hero slab** → the other ~24 slabs are
  byte-identical.
- `TopBar.tsx` — `order: 100` on the hero key so it draws AFTER (over) the masthead rail.

**Verification (running app, canvas mode, Chrome DevTools MCP, DPR-evidenced crops):**
- Slab registered: `material:metal, accent:1, hero:true, heroDepthPx:10, 96×32 pill` (confirmed via `__PRISM_CHROME_SLABS__`).
- Draw order after fix: hero idx 37 (last), rail idx 6 → hero on top.
- `hero-v4-addnode.png` (rest) — a raised, luminous brass pill: lit top cap, shaded base, bright
  beveled brass edge; clearly the primary CTA vs the dark glass Reset/Search keys beside it.
- `hero-v4-hover-crop.png` (pointer over key) — the pointer-light specular sweeps the chamfer (left
  side brighter under the cursor) → the bevel normal genuinely responds to light (real 3D form).
- `hero-v4-rest.png` (full frame) — no-regression: toolbar dock, mode toggle, Transform flyout,
  minimap all unchanged.

**Gates:** tsc **9 (net −1**, fixed the pre-existing TopBar error); 0 console errors; other slabs unchanged.

**Honest remainder:** the key reads as a raised/domed brass *pill* (radius 999), not a hard-edged
extruded *box* — appropriate for a pill CTA. A literal box-extrusion with visible side walls + an
external cast/contact shadow grounding the key would need a separate hero mesh pool (deferred; the
in-shader path delivers genuine beveled-lit 3D depth within the proven instanced system). The other
P2 surfaces (toolbar/panels/buttons broad uplift, C9 decouple, C10 floating toolbar, glassmorphism
kill) remain — see CONTRACT.md.
