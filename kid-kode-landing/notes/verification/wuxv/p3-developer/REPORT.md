# UX STUDY REPORT — "Sam Rivera", Senior Full-Stack Dev (P3 / WUXV)

(Verbatim final report of the fresh-context persona agent. Committed
unsoftened per wave law. Frames in this directory.)

**Product:** Prism @ http://localhost:3010 · **Persona:** Sam, 31, Next.js/React/TS, skeptical of AI app builders · **Viewport:** 1440×900

## 1. JOURNEY LOG

| # | Intent | Action | Result | Feel |
|---|--------|--------|--------|------|
| 1 | Reach the product | Load `:3010` | Landed on 3D "Prism Editor" (Galaxy/Canvas/Preview-App), not a marketing pitch | Neutral — where's sign-up? |
| 2 | Sign up | `/app` → redirected to `/sign-in?next=/app` → "Create an account" → Email | Google/GitHub disabled ("awaiting keys"), Email works | Good — honest about missing OAuth |
| 3 | Create account | Fill Sam Rivera / email / password → Create | Landed on Dashboard "Welcome, Sam", 0 projects | Smooth, fast |
| 4 | Find GitHub import | Dashboard "More ways to start" → "Import from GitHub" | Went to `/app/integrations`; all Import buttons **disabled**; note: "Open a project (from the builder) to import" | Confused — a link that can't do the thing |
| 5 | Try intake flow | `/app/build` start screen | Only "describe your idea" + visual seed (screenshot/logo/URL); **no repo-URL import** | Frustrated — task said import lives here |
| 6 | Guided questions | Type import intent → "Start guided build" | 6 design/capability questions, no import option | This path is "build fresh", not "import" |
| 7 | Reach a project | "Skip questions — just build" → Build Brief | Brief has a **"GitHub import: Starting fresh"** line (editable) — but my prose wasn't detected as an import | Mixed — nice that the field exists; it didn't auto-detect |
| 8 | Point import at taxonomy | Edit brief "GitHub import" line → paste `github.com/shadcn-ui/taxonomy` | Text edited; no analysis triggered (it's just a brief field) | Skeptical — this isn't "analyzing my repo" |
| 9 | Approve & open builder | Approve & build | Project `proj-a6c2…` created; builder opens; chat labeled **"Echo agent · W1 — orchestrator lands in W5"** | The honesty is refreshing, but this is a stub |
| 10 | Import into the open project | Builder → Integrations tab → "Manage integrations for this app" → project-scoped integrations | Import buttons now **enabled**, but only 3 fixed **`prism-sandbox/*`** repos; **no free-text URL field**; "Sandbox mode — set the GitHub App env vars" | Dead end for taxonomy |
| 11 | Import something | Click Import on `prism-sandbox/app-dashboard` | Button flips to "Imported"; a chip "Imported repo: prism-sandbox/app-dashboard" appears. **No analysis, no progress, no routes/components, no fidelity report** | This is a no-op state flip |
| 12 | Find URL import | Search connect box "github repo import" → "Connect GitHub" tile | Generic OAuth capability modal (`github:access`), not a repo importer | Confirmed: URL import not exposed |
| 13 | Ask the agent about my code | Builder chat: "do you run it as-is or regenerate? show fidelity report" | Echo agent restates my text + scripted "Reading graph / Planning edit" then: **"For now I am the W1 echo agent: same contract, scripted hands"** | Honest, but answers nothing |
| 14 | Build the app | "Build this app" | Streamed: plan → materialize 3 hubs (19 nodes: "Home", "Primary Workspace") → verify (§11) → deploy → **"✓ Verified shippable"** + preview URL | Fast and legible — but it built a **generic app**, not taxonomy |
| 15 | Judge the result | Open `/preview/proj-a6c2…` | Renders a **near-empty dark 3D scene** with only a "Prism preview" banner; scroll/click reveal nothing legible | "Verified shippable" over an empty scene erodes trust |
| 16 | Edit in builder (attempt 1) | Reload builder → chat "Change Home hero headline to 'Sam's Taxonomy'" | Echo stub again; **no change made**; also a new error: **CONTAINER_MISSING** | Editing-in-chat does nothing |
| 17 | Go to node editor | `/editor` (colleague's note) | Real 3D node editor: CREATE/TRANSFORM/SCENE/LOGIC/OUTPUT toolbar, LIBRARY, INSPECTOR, KEYFRAMES — loads the **ORRERY watch demo graph**, not my project | Impressive surface; wrong graph |
| 18 | Select a node | Click gold CTA button in canvas | Node selected → Inspector fills (CTA-BUTTON, CAPTION, BEHAVIOR, SCHEMA); KEYFRAMES shows faders | Selection round-trips — good |
| 19 | Edit caption (attempts 2-4) | Click / dbl-click caption in Inspector + canvas; type; drag GOLD material onto node | No edit landed. Canvas clicks map to **camera orbit / deselect**; couldn't hit tiny canvas-rendered fields; drag orbited the camera | Real dead end — canvas editing is fragile |
| 20 | Find Functions / generate-3D | Inspector (only caption/behavior/schema), LOGIC + CREATE toolbar categories, hover for tooltips, LIBRARY search "generate" | **No Functions tab, no generative-3D panel** anywhere on `/editor`; LIBRARY is a material palette | Dead end — never reached a generate surface |

## 2. COUNTERS

| Task | Actions | Hesitations | Backtracks | Dead ends |
|------|---------|-------------|------------|-----------|
| 1 Sign-up | 6 | 1 (landing ≠ marketing) | 1 (`/`→`/app`) | 0 |
| 2 GitHub import | ~14 | 3 | 3 (dashboard→integrations→build→brief→builder) | **1** (arbitrary-URL import unreachable) |
| 3 Fidelity report | 3 | 2 | 0 | **1** (no fidelity report exists) |
| 4 Build + judge preview | 6 | 1 | 0 | 0 (built, but empty preview) |
| 5 Node editing | ~12 | 4 | 2 | **2** (chat edit no-op; canvas edit unreachable) |
| 6 Generate-3D | ~8 | 3 | 2 | **1** (Functions panel unreachable) |
| **TOTAL** | **~55** | **14** | **~8** | **6** |

## 3. TRUST LEDGER

**Built trust (+):**
- (+) `wuxv-p3-02-signin.png` — Google/GitHub buttons disabled labeled **"awaiting keys"**. Honest about un-set OAuth rather than faking it.
- (+) `wuxv-p3-06/14` — *"No key ever touches Prism; every connection is a capability reference."* Consistent, credible security posture.
- (+) `wuxv-p3-17-connect-github-modal.png` — *"Stored as: Capability reference (no secret)"*, *"Your credentials go straight to the vault; they never touch this app."*
- (+) `wuxv-p3-07-github-sandbox.png` — *"Sandbox mode — set the GitHub App env vars to enable real installs."* and *"…edit production apps through pull requests — never a force-push."*
- (+) `wuxv-p3-20-echo-agent-answer.png` — *"For now I am the W1 echo agent: same contract, scripted hands."* Unusually candid that the agent is a stub.
- (+) `wuxv-p3-44` — Node selection genuinely round-trips into a live Inspector + keyframe tracks. The editor scaffolding is real.

**Broke trust (−):**
- (−) `wuxv-p3-05-more-ways.png` — Dashboard says *"Start from a blank prompt, a template, or **your GitHub**."* The "Import from GitHub" link leads to a page where **you cannot import your GitHub** (sandbox-only, URL-less). Promise ≠ delivery.
- (−) `wuxv-p3-11-brief.png` — I explicitly described importing `shadcn-ui/taxonomy`; the brief silently set **"GitHub import: Starting fresh."** My stated intent was dropped.
- (−) `wuxv-p3-15-import-clicked.png` — Clicking "Import" produced **zero analysis** — no routes, no components, no Stripe/Prisma detection, no fidelity report. Just a label flip.
- (−) `wuxv-p3-22 / -25` — Build declares **"✓ Verified shippable — behavioral, visual, and deploy checks pass"** yet the preview renders as an **empty dark scene**. A "verified" green check over nothing is the single biggest trust breaker for a skeptic.
- (−) `wuxv-p3-28-container-missing-error.png` — Reloading the builder throws **"CONTAINER_MISSING — mount container #prism-engine-container is not in the document"** and "Engine host: real · error". A raw runtime error in the happy path.
- (−) `wuxv-p3-29` — "Edit it in chat — every change re-verifies before it ships" but the chat edit **changed nothing** (echo stub). The affordance over-promises.

## 4. DEAD ENDS & MISLEADING AFFORDANCES

1. **"Import from GitHub" that can't import your GitHub** (`wuxv-p3-05`, `-06`, `-07`, `-14`, `-16`, `-17`). Every path to importing the real `taxonomy` URL is a dead end: dashboard link → disabled sandbox page; build-start → no import field; brief "GitHub import" line → inert text; project-scoped integrations → 3 fixed fake repos, no URL box; connect-search → generic OAuth modal. **The public-repo-URL importer described in the task is not reachable in this build.** Root cause disclosed: GitHub App env vars unset → sandbox mode.
2. **No fidelity/mapping report anywhere** (task 3). The "carried / adapted / needs-you" report never appears because no real import/analysis runs. Import is a state flip.
3. **In-chat editing is a no-op** (`wuxv-p3-29`) — the W1 "Echo agent" scripts steps but mutates nothing; the orchestrator is explicitly "in W5".
4. **Canvas node-editing is effectively unreachable via pointer** (`wuxv-p3-36`→`-42`). Clicks on Inspector/canvas text fields don't enter edit mode; drags orbit the camera; the material-swatch drag rotated the scene instead of applying. I could *select* a node but could not land a single verifiable property change.
5. **No Functions / generative-3D panel on `/editor`** (`wuxv-p3-48`→`-51`). The Inspector only exposes caption/behavior/schema; toolbar categories are node-primitive palettes; LIBRARY is materials. The generate-3D capability area was not discoverable.
6. **Misleading "Verified shippable" badge** (`wuxv-p3-22`, `-25`) over an empty-rendering preview.

## 5. INTERVIEW (Sam, first person)

**Q1 — What is this product and what did you accomplish?**
"Prism pitches itself as an AI app builder that takes a prompt — or your GitHub repo — and produces a real 3D-runtime app that it 'verifies before it ships.' What I actually accomplished: I signed up, created a project, clicked 'build,' and got a generic 3-hub app it called 'Verified shippable.' What I *couldn't* accomplish was the thing I came for — import my `taxonomy` repo, read a fidelity report, and edit a node. Those are all stubbed or sandboxed in this build."

**Q2 — Top 3 confusions.**
"One: 'Import from GitHub' is advertised on the dashboard but leads to a sandbox with three fake repos and no place to paste my URL. Two: the build brief silently said 'GitHub import: Starting fresh' even though I typed that I was importing taxonomy — so did it hear me at all? Three: the node editor at `/editor` loads a watch-store demo graph, not my project, and none of my edits stuck — I couldn't tell if I was doing it wrong or if editing just doesn't work here."

**Q3 — Where did you almost give up?**
"Twice. First when the GitHub import turned out to be sandbox-only with no URL field — that's the whole reason a dev like me shows up. Second in `/editor`, after four honest tries to change one caption, where every click either orbited the camera or deselected the node. If a colleague hadn't told me the editor was at `/editor`, I'd never have found it, and once there I still couldn't make an edit land."

**Q4 — What impressed you technically?**
"The honesty and the security model. Disabled buttons say 'awaiting keys.' The agent literally admits 'I am the W1 echo agent: scripted hands.' The GitHub connect modal says credentials go to a vault and Prism stores 'a capability reference (no secret)' — that's the right architecture and rare to see stated plainly. The node editor itself — real WebGPU scene, selecting a node round-trips into a live inspector with keyframe tracks — is a genuinely impressive surface, even if I couldn't edit through it yet."

**Q5 — Would you migrate your project / recommend to your team?**
"Not today, and I'd tell my team to wait. In this state it can't answer my three core questions: it never showed me it read my repo, it doesn't explain import=regeneration in the flow (the memory of that concept exists but the UI never surfaced it to me), and I couldn't edit the result. The 'Verified shippable' badge over an empty preview actually makes me *more* skeptical, not less — that's exactly the 'AI magic that falls apart' pattern I'm wary of. I'd re-evaluate once the real orchestrator (W5) and real GitHub App are wired and the fidelity report is live."

**Q6 — First thing you'd change.**
"Make the import honest end-to-end: either give me a repo-URL field that actually fetches and analyzes taxonomy and shows the carried/adapted/needs-you report — or, if it's sandbox-only, don't advertise 'import your GitHub' on the dashboard. And gate 'Verified shippable' on the preview actually rendering something."

## 6. SCREENSHOT INDEX

| File | What it shows |
|------|----------------|
| 01/01b-landing | 3D editor landing at `/` |
| 02-signin | Sign-in; Google/GitHub "awaiting keys" |
| 03-signup-filled | Email sign-up form filled |
| 04-dashboard | Dashboard, "Welcome, Sam", 0 projects |
| 05-more-ways | "Import from GitHub" option + model selector |
| 06-integrations | Integrations catalog |
| 07-github-sandbox | GitHub sandbox, Import disabled, "set env vars" |
| 08-build-intake | Guided-build start (no import field) |
| 09-builder-bare | `/app/builder` with no project = galaxy view |
| 10-guided-q1 | 6-question guided flow |
| 11-brief | Build brief incl. "GitHub import: Starting fresh" |
| 12-brief-github-url | Taxonomy URL pasted into brief line |
| 13-builder | Builder opened; "Echo agent · W1" |
| 14-integrations-scoped | Project-scoped integrations; Import now enabled |
| 15-import-clicked | "Imported" flip; no analysis |
| 16-search-github | Connect-search returns generic GitHub tile |
| 17-connect-github-modal | OAuth capability modal (not a repo importer) |
| 18-builder-back / 19-20-chat | Echo-agent response ("scripted hands") |
| 21-building / 22-build-complete | Build stream + "✓ Verified shippable" + preview URL |
| 23-27-preview* | Preview renders as empty dark scene |
| 28-container-missing-error | CONTAINER_MISSING engine error on reload |
| 29-chat-edit-attempt | In-chat edit = no-op echo |
| 30-32-editor* | `/editor` node editor (ORRERY demo graph) |
| 33-34-editor-click* | Node selection; Inspector populates |
| 35-41 caption/inspector | Failed caption edits (click/dblclick/type) |
| 42-material-drag | Material drag → camera orbit (no apply) |
| 43-47 editor-reset/zoom | Camera reset + zoom to read Inspector |
| 48-49 logic/create-category | Toolbar categories = node palettes, no Functions |
| 50-hover-create-icons | No tooltips; no generate affordance |
| 51-library-search-generate | LIBRARY = material palette, not Functions |

## 7. HONEST-STATE NOTES (quoted exactly)

- Sign-in: **"awaiting keys"** on both Google and GitHub buttons.
- GitHub section: **"Sandbox mode — set the GitHub App env vars to enable real installs."** and **"Install the Prism GitHub App, import a repo, and edit production apps through pull requests — never a force-push."**
- Integrations (no project): **"Open a project (from the builder) to import a repo into it or preview its PR-based edit path."**
- Connect modal: **"Stored as: Capability reference (no secret)"**, **"Your credentials go straight to the vault; they never touch this app."**, grant scope **`github:access`**.
- App environment: **"Values live in the server vault — only references and key names appear here (E5)."**
- Build chat: **"Echo agent · W1 — orchestrator lands in W5"** and **"When the build orchestrator lands (W5), this is where I would execute the plan wave by wave… For now I am the W1 echo agent: same contract, scripted hands."**
- Builder chat model attribution: **"Claude Fable 5"** (also the default build model on the dashboard).
- Builder attachments: **"Attach files (metadata only in W1)"**.
- Engine error banner: **"CONTAINER_MISSING — mount container #prism-engine-container is not in the document"**, engine status **"real · error"**.
- Verified badge tooltip: **"Behavioral, visual, and deploy checks pass (I9)"** — shown despite an empty-rendering preview.
- **Money rule (task 6):** I never reached any generate-3D submit surface, so no cost-bearing generation was possible; no dollar/credit cost was ever displayed. Nothing was submitted.

## POST-SESSION TRIAGE NOTE (added by the study runner, not the persona)
Code triage after this session found the URL-based importer DOES exist and is
fully wired (intake capability card → "Import an existing GitHub repo"
checkbox → GithubImportPanel → streaming ingest.analyze → FidelityLedger →
applyImport). Sam never found it because (a) the dashboard "Import from
GitHub" chip routes to the sandbox-only /app/integrations surface, and (b)
the panel hides behind an unchecked toggle on the 4th intake card, while
"Skip questions — just build" (which Sam reasonably used) bypasses the deck
entirely. The finding stands as a discoverability/routing failure (UXV-F1)
rather than a missing feature; the persona's experience is preserved
verbatim above.
