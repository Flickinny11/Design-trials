# TEXT SYSTEM — real MSDF text + bind it into the text-animation primitives (Canvas spec §7). (Claude Code, ultracode)

## MODEL & MODE
MODEL: claude-fable-5 (NOT opusplan; confirm on line 1). 1M context.
ORCHESTRATION: ULTRACODE — Dynamic Workflows, PARALLEL subagents in verified waves (reuse `parallel()`).
CONTRACT-FIRST: freeze the additive `textSpec` field + the MSDF TextObject API BEFORE parallel agents build against it.
MODE: APP IMPLEMENTATION, verified. Edits under kid-kode-landing/src/** (text subsystem + the text-animation
primitives + the Text toolbar group) + scripts/notes. Branch prism-editor-build. From git root. NO commit (staged).
Shut down browsers/dev servers; free the port. ANTI-STUCK: web-search CURRENT (June 2026) correct approach after ~2
fails; never downgrade a dep; never fake a pass.

## READ FIRST
PRISM-CANVAS-EDITOR-SPEC.md §7 (Text System), §5 (Text tools group), §2 decision 8, INV-11, §18 criteria 26-27, §20.
The existing text-animation primitives in src/lib/prism/animatable/primitives/** (they currently animate proxy/placeholder
text). The lighting/material systems just shipped (reuse env/material patterns; text fills can opt into lighting).

## DECISIONS (locked)
1. Letterforms are ALWAYS real font glyphs via MSDF (INV-11) — NEVER diffusion-drawn, never image-baked. AI may fill
   only the texture/material poured into the glyph coverage, never the letter shapes.
2. MSDF text object via `three-msdf-text-webgpu` (WebGPU/TSL; Troika is NOT WebGPU-ready and is FORBIDDEN), atlases via
   `msdf-bmfont`. RE-VERIFY at build (§20, June 2026) that this is still the best WebGPU MSDF text path; if something
   clearly better exists, use it — but it MUST be real-font MSDF/SDF, WebGPU/TSL-native, never diffusion text.
3. Core fonts ship as pre-baked MSDF atlases; a non-core font GENERATES its atlas on demand and CACHES it after first use.
4. `textSpec` is an additive node field (INV-8, safe default): font, size/weight/spacing, fills (solid/gradient/texture/
   AI-texture), shadow/outline/stroke/glow, alignment. Round-trips through save/reload.
5. Text objects are separable, individually selectable, movable, restylable, animatable — re-font/resize is INSTANT with
   NO re-render of any image artifact (criterion 26).

## SCOPE
- Build the MSDF TextObject (real glyphs in the one WebGPU scene) + the font system (full library list, on-demand atlas
  gen + cache).
- BIND real MSDF text into the text-animation primitives: per-glyph / per-word / per-line decomposition (SplitText-style)
  so stagger/scramble/wave/kinetic-typography/MSDF-dissolve run on REAL letterforms via the same timeline + Driver model.
- Wire the Canvas Text toolbar group (§5): font picker (full library; non-core -> generate+cache atlas), size/weight/
  spacing, fills/shadows/outlines/strokes/glow, presets, and the text-animation picker.
- AI texture-fill (§7.4): natural-language -> texture masked by glyph coverage (never draws letters). Re-verify the best
  current texture endpoint at build (§20); if the endpoint isn't wired this step, ship the masking path + flag the
  endpoint as the one remaining hook. Functional text wiring (does the button DO something) is a node-editor concern — out
  of scope here; this step is the VISUAL/animation text system in Canvas.

## VERIFICATION — full loop + USER-ADVOCATE
verify-catalog-parallel.mjs `--advocate`. Gates: criterion 26 (text renders as real MSDF, selectable+movable, re-font/
resize instant, no image re-render — prove it); criterion 27 (font picker lists full library; selecting a non-core font
generates+caches its atlas — prove the cache); the text-animation primitives now animate REAL glyphs per-glyph/word/line
(before/after frames); user-advocate PLEASED with cited evidence (legible, premium, smooth — not blocky); real-GPU
(webgpu); 312 no-regression; tsc 0-new; vitest green incl. new textSpec round-trip tests. Fix-don't-skip; honest flags.

## GUARDRAILS
Forbidden: Troika or any non-WebGPU text path; diffusion/image-baked text (INV-11); AI drawing letterforms; 2nd renderer;
global-fps; dep downgrades; assertion-based verification; non-additive schema.

## RESUMABILITY
notes/verification/TEXT-SYSTEM-PROGRESS.md per wave. Resumable; never restart from zero. Stage as you go.

## OUTPUT
notes/TEXT-SYSTEM-REPORT.md: what shipped (TextObject, font system, the bound text-animation primitives, Text toolbar
group, AI texture-fill masking path); criteria 26/27 proof; before/after frames of text animations on real glyphs;
advocate verdicts; 312 no-regression; metrics; tsc/vitest; honest flags. Frames under
kid-kode-landing/notes/verification/text-system/. NO commit — staged. Plain-language summary for Logan. STOP. HEAD stays
prism-editor-build.
