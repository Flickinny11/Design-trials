# UI WOW 2 — mobile excellence + keyframe editor + galaxy + toolbar/canvas to WOW. Lightning-fast, no AI-slop. (Claude Code, ultracode)
# Bar is WOW. "Acceptable/passes" == FAIL. Logan judges frames; monitor is the hard pre-judge and reviews every frame.

## MODEL & MODE
MODEL: claude-opus-4-8 (Fable-5 DOWN, silently falls back to opus; confirm modelUsage==claude-opus-4-8 at start AND
after any resume, record in ledger; never trust the label). 1M context. ULTRACODE: Dynamic Workflows, PARALLEL subagents
in verified waves, CONTRACT-FIRST. Branch prism-editor-build, from git root. AUTO-CKPT at every VERIFIED phase (standard
exclusions; worktrees==0). LOGAN-INBOX polling at phase boundaries. ANTI-STUCK: web-search CURRENT (June 2026) technique
after ~2 fails; never downgrade a dep; NEVER fake/assert — evidence (frames + interaction) or it didn't happen. ENV:
NODE_ENV unset; kill all browsers/dev servers at each phase end; free ports. Resumable: notes/verification/UI-WOW-2-PROGRESS.md.

## CONTEXT (changes priorities — read carefully)
This editor view will eventually be EMBEDDED inside an AI app-builder's PREVIEW PANE (streaming chat on the left),
expandable to fullscreen. So: it must be RESPONSIVE down to a constrained container width (not just full browser), and
LIGHTNING fast on mobile + constrained sizes, while staying the MOST premium 3D/wow it can be. NO AI-SLOP — we have a
massive integrated dependency stack (docs/prism/DESIGN-REFERENCES.md) that CAN BE COMBINED with each other (GSAP +
Lenis + cursor-physics + curtains-distortion + WebGPU particles + view-transitions, etc.) to substantially enhance BOTH
mobile and desktop. Use them, combined, for signature wow. Also USE the in-house prompt→texture feature on TEXT (poured
textures into glyphs) alongside 3D depth + shadows + the text designers.

## MONITOR FINDINGS (verified by eye — concrete leads, use them)
- KEYFRAME EDITOR: cramped strip at the bottom, half-hidden behind other panels, utilitarian dark tracks+diamonds.
  Logan's key interest: premium REDESIGN + a "smoky, high-tech, EXPANDING" open/close animation that is FAST and
  responsive (GSAP-choreographed reveal w/ smoke/blur/particle character — combined deps), works mobile + desktop.
- GALAXY VIEW: sparse — flat simple spheres, thin grey orbit lines, empty black. Make it WOW: photorealistic planets in
  the brass/bone/ice palette (real materials + lighting + glow/depth), glowing orbit arcs + beautiful node-connection
  lines, nebula/atmosphere/parallax depth, smooth camera. Combine deps. Still lightning-fast.
- MOBILE: the 11-item VERTICAL toolbar rail is too tall for phone; panels STACK and crowd. Use BEST JUDGMENT: make the
  toolbar expanding / horizontal-scroll / drawer so all buttons are reachable; replace stacked panels with bottom-sheets
  / one-at-a-time / full-screen sheets so it's clean; responsive at preview-pane widths; lightning-fast; premium 3D wow retained.

## PHASES (each: contract → parallel waves → verify → AUTO-CKPT; advocate at WOW bar, DPR-2 crops, desktop+mobile+constrained)
P0 MOBILE EXCELLENCE — the expanding/scroll toolbar + bottom-sheet panel system; responsive to constrained/preview-pane
   widths; lightning-fast (measure); premium retained. (the critical one — mobile MUST work as well as desktop.)
P1 KEYFRAME EDITOR — premium redesign + the smoky/high-tech/fast EXPANDING animation; full timeline UX (tracks, curves,
   keys, scrub) beautiful + responsive on mobile + desktop; combined deps for the reveal.
P2 GALAXY VIEW WOW — photorealistic planets + glowing orbits/connections + nebula/atmosphere/depth + smooth camera;
   combined deps; lightning-fast; works in constrained viewport.
P3 CANVAS + TOOLBAR WOW POLISH — combine deps for richer signature effects on the canvas chrome; showcase prompt→texture
   on TEXT (poured textures + 3D depth + shadows); elevate any remaining flat/cold chrome.
P4 PERFORMANCE — lightning-fast on mobile + constrained/preview-pane + desktop; tier-gated (INV-9); measure frame budget
   + interaction latency (<100ms) + memory; fix any jank; deviceLost 0.
P5 FULL INTERACTION VERIFICATION — advocate BUILDS+EDITS a real scene driving everything (toolbar, library, animation
   picker, keyframe editor expand, galaxy nav, fal regen, text w/ texture), DESKTOP + MOBILE + a CONSTRAINED (preview-
   pane-width) viewport. The 5 wow questions answered with cited frames (fonts beautiful? real 3D? actually photoreal?
   deps visibly wowing? user wow'd + intuitive?), bar = WOW or MUST-FIX, iterate fix-rounds → 0 MUST-FIX. SR side-by-side.

## VERIFICATION + GUARDRAILS
No-regression each phase (406+ catalog + 36 elements render/play/control + full suite 3349 + tsc 0-new). One renderer
(Three.js/TSL/WebGPU); no PixiJS/2nd renderer; no stock icons; no diffusion-drawn letterforms; no global-fps; no dep
downgrades; additive-only schema; INV-9 tiering; NO PURPLE; design-tokens-only styling; never surface "fal"; never print
FAL_KEY; secret-leak check before every checkpoint; assertion-based verification FORBIDDEN. fal budget: same $50 account
(~$0.3 spent); cumulative ledger, warn $25/$40, STOP $48.

## OUTPUT
notes/UI-WOW-2-REPORT.md: per-surface before/after (mobile toolbar+sheets, keyframe expand sequence frames, galaxy
before/after, canvas/text-texture), dependency-COMBINATION usage table (surface → which deps combined → what the user
sees), the interaction system-test matrix (desktop+mobile+constrained, 5 wow answers w/ frames), perf table (the
preview-pane + mobile numbers), SR side-by-side, no-regression, fal ledger, honest flags, AUTO-CKPT hashes. Frames under
kid-kode-landing/notes/verification/ui-wow-2/. Plain-language summary + honest WOW verdict. STOP.
