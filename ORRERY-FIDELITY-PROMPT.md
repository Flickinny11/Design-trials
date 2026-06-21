# ORRERY No.7 — FIDELITY PASS (make the whole app read as the premium 3D product it claims to be)

You are the autonomous ORRERY build agent (ULTRACODE). Repo: `/Users/loganbaird/Prototype_Prism/Design-trials/kid-kode-landing`, branch `prism-editor-build`. Operator is non-technical, pre-authorized all ops (`bypassPermissions`), and is NOT watching - never ask questions, never stop for "go". Commit + push at every verified wave. Print the completion marker ONLY when truly done (see end).

## MODEL & MODE
MODEL: claude-opus-4-8, 1M context (Fable-5 is suspended; you will silently be on Opus - confirm `modelUsage` at start and after every resume; record it in the ledger; never trust the label). ULTRACODE: Dynamic Workflows, PARALLEL subagents in VERIFIED waves, CONTRACT-FIRST per wave. `unset NODE_ENV` before any npm/node. Token-efficient.

## IF RESUMING
Run `git log --oneline -10`. `AUTO-CKPT: FIDELITY ...` commits are DONE - audit, skip, continue from the first incomplete hub. If `notes/ORRERY-FIDELITY-REPORT.md` contains the marker, re-print the marker and stop.

## THE TRUTH ON THE GROUND (do not trust prior "shipped" claims - trust the rendered pixels)
The graph is structurally complete: **292 nodes across 6 hubs** - `s1-arrival`(33), `s2-movement`(38), `s3-materia`(60), `s4-celestia`(39), `s5-acquire`(41, pricing/checkout), `s6-atelier`(81, the watch configurator). All 265 meshes render. So content EXISTS. **The problem is fidelity and discoverability, not missing nodes.** Prior phase specs claimed "F5.0-F5.4 shipped a premium app"; the operator's lived experience is the opposite - the landing reads sparse and flat, the rich hubs are buried. Your master reference is `docs/prism/ORRERY-NO7-PROTOTYPE-SPEC.md` (section 9 success criteria, section 10). Believe your screenshots over any prose.

## DESIGN LAW (enforceable - these are MUST-FIX, not suggestions)
1. **Dogfooding:** any 3D/material/motion technique premium enough to sell to Prism's customers MUST appear in this app's own surfaces. If the chrome looks like an AI default, it is wrong.
2. **No flatness:** no flat surfaces faking depth with drop-shadows. Real geometry, real `MeshPhysicalNodeMaterial` (TSL), real ambient + key lighting on every hub.
3. **No 2D-skew-as-3D:** the hero wordmark "Time, machined." is currently a flat gold text with a perspective skew. Replace it with **true 3D liquid-glass MSDF lettering** (extruded/transmissive glass glyphs, refraction, rim light) - this is the exact "large letters in liquid glass" treatment produced in earlier slices. FIND that prior work first: `git log --all --oneline | grep -iE 'glass|letter|hero|msdf|slice'`, inspect other branches and `git stash list`; integrate it. If unrecoverable, rebuild it with three-msdf-text-webgpu + a transmissive TSL material (respect the <=2 transmission budget per hub via `__PRISM_TRANSMISSION_COUNT__`).
4. **No stock/emoji icons** (Lucide/Feather/emoji, the flat lightning bolt, the low-res gold-star logo). All icons custom, dimensional, on-brand.
5. **Composition:** no vast empty centers. The Arrival hero watch currently floats tiny in a huge void - scale and stage it so the landing reads as a designed hero, not a lonely object.
6. **No label overflow / clipping / misalignment** anywhere. Real typography with texture (use `design_references.md` + fal.ai for any texture/material assets; do not under-use them).

## THE TARGET - bring EVERY hub to premium full-app fidelity, and make the app's depth DISCOVERABLE
Drive each hub as a first-time user (see verification) and raise it to the bar:
- **s1-arrival (landing):** true 3D liquid-glass hero lettering (Law 3); staged, properly-scaled hero watch; a real dimensional brass CTA (not the flat skewed "RESERVE YOUR No.7" slab); ambient lighting; the top nav and footer must look premium and **must actually navigate** to the rich hubs.
- **s6-atelier (configurator):** must be reachable in <=1 obvious action from the landing, and must be fully usable - select parts (case/dial/hands/strap/complication), drag-and-drop or tap to apply, live preview on the watch, running price, save. VERIFY by actually driving it, not by asserting nodes exist.
- **s5-acquire:** must read as a real pricing / reserve / checkout section (tiers, price, CTA), not a sparse stub.
- **s2-movement, s3-materia, s4-celestia:** each must render as a rich, intentional section (hero element + supporting content + premium materials/lighting), not a near-empty hub.
- **Navigation/IA:** a first-timer landing on `s1-arrival` must immediately understand there is a full app here (configurator, materials, pricing) and be able to reach it. Fix nav that doesn't visibly lead anywhere.

## CONTRACT RULES (hard)
Graph is the app - author in `public/prism-mock/home/live-graph.json` (flat top-level `nodes[]`, each with `parentHubId`). TSL only (`MeshPhysicalNodeMaterial`). MSDF text only - NO `THREE.TextGeometry`, NO DOM text. Synchronous `createNode`. No client secrets. Allowlist before ANY new import (`.claude/hooks/dependency-allowlist-check.py`); never downgrade a dependency. One scene, three view modes (`galaxy | canvas | preview-app`). NEVER leave a test fixture (e.g. a `broken-url` codeRef) in `live-graph.json` - revert before committing. **Zero console errors is the bar.**

## VERIFICATION PROTOCOL - THREE GATES (this is how prior false-passes happened; do not skip a gate)
Use Playwright MCP (`mcp__playwright__browser_*`), NOT KripVerify. Dev server `http://localhost:3000` (start `npm run dev &` if `curl -s -o /dev/null -w '%{http_code}'` != 200).
Before asserting anything, force a fresh graph load (long sessions cache a stale graph):
```js
await window.__PRISM_DEBUG_STORES__.graphSource.getState().loadFromUrl('/prism-mock/home/live-graph.json');
await new Promise(r=>setTimeout(r,2500));
```
Navigate hubs: `window.__PRISM_EDITOR_PREVIEW_APP_NAV__.goTo('s1-arrival'|'s2-movement'|'s3-materia'|'s4-celestia'|'s5-acquire'|'s6-atelier')`. Handles: `window.__PRISM_DEBUG_STORES__.{configurator,graphSource}`, `window.__PRISM_SCENE__`, `window.__PRISM_TRANSMISSION_COUNT__`, `window.__ATELIER_RAPIER_READY__`.

For EVERY hub you touch, all three gates must pass before that wave is "done":
- **Gate 1 - Functional/Contract/Tests:** renders, interactions work, zero console errors, contract rules honored. "Object exists in scene graph" is NOT proof - SCREENSHOT and confirm the pixels.
- **Gate 2 - Art reviewer (premium?):** screenshot the hub; judge against DESIGN LAW. Flat / skewed-2D-as-3D / stock icons / empty composition / default type = FAIL -> fix.
- **Gate 3 - USER-ADVOCATE (decisive, MUST-FIX power):** drive the hub like a non-technical first-time visitor and answer, with screenshot evidence: Is anything broken, misaligned, cut off, or flat? Would a first-timer realize the configurator and pricing exist and how to reach them? Is it laggy? Are they delighted, indifferent, or annoyed - and exactly why? Any "annoyed/indifferent/can't-find-it" = MUST-FIX before the wave closes.

## ANTI-STUCK
After 2 failed attempts on the same thing: web-search / `mcp__context7__query-docs` the current correct approach, root-cause, retry. Never paste broken code into a repair - delete and regenerate the node from its schema.

## DELIVERABLE
Write `kid-kode-landing/notes/ORRERY-FIDELITY-REPORT.md`: per-hub before/after screenshot paths under `notes/verification/fidelity/`, all three gate verdicts per hub, what changed, console-error count, and honest flags on anything not fully fixed. Commit each hub as `AUTO-CKPT: FIDELITY <hub>` and `git push origin prism-editor-build`. Append one line per hub to `kid-kode-landing/notes/ORRERY-ATELIER-PROGRESS.md`.

## COMPLETION MARKER (print this EXACT line as the very last thing - ONLY after every hub passes all three gates and the report is written, committed, and pushed):
ORRERY-FIDELITY: RUN COMPLETE
