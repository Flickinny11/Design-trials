# IMAGE/MEDIA REPORT — P3 of the Canvas completion run

**Branch:** `prism-editor-build` · **Model:** claude-fable-5 · **Date:** 2026-06-10
**Spec:** PRISM-CANVAS-EDITOR-SPEC.md §5 (Image tools), §6 (Add Object / lifecycle). Additive schema: `ImageSpec { fit, crop, cornerRadius, opacity }` + `PrismNode.imageSpec`.

## What shipped
- **Upload + URL artifacts:** `POST /api/prism/assets` — multipart, mime-sniffed (sharp), 12MB cap, sha256 content-addressed under `public/prism-mock/uploads/` (idempotent; client names never touch the filesystem). Client seam `uploadImageAsset(file) → {url,width,height}`.
- **Image toolbar group (wired):** drop/browse upload + paste-a-link → image-plane node born Populated (aspect-sized, distinct spawn, friendly caption); Replace (file/link) on any image element via the sanctioned route + surgical rebuild; presentation controls (Cover/Contain/Stretch chips, crop x/y/w/h faders, rounded corners, opacity) writing `imageSpec`.
- **imageSpec rendering:** per-node texture-clone UV windows (loader-cache Texture never mutated; clone shares the GPU image), 'contain' letterboxing via mesh scale, TSL rounded-rect SDF mask (uniform-driven — radius edits never recompile), opacity multiply; instant in-place restyle via `userData.imageHandle.setSpec` + a GraphScene effect (source ⊕ preview overlay). Parallax planes keep vertex relief under crops (UV-distortion flourish drops only for non-identity windows — documented trade).
- **Bubble "Add Object" is real for images:** inline upload/link panel populates the bubble (`sourceAsset` + renderMode) and runs the surgical rebuild — Bubble → Populated → Built chips track reality; 3D/video/code stay honestly "coming soon — needs the build pipeline".
- **Generation honestly flagged:** `src/server/image-gen/generate.ts` + `/api/prism/image-gen` return `{wired:false}` (typed for drop-in wiring; FLUX-family endpoint documented for re-verify at wiring time); the UI shows a plain-language disclosure and never fakes output.

## Verification
- Drive `scripts/verify-image-media.mjs`: **5/5 PASS** on real GPU — upload idempotency, URL→textured plane, instant restyle with material+mesh identity held (no rebuild), bubble populate via Add Object, disclosure with zero fake nodes. Frames 01–04 + results.json.
- Advocate round 1: ANNOYED/BLOCKED — 2 MUST-FIX (sha-hash leaked as picture name; disclosure not visible in any frame). Fixed (hex/uuid-stem names fall back to friendly captions at the shared derivation root; drive scrolls the inline notice into frame) → **re-grade PLEASED/PASS**.
- 312-catalog: **306/312, deviceLost 0** — fails exactly the documented pre-existing 6 (4 load-flakes recovered 4/4 on quiet retry).
- tsc 0-new; vitest +81 new tests (30 imageSpec + 31 UI helpers + 20 assets/add-object), full suite at the 21-fail legacy baseline.

## Retina-softness ownership (carried from the sharpness directive) — measured truth
The pipeline is native-res and DPR-correct (no resize anywhere; backing stores at min(DPR,2)). Measured: a default-zoom feature card draws ~386×241 device px from a 1024² source (~2.6× oversampled — sharp); a full-viewport close-up draws ~2000 device px from ≤1024 source px (0.5× undersampled — soft). **The remaining softness ceiling is the 1024² mock ASSET resolution**, fixable only by re-provisioning higher-res assets (harness-side generation) or user uploads at native resolution (now supported). Also flagged: `loadHubMockupTexture` caps hub BACKDROP mockups at 1024px (separate path; P5/chrome owner).

## Honest flags
1. Generation endpoint inert by design (`{wired:false}`; no FAL key here).
2. Parallax UV-distortion flourish drops under non-identity fit/crop windows (vertex relief preserved).
3. First cornerRadius>0 on a legacy plain-material plane upgrades it in place to its node-material twin (safe — all paths render under WebGPURenderer).
4. Advocate's non-blocking nits → P5: patterned drive fixture, pre-populate bubble frame in this bundle, dissolve-particle page-edge overflow, favicon 404.
5. `public/prism-mock/uploads/` is committed content-addressed test data for now (gitignore decision deferred).

## Plain-language summary for Logan
Pictures are first-class now. Drop or browse a file (it's stored content-addressed in the app) or paste a link, and it lands in the 3D scene as an image element. Select it and shape it live — cover/contain/stretch, crop from any edge, round the corners, fade the opacity — all instant, nothing re-renders the picture itself. Swap the picture on any image element in two clicks. The glass bubble from Add Element can now actually be given a picture ("Add Object") and becomes a real element on the spot. And the Generate button tells you the truth: cloud image generation isn't hooked up yet — no fake results. On sharpness: your pipeline is clean at Retina; what's still soft up close is the 1024-pixel mock images themselves — new uploads at higher resolution render tack-sharp.
