# UXV FINDINGS — PRISM-WUXV persona-simulated UX verification (2026-07-09)

Method: 4 fresh-context persona agents drove a REAL browser (Playwright,
1440x900 / 390x844) against a REAL production build (`npm run build` EXIT 0,
`next start -p 3010`). Evidence frames in `notes/verification/wuxv/<persona>/`;
verbatim interviews in `notes/SHELL-WUXV-REPORT.md` §3. Personas: P1 novice
founder "Mia", P2 impatient mobile "Dre", P3 senior dev "Sam", P4 designer
"Yuki". Findings are ranked BLOCKER / FRICTION / POLISH. Persona quotes are
verbatim and unsoftened.

Root-cause triage (this file's "cause" lines) was done AFTER the persona
sessions by reading code — personas never saw source.

---

## BLOCKER

### UXV-B1 — Built-app preview renders black / red-dithered (all 4 personas)
The single worst experience in the product: after a successful guided build
("✓ Verified shippable"), the preview of the user's app renders as a black
scene with red-dithered fragments — embedded preview, Galaxy/Canvas/Preview
modes, standalone `/preview/[projectId]` tab, and after Rebuild.
- Evidence: p1-25/26/27/28/29/30/31 (all black), p2-39/40 ("dark scene w/ red
  speckle"), p3-23..27 (empty dark scene), triage frames
  `build/wuxv-triage-wbgdemo-webgpu.png` (corrupted) vs
  `build/wuxv-triage-wbgdemo-webgl2.png` (perfect).
- P1 (Mia): "It kept saying 'live' and 'verified' but there was nothing to
  see... That's the moment I thought, 'this is broken, I'm wasting my
  afternoon.'"
- P2 (Dre): "I did all that work and I can't see my kicks app... the preview
  is just a dark screen with some red static. Where's my storefront?"
- P3 (Sam): "The 'Verified shippable' badge over an empty preview actually
  makes me *more* skeptical... exactly the 'AI magic that falls apart'
  pattern I'm wary of."
- Cause (triaged): the runtime player's WebGPU backend is corrupted in
  current Chromium (known W2D-era "red dither" regression, previously treated
  as capture-only). The SAME page on the three/webgpu **WebGL2 backend**
  renders production-quality (proven on /wbg-demo). The editor at `/` uses a
  separate renderer init and is unaffected.
- FIX (this wave): default the runtime player (ConductorRuntime →
  mountFromGraphSource → createSceneRoot) to the WebGL2 backend
  (`forceWebGL`) with `?webgpu=1` opt-in. Two-file additive change; editor
  untouched. Deviation recorded in `notes/spec-deviations-wuxv.md` BEFORE the
  change.
- SECONDARY (with B1 fixed the badge stops lying): "Verified shippable —
  visual checks pass" must never again be shown over a preview a user cannot
  see. Founder list carries the structural ask (§11 visual latch should fail
  on a black frame).

### UXV-B2 — Stub planner shreds sections: duplicate "Home", phantom
### "Library", user's custom sections DROPPED (P1, P2)
Mia asked for "cake ordering page" and "About Us" (typed into intake Q5);
the plan built "Home · Home · Landing · Catalog · Library" — her sections
gone, two Homes, a Library she never asked for.
- Evidence: p1-36-chat-detail.png (hub list + "planner: stub (deterministic,
  no API key)"), p1-20-q5-sections.png (her custom sections typed in).
- P1 (Mia): "two of them were both called 'Home,' one was 'Library' which I
  never asked for, and my cake-ordering page and About Us page weren't in
  the list at all."
- Cause (triaged): `deriveSections` (src/server/conductor/blueprint.ts:95)
  splits the brief sections line on `/` — the intake option labels are
  literally "Home / landing" and "Catalog / library", so they shred into 4
  tokens; `.slice(0,4)` then evicts the user's custom sections; a hardcoded
  "Home" hub is prepended with no dedupe.
- FIX (this wave): stop splitting on `/`, dedupe case-insensitively, drop
  "Home"/"Landing" (home hub always seeded), slice AFTER filtering, hubId
  collision guard in `buildDeterministicBlueprint`. Regression test added.

---

## FRICTION (high → low)

### UXV-F1 — "Import from GitHub" routes to a surface that cannot import
### your GitHub; the real URL importer is buried (P3)
Sam's entire evaluation goal — import `shadcn-ui/taxonomy` — dead-ended 5
ways. The REAL, fully-wired URL importer (GithubImportPanel → streaming
`ingest.analyze` → FidelityLedger → applyImport) exists but hides behind an
unchecked checkbox on the 4th intake card, while the dashboard chip "Import
from GitHub" routes to the sandbox-only `/app/integrations` page.
- Evidence: p3-05 (dashboard promise), p3-07 (sandbox, disabled), p3-11
  (brief silently says "GitHub import: Starting fresh"), p3-15 (Import click
  = label flip, zero analysis).
- P3 (Sam): "'Import from GitHub' is advertised on the dashboard but leads
  to a sandbox with three fake repos and no place to paste my URL."
- FIX (this wave): dashboard chip deep-links to `/app/build?import=github`;
  intake reads the param, pre-checks the import toggle and opens the panel.
  (The ingest pipeline itself needed zero changes.)

### UXV-F2 — Stale/dishonest chat copy: "Echo agent · W1 — orchestrator
### lands in W5" (P3; P1 jargon)
The W5 Conductor DID land ("Build this app" runs it); the chat composer is
still a scripted echo. The current copy is wrong about the orchestrator and
silent about the chat being a stub — Sam asked it to make an edit and
nothing happened.
- Evidence: p3-20 ("scripted hands"), p3-29 (edit no-op), p1-23.
- FIX (this wave): honest copy in ChatRegion + stub-agent closer ("the real
  build runs via 'Build this app'; chat edits are not wired yet").

### UXV-F3 — CONTAINER_MISSING error on builder reload (P3)
Reloading /app/builder/[projectId] surfaces "CONTAINER_MISSING — mount
container #prism-engine-container is not in the document", engine "real ·
error".
- Evidence: p3-28-container-missing-error.png.
- Cause: one-shot getElementById in RealEngineHost.attach() races the React
  commit of the conditional mount div.
- FIX (this wave): retry lookup over a few frames; error only if still
  absent.

### UXV-F4 — Intake steps open scrolled past their own heading (P2 mobile,
### also desktop)
Every guided question (Q4/Q5/Q6/brief) appeared mid-card; Dre had to scroll
UP to read what was being asked.
- Evidence: p2-28-q4.png vs p2-30-q4-heading.png.
- P2 (Dre): "every question opened halfway down so I kept scrolling up to
  see what it was asking."
- FIX (this wave): scroll-to-top effect on card/phase change in DecisionDeck
  + IntakeShell.

### UXV-F5 — Post-tour camera clamp freezes mode switching at `/` (P4)
After the guided tour's preview-app step on the atelier hub, the imperative
polar/azimuth clamps are never reset, so Galaxy/Canvas buttons flip state
while the canvas stays frozen — until reload.
- Evidence: p4-09/10 (buttons active, view frozen).
- P4 (Yuki): "the mode buttons stopped switching the view and I had to
  reload."
- FIX (this wave): cleanup effect restoring free-orbit limits when leaving
  the clamped state; belt-and-suspenders walkthrough seen-flag persist on
  terminal status (tour re-triggered after her reload: p4-11).

### UXV-F6 — Long titles clip with no ellipsis (P2)
"App where sneakerheads can list and" runs off the edge in the builder
header and the standalone preview pill.
- Evidence: p2-35/37/40.
- FIX (this wave): `.cr-badge`/`.cr-badge-name` max-width + ellipsis;
  builder frame-name max-width so its existing ellipsis engages.

### UXV-F7 — Prompt color word "indigo" ignored → green background (P4)
"slow drifting aurora over deep indigo, calm, cinematic" produced "Verdant
Light" (green): the palette word lexicon has no indigo/violet cluster, and
"aurora" votes verdant.
- Evidence: p4-32 (green result + MY LIBRARY entry).
- P4 (Yuki): "I asked for 'deep indigo'; it produced 'Verdant' green."
- FIX (this wave): add indigo/violet/amethyst/aubergine word cluster mapped
  to the nearest sanctioned cool identity (anodized deep-blue), ordered so an
  explicit color word outranks mood words like "aurora". (A true indigo
  palette would violate INV-9 "no purple" — founder list.)

### UXV-F8 — Background hover-preview reads as broken on photo-hero hubs (P4)
The panel promises "Hover to preview it live on this hub", but a full-bleed
photo hero occludes the background layer — nothing visibly changes.
- Evidence: p4-23/24 (no change) vs p4-27 (works on open hub).
- P4 (Yuki): "A less patient person concludes it's broken."
- FIX (this wave): one-line honest note in the picker when the active hub
  has a full-bleed hero ("this hub's hero may cover the background").
  Structural alternative (mini live preview viewport) → founder list.

### UXV-F9 — Generate-3D and node-editing capabilities are undiscoverable
### from the app's own navigation (P3)
Sam never found the Functions/generative-3D area (it lives in the `/`
editor's Inspector Functions tab; `/editor` doesn't have it; no nav points
there), and pointer-based caption editing at `/editor` never landed a
change.
- Evidence: p3-48..51 (no Functions on /editor), p3-35..42 (edits not
  landing).
- DISPOSITION: structural — routed to FOUNDER DECISION LIST (which editor
  surface is the product's node editor; nav entry; canvas text-field input
  model). Not additive-fixable this wave without design decisions.

---

## POLISH

- UXV-P1 — Intake card labels overlap their 3D icon thumbnails at 390px
  (p2-23, p2-26).
- UXV-P2 — Brief read-back textareas truncate visible text at the box edge
  (p2-35).
- UXV-P3 — Template pickers are prose-only; designers choose from sentences,
  not thumbnails (p4-13/19). Founder list (needs a thumbnail capture
  harness like W-BG's).
- UXV-P4 — New section drops off-screen (Y≈-9.85) with no auto-scroll to it
  (p4-20).
- UXV-P5 — Arrival-hub hero watch reads as a distant speck at the default
  camera; luxury centerpiece deserves presence (p4-01/07/37 + triage
  build/wuxv-triage-root-hero.png; art-direction taste, founder list).
- UXV-P6 — Two entry points to backgrounds (toolbar flyout + hub Inspector)
  with no hint they're the same catalog (p4 notes).
- UXV-P7 — Tour re-triggers if the browser reloads before a terminal
  Finish/Skip/Close (p4-11); belt-and-suspenders persist included in F5 fix.

## DELIGHTS (evidence the personas volunteered, kept for balance)
- P1: direction material boards ("Walnut Studio... EXACTLY my bakery's
  vibe"), the editable Build Brief ("it had listened to every single thing I
  said").
- P2: honest pricing ("free in preview" instead of a hidden number), 0
  rage-taps across the whole mobile funnel, instant email signup.
- P3: capability-reference security posture quoted verbatim ("they never
  touch this app"), candid stubs ("awaiting keys", "scripted hands").
- P4: Meridian template instantiation ("reads like a photograph, not a CSS
  gradient"), 60-background catalog with live hover-preview, clean 2D/3D
  flatten, craft copywriting.
