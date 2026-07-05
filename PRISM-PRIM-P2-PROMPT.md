# PRISM PRIMITIVE SYSTEM — PHASE P-2: the MATERIAL SYSTEM — curated library + shared IBL + prompt-to-texture. IN-ENGINE. ZERO DOM/CSS. Verified HEADLESS, matching the approved glass look.

ULTRACODE build agent for Prism. Root /Users/loganbaird/Prototype_Prism/Design-trials (branch prism-editor-build). App kid-kode-landing/. `unset NODE_ENV`. bypassPermissions. Commit+push every wave. BUILD ON committed P-1 (the parametric primitives + Inspector).

## NOTIFY OFTEN
`osascript -e 'display notification "<msg>" with title "Prism · PRIM-P2" sound name "Glass"'` at each wave START, COMMIT, verification START, each behavioral check, advocate, blocker.

## GOAL — build per docs/prism/PRISM-PRIMITIVE-TEMPLATE-SYSTEM-SPEC.md §2
- A structured MATERIAL LIBRARY as parametric TSL node-materials: Metals, Stones, Glass, Gems, Woods, Ceramics, Fabrics, Exotic (iridescent/oil-slick/patina). Each = editable params (baseColor/tint, roughness, metalness, clearcoat, transmission, IOR, thickness, sheen, anisotropy, normal/displacement, wear). Real PBR + transmission + clearcoat.
- ONE shared HDRI/IBL environment so EVERY material refracts/reflects correctly. Reuse the toolbar's env + the committed worn map sets (oxblood/emerald/sapphire/bronze/gunmetal) as the seed metals.
- PROMPT-TO-TEXTURE integrated (REUSE the existing pipeline; keys in .assetgen/): a surface description -> generate a MATCHED PBR set (ALL maps from one latent + DELIT — lighting stripped from albedo) -> save as a reusable material + apply. Makes the library effectively infinite.
- Materials = a reusable registry keyed by id; P-1 primitive schemas reference a material by id. Reviewable: extend `/primitive-lab` (or `/material-lab`) to apply + preview materials on primitives.

## AESTHETIC GROUND TRUTH
The approved `/toolbar-chassis` + `/keyframe-editor` define the bar: real worn brushed-metal + real transmission glass under studio IBL + AgX. Materials PASS style IFF they reach that photoreal, refracting, worn quality. NO glossy plastic, NO flat.

## STACK — WebGL ONLY. LAW.
TSL node-materials (WebGPU r184+). NO DOM/CSS/Tailwind/`<Html>`. no-dom-ui-gate PASS, node-authorship-gate PASS.

## VERIFICATION — APPLY docs/prism/VERIFICATION-STANDARD.md IN FULL. HEADLESS Playwright. NEAR-HUMAN.
Behavioral (interact -> screenshot -> console -> vision-judge): apply several library materials to a primitive -> confirm correct PBR/transmission look under IBL (frames per material); tune material params -> confirm response; run PROMPT-TO-TEXTURE on a description -> confirm a generated MATCHED+DELIT set applies + looks right. STYLE: matches the approved worn-metal/glass quality. FRESH-CONTEXT ADVOCATE (task: "apply three materials to a pane incl. one via prompt-to-texture; report whether they look like real materials matching the approved look"). FAIL BLOCKS. Frames -> notes/verification/prim-p2/.

## MODEL / ORCH
MODEL claude-opus-4-8. ULTRACODE parallel subagents (parallelize material/PBR generation). Read first: SPEC §2, VERIFICATION-STANDARD.md, committed P-1, toolbar env + worn maps, the existing prompt-to-texture pipeline. Keys in .assetgen/.

## WAVES (commit+push+NOTIFY each)
1. w-lib: curated TSL material library (families + params) + shared IBL; seed metals from committed worn maps. `AUTO-CKPT: PRIM-P2 w-lib`.
2. w-apply: materials as a registry; primitives reference by id; live apply/preview on `/primitive-lab`. `AUTO-CKPT: PRIM-P2 w-apply`.
3. w-prompt: prompt-to-texture integration (matched-latent + delit) -> generated material saved + applied. `AUTO-CKPT: PRIM-P2 w-prompt`.
4. w-verify: HEADLESS behavioral verification + advocate + aesthetic match + frames + report. `AUTO-CKPT: PRIM-P2 w-verify`.

## ANTI-STUCK
NEVER plastic/flat/independently-generated maps (must be matched+delit). If blocked, land what works, note it, write report, emit BLOCKED.

## DONE / MARKERS
DONE when: the material library applies real refracting materials to primitives under shared IBL, prompt-to-texture generates+applies a matched-delit set, all matching the approved look, HEADLESS verification + advocate clean, gates PASS, tsc 0-new, 0 console errors, frames captured. Write notes/PRIM-P2-REPORT.md. Print LAST:
PRISM-PRIM-P2: RUN COMPLETE
If blocked:
PRISM-PRIM-P2: BLOCKED-NEEDS-FOUNDER
