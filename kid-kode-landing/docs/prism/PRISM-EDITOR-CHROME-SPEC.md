# PRISM EDITOR-CHROME — HARDENED DESIGN SPEC (BINDING · ATOMIC CRITERIA)

This is the single binding spec for ALL editor-chrome redesign work (toolbar, buttons, icons, node editor, keyframe editor). It captures EVERY design instruction the founder gave, as individually-verifiable criteria. A run is NOT done until EVERY criterion below passes with cited evidence. Satisfying "most" = FAIL. The verification walks this list row by row; any unmet/unproven row = MUST-FIX. Editor chrome is the editor's own React/R3F UI (not app-content nodes), so the node-authorship gate does not apply — but EVERY rule below does.

## 0. PRIME DIRECTIVES (non-negotiable; any violation = auto-MUST-FIX)
- **D1 — GENERATION IS MANDATORY.** Every visual FORM is a GENERATED photorealistic 3D object: a real GLB file written to disk by the 3D generators (Tripo v3.1/P1, or Replicate Hunyuan3D/TRELLIS), exactly like the watch case/bezel/crown GLBs already in `public/prism-mock/orrery/meshes/`. NO procedural Three.js geometry standing in for a generated object. NO shader-only "object." NO primitive box/plane/cylinder as a stand-in. If it has a form, it was generated and saved to disk. (Keys in `.assetgen/`.)
- **D2 — NOTHING FLAT, EVER.** No flat/2D/CSS/tailwind-style surface anywhere. Every element has real volumetric 3D depth, edges, perspective, shadows, and ambient-light refraction.
- **D3 — NO STOCK/CHEAP ICONS.** Zero emoji. Zero Lucide-react or anything Lucide-like. Zero lightning bolts. Zero boxes. Zero simple line drawings. Zero generic/cheap symbols.
- **D4 — NO GROTESQUE FONTS** anywhere.
- **D5 — OVER-USE the styleguide + experiments.** `DESIGN-REFERENCES.md` + `CINEMATIC-PRIMITIVES-LIBRARY.md` + the open-design experiments (soap-scum, bioluminescent material, liquid metal, photoreal metals, marble, photoreal textures). Source unique materials via Claude Design / the local open-design app / FLUX.2 + the generators.
- **D6 — PRESERVE FUNCTION.** Every restyled control keeps firing its real action.
- **D7 — PER-CRITERION VERIFICATION.** Done requires EVERY numbered criterion proven individually with cited evidence. No holistic "looks good." Build the checklist (§7), walk it row by row, fail on any gap.

## 1. THE TOOLBAR  (TB)
- **TB-1** The toolbar is a GENERATED photorealistic 3D **Liquid Glass OBJECT** — a GLB on disk — with volumetric 3D depth, transparency, and ambient-light refraction. NOT iOS "liquid glass". NOT glassmorphism (a blurred frosted panel is NOT this). NOT a procedural shader bar.
- **TB-2** The toolbar is ANIMATED: it WARPS and BENDS with movement like real liquid glass (the warp + refraction treatment rides on the generated form via the design_references deps).
- **TB-3** EACH button is a GENERATED photorealistic 3D object (its OWN GLB on disk), "sunk" INTO the liquid-glass toolbar, with real photoreal depth, texture, edges, shadows, lighting.
- **TB-4** On HOVER, a button spins a FULL 3–4 end-over-end rotations on the HORIZONTAL axis.
- **TB-5** On CLICK the spin ACCELERATES, then SMOOTHLY DECELERATES to a stop (reads as real physics, not linear).
- **TB-6** The spin visibly REVEALS the button's real 3D depth, edges, shadows, lighting.
- **TB-7** MOST buttons have NO text; a hover TOOLTIP shows the label. Only a FEW buttons carry text.
- **TB-8** A FEW buttons (not all) appear ENGRAVED with their icon; on HOVER the engraving ANIMATES; it reads photoreal — real depth + shadow, as if truly engraved with an animated symbol.
- **TB-9** Every toolbar action still fires (full action-matrix proof).

## 2. THE ICONS  (IC) — applies to the toolbar AND the node editor
- **IC-1** EVERY icon is a GENERATED bespoke 3D object (GLB on disk) — custom, 3D, with real depth.
- **IC-2** Icons are COLORED (not monochrome line glyphs).
- **IC-3** Icons are ANIMATED (motion/life) with smooth gradients + shadows + premium aesthetic.
- **IC-4** Hover TOOLTIPS on the icons.
- **IC-5 (defect)** Zero emoji, zero Lucide/Lucide-like, zero lightning bolts, zero boxes, zero simple line drawings, zero cheap/generic symbols.

## 3. THE NODE EDITOR UI  (NE)
- **NE-1** The node editor's BASE is a GENERATED photorealistic **Liquid Glass 3D object** (GLB on disk) — same liquid-glass treatment as the toolbar.
- **NE-2** The TABS and the different SECTIONS inside the node editor are OTHER GENERATED photorealistic 3D objects (GLBs on disk).
- **NE-3** The node-editor ICONS are premium, 3D-with-depth, custom, COLORED, ANIMATED, with hover tooltips (per §2).
- **NE-4** The TABS have HOVER ANIMATIONS that use the 3D liquid + design_references.
- **NE-5** The node editor has volumetric DEPTH, SHADOWS, and AMBIENT LIGHT throughout.

## 4. THE KEYFRAME EDITOR  (KF)
- **KF-1** The keyframe editor has a good materials START but is NOT done — FINISH it to the same generated-3D / liquid-glass / photoreal-material bar as the rest. No half-done surfaces.
- **KF-2** No grotesque fonts; smooth gradients + shadows; volumetric depth + ambient refraction.

## 5. MATERIALS & COHERENCE  (MAT)
- **MAT-1** Integrate the open-design experiments — soap-scum, bioluminescent material, liquid metal, photoreal metals, marble, photoreal textures — into the chrome where they elevate it.
- **MAT-2** Ambient-light refractions, smooth gradients, and shadows throughout; one coherent premium color scheme.

## 6. ASSET-GENERATION PROTOCOL
For EACH form (toolbar shell, each button, each icon, node-editor base, each tab/section): generate it best-model-per-object (Tripo v3.1/P1 for hard-surface + segmentation; Replicate Hunyuan3D/TRELLIS; multi-view input for clean hard-surface), write the GLB under `public/prism-mock/editor/meshes/` (or similar), and load THAT GLB. Textures/HDRIs via FLUX.2. The warp + refraction + spin are material/animation BEHAVIORS layered ON the generated GLBs (a generated mesh is otherwise frozen) — this is how it lands as generated photoreal 3D objects that move + refract like real liquid glass. Keys stay in `.assetgen/`.

## 7. VERIFICATION PROTOCOL (how a run proves it followed ALL of this)
Write `notes/EDITOR-CHROME-CHECKLIST.md` with EVERY criterion above as a row. For each row capture the SPECIFIC evidence and mark PASS/FAIL:
- **Generation rows (D1, TB-1, TB-3, IC-1, NE-1, NE-2):** the GLB file path on disk (`ls` proof) AND a scene-graph assertion (`evaluate_script`) that THAT GLB is the mounted geometry (not a procedural fallback). No GLB on disk = FAIL.
- **Animation rows (TB-2 warp, TB-4/5/6 spin, TB-8 engraving, IC-3, NE-4 tab hover):** MULTI-FRAME capture across the motion timeline (t=0/0.2/0.4/0.6/0.8/1.0) proving the motion actually occurs.
- **Tooltip rows (TB-7, IC-4):** hover frame showing the tooltip.
- **Defect gate (auto-MUST-FIX):** ANY flat surface; ANY procedural form standing in for a generated one; glassmorphism-as-liquid-glass; ANY emoji/Lucide/line-icon/lightning/box/generic symbol; ANY grotesque font; ANY non-firing action; ANY half-done surface.
- **Reviewers:** art-fidelity (`scripts/art-fidelity-review.mjs`) + `prism-criteria-reviewer` (must check EACH row, not holistically) + **user-advocate** as a non-technical first-timer with the explicit question: *"Does EVERY described element read as a premium GENERATED photoreal 3D object — toolbar, each button, each icon, node-editor base, each tab, keyframe editor — or is anything flat / procedural / cheap / missing?"* — cited frames + MUST-FIX power.
A run is DONE only when 100% of the checklist rows PASS. A row that is out-of-scope for a given session must be explicitly marked DEFERRED (not silently skipped), and deferral is only allowed by the founder's stated scope for that session.
