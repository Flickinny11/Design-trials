# PRISM PRIMITIVE SYSTEM — PHASE P-3: the FLUID SYSTEM — TSL/WebGPU customizable fluids + liquid glass. IN-ENGINE. ZERO DOM/CSS. Verified HEADLESS, matching the approved glass look.

ULTRACODE build agent for Prism. Root /Users/loganbaird/Prototype_Prism/Design-trials (branch prism-editor-build). App kid-kode-landing/. `unset NODE_ENV`. bypassPermissions. Commit+push every wave. BUILD ON committed P-1 + P-2.

## NOTIFY OFTEN
`osascript -e 'display notification "<msg>" with title "Prism · PRIM-P3" sound name "Glass"'` at each wave START, COMMIT, verification START, each behavioral check, advocate, blocker.

## GOAL — build per docs/prism/PRISM-PRIMITIVE-TEMPLATE-SYSTEM-SPEC.md §3
- Customizable 3D FLUIDS as a material/primitive class on TSL + WebGPU compute (the current path). Choose per element: MLS-MPM particle fluid (cf. threejs.org webgpu_compute_particles_fluid) for volumetric; screen-space velocity-pressure / simplified Navier-Stokes via TSL StorageTexture for surfaces; shader-driven flow surface for liquid glass. Sim runs on GPU.
- EDITABLE params: viscosity (togetherness), surfaceTension, flowSpeed, flowDirection/pattern, thickness/depth, turbulence, IOR/refraction, tint/opacity, damping, reactsToInteraction.
- 3D LIQUID GLASS = the fluid system applied to a transmission-glass surface (flow+warp+refraction on a parameterized timeline) — ANY glass element can "go liquid." This is the dropdown-expand animation used in P-4.
- Fluids are still NODES (a fluid primitive = a node + fluid material + params). Reviewable: extend the lab route with a fluid primitive + param controls.

## AESTHETIC GROUND TRUTH
The approved `/toolbar-chassis` + `/keyframe-editor` real-glass look is the bar; liquid glass must read as that same premium transmission glass, now flowing. NO cartoonish/plastic fluid.

## STACK — WebGL ONLY. LAW.
TSL + WebGPU compute (r184+). NO DOM/CSS/Tailwind/`<Html>`. no-dom-ui-gate PASS, node-authorship-gate PASS.

## VERIFICATION — APPLY docs/prism/VERIFICATION-STANDARD.md IN FULL. HEADLESS Playwright. NEAR-HUMAN.
Behavioral (interact -> screenshot -> console -> vision-judge): instantiate a fluid primitive -> confirm it's a node + renders; tune params (viscosity, flowSpeed, thickness) -> confirm the fluid VISIBLY responds (capture frames across param values + across time to show motion); trigger the liquid-glass surface -> confirm flow+refraction matches the approved glass. STYLE: matches approved glass. FRESH-CONTEXT ADVOCATE (task: "create a fluid, make it thicker and slower, then faster; trigger liquid glass; report whether it behaves like a real customizable fluid + matches the glass look"). FAIL BLOCKS. Frames -> notes/verification/prim-p3/.

## MODEL / ORCH
MODEL claude-opus-4-8. ULTRACODE parallel subagents. Read first: SPEC §3, VERIFICATION-STANDARD.md, committed P-1/P-2, the toolbar glass material + env.

## WAVES (commit+push+NOTIFY each)
1. w-fluid: TSL/WebGPU fluid material/sim + editable params (viscosity/flow/thickness/turbulence/IOR). `AUTO-CKPT: PRIM-P3 w-fluid`.
2. w-liquidglass: liquid-glass surface (flow+warp+refraction on glass) parameterized for expand animations. `AUTO-CKPT: PRIM-P3 w-liquidglass`.
3. w-node: fluid primitive as a node + param controls on the lab route. `AUTO-CKPT: PRIM-P3 w-node`.
4. w-verify: HEADLESS behavioral verification (param response + motion + liquid glass) + advocate + aesthetic match + frames + report. `AUTO-CKPT: PRIM-P3 w-verify`.

## ANTI-STUCK
NEVER fake fluids with a static texture or DOM. If real-time GPU fluid genuinely can't reach the bar after real effort (alt: screen-space surface vs MLS-MPM), land the best working approach, note it, write report, emit BLOCKED.

## DONE / MARKERS
DONE when: a customizable fluid renders + responds to its params (visibly), liquid glass flows + refracts matching the approved glass, fluid is a node, HEADLESS verification + advocate clean, gates PASS, tsc 0-new, 0 console errors, frames captured. Write notes/PRIM-P3-REPORT.md. Print LAST:
PRISM-PRIM-P3: RUN COMPLETE
If blocked:
PRISM-PRIM-P3: BLOCKED-NEEDS-FOUNDER
