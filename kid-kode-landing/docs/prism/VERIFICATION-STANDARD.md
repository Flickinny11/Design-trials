# PRISM — VERIFICATION STANDARD — "the observer thinks like a user"
Applies to EVERY editor-chrome / canvas build. The verifier is the Claude Code build agent (its own loop + subagents), NOT the chat orchestrator. Render is the FLOOR, never the verdict.

## 0. PRINCIPLE
"Did it render" is table stakes. This standard is about whether a real, discerning user would find the surface correct, on-style, intuitive, and pleasant. The build agent NEVER self-certifies aesthetics or "good enough" — it produces interaction evidence and a fresh-context advocate judges.

## 1. FREQUENT IN-BUILD CHECKS (model: claude.ai/design)
Do NOT batch verification to the end. After EVERY meaningful change (every wave AND every non-trivial edit), using a HEADLESS browser (Playwright headless — see §2; never a visible window):
- cold-load the route (headless `page.goto`), wait for ready, `screenshot({ path })`.
- vision-judge the frame: rendering AND on-style vs the locked aesthetic + `DESIGN-REFERENCES.md` + this surface's spec.
- capture console (`page.on('console')`) -> zero errors.
Catch drift the MOMENT it appears, not at the end. Check often.

## 2. BEHAVIORAL INTERACTION (the core upgrade — go beyond a cold-load gate)
BROWSER AUTOMATION IS HEADLESS — ALWAYS. NEVER open a visible/headed browser window on the founder's monitor (it hijacks the screen while they work). Drive a HEADLESS browser — Playwright `chromium.launch({ headless: true })` is the reliable default: full navigate / click / hover / drag (mouse.down/move/up) / type / `screenshot({ path })` / `page.on('console')`, all rendered OFFSCREEN. Headless screenshots are full-fidelity, so vision-judgment works perfectly. (`npx playwright install chromium` if needed. If chrome-devtools MCP is used instead, it MUST be launched headless.) The ONLY time a visible browser appears is when the FOUNDER chooses to open the dev server himself to look — the agent never paints a window on his screen.
At each wave's verification, USE the surface (headless) — don't just look:
- CLICK every control; HOVER every interactive element (confirm hover states/animations actually fire); DRAG every fader/knob/slider (confirm the handle TRAVELS and the bound value CHANGES); SCRUB timelines (confirm playback drives the property); OPEN menus/dropdowns (confirm expand + contents); TYPE into inputs.
- After EACH interaction: `take_screenshot` + `list_console_messages`, then vision-judge the RESULT — did the expected thing happen, and did it look right while happening?
- Tools: `navigate_page`, `click`, `hover`, `drag`, `fill`, `take_screenshot`, `take_snapshot`, `wait_for`, `evaluate_script`, `list_console_messages`.

## 3. FOUR JUDGEMENT AXES (every pass, against the spec)
1. STYLE — matches the locked aesthetic + `DESIGN-REFERENCES.md` + this surface's spec (worn metal, real glass, engraved-in-glass labels; never flat/plastic/DOM).
2. FUNCTION — every interaction does what the spec says. It ACTUALLY works.
3. INTUITIVENESS / EASE — a first-time user understands what to do and succeeds without instruction.
4. USABILITY / SATISFACTION — responsive, legible, pleasant; a user would be happy to use it.

## 4. FRESH-CONTEXT USER-ADVOCATE (blocking)
Spawn a subagent with NO build context, given only: this surface's spec + the live route URL + "you are a first-time user — accomplish <the surface's core task>; report every point of friction, confusion, breakage, or ugliness, honestly." It MUST interact via chrome-devtools and judge the four axes. Its FAIL blocks completion. The build agent may not overrule it by assertion.

## 5. EVIDENCE RULE
No verification claim without an interaction screenshot backing it. "It works" requires a frame showing it working. Aesthetic "good enough" is never the build agent's call.

## 6. LOOP
change -> (§1 frequent cold-load + judge) -> at wave end (§2 behavioral pass over EVERY control + §3 four axes + §4 advocate) -> fix defects -> re-verify -> mark done ONLY when the behavioral pass AND the advocate are both clean, with evidence frames. Hard gates still apply: no-dom-ui PASS, node-authorship PASS, tsc 0-new, 0 console errors.
