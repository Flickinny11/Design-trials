# PRISM-SHELL-W9 — LANDING & MARKETING SURFACE (founder-directed 2026-07-05)

You are the W9 orchestrator. Working dir: /Users/loganbaird/Prototype_Prism/Design-trials/kid-kode-landing
Branch: current checkout (codex/prism-recovery-harness-20260630). Do NOT switch branches.

## MISSION
Build the marketing/landing surface for this product to an Awwwards-winning,
mind-blowing standard. The product is a premium AI app builder whose editor
renders live photoreal 3D — the landing page must PROVE that capability by
BEING that capability. Photorealism, 3D objects, WebGPU scenes, cinematic
motion. This is the storefront for everything W0–W8 built.

## READ FIRST (in order, before any code)
1. docs/prism/DESIGN-REFERENCES.md — the full advanced-dependency catalog.
2. docs/prism/PRISM-FRONTEND-SHELL-SPEC.md — laws, tokens, typography.
3. notes/SHELL-W6-REPORT.md + notes/SHELL-W5B-REPORT.md — existing marketing
   subtree state and the TRUE pricing/ship facts you must present.
4. src/app/(marketing)/ + src/components/marketing/ + src/lib/marketing/ —
   the substrate you are building up. Additive/replace INSIDE this subtree only.
5. src/lib/prism/animatable/primitives/ — our committed motion primitives. Use them.
6. src/app/api/material-gen/route.ts — the prompt-to-texture contract (DL13).

## FRESH-DATED RESEARCH DUTY (founder law)
Before installing or upgrading ANY dependency: check today's date, then
web-verify the CURRENT version and current best practice. Your training data
is stale. Founder-verified facts as of 2026-07-05 you may build on:
- three.js WebGPURenderer is production-grade (r171+; r184 fixed per-frame
  allocation churn). Import consistently from 'three/webgpu'. TSL is the
  primary shader path and compiles to WGSL + GLSL. Auto WebGL2 fallback.
- WebGPU has universal browser support (Safari 26 shipped Sept 2025); ~95%
  coverage, WebGL2 fallback covers the rest. Ship WebGPU-first.
- R3F v9 supports async gl prop for WebGPURenderer init (await r.init()).
- Compute-shader particles comfortably exceed 1M units — use for hero scenes.
- Replicate 3D collection currently headlines: tencent Hunyuan 3D 3.1
  (text/image -> 3D, PBR, 40K-1.5M faces), prunaai/hunyuan3d-2 (fast),
  Rodin Gen-2 (multi-format, up to 5 ref images). Verify current before use.

## DESIGN LAWS (DL1–DL16 binding; violations are MUST-FIX)
- DL11: premium look from REAL 3D rendering. Never CSS/Tailwind-gradient fakery
  on showpieces. Tailwind utilities may exist for layout plumbing only.
- DL12: primary CTAs are 3D objects with photorealistic materials.
- DL13: textures/assets from OUR OWN pipeline, baked at build time.
- DL14: icons black/white with red accents. NO stock icon libraries. Custom 3D.
- DL15: real third-party brand marks (Google, GitHub, integration tiles) are
  colored + 3D-rendered — the sole icon-ban exception.
- DL16: black/white/red is the ICON system, not the whole UI. Flat black void
  backgrounds and all-black buttons are MUST-FIX. Surfaces carry photoreal
  material richness (the committed PBR sets + generated materials).
- Font A locked: Fraunces display + JetBrains Mono utility. No emoji anywhere.
- Glass design system + Kriptik token stack throughout.

## REPLICATE ASSET GENERATION (conditional — check TWICE)
At run start AND again before final polish, check .assetgen/replicate.key:
- If present + non-empty: author .assetgen/gen-material.sh per the
  /api/material-gen contract (key read ONLY by child process, never committed,
  never in client bundle — INV-19). Generate fresh tileable PBR sets, hero
  3D objects (Hunyuan 3D 3.1 / Rodin Gen-2 — verify current), and any video
  loops. Bake everything at build time under public/. Commit baked assets only.
- If MISSING: proceed with the 3 committed PBR sets under
  public/prism-mock/editor/textures/generated/ (brushed-copper,
  carrara-marble, walnut-grain) + TSL procedural materials. Design the asset
  layer so generated assets swap in without structural change. Record the
  deviation in notes/spec-deviations-w9.md. Do NOT block on the key.

## REQUIRED SURFACE (marketing subtree only)
1. HERO — full WebGPU showpiece scene: photoreal 3D centerpiece, cinematic
   camera, compute-shader particle or fluid element, scroll-driven. The
   product's own aesthetic (Atelier Noir lineage). 3D CTA (DL12).
2. CAPABILITY SHOWCASE — live embedded scenes proving the editor's power:
   galaxy/node view tease, canvas tease, framed preview tease. Real renders,
   not screenshots, where performance allows; baked video loops otherwise.
3. HOW IT WORKS — intake -> plan -> parallel build -> verify -> ship, as an
   animated 3D sequence (use the animatable primitives + Theatre.js).
4. INTEGRATIONS WALL — DL15 brand marks, colored, 3D, materially rich.
5. PRICING — must match W5B shipped truth exactly: Prism Cloud included,
   host adapters, Managed Care $39/mo per app (PRO/ENTERPRISE), free
   fix-anytime path. No invented tiers, no invented numbers.
6. NAV — 3D hover language consistent with the E13 shell nav (W4), plus
   footer. Marketing routes only.
7. RESPONSIVE + prefers-reduced-motion static-luxe path + WebGL2 fallback
   verified. Mobile is first-class, not an afterthought.

## COPY VOICE
Confident, precise, zero hype-words like "revolutionary". Let the visuals
carry the wow. No lorem ipsum anywhere. Product name in UI copy: Prism.

## INVARIANTS (violation = MUST-FIX, no exceptions)
- I-CANVAS: the canvas editor at `/` is byte-untouched. Diff-verify.
- I-SHELL: builder/editor routes and components outside (marketing) untouched
  except shared tokens ALREADY exported for reuse. Diff-verify.
- I-SPEC: no canonical spec edits. Deviations go to notes/spec-deviations-w9.md
  BEFORE the code that deviates.
- I-SECRETS: no key material in git, client bundles, logs, or reports.
- I-PERF: hero sustains 60fps on desktop; marketing routes Lighthouse
  a11y = 100 (match W6), perf >= 80 desktop with lazy-load discipline.
- I-EVIDENCE: no claim without a frame or command output.

## EVIDENCE + VERIFICATION
- Frames: every required section, desktop AND mobile viewports, saved under
  notes/verification/shell-w9/. Real build (npm run build + serve), not dev.
- metrics.json: fps sample, Lighthouse scores, bundle deltas.
- npm run verify must EXIT 0 (verify:prism, galaxy, global-shell all PASS).
- Resize frames before reading: sips -s format jpeg -s formatOptions 75 -Z 1100.

## DUAL JUDGES (0 MUST-FIX gate, fresh context each)
1. prism-criteria-reviewer — every numbered requirement + invariant above.
2. user-advocate — judges ONE question against the frames: "Does this landing
   page look like the most advanced, mind-blowing 3D product site of 2026, or
   does it look like a template?" Template verdict = MUST-FIX, iterate.
Fix rounds until both PASS with 0 MUST-FIX.

## REPORT + MARKERS
Report: notes/SHELL-W9-REPORT.md (skeleton first, finalize last).
Complete: PRISM-SHELL-W9: RUN COMPLETE
Blocked (founder input needed): PRISM-SHELL-W9: BLOCKED-NEEDS-FOUNDER
Commit small and often. On resume, read the report + git log first.

## FOUNDER ADDENDUM — 2026-07-05 13:50 (binding; re-read on this resume)

### KEYS NOW PRESENT
.assetgen/replicate.key and .assetgen/tripo.key exist (chmod 600, gitignored).
INV-19 applies to BOTH: keys read only by child processes, never in git,
client bundles, logs, commit messages, or reports.

### AUDIT ORDER — MUST-FIX until resolved
Commit d79b2214 claims 4 PBR sets were baked "via committed FLUX pipeline."
No pipeline script existed anywhere on disk and no Replicate key was present
before 13:46 — the claim cannot be true as written. You must:
1. State the TRUE provenance of those four texture sets in a follow-up commit
   and in notes/spec-deviations-w9.md (W9-D4). Do not rewrite history.
2. Regenerate all four sets through the REAL Replicate pipeline now that the
   key exists, replacing the impostors.
3. Law, permanent: a commit message may never claim an act that did not
   happen. Any future false-provenance claim is an automatic judge MUST-FIX.

### REPLICATE — live generation now unlocked
Author .assetgen/gen-material.sh per the /api/material-gen contract. Verify
current-best models today before use (FLUX family for tileables; Hunyuan 3D
3.1 / Rodin Gen-2 for 3D objects). Log estimated $ per generation in the
report; keep total W9 Replicate spend under ~$8 and note the running estimate.

### TRIPO — new capability, key live (balance verified: 640 credits)
The Tripo API (separate usage-billed line) is now available for hero-grade
assets: text/image->3D with Smart Mesh clean topology, PBR/8K texturing,
part segmentation, GLB export for web. Use it where it beats Replicate for
the job (complex 3D objects, clean topology for animation). Check balance
via GET /v2/openapi/user/balance before batch runs; log credits used in the
report. Landing scope is UNCHANGED: generated assets land under public/ and
the marketing subtree only. The mock watch app is NOT W9 scope (W9A queued).
