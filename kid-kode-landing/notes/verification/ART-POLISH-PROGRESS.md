# ART-POLISH progress (resumable)

Branch: prism-editor-build · Model: claude-opus-4-8 · NO commit (staged for Logan).
Frames root: kid-kode-landing/notes/verification/art-polish/

## Wave 0 — frozen volumetric tag contract  ✅ DONE (2026-06-09)
- contract.ts: added optional `PrimitiveDefinition.volumetric?: boolean` (safe default false)
  + exported `VOLUMETRIC_DEPTH_ATTR = 'aDepth'`. Animatable interface UNCHANGED.
- subjects.ts: `buildVolumetricSlabGeometry()` (5 back-to-front slabs, z 0→-0.62, per-vertex
  `aDepth` 0 front→1 back) + `buildSubject(kind, { volumetric })` upgrades a 'plane' subject to
  the slab stack (subject stays ONE Mesh → material-swap contract preserved). depthWrite:false.
- Threaded flag through tests/editor-build/animatable/_conformance.ts (makeTarget) and
  src/components/editor/animation-catalog/shared-tile-renderer.ts.
- GATE: tsc --noEmit = 10 pre-existing errors, 0 NEW. vitest animatable = 312 files / 960 tests PASS.
- Dormant until a primitive opts in → zero behavior change for the other 296 primitives.

## Wave 1 — 16 flat/blocky volumetric primitive fixes  ⏳ launching
DEPTH set (volumetric:true + aDepth slab volume): clouds, fog, cosmic-dust, fireball-burst(+fire colour),
  supernova, will-o-wisp, heat-column, volumetric-cone, ink-bloom, smoke, fog-roll, mist-drift, wispy-smoke
QUALITY/COLOUR set: godray, dappled-light, ink-spread

## Wave 2 — items 1,3,4,5  ⏳ pending
## Verification + reports  ⏳ pending

### Wave 1 result ✅ DONE
- 16/16 vitest-green; 14 got volumetric:true (clouds, fog, cosmic-dust, fireball-burst[+fire colour],
  supernova, will-o-wisp, heat-column, volumetric-cone, ink-bloom, smoke, fog-roll, mist-drift,
  wispy-smoke, godray). dappled-light + ink-spread = quality-mode 2D (correct).
- Central tsc gate caught 7 NEW errors (clouds z, will-o-wisp overloads) — FIXED inline (added z/cos
  to the local TNode aliases, chainable sin/cos, dropped a bad cast). Re-gate: tsc 10=baseline 0-new;
  vitest animatable 312 files / 960 tests PASS.
- ~1.25M subagent tokens, 16 agents, ~4min wall-clock, 0 file collisions.

### Wave 2 result ✅ DONE
- Item1 glass centres: shared-tile-renderer addGlassBackdrop() gains a guaranteed on-axis "hero" soft disc
  + near-axis bokeh + lifted panel floor + closer/hotter backdrop; crystal-ball/water-droplet/liquid-glass
  default thickness lowered so the centre magnifies the hero (not the inverted dim rim); crystal-ball gains
  a faint on-axis inner-glow floor. Files: shared-tile-renderer.ts, crystal-ball.ts, water-droplet.ts, liquid-glass.ts.
- Item3 T2 unlit mask: material-system.ts UNLIT_LAYER=1 + tagUnlitObject(); default-factory tags unlit planes;
  ProbeScene tags its unlit-plane; lighting-rig buildT2 composites mix(giAo, color, coverage) where coverage =
  oneMinus(step(0.999999, maskDepth)) from a UNLIT_LAYER-only mask pass (DEPTH, not alpha — opaque bg forces
  RT alpha=1 in r184; depth is bg-immune + depth-correct). All inside the existing T2 try/catch (clean T1 fallback).
  +2 unit tests (material-lighting 34/34).
- Item4 editor shadows: <Canvas shadows="soft">, createUnifiedRenderer enables shadowMap+PCFSoft, AssembledSceneNode
  meshes cast+receive, AssembledShadowCatcher receiver plane, HubLighting key light casts. Files: GraphScene.tsx, HubLighting.tsx.
- Item5 nits: caustics-ripple (brighter web), dissolve-noise (+emissive glow), pixel-dissolve (crisper+emissive),
  dust-cloud (volumetric:true + aDepth depth + brighter), pointer-displace (resting micro-ripple relief).
- GATE: central tsc caught 4 new errors in dust-cloud (TSL ReturnType<vec2> collapsing to never) — FIXED inline
  (opaque V2=any alias + permissive vc/vf/mixp wrappers). Re-gate: tsc 10=baseline 0-new.
  vitest animatable+material-lighting = 317 files / 994 tests PASS. Integration: 1 FAIL = HL08 parallax-plane
  MeshStandardNodeMaterial — PROVEN pre-existing at HEAD via stash (stale test from committed material-lighting
  receivesLighting default), 0 new regressions. ~415k subagent tokens, 4 agents.

### Real-GPU review #1 (backend=webgpu, 29 tiles captured, deviceLost 0) — found defects
- frames: notes/verification/art-polish/after/ + _after-sheet.png (montage).
- GOOD: cosmic-dust, volumetric-cone, dappled-light, ink-bloom, smoke, dust-cloud, godray(shafts read),
  nebula/plasma/fire-flame (refs premium). Glass crystal-ball got slight lift.
- DEFECTS SEEN (Wave 3 targets):
  * GLASS centres (crystal-ball/water-droplet/liquid-glass/liquid-fill-glass/refraction-warp) STILL BLACK.
    ROOT CAUSE: the scissored multi-view catalog rig does NOT populate three's transmission render target,
    so clear transmissive centres have no backdrop to refract (an opaque sphere placed directly behind does
    NOT show through either). RIG LIMITATION — not fixable by backdrop tuning. FIX: luminous internal CORE
    via emissiveNode (validated on crystal-ball INNER_GLOW_FLOOR 0.05->0.5). Wave 3 rolls it to the 4 siblings.
    The transparent/additive hero disc was also wrong (three excludes transparent objs from transmission RT)
    -> replaced with opaque emissive sphere (still doesn't transmit, but harmless; core glow is the real fix).
  * fireball-burst STILL TEAL (not fire) — colour bug. Wave 3 fixes to warm R>=G>=B.
  * clouds too dark + horizontal SLAB BANDING (parallax too large). Wave 3: lift depthFade floor, cut parallax.
  * heat-column cool grey-blue (should be warm) + dark + banding. Wave 3 fix.
  * dim: mist-drift, caustics-ripple(near-black), supernova, will-o-wisp, ink-spread, godray(greenish+centre
    moiré). Wave 3 brightness/colour/anti-alias.

### Wave 3 — fix-up wave ⏳ launching (5 agents: glass-cores / fireball-fire / clouds / heat-column / dim)
- crystal-ball luminous core already applied by orchestrator (validated approach).

### Wave 3 + orchestrator fix-ups — real-GPU review #2
- Wave 3 (5 agents, vitest all green): glass luminous cores (water-droplet/liquid-glass/refraction-warp/
  liquid-fill-glass) + fireball fire + clouds + heat-column + dim-6 (mist-drift/caustics-ripple/supernova/
  will-o-wisp/ink-spread/godray). tsc 0-new.
- Recapture #2 GOOD: caustics-ripple (bright web), godray (warm amber, anti-aliased), mist-drift, supernova,
  will-o-wisp, ink-spread all lifted; glass centres now glow (no longer pure black).
- HARD CASES (fireball-burst, heat-column) — orchestrator-driven, multiple iterations:
  * Root cause #1: fire-flame (the premium ref) is NOT volumetric — 5 ADDITIVE slabs sum/blow out to
    grey-white. Dropped volumetric:true on both → single-plane additive (aDepth pinned to 0). 
  * Root cause #2 (fireball): captured at the burst's SMOKE phase (age≈0) → grey. Made heat stay warm
    across the whole cycle (heat = ball*(age*0.4+0.6)).
  * Root cause #3 (both): ACES tonemapping desaturates over-bright warm → cream/white; and at high
    brightness a tonemapping/additive HUE artifact tints warm content olive/teal. Mitigated by SATURATED
    low-G ramps (orange not yellow-white) at capped brightness. Diagnostic (forced colorNode=red) proved
    the heat-column column SHAPE + pipeline are correct and warm colour DOES apply.
  * OUTCOME (honest): fireball-burst now reads WARM (salmon/red, no longer teal/grey) but as a warm glowing
    mass rather than vivid licking flames. heat-column now reads WARM (amber top, gold base) with a residual
    olive mid-band (a tonemapping/HDR-additive hue artifact at mid-brightness that survives a verifiably-warm
    low-G ramp). Both are clear improvements over the teal failures; neither is pixel-perfect premium. FLAGGED.
- FINAL GATE: tsc 10=baseline 0-new; vitest animatable+material-lighting 317 files / 994 tests PASS.

### Item 3 (T2 unlit mask) — VERIFIED PASS
- /material-lighting-probe?tier=T0 vs ?tier=T2, unlit-plane region: RGB (207,91,45) → (207,91,45),
  lumaDelta 0.000 → BYTE-IDENTICAL at T2. Lit sphere changes (lumaDelta 233 → GI active). Mask works.
- frames notes/verification/art-polish/probe-t2/ + t2-unlit-mask-report.json.
- NOTE: lit sphere is dark at T2 (luma 4.5) — that is the pre-existing material-lighting SSGI/GTAO GI output
  (my mask only adds the unlit exclusion; coverage=0 on lit pixels → unchanged GI). Worth a separate look but
  NOT introduced by art-polish.

### Fresh-context art review #1 (independent, tough) — verdict
- premium 2 (supernova, caustics-ripple) · acceptable 10 · nit 7 · broken 7
  (clouds, fireball-burst, will-o-wisp, fog-roll, crystal-ball, water-droplet, refraction-warp).
- Key: glass spheres read as opaque grey "clay" (cores too dim/white); fireball salmon not fire;
  SLAB BANDING visible (fog-roll displaced edge, dust-cloud square-frame, mist-drift seam, clouds blocky).

### Wave 4 — orchestrator fix-ups addressing reviewer #1
- ROOT CAUSE of banding (from reviewer's "square-frame/displaced-edge"): rear slabs project SMALLER under
  perspective → their rectangular edges show as nested frames. FIX: buildVolumetricSlabGeometry now
  perspective-compensates each slab scale = (camZ+|z|)/camZ (camZ=3.2) so every slab fills the same screen
  footprint → nested-frame banding gone. GLOBAL win for all 13 volumetric tiles.
- Glass cores → BRIGHT SATURATED COLOURED (not pale/white): crystal-ball vivid blue-violet (now a premium
  luminous crystal orb), water-droplet/refraction-warp bright cyan, liquid-glass bright blue. core mult 0.5→~1.1.
- clouds: opacityNode floored (alpha*0.4+0.6) so the SKY fills the tile (was transparent→dark bg). No longer black.
- fireball: added a RADIAL temperature gradient (hot core→orange→red edge) + softer ball edge + gentler edge
  turbulence (less "torn paper"). Still flagged (see below).
- GATE: tsc 10=baseline 0-new; vitest 317 files/994 tests PASS.
- Recapture #3: crystal-ball + water-droplet now PREMIUM luminous orbs; refraction-warp good; banding much
  reduced on fog-roll/dust-cloud/mist-drift; clouds brighter (sky shows, if a touch muddy). fireball still
  reads salmon/cool-core not vivid orange (ACES+additive hue artifact — same as heat-column).

### HONEST REMAINING FLAGS (not faked)
- fireball-burst: warm-toned, radial core, but NOT vivid orange fire (ACES/additive hue shift resists shader
  colour control after 7 attempts). heat-column: warm amber/gold with residual olive mid-band (same artifact).
- clouds/fog: lifted out of black but read muddy, not vivid sky. liquid-glass: luminous but a touch dark vs siblings.
- Recommend for fire/heat tiles: a non-additive (over) fire approach or a tonemapping tweak in a focused session.
