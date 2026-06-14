# 3D TEXT STYLING — progress ledger (resumable)

Branch: `prism-editor-build` · Model: **claude-opus-4-8** (confirmed via env at start; Fable-5 down → opus fallback) · Bar: **WOW**

## Phase status
- [x] P0 — Research + Understand DONE: architecture locked in DESIGN.md (opentype.js→ShapePath→ExtrudeGeometry; canvas/preview-app rig complete; stores/tier/fal mapped).
- [x] P1 — Schema + contract DONE: additive TextSpec (bold/italic/strikethrough/underline, extrude:TextExtrudeSpec), TextShadowSpec += blur/offsetZ, new contract-3d.ts (GlyphOutline*, FontOutlineRegistry, CreateTextObject3DFn). opentype.js→BUILD_ALLOW + package.json devDep; BufferGeometryUtils→RUNTIME_ALLOW. **tsc 0-new** (baseline = 9 pre-existing test-mock errors, none in touched files). vitest baseline capturing.
- [x] P2 — Font preview gallery DONE + VERIFIED. FontPicker.tsx rebuilt as a windowed scroll gallery (~15 DOM rows for 1935 families), search, Lenis momentum (existing useLenis), lazy per-visible-row Google @font-face (no CSP) + category system-stack fallback (font-preview-loader.ts). p6-gallery frame: Bebas Neue / Inter / JetBrains(mono) / Lora / Playfair(serif) / Space Grotesk / ABeeZee — EACH rendered IN ITS OWN FACE, category labels + CORE chips, premium machined-well + brass-active treatment. Prop contract preserved (+ optional disabled). 0 console errors.
- [x] P3 — True 3D extrude renderer DONE + RENDER-VERIFIED on real WebGPU. Server `outline-gen.ts` + `/api/prism/fonts/outline` (Inter unitsPerEm 2048, y-down) + client `font-outline-registry.ts` (9/9 test) + `text-object-3d.ts` (opentype cmds→ShapePath→ExtrudeGeometry per-glyph, merge w/ groups, face-UV remap to block 0..1, single lit MeshPhysicalNodeMaterial w/ TSL normalLocal.z face/side split — primitive-safe) + factory dispatch (`spec.extrude.enabled && tier!==T0` → 3D, else flat; bold→wght700; graceful flat fallback) + `NodeContext.tier` seam. **Harness `scripts/verify-text-3d.mjs`** (real Chrome WebGPU, DPR2, authentic Add-Text→preview→Save→Save-and-Rebuild, reorients real mounted group for depth shots). Result p3-hero: backend=webgpu, 5 glyphs, **depthZ=0.2356** (real extrusion), is3d=true, castShadow=true, 0 console errors. Frames show gold extruded PRISM w/ volumetric side walls + bevel highlights, real Inter-bold outlines, metallic (not env-blue) in canvas. tsc 9 baseline/0-new.
  - P7 framing follow-ups: center the 3D node + close/avoid Inspector overlap for clean hero; aim sharpness crop at the text; make cast shadow prominent (P4).
- [x] P4 — Real controllable drop shadow DONE + VERIFIED (3D). Finding: shadow CONTROLS existed in TextToolsFlyout but the renderer NEVER consumed textSpec.shadow (the "incomplete styling"). Now `text-object-3d.ts` builds a flat block-silhouette shadow group (ShapeGeometry, unlit MeshBasicNodeMaterial) offset (offsetX/Y/Z em), tinted shadow.color @ opacity, blur via golden-angle stacked taps (tier-capped 6/8), layered with the genuine PCFSoft scene shadow. p4-shadow: blue PRISM pops with soft dark offset shadow, 0 errors. DEFERRED: flat-MSDF-mode shadow (lower priority; 3D is the focus) → polish.
- [x] P5 — Fill on 3D faces DONE + VERIFIED (real fal). (a) p5-texface: abstract-gold texture poured across 3D FACES (UV remap spans whole word) + distinct metallic side walls. (b) p5-ai: REAL fal-ai/flux-2 generated 4 textures ('molten copper relief, hammered metal'), wired:true, applied as ai-texture on the 3D faces — copper PRISM pops, 0 console/network errors, depthZ=0.236. Server: generateTextFills→falProvider.generateImage + storeRemoteAsset, /prism-mock/uploads/, 10-count default, INV-11 negative prompt, FP-07-clean route (Boolean(process.env.FAL_KEY) probe — no value leak). Client: FillEditor "Generate with AI" (cost-gated explicit click; procedural instant preview); TextFillPreviewStrip renders TRUE 3D when extrude.enabled (+lights). fal ledger: +$0.048 → cumulative $0.479 (<<$25). DEFERRED to P7: VISUAL capture of the 3D preview strip (headless flyout-open mechanics flaky; strip code is equivalence-verified — same createTextObject3D; advocate drives the UI in P7).
- [x] P6 — Wire controls + store round-trip DONE + VERIFIED. TextToolsFlyout: Style flags B/I/S/U (write top-level bold/italic/strikethrough/underline); "3D · extruded geometry" section (Flat/3D toggle → extrude.enabled, Depth, Bevel off/on, Bevel Size, Metalness, Roughness, Side color); Shadow += Blur + Offset Z faders. All route via usePreviewStateStore (FP-15-clean). INV-9 host tier wired: GraphScene createUnifiedRenderer → setSharedNodeContextTier(detectCapabilityTier(renderer,{isMobile}).tier) → ctx.tier → factory gate. p6-ui/p6-gallery frames confirm controls render w/ material treatment + drive the 3D text (3D toggle active, gold extruded scene). Flat↔3D kind-switch applies via Save-and-Rebuild (RA-16); params tune live. 0 console errors.
- [ ] P7 — Verify (advocate builds in real app, frames, no-regression) + report

## Established facts (audit before any implement)
- HEAD `3808db73` "launch kit" = harness/resume scaffolding ONLY (4 root files); NO feature code shipped yet → fresh build on P1 MSDF foundation.
- P1 text system: `src/lib/prism/text/{contract,font-registry,text-object,create-text-node,msdf-layout,msdf-material}.ts`. Letterforms = real MSDF glyphs (INV-11). `TextSpec` @ `src/lib/prism-graph/types.ts:331`; `TEXT_SPEC_DEFAULT` @ :355.
- Fonts on disk: ONLY `public/fonts/Inter-Variable.ttf` (+ 3 UI woffs). 1,935 families come from on-demand Google Fonts atlas bake (`/api/prism/fonts/atlas`). True extrude needs OUTLINES → fetch TTF + parse with opentype.js (new additive dep; update dependency-allowlist-check.sh).
- Anti-drift FP-02 blocks ONLY `new THREE.TextGeometry(` — `ExtrudeGeometry` is permitted. opentype.js→THREE.Shape→ExtrudeGeometry keeps real outlines (INV-11) and avoids forbidden TextGeometry/typeface path.
- fal ledger: cumulative $0.431 prior; seeded `notes/verification/text-3d/fal-ledger.json`. STOP $48.

## TextSpec today (types.ts:331) — additive targets
content, fontFamily, fontSize, fontWeight, letterSpacing, lineHeight, align, fill(TextFill), outline, glow, shadow(TextShadowSpec: color/offsetX/offsetY/opacity — **no blur, no offsetZ**), opacity, decompose.
ADD (additive, optional): style flags (bold/italic/strike/underline); `extrude` sub-spec (enabled, depth, bevel*, curveSegments, faceFill/sideFill routing); shadow.blur + shadow.offsetZ. `receivesLightingDefault`: mesh=LIT — 3D text routes LIT.

## LOGAN-INBOX standing directives folded in (DONE-section, but load-bearing here)
1. Prompt→texture picker = **10 candidates, each the USER'S OWN selected text** with the texture applied — and the 3D-extrusion of that text is the **explicitly-flagged backlog item = THIS task**. Upgrade `TextFillPreviewStrip.tsx` (already 10 flat) to render TRUE 3D.
2. Retina DPR-2 tack-sharp → high curveSegments/bevelSegments; advocate judges at DPR2 w/ zoomed crops vs "pro 3D designer" + Slider-Revolution side-by-side ("must visibly outclass").
3. Every new UI surface = design-system MATERIAL treatments (never flat) + deliberate typography hierarchy.
4. STANDING: `docs/prism/DESIGN-REFERENCES.md` REQUIRED reading + toolkit for any new UI (GSAP installed; Lenis-class inertia for gallery scroll; implement DOM-era techniques natively in TSL).

## Verification plan (harnesses to reuse — real Metal GPU dev server + user-advocate agent)
- `scripts/useradvocate-capture.mjs` + `useradvocate-verdict-schema.mjs` — advocate evidence capture pattern.
- `scripts/capture-text-closeups.mjs` / `verify-text-system.mjs` — text frame capture.
- `scripts/verify-editor-shadow.mjs` — shadow verification (P4).
- `scripts/verify-editor-runtimes.mjs` — two-runtime (canvas + preview) snapshot.
- NOTE: kv_*/KripVerify + chrome-devtools MCP are NOT connected this session → drive via Playwright harness (real-GPU), judge frames with the `user-advocate` subagent. Assertion-only verification FORBIDDEN.

## Checkpoints (hash — phase)
_(none yet)_

## Log
- P0 started: parallel research+understand workflow launched (wf_81bee7f5-d53).
