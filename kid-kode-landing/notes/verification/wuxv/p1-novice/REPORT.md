# UX Test Report — "Mia the Bakery Owner" (Novice, P1 / WUXV)

(Verbatim final report of the fresh-context persona agent. Committed
unsoftened per wave law. Frames in this directory.)

**Persona:** Mia Alvarez, 34, bakery owner, zero dev experience. **Product:** Prism @ localhost:3010. **Goal:** understand the product, sign up, build a bakery site with a cake-ordering form, reach a preview, and figure out next steps.

**Headline:** I got all the way through a friendly guided flow and the tool proudly told me my app was "Verified shippable" — but I never actually got to SEE my bakery. Every preview was a black screen. That gap between "we promise it's done" and "you can't look at it" is the whole story.

---

## 1. JOURNEY LOG

| # | My intent | What I did | What happened | How it felt |
|---|-----------|-----------|---------------|-------------|
| 1 | Understand what this is | Opened /home, scrolled 3 sections | "Describe it. Watch it build. Ship it." Real red glowing 3D scenes, molecule graph, feature cards | Impressed, a little intimidated — this looks powerful and expensive |
| 2 | See if it's for me | Read hero + "how it works" (Describe→Plan→Build→Verify→Ship) | Clear promise: type a sentence, get a real app | Hopeful — "type what you want" is exactly what my friend said |
| 3 | Sign up | Clicked "Start building" → landed on Sign in | Google & GitHub both greyed out ("AWAITING KEYS"); Email active | Slightly wary but the honesty was reassuring |
| 4 | Create account | "Create an account" → Email tile → filled Name/Email/Password → Create account | Dropped straight into Guided build | Smooth. Fastest signup I've done |
| 5 | Start my app | Typed "a warm, inviting website for my bakery with an online cake ordering form", clicked "Start guided build" | 6-question wizard began | Comfortable — 6 questions felt manageable, not scary |
| 6 | Answer Q1 "What are we building?" | Picked **Storefront** (catalog/cart/checkout) | Selected, red highlight | Easy — closest to selling cakes |
| 7 | Answer Q2 "Under the hood?" | Picked **Database** + **Payments** | Both selected | Made sense — I need to store orders and take payment |
| 8 | Answer Q3 "Direction" | Picked **Walnut Studio** (warm, crafted, human) | Beautiful 3D wood material board selected | Delighted — this is EXACTLY my bakery's vibe |
| 9 | Answer Q4 "Connect your world" | Picked **Stripe** + **Resend** | Selected; also saw deploy targets | Fine, though I wasn't sure if I needed accounts for these yet |
| 10 | Answer Q5 "Main sections" | Picked Home, Catalog + typed my own: cake ordering page + About Us | Custom text accepted | Good — glad I could describe my own |
| 11 | Answer Q6 "How should it feel?" | Picked **Playful** | "Review your brief" unlocked | Confident |
| 12 | Check what it understood | Clicked "Review your brief" | A clean, fully-editable brief listing everything I said | This was the best moment — I felt in control and understood |
| 13 | Kick off the build | "Approve & build" → builder opened | Project created; "Build this app" button shown | Clear |
| 14 | Build my app | Clicked "Build this app" | Streamed steps: Planning → 5 hubs materialized → Verifying → Deploying → "✓ Verified shippable" in ~3 seconds | Amazed at the speed, but suspicious it was TOO fast |
| 15 | See my bakery | Preview panel = **solid black** | Nothing rendered | Confused and let down |
| 16 | Try to fix it | Switched Galaxy/Canvas modes, clicked Rebuild | Still solid black in all modes | Frustrated |
| 17 | Open the real preview | "Open" → new tab with preview URL | A tiny "Warm, inviting website for my bakery — PRISM PREVIEW" pill on a **fully black page** | This is where I almost gave up |
| 18 | Wake it up | Clicked + scrolled the black preview, waited 8s | Still black, faint red flicker only | Deflated |
| 19 | Figure out next steps | Opened the SHIP tab | Rich, honest panel: verification checklist, hosts, pricing, rollback checkpoints, export | Reassured — at least I understand my options |
| 20 | Try a safe "publish" | Clicked Prism Cloud "Deploy" | New "live · ✓ verified" ship added, new preview link — stayed local, no account asked | This part actually worked and felt trustworthy |
| 21 | Understand what happened | Expanded the "Planning app structure" step | Revealed: **"planner: stub (deterministic, no API key)"**, hubs "Home · Home · Landing · Catalog · Library", 33 nodes | Now I get why it was instant and blank — the real brain didn't run |

## 2. COUNTERS

| Task | Actions | Hesitations | Backtracks | Dead ends |
|------|--------:|------------:|-----------:|----------:|
| 1 — Understand /home | ~4 (scroll gestures) | 0 | 0 | 0 |
| 2 — Sign up | 6 (clicks + 3 field fills) | 1 (Sign-in vs Create-account) | 0 | 0 |
| 3 — Build (guided flow) | ~18 (7 card picks, 2 text entries, Next×6, approve) | 1 (Q5 had no "ordering" option → used "describe your own") | 0 | 0 |
| 4 — Wait for build | 2 (Build this app + wait) | 1 ("Echo agent · W1" jargon) | 0 | 0 |
| 5 — Reach preview | ~8 (mode switches, rebuild, open tab, interact) | 2 | 1 (builder↔tab) | **1 (preview is black everywhere)** |
| 6 — Next steps | ~5 (Ship tab, Prism Cloud deploy, expand step) | 1 (many host options) | 0 | 0 |
| **TOTAL** | **~43** | **7** | **1** | **1** |

## 3. DEAD ENDS & MISLEADING AFFORDANCES

1. **DEAD END — The preview is a black screen everywhere.** After "✓ Verified shippable," the embedded preview (Preview mode: `wuxv-p1-25-building-02.png`; Galaxy: `wuxv-p1-26-galaxy-mode.png`; Canvas: `wuxv-p1-31-canvas-mode.png`), the standalone preview tab (`wuxv-p1-28-preview-newtab.png`, `wuxv-p1-29-preview-newtab-wait.png`, `wuxv-p1-30-preview-interact.png`) and a Rebuild (`wuxv-p1-27-preview-after-rebuild.png`) all rendered solid black. Three distinct repair attempts (Rebuild, Open-in-tab, click/scroll) — none produced a visible app. As a user I have no way to confirm my bakery exists.
2. **MISLEADING — "Verified shippable" green badge over an invisible app.** The Ship panel proudly shows ✓ Behavioral / ✓ Visual / ✓ Post-ship (`wuxv-p1-32-ship-tab.png`). "Visual — conforms to the chosen Direction Board" is checked, yet I see only black. To a non-technical user this reads as a false promise.
3. **MISLEADING (mild) — sections don't match what I asked for.** The plan built "Home · Home · Landing · Catalog · Library" (`wuxv-p1-36-chat-detail.png`) — a duplicated Home, a "Library" I never requested, and NO visible cake-ordering page or About Us despite my typing them in Q5.
4. **JARGON affordance — "Echo agent · W1 — orchestrator lands in W5"** in the build-chat header (`wuxv-p1-23-builder-start.png`) means nothing to me. Same with node/hub/"§11 latch" language sprinkled through the Ship panel.

## 4. INTERVIEW (in character, quotable)

**Q1 — What is this product, and what did you accomplish today?**
"It's a website that builds you a real app just from describing it in plain English. I answered six friendly questions about my bakery, it wrote up a summary I approved, and it told me it built and 'verified' my site in about three seconds. What I actually accomplished? Honestly — I set the whole thing up and it says it's done, but I never got to lay eyes on my own bakery website. So I *think* I built an app, but I can't prove it to myself."

**Q2 — Top 3 things that confused you.**
1. "The preview was just a black rectangle, everywhere I looked. It kept saying 'live' and 'verified' but there was nothing to see."
2. "It built five sections but two of them were both called 'Home,' one was 'Library' which I never asked for, and my cake-ordering page and About Us page weren't in the list at all."
3. "Words like 'Echo agent,' 'W1,' 'orchestrator,' 'node,' 'hub,' '§11 latch.' I run a bakery — I have no idea what those mean."

**Q3 — Where did you almost give up?**
"When I opened my app in its own tab, waited, clicked, scrolled — and it stayed pitch black with just a tiny label in the corner. That's the moment I thought, 'this is broken, I'm wasting my afternoon.'"

**Q4 — What delighted you?**
"The design-direction question — those little 3D material boards. When I clicked 'Walnut Studio' I could feel the warm, cozy bakery vibe. That was gorgeous. And the 'Review your brief' page — it had listened to every single thing I said and let me edit any line. That made me trust it right up until the preview let me down. Also, the Prism Cloud 'Deploy' actually did something and didn't ask me to sign up for anything scary."

**Q5 — Would you come back / recommend it?**
"Not yet. The signup and the questions are honestly the nicest I've used — I'd tell a friend the *start* is magic. But I can't recommend a tool that won't show me the thing it built. If the preview showed my actual warm bakery site with my cakes, I'd be telling everyone at the farmers' market. Right now I'd say 'wait until they fix the preview.'"

**Q6 — The FIRST thing you would change.**
"Make the preview actually show my website. A green 'verified' checkmark means nothing if the screen is black. I need to SEE my bakery — the cakes, the ordering form, the warm colors — before I'll believe any of it."

## 5. SCREENSHOT INDEX

| Filename | What it shows |
|---|---|
| wuxv-p1-01-home-hero.png | Homepage hero: "Describe it. Watch it build. Ship it." |
| wuxv-p1-02-home-scrolled.png | "One scene, three ways" 3D molecule graph (Galaxy/Canvas/Preview) |
| wuxv-p1-03-home-howitworks.png | "What you get" feature cards |
| wuxv-p1-04-signin.png | Sign in — Google/GitHub "AWAITING KEYS", Email active |
| wuxv-p1-05-signup.png | Create account — same three tiles |
| wuxv-p1-06-signup-form.png | Email signup form revealed |
| wuxv-p1-07-signup-filled.png | Form filled with Mia's details |
| wuxv-p1-08-build-start.png | Guided build start ("Describe what you want to build") |
| wuxv-p1-09-idea-typed.png | My bakery idea typed in |
| wuxv-p1-10-question1.png | Q1 What are we building (4 archetypes) |
| wuxv-p1-11-q1-storefront.png | Storefront selected |
| wuxv-p1-12-question2.png | Q2 Under the hood (6 capabilities) |
| wuxv-p1-13-q2-selected.png | Database + Payments selected |
| wuxv-p1-14-question3.png | Q3 Choose a direction (5 material boards) |
| wuxv-p1-15-q3-walnut.png | Walnut Studio selected |
| wuxv-p1-16-question4.png | Q4 Connect your world (integrations + deploy) |
| wuxv-p1-17-q4-integrations.png | Stripe + Resend selected |
| wuxv-p1-18-q4-deploy-scroll.png | Deploy targets (Prism Cloud, Vercel visible) |
| wuxv-p1-19-question5.png | Q5 Main sections |
| wuxv-p1-20-q5-sections.png | Home + Catalog + my custom "cake ordering / About Us" text |
| wuxv-p1-21-question6.png | Q6 How should it feel (5 tones) |
| wuxv-p1-22-brief-review.png | Build Brief — editable, matched everything I said |
| wuxv-p1-23-builder-start.png | Builder opened; "Build this app" + "Echo agent · W1" jargon |
| wuxv-p1-24-building-01.png | Build streamed all steps → "✓ Verified shippable"; center still black |
| wuxv-p1-25-building-02.png | Preview mode — black canvas |
| wuxv-p1-26-galaxy-mode.png | Galaxy mode — black canvas |
| wuxv-p1-27-preview-after-rebuild.png | After Rebuild — still black |
| wuxv-p1-28-preview-newtab.png | Standalone preview tab — black with tiny label pill |
| wuxv-p1-29-preview-newtab-wait.png | Preview tab after 8s wait — still black |
| wuxv-p1-30-preview-interact.png | After click + scroll — still black |
| wuxv-p1-31-canvas-mode.png | Canvas mode — black canvas |
| wuxv-p1-32-ship-tab.png | Ship panel opened (right side) |
| wuxv-p1-33-ship-panel-full.png | Full page w/ faint red glow hint in center preview |
| wuxv-p1-34-prismcloud-deploy.png | After Prism Cloud deploy |
| wuxv-p1-35-step-expanded.png | Chat step expanded |
| wuxv-p1-36-chat-detail.png | "planner: stub (deterministic, no API key)" + hub list |

## 6. HONEST-STATE NOTES (quoted exactly)

- **Sign in / Sign up:** Google tile — "awaiting keys"; GitHub tile — "awaiting keys" (screenshots `04`, `05`). Email/password worked.
- **Planner (from expanded build step, `wuxv-p1-36-chat-detail.png`):** "planner: stub (deterministic, no API key)" — the real AI conductor did not run; build was a deterministic stub. This is the most consequential honest-state disclosure and almost certainly explains the instant build + black preview.
- **Build completion message (`wuxv-p1-24`):** "✓ Verified shippable — behavioral, visual, and deploy checks pass (fresh-context advocate pass still gates final \"done\")."
- **Ship panel verification (`wuxv-p1-32`):** "Advocate — fresh-context human-grade pass (§11.4)" shown with a "·" (pending) rather than a ✓.
- **Deploy hosts requiring keys (Ship panel):** Netlify — "dry-run · set NETLIFY_AUTH_TOKEN"; Cloudflare — "dry-run · set CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID"; Modal — "dry-run · set MODAL_TOKEN_ID, MODAL_TOKEN_SECRET"; RunPod — "dry-run · set RUNPOD_API_KEY"; Vast.ai — "dry-run · set VAST_API_KEY".
- **Secrets discipline (footer of Ship panel):** "Deploys gate on the §11 latch; env-gated hosts run in dry-run with a generated config manifest — no secret ever leaves the server (I5)."
- **Prism Cloud & Vercel** were "live" (not gated). Prism Cloud "Deploy" ran locally with no external account prompt.
