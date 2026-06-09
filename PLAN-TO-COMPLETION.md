# Prism prototype — PLAN TO COMPLETION (the runway + the finish line)
_Prepared autonomously while the six-tile job finished. Scope = the Canvas/preview-pane spec; the engine/harness is later._

## Where we are (git checkpoints, newest last)
- 5fa695f  catalog: 312/300 animation primitives
- 920237c  parallel verification harness (3-5x; real-GPU tier 25-40x)
- 4fdd78e  material + lighting system (spec §10/§11; tiers T0/T1/T2; receivesLighting; materialSpec/lightingSpec)
- c1cba73  art-polish pass (glass cores, T2 unlit mask, 5 nits) + the additive `volumetric` tag
- [STAGED, not yet checkpointed]  user-advocate verification gate + six-tile cleanup (fire/heat rebuilt; 6 volumetrics
  rebuilt smooth single-plane). User-advocate PROVEN to block bad tiles + pass good ones with cited evidence.

## The queued sequence (each is a ready-to-fire, scope-locked ultracode prompt at repo root)
1. **VOLUMETRIC-SWEEP-PROMPT.md** — convert the 7 slab holdouts (godray, supernova, volumetric-cone, dust-cloud,
   ink-bloom, mist-drift, wispy-smoke) to smooth single-plane in-shader volume; re-grade the whole volumetric category;
   bake the photoreal/premium/4K "reject blocky/low-poly" bar into the user-advocate. FIRES FIRST.
2. **TEXT-SYSTEM-PROMPT.md** — real MSDF text (three-msdf-text-webgpu), font library + on-demand atlas cache, textSpec,
   bind real glyphs into the text-animation primitives (per-glyph/word/line), wire the Text toolbar group, AI texture-fill
   masking path. Closes criteria 26, 27.
3. **TOOLBAR-WIRING-PROMPT.md** — wire the Animation-picker (apply any of the 312 to a node as a Driver binding),
   Add-Element, and Group/Ungroup. Closes criterion 22 + the catalog payoff.

## Still-separate subsystem builds (honest — beyond "wiring", scope after the above)
- **Image / media-artifact group** (add/replace image artifacts, diffusion media pipeline in-canvas).
- **3D-object creation group** (add mesh/shape primitives; material editor already wired).
- **Add-from-Library / Change-Artifact**, and node-editor function-wiring (a node-editor-spec concern, not Canvas).

## §18 finish-line map (~31 atomic criteria)
- DONE/verified: 1 renderer · 3 modes (Galaxy/Canvas/Preview, one cached scene) · build+edit+rebuild · faithful build
  (node-own schema) · drivers · 12 catalog >=300 · 17 lighting · 18 capability tiers · material system.
- CLOSED BY the queued steps: 26-27 (Text System) · 22 (Group/Ungroup) · animation-picker binding · volumetric quality bar.
- REMAINING after the queued steps = the separate subsystem builds above (Image media, 3D-object creation) + final
  full-spec §18 sign-off pass via the parallel harness + user-advocate.

## Working rules carried forward
Pattern: self-contained prompt -> launch headless opus-4-8 (bypassPermissions, unset NODE_ENV, from git root) -> monitor
-> INDEPENDENTLY re-verify (report + view frames) -> report to Logan plain-language + gallery -> gate on his GO ->
checkpoint (standard exclusions) -> next. ONE browser-driving job at a time (Chrome/dev-server contention). Ultracode
(parallel subagents) for breadth; contract-first for shared-state changes. Verification is EVIDENCE-BASED + the
user-advocate "would a real user be pleased" gate, never assertion. No blocky/low-poly; photoreal premium bar.
