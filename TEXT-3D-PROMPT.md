# 3D TEXT STYLING — true extruded 3D text + full style controls + prompt-to-texture on 3D faces. (Claude Code, ultracode)
# Bar is WOW. Logan judges frames; monitor is hard pre-judge. Interactive + visual verification.

## MODEL & MODE
MODEL: claude-opus-4-8 (Fable-5 DOWN, silently falls back to opus; confirm modelUsage==claude-opus-4-8 at start AND after
any resume; record in ledger; never trust the label). 1M context. ULTRACODE: Dynamic Workflows, PARALLEL subagents,
CONTRACT-FIRST. Branch prism-editor-build, from git root. AUTO-CKPT at every VERIFIED phase (standard exclusions;
worktrees==0). LOGAN-INBOX polling at phase boundaries. ANTI-STUCK: web-search CURRENT (June 2026) technique after ~2
fails; never downgrade a dep; NEVER fake/assert — evidence (frames + interaction). ENV: NODE_ENV unset; kill browsers/dev
servers at each phase end. Resumable: notes/verification/TEXT-3D-PROGRESS.md.

## WHY (Logan, on the live app)
The text styling is incomplete and the in-scene text is FLAT (MSDF glyphs on a plane), not true 3D. Users need to fully
style text and make it genuinely 3D and "pop": select text → choose font (scroll a preview gallery of the ~1,935-font
library, SEE each font rendered) → bold/italic/strikethrough/underline → make it 3D → adjust depth/bevel, shadow
(offset/position + color + opacity + blur), full color + fill opacity → then pour a prompt→texture onto the 3D text to
make it pop. RESEARCH FIRST (June 2026): the best WebGPU/Three.js approach for true EXTRUDED 3D text from real font
outlines (ExtrudeGeometry from font typefaces / outline triangulation / SDF-raymarched volume) — letterforms MUST stay
real font outlines (INV-11; never diffusion/fake). Keep the existing flat MSDF mode; ADD a true-3D extruded mode.

## SCOPE
1. FONT PICKER: scrollable preview gallery — each entry rendered in its own font (lazy/virtualized for ~1,935 families +
   variable axes); search; on-demand atlas/outline load + cache. Bold / italic / strike / underline controls (real font
   styles where available; synthesized where not, clearly).
2. TRUE 3D TEXT: a "3D" toggle that extrudes the real font outlines into lit, shadow-casting geometry — depth + bevel
   controls; rotatable/visible sides in 3D space; participates in the lighting/material system (photoreal). Tier-gated
   (INV-9): true-3D on T1+, graceful fallback (flat MSDF w/ pseudo-depth shadow) on T0.
3. SHADOW: offset X/Y (+ Z for the 3D case), color, opacity, blur — real drop shadow, not just glow.
4. FILL: full color + fill opacity + the existing Solid/Gradient/Texture/AI prompt→texture — and the texture/AI fill must
   apply to the 3D text FACES (and configurably the bevel/sides) to make it pop. Outline + glow retained.
5. All composable + additive textSpec (round-trips save/reload). Works in Canvas + renders in Preview.

## VERIFICATION (interactive + visual, desktop + mobile)
Advocate BUILDS 3D text in the real app: pick a font from the preview gallery, bold/italic, toggle 3D, set depth+bevel,
set shadow (offset/color/opacity), pour an AI texture onto the 3D faces, rotate the camera to SEE real extruded depth +
sides + shadow + texture. Cite frames. Bar = WOW (extruded text that pops, photoreal, real font outlines) or MUST-FIX.
DPR-2 zoom crops. No-regression (existing flat text + 406 catalog + suite + tsc 0-new). fal budget: same $50 account,
cumulative ledger, warn $25/$40, STOP $48.

## GUARDRAILS
One renderer (Three.js/TSL/WebGPU); real-font letterforms only (INV-11), never diffusion text; no 2nd renderer; no stock
icons; no global-fps; no dep downgrades; additive-only schema; INV-9 tiering; NO PURPLE; design-tokens-only; never
surface "fal"; never print FAL_KEY; secret-leak check before checkpoints; assertion-based verification FORBIDDEN.

## OUTPUT
notes/TEXT-3D-REPORT.md: font-preview-gallery before/after, the 3D extrude controls + frames (rotated to show depth/
sides), shadow/fill/texture-on-3D evidence, interactive build walkthrough, no-regression, fal ledger, honest flags,
AUTO-CKPT hashes. Frames under kid-kode-landing/notes/verification/text-3d/. Plain-language summary + WOW verdict. STOP.
