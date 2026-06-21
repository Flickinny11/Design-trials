# PRISM CHROME OVERHAUL — RUN 1 (Premium 2D UI Chrome System)

You are an autonomous senior build agent for **Prism**, a WebGPU/Three.js graph-native 3D app-builder.
Repo root: `/Users/loganbaird/Prototype_Prism/Design-trials` (git root, branch `prism-editor-build`). App lives in `kid-kode-landing/`. Always `unset NODE_ENV` before npm/node.

## THE PROBLEM YOU ARE FIXING
The 3D SCENE is sophisticated and premium. The **2D UI CHROME is not** — toolbars, buttons, the hub switcher, inspector panels, fonts, colors, and alignment currently look flat, templated, "AI-slop." This is the #1 quality gap. Your job is to make the chrome as premium as the scene.

## THE BAR (non-negotiable)
- Target = **Awwwards / WOW**. "Competent Tailwind" or "clean flat UI" == **FAIL**.
- **HEURISTIC (encode this in every decision):** *If you think you have used the premium dependencies "enough," you have NOT — it needs more.* Push the toolkit MAXIMALLY. The verification gate explicitly fails work that looks merely competent.
- It must also **FEEL fast** — performance is a first-class gate, not an afterthought (see §PERFORMANCE). A gorgeous chrome that stutters == FAIL.

## SCOPE — RUN 1 (do this, not everything)
Build the premium chrome **as reusable libraries**, then apply them to the **main editor chrome**: the **top toolbar**, the **hub switcher**, the **left + right inspector panels**, and **primary + secondary buttons**. Nail these as a proven-premium SYSTEM. (Follow-up runs propagate to modals, node-editor chrome, galaxy controls — NOT this run.)

## MANDATORY TOOLKIT — read first, then use it
1. **READ** `kid-kode-landing/docs/prism/DESIGN-REFERENCES.md` (1066 lines — the curated Awwwards-level toolkit; it deliberately EXCLUDES basic CSS/Tailwind) and `kid-kode-landing/docs/prism/CINEMATIC-PRIMITIVES-LIBRARY.md` (magnetic-cursor + TSL shader lib). Use these. Do NOT default to flat Tailwind/CSS.
2. **Refraction glass** (toolbar, inspector panels): a REAL WebGL/WebGPU refraction layer that **samples the 3D scene behind it** (the actual backdrop) with **IOR ≈ 1.5**, **beveled SDF edges**, **rim + specular light**, **frost**, **chromatic aberration**. Use a **three-layer composite**: the refraction layer (WebGL) sits UNDER the crisp DOM text/icons — **never filter the text container** (preserves antialiasing). Inspect the existing renderer and pick the cleanest integration (full-screen overlay pass sampling the scene framebuffer + DOM-aligned panel rects, OR a DOM-mapped shader via the toolkit's OGL/curtains.js). **FORBIDDEN: `backdrop-filter`/glassmorphism — that is a hard fail.**
3. **True-3D hero controls** (hub switcher + primary action buttons): ACTUAL 3D beveled geometry — real thickness, **photoreal material** (machined metal / ceramic / glass per the Observatory Brass palette), **perspective**, **cursor-tracked specular highlight**, and a **physics press** on click (isotropic expansion + chromatic burst). Use the existing Three.js/TSL renderer.
4. **Glass-DOM secondary buttons**: lighter refraction shader, crisp text, real hover/press depth.
5. **Micro-interactions EVERYWHERE**: magnetic cursor, velocity-aware dispersion, GSAP-timed hover/press, smooth state transitions. Nothing should snap or feel static.
6. **Typography** — premium **variable** pairing. Self-host a mechanical-precision grotesque for display + UI (**Aeonik**, or if licensing blocks it, **Neue Montreal** or **Switzer** — pick ONE premium variable face, self-host the woff2). Use a premium mono (**Geist Mono** or similar) ONLY for code / numeric data readouts — **never** as the primary UI font. **The current fonts are the worst part — do not keep them. Surface your chosen face in the report for Logan's veto.**
7. **Color**: OKLCH token system, **Observatory Brass** (graphite / bone / brass / ice). **NO purple anywhere** in Prism-owned UI (third-party brand logos may keep their own colors).
8. **Alignment / grid**: fix the amateur alignment — consistent 8pt grid, a real spacing scale, optical alignment, proper visual hierarchy. Misalignment is a fail.

## PERFORMANCE (first-class gate — must measure, not assume)
- GPU-tier detection (T0/T1/T2); gate effect intensity by tier.
- Offscreen-render the glass refraction at reduced resolution + upscale; **only re-render glass when the scene/layout actually changes** — do not burn GPU every frame when static.
- Coalesce/throttle refraction updates; debounce resize; **LOD on effects** (drop chromatic aberration + reduce sample counts on low tier).
- DOM animations compositor-friendly: transform/opacity only; `will-change` sparingly.
- **Budgets:** 60fps desktop, **≥30fps constrained-preview + mobile**, interaction latency **<50ms**.
- Pull `DESIGN-REFERENCES.md` §16 (Performance Patterns) AND **web-search current (June 2026) techniques for the CUSTOM pieces** — GPU refraction perf, offscreen-canvas upscaling, WebGL/WebGPU texture-sampling optimization. This is custom; the references will not have an exact recipe. Research it. Do not reach only for what you already know.

## FORBIDDEN (any of these = hard fail)
`backdrop-filter`/glassmorphism · flat Tailwind chrome · generic system mono as the primary font · purple in Prism UI · any effect that drops performance below budget.

## REQUIRED (all must be true to pass)
real scene-sampling refraction · real 3D depth on hero buttons · premium variable typography · OKLCH Observatory-Brass palette · pervasive micro-interactions · performance budgets met (measured).

## WAVES — commit at EACH boundary (commits are how progress is detected)
- **W1** — Typography (self-hosted premium variable woff2) + OKLCH token system + 8pt grid/spacing/alignment foundation. **Commit.**
- **W2** — Refraction-glass overlay system (scene-sampling, IOR/bevel/rim/frost/chromatic-aberration, three-layer composite) applied to toolbar + inspector panels. **Commit.**
- **W3** — True-3D hero controls (hub switcher + primary actions) + glass-DOM secondary buttons. **Commit.**
- **W4** — Micro-interactions (magnetic cursor, physics press, velocity dispersion, GSAP timing). **Commit.**
- **W5** — Performance optimization + tier-gating; hit the budgets. **Commit.**
- **W6** — Verification gate + sign-off. **Commit.**

## VERIFICATION GATE (evidence over assertion — this enforces the bar)
Run the **user-advocate computer-use sub-agent** (drive the REAL app like a non-technical user — interact, don't just inspect) PLUS a numeric harness. Verify, with cited evidence:
(a) refraction is REAL — implementation has no `backdrop-filter`; visually the scene refracts/distorts through the glass; (b) hero buttons show real depth/perspective/specular and the physics press fires; (c) micro-interactions are present + smooth; (d) **performance budgets met — MEASURE fps + interaction latency and report the numbers**; (e) NO forbidden patterns anywhere; (f) typography is the premium variable pairing (not system mono); (g) NO purple.
**The "enough = not enough" rule applies to the gate:** if the chrome reads as "nice Tailwind" or "competent but flat," it FAILS — push further and re-verify. Do not mark a criterion done on assertion; show command output or screenshots.
Capture frames (desktop 1440px + constrained-preview ~820px) to `kid-kode-landing/notes/verification/chrome/` for Logan's final eye. Resize before reading: `sips -s format jpeg -s formatOptions 72 -Z 1300 <png> --out /tmp/x.jpg`.

## NO-REGRESSION
`unset NODE_ENV && npx tsc --noEmit` clean · prod build passes · vitest passes · the 3D scene still renders correctly. Don't break the scene to style the chrome.

## REPORTING + MARKERS
- Append to `kid-kode-landing/notes/MONITOR-FEED.md` at each wave boundary + on completion/blocker: `[<HH:MM:SS>] CHROME <phase>: <status> | <scores> | <verdict> | <next>`.
- Maintain a ledger at `kid-kode-landing/notes/verification/CHROME-PROGRESS.md` (one row per wave, updated at wave DONE).
- Write `kid-kode-landing/notes/CHROME-REPORT.md`. On FULL completion (all criteria pass with evidence), write the exact marker line **`CHROME: RUN COMPLETE`** to that report.
- Before each wave, check `kid-kode-landing/notes/LOGAN-INBOX.md` for mid-run directives and obey them.

## RESUME STATE — IMPORTANT
W1 (Switzer + OKLCH Observatory-Brass tokens + 8pt grid) and W2 (refraction-glass system on toolbar + inspector panels) are **ALREADY COMPLETE and committed** — verify via `git log` (commits include `c21c3aa0` = W1, `8ac4149b` = W2) and the ledger at `kid-kode-landing/notes/verification/CHROME-PROGRESS.md` (both rows marked DONE). **BEGIN AT W3** (true-3D hero controls + glass-DOM secondary buttons), then W4 → W5 → W6. **Do NOT redo W1 or W2.** Read the design references first if not already in context. If git/ledger somehow show W1/W2 missing, resume from wherever they actually left off.
