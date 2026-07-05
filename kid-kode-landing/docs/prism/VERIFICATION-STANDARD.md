# PRISM — VERIFICATION STANDARD — "the observer thinks like a user, in a real browser"
Applies to EVERY editor-chrome / canvas build. The verifier is the Claude Code build agent (its own loop + subagents), NOT the chat orchestrator. Render is the FLOOR, never the verdict.

> **2026-06-29 — DOCTRINE CHANGE (supersedes the prior "HEADLESS — ALWAYS" rule).**
> The previous standard mandated headless Playwright (`chromium.launch({headless:true})`) for ALL verification. That was WRONG and actively harmful: headless Chromium here falls back to a **software GPU (SwiftShader)**, which **cannot faithfully render the WebGPU / heavy-Three.js scene** the editor actually is. A software-GPU "does it render" check is blind to the real thing — it silently **passed a canvas that was crash-looping on a remote-HDRI fetch for days** (the toolbar/keyframe "disappearance"). A render-only smoke test on a software GPU is not verification; it is theater.
> **New rule: verify in a REAL, HARDWARE-GPU-ACCELERATED browser, driven with near-human computer-use + vision, exercising both LOOK and FUNCTION.** Details in §2.

## 0. PRINCIPLE
"Did it render (in software)" is not even table stakes — it can be a lie. This standard is about whether a real, discerning user, looking at the app in a **real GPU browser**, would find the surface correct, on-style, intuitive, fast, and pleasant. The build agent NEVER self-certifies aesthetics or "good enough" — it produces interaction evidence from a real render, and a fresh-context advocate judges.

## 1. FREQUENT IN-BUILD CHECKS (model: claude.ai/design)
Do NOT batch verification to the end. After EVERY meaningful change (every wave AND every non-trivial edit), in a **real hardware-GPU browser** (see §2 for the tool ladder):
- load the route, wait for the scene to be ready (canvas painted + first frame settled), capture a **screenshot of the actual GPU render**.
- vision-judge the frame: rendering AND on-style vs the locked aesthetic + `DESIGN-REFERENCES.md` + this surface's spec.
- capture the console → zero errors (a runtime/page error is a FAIL, not a warning — the HDRI crash was a thrown error that headless-render checks ignored).
Catch drift the MOMENT it appears, not at the end. Check often.

## 2. BEHAVIORAL INTERACTION IN A REAL GPU BROWSER (the core — this is what was missing)

**Verification MUST run in a browser with real hardware GPU acceleration, driven with near-human computer-use + vision.** Pick the highest-fidelity available tool:

1. **Claude native computer-use** (`mcp__computer-use__*`) — the gold standard. Drives a REAL browser on a REAL GPU exactly like a human: move/click/hover/drag/scroll/type, take a screenshot, and *look*. This is the "claude.ai/design" loop — it sees what the user sees and interacts like the user. Use a non-primary display or run when the founder is away if screen real-estate is a concern; with the founder present and collaborating, real-browser verification on screen is expected and welcome.
2. **Claude-in-Chrome MCP** / **chrome-devtools MCP** against a **GPU-accelerated real Chrome** — DOM-aware, fast, real GPU. Acceptable when computer-use is unavailable. The Chrome instance MUST have hardware acceleration ON (NOT `--enable-unsafe-swiftshader`, NOT `--disable-gpu`).

**BANNED for visual/behavioral verification:**
- ❌ **Headless software-GPU browsers** (Playwright/Puppeteer `headless:true` with SwiftShader). They cannot render WebGPU/heavy-Three faithfully and pass crashes. (Headless is fine ONLY for non-visual unit/contract assertions that never touch the canvas — e.g. store round-trips, schema gates.)
- ❌ **KripVerify** — removed from this project entirely; do not reference it.

At each wave's verification, USE the surface (in the real GPU browser) — don't just look:
- CLICK every control; HOVER every interactive element (confirm hover states/animations actually fire — e.g. a button that should *raise* on hover visibly raises); DRAG every fader/knob/gizmo (confirm the handle TRAVELS and the bound value CHANGES); SCRUB timelines (confirm playback drives the property); OPEN menus/flyouts (confirm expand + contents); TYPE into inputs.
- **Functional truth, not just presence:** after each interaction, confirm the action did *what the code says it should* — clicking "Add" actually adds a node to the live graph; "Build" actually builds; the toolbar button fires its wired op. Presence of a button ≠ a working button.
- **Feel:** judge responsiveness and motion quality — is it smooth, is it fast, does it *feel* fast, does it stutter? A correct-but-janky interaction fails the satisfaction axis.
- After EACH interaction: screenshot + read console, then vision-judge the RESULT — did the expected thing happen, and did it look right while happening?

## 3. FOUR JUDGEMENT AXES (every pass, against the spec)
1. STYLE — matches the locked aesthetic + `DESIGN-REFERENCES.md` + this surface's spec (real photoreal glass/metal, real depth + lighting + refraction, engraved-in-glass or bespoke-3D labels/icons; **never** flat/plastic/DOM/CSS-glassmorphism/stock-icon/emoji/Lucide).
2. FUNCTION — every interaction does what the spec says. It ACTUALLY works on the live graph.
3. INTUITIVENESS / EASE — a first-time user understands what to do and succeeds without instruction.
4. USABILITY / SATISFACTION — responsive, fast, fluid, legible, pleasant; a user would be happy to use it. "Feels fast" is a requirement, not a bonus.

## 4. FRESH-CONTEXT USER-ADVOCATE (blocking)
Spawn a subagent with NO build context, given only: this surface's spec + the live route URL + "you are a first-time user — accomplish <the surface's core task>; report every point of friction, confusion, breakage, ugliness, or sluggishness, honestly." It MUST interact in a **real GPU browser** (computer-use / Claude-in-Chrome) and judge the four axes. Its FAIL blocks completion. The build agent may not overrule it by assertion.

## 5. EVIDENCE RULE
No verification claim without an interaction screenshot from a **real GPU render** backing it. "It works" requires a frame showing it working, captured on hardware GPU. Aesthetic "good enough" is never the build agent's call. A software-GPU/headless screenshot is NOT acceptable evidence for a visual claim.

## 6. LOOP
change → (§1 frequent real-GPU cold-load + judge) → at wave end (§2 behavioral pass over EVERY control in a real GPU browser + §3 four axes + §4 advocate) → fix defects → re-verify → mark done ONLY when the behavioral pass AND the advocate are both clean, with real-GPU evidence frames. Hard gates still apply: no-dom-ui PASS, node-authorship PASS, tsc 0-new, 0 console errors.

## 7. WHY THIS CHANGED (incident reference)
On 2026-06-29 the canvas editor's toolbar + keyframe panel "disappeared." Root cause: `GraphScene.tsx` / `HubLighting.tsx` loaded their IBL from a remote CDN (`drei <Environment preset>` → `raw.githack.com/...hdr`); when the fetch failed it **threw inside `<Canvas>` and crashed the entire canvas**. This had likely been intermittently broken for many builds. Every "verification" in that window was headless software-GPU render-smoke — which renders preview-app (local HDRI) fine and never exercised the crashing canvas mode in a real browser. A single real-GPU "switch to Canvas and look" would have caught it in one second. That is the standard now.

## 8. PERFORMANCE / RESOURCE BUDGET + NO-REMOTE-ASSET (must pass every verify)
A surface that renders but stutters, leaks, or phones home fails. Every real-GPU verify run also asserts:
- **Frame rate:** ≥ **60 fps** on the WebGPU path; ≥ **45 fps** on the WebGL2 fallback (`CINEMATIC-PRIMITIVES-LIBRARY.md` quality bar). Capture an FPS reading during interaction (hover/drag/scrub), not just at idle. Jank during interaction = FAIL (the satisfaction axis).
- **"Feels fast":** input → visible response is immediate; no spinner where a frame should be; animations ease, never snap or hitch.
- **Memory / resources:** no unbounded growth across mode toggles / repeated interaction (watch heap + render-target count). A transmission-buffer-per-element pattern (e.g. drei `MeshTransmissionMaterial` × N) must be budgeted — prefer the renderer's shared transmission pass.
- **ZERO REMOTE FETCHES (hard gate):** open the **Network panel** during the run — there must be **no** request to an external host for an asset (HDRI / texture / mesh / font / model). Every asset resolves from `public/**` (local). This is enforced two ways and BOTH must hold: at **write time** by `.claude/hooks/no-remote-asset-gate.sh` (Pillar 5 gate), and at **run time** by this network check. A single remote asset fetch is the 2026-06-29 crash class — it is an automatic FAIL even if the frame looks fine (it will fail intermittently when the host is slow/down).
- **Console:** zero errors AND zero unhandled promise rejections during the whole run (the HDRI crash surfaced as a thrown rejection inside `<Canvas>`).

The verification tool must expose the network + console + an FPS probe (Claude-in-Chrome / chrome-devtools MCP / computer-use against a real GPU Chrome). Headless software-GPU exposes none of this faithfully — see §2.
