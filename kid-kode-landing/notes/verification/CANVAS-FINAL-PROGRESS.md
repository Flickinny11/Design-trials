# CANVAS PRODUCTION-FINAL — Resumable Progress Log

**Run start:** 2026-06-13
**Branch:** prism-editor-build (from git root /Users/loganbaird/Prototype_Prism/Design-trials)
**Model:** claude-opus-4-8 (CONFIRMED — harness env states "Opus 4.8 / claude-opus-4-8".
Fable-5 unavailable, silently falls back to opus-4-8 per launch-kit guard; this run is
deliberately pinned to opus-4-8 so no switch needed. Re-confirm after any sentinel resume.)

## Fal spend ledger ($50 budget; warn $25/$40; STOP $48)
| ts | model | call | est cost | running total |
|----|-------|------|----------|---------------|
| 2026-06-13 | fal-ai/flux-2 | KEY SMOKE 512² image (brass sphere) — OK 1.5s | $0.003 | $0.003 |

Machine ledger: `notes/verification/canvas-final/fal-ledger.json` (authoritative; this table mirrors it).

## Re-verified fal model picks (§20, June 2026; proven in-repo + web)
- **Image (text→image):** DEFAULT `fal-ai/flux-2` (FLUX.2 dev, ~$0.012/MP) · STUDIO `fal-ai/flux-2-pro` (~$0.03/MP).
  Result: `data.images[0].{url,width,height}`. SMOKE PASSED.
- **Image→3D (single-image, Logan: single-shot beats multi-view):** PRIMARY `fal-ai/hunyuan3d-v3/image-to-3d`
  (proven June showcase, ~$0.05–0.075); fallbacks `fal-ai/trellis`, `fal-ai/hyper3d/rodin`. Multi-view slots
  optional (kept as extra input; single-image is default). Result: `data.model_mesh?.url ?? data.glb?.url ?? …`.
- **Video (image→video / text→video):** `fal-ai/kling-video/v3/pro/image-to-video` (proven June, ~$0.10+/s) STUDIO;
  cheaper smoke option TBD at wiring. Result: `data.video.url`.
- **Edit/variation (Modify This / img2img):** `fal-ai/flux-2/dev/image-to-image` (prior image as `image_url` + prompt). Verify at wiring.
- **Code lane:** fal LLM passthrough (no Anthropic key in env — single provider/budget). Verify endpoint at wiring.
  "Code" = procedural scene-composition artifact spec (meshPrimitive+materialSpec+animationBindings JSON) onto EXISTING
  schema — NOT the out-of-scope full app-builder; behavior stays node-editor (§1.3).

## Architecture decisions (Phase 1)
- **Provider layer** `src/server/media-gen/`: `MediaProvider` iface; `fal-provider.ts` (default); `byok.ts` (stub+doc);
  `pricing.ts` (model→credit map); `credits.ts` (per-gen accounting, real spend only); `catalog.ts` (Prism-branded names →
  fal ids; NEVER surface "fal"). image-gen hook rewired to provider.
- **Asset persistence** `src/server/assets/store.ts`: `storeRemoteAsset(url, kind)` downloads fal output, content-hashes,
  writes `public/prism-mock/uploads/<hash>.<ext>` (png/jpg/webp/avif/glb/mp4/usdz). Multipart `/api/prism/assets` extended
  for glb/usdz/mp4/riv (§12.1).
- **Schema additions (additive INV-8/INV-18):** `PrismNode.artifactLibrary?: ArtifactLibraryEntry[]` (append-only, retains
  prior on Use This); `PrismNode.faceTextures?: FaceTexture[]` (per-face mapping → material array on primitive groups:
  Box=6/Cone=2/Sphere=1, matches §12.1 exactly).
- **Swap path:** canonical `updateNode`/`commitPreviewToSource` → `rebuildNode` (NOT regen-api — retiring FP-NE-5 path).
  Prior artifact pushed to artifactLibrary before swap.
- **Wizards:** Change-Artifact launcher (toolbar group + Inspector affordance) → Upload wizard (§12.1) + Prompt wizard
  (§12.2), portal modal windows, Observatory-Brass (animation-tools/ui kit), DESIGN-REFERENCES toolkit, mobile-aware.
  Interactive 3D result viewport = small R3F preview canvas (precedent: catalog hover tiles).

## Orchestration note (ultracode)
Coupled TS build spine (schema/provider/routes/persistence/wizard integration) → MAIN LOOP, contract-first (parallel agents
can't see each other's edits on a shared compiling project — false parallelism). FAN-OUT (Workflow/parallel agents) reserved
for genuinely independent parts: wizard leaf components (distinct new files, fixed contracts), Phase-2 system-test matrix,
Phase-4 per-criterion verification. Honors multi-agent-where-it-helps without sabotaging the build.

## Phase status
- [ ] Phase 0 — orient + scout codebase + re-verify fal models (IN PROGRESS)
- [ ] Phase 1 — Change-Artifact generation wired to fal (Upload + Prompt wizards, provider layer, credit meter)
- [ ] Phase 2 — Full human-grade system test (advocate, desktop + mobile, system-test matrix)
- [ ] Phase 3 — Fix + polish + optimize (MUST-FIX, cosmetic flags, perf, no-regression)
- [ ] Phase 4 — Production sign-off (§18 + §19 re-verify, DPR-2 evidence table, verdict)

## Setup notes
- Cleaned 4 stale worktrees (cool-gauss, pensive-kalam, relaxed-chaum, xenodochial) — only marker
  CLAUDE.md modified, 0 commits ahead. worktrees=0 confirmed.
- LOGAN-INBOX: no OPEN directives. Standing: DESIGN-REFERENCES.md required for new UI; raised
  material bar; advocate at DPR-2 + Slider-Revolution side-by-side. Violet-orb retint → brass/ice
  (inbox does NOT say keep).
- Seams: src/server/image-gen/generate.ts (UNWIRED hook), src/server/text-fill/generate.ts
  (UNWIRED hook), src/server/secrets/vault.ts (in-proc scaffold). @fal-ai/client ^1.4.0 installed.
  FAL_KEY present in .env.local.
