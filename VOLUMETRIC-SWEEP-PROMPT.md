# VOLUMETRIC SWEEP — kill the blocky slab look catalog-wide; premium 4K motion-graphics quality. (Claude Code, ultracode)

## MODEL & MODE
MODEL: claude-opus-4-8 (NOT opusplan; confirm on line 1). 1M context.
ORCHESTRATION: ULTRACODE — Dynamic Workflows, PARALLEL subagents (reuse `parallel()` in
notes/catalog-finish-workflow.mjs), one Opus subagent per tile. CONTRACT-FIRST: none needed (the additive `volumetric`
tag already exists); this sweep REVERSES the slab approach for the named tiles.
MODE: APP IMPLEMENTATION, verified. Edit only the named primitive files under
kid-kode-landing/src/lib/prism/animatable/primitives/** + their tests. Branch prism-editor-build. From git root.
NO commit (staged for Logan). Shut down every browser/dev server you start; free the port.
ANTI-STUCK: after ~2 fails, web-search the CURRENT (June 2026) correct technique, root-cause, retry. NEVER downgrade a
dep, never take the blocky/easy path, never fake a pass.

## WHY (the quality bar — read carefully)
The slab-stack depth mechanism makes volumetrics look BLOCKY / stacked / jagged — like low-poly Minecraft game art,
animated in chunks. That is the WRONG direction. Prism primitives are the building blocks users drop into real 3D
scenes; they MUST look PHOTOREALISTIC, premium, smooth, 4K motion-graphics quality. The six-tile pass already proved
the fix: set `volumetric:false` -> ONE flat quad (no slabs, no seams by construction) and build the volume ENTIRELY
IN-SHADER (layered domain-warped >=5-octave smooth fbm + depth-fade; glow/sparkle where apt). Apply that proven recipe
to every remaining offender.

## SCOPE — the 7 slab holdouts (convert each to smooth single-plane in-shader volume)
`godray`, `supernova`, `volumetric-cone`, `dust-cloud`, `ink-bloom`, `mist-drift`, `wispy-smoke`.
For each: set `volumetric:false`, rebuild the look in-shader to read as a real, smooth volume (no banding/seams/blocks),
preserve its uniforms/schema/userData and its controls (each control must stay live), keep it premium and in-gamut.
ALSO re-grade the WHOLE `volumetric` category (incl. the 6 already fixed) so the catalog is CONSISTENT — flag any other
tile that still reads blocky/flat/muddy and fix it the same way.

## VERIFICATION — full loop + the USER-ADVOCATE with the photoreal bar
Run scripts/verify-catalog-parallel.mjs with the `--advocate` stage (the user-advocate built last step). ADD this bar to
the advocate's rubric for volumetrics (and record it in notes/verification/useradvocate/RUBRIC.md):
> "Reject as MUST-FIX anything that looks BLOCKY, stacked, tiled, jagged, low-poly, or game-engine-cheap. The bar is
>  photorealistic, smooth, premium 4K motion-graphics. A user dropping this into a real 3D scene must say 'that looks
>  professional', not 'why does this look like Minecraft'. Cite the frame + the bandingScore."
Gates per tile: renders+plays+controls live; the advocate returns PLEASED with cited smooth-volume evidence (low
bandingScore); art-fidelity reviewer agrees; real-GPU (backend=webgpu). No-regression: all 312 still render+play+control.
tsc 0-new (hold baseline 10); vitest green. Fix-don't-skip; honest FLAG only if a tile truly can't reach the bar after
real effort (never fake, never rubber-stamp).

## GUARDRAILS
Forbidden: blocky/slab depth as the look; 2nd renderer/PixiJS; diffusion-drawn text; global-fps; dependency downgrades;
non-tiered heavy effects (INV-9); assertion-based verification (evidence required); non-additive schema changes.

## RESUMABILITY
notes/verification/VOLUMETRIC-SWEEP-PROGRESS.md per tile (before/after + advocate verdict + tsc/vitest). Resumable.

## OUTPUT
notes/VOLUMETRIC-SWEEP-REPORT.md: before/after frames for all 7 (+ any extra offenders fixed); the advocate verdict per
tile proving smooth (low bandingScore, PLEASED); 312 no-regression; metrics; tsc/vitest; honest flags. Frames under
kid-kode-landing/notes/verification/volumetric-sweep/. NO commit — staged. Plain-language summary for Logan with the
headline before/after. STOP. HEAD stays prism-editor-build.
