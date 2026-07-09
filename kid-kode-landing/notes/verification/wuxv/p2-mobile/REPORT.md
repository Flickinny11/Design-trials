# UX TEST REPORT — "Dre", 27, sneaker resaler, phone-only (P2 / WUXV)

(Verbatim final report of the fresh-context persona agent. Committed
unsoftened per wave law. Frames in this directory.)

**Product:** Prism AI app builder · **Device:** 390×844 (iPhone-size) · **Time on task:** ~6 min

## 1. 10-SECOND TEST VERDICT
Yeah, I got it fast. Big headline **"Describe it. Watch it build. Ship it."** plus "Prism turns a sentence into a real, running application." Under it there's already a **"Describe your app"** box with a Build button and example chips (barbershop site, SaaS page, product configurator). Within 10 seconds I knew: *type what you want, it builds you an app.* One quick scroll gave me the proof points — WebGPU, 3 modes, 1-click deploy, 100% isolation — and a "How it works: Describe → Plan → Build → Verify → Ship." Nothing was cut off, no sideways scroll, text readable. **Pass.** The landing page is genuinely strong on mobile.

## 2. JOURNEY LOG
| # | Intent | Action | Result | Feel |
|---|--------|--------|--------|------|
| 1 | Get the pitch | Load /home | Clear hero + prompt box | 😎 Instant "I get it" |
| 2 | Skim the page | Thumb-scroll to bottom | 11k px of clean sections, sticky header, no overflow | 🙂 Smooth, no scroll-jack |
| 3 | Cost check | Open /pricing | $0 Studio, Pro "free in preview", $39 Managed Care, real quota tables | 👍 Honest, no gotchas |
| 4 | Start building | Type idea in hero, tap Build | Routed to Sign-in (prompt saved in URL) | 🙂 Fine, expected a wall |
| 5 | Make account | Create account → Email → fill Name/Email/Pass | Landed straight in guided build, no email verify | 😀 Fast, frictionless |
| 6 | Answer intake | 6 guided questions (archetype, backend, direction, integrations, sections, tone) | All single taps registered first try | 🙂 Easy, clear |
| 7 | Approve | Review brief → Approve & build | All 6 answers echoed correctly, every line editable | 👍 Impressive fidelity |
| 8 | See my app | Build this app → Expand/Open preview | 33 nodes, "Verified shippable", live URL… but renders as **dark scene w/ red speckle** | 😕 Big letdown |

## 3. COUNTERS
- **Task 1–2 (landing):** actions 14 · hesitations 1 (why won't window scroll — inner container) · backtracks 0 · dead ends 0 · **rage-taps 0**
- **Task 3 (pricing):** actions 3 · hesitations 0 · backtracks 0 · dead ends 0 · **rage-taps 0**
- **Task 4 (signup + build flow):** actions ~28 · hesitations 2 (each new question loaded scrolled *past* its own title; had to scroll up) · backtracks 0 · dead ends 0 · **rage-taps 0**
- **Task 5 (preview):** actions 4 · hesitations 1 (is this really my app?) · backtracks 0 · dead ends 0 · **rage-taps 0**
- **Whole session: 0 rage-taps, 0 dead ends, 0 console errors.** Every tap did something the first time — genuinely rare.

## 4. MOBILE SINS LIST
1. **Guided-build steps load scrolled past their own heading.** Every question (Q4 "Connect your world," Q5, Q6, the brief) appeared with the title above the fold; I had to scroll up to read what was even being asked. Friction on a phone. → `wuxv-p2-28-q4.png` (mid), `wuxv-p2-30-q4-heading.png` (after I scrolled up)
2. **Long titles clip with no ellipsis.** "App where sneakerheads can list and" just runs off the right edge in the brief header, builder header, and preview pill. Looks broken/unfinished. → `wuxv-p2-35-brief-top.png`, `wuxv-p2-37-builder.png`, `wuxv-p2-40-preview-standalone.png`
3. **Brief read-back textareas truncate.** "…trade kicks", "…one red signal", "…account, Pricing" are cut at the box edge on first view (scrollable, but you don't see full text). → `wuxv-p2-35-brief-top.png`
4. **Intake card labels overlap their 3D icons.** On the archetype/capability cards the text ("SaaS product," "Community/social," "Accounts & auth") sits on top of the little 3D thumbnail, reading cluttered. → `wuxv-p2-23-q1.png`, `wuxv-p2-26-q2-selected.png`
5. **The actual built app is unreadable.** The whole point — my app — renders as a black scene with red-dithered rectangles. No headline, no product images, no "list your kicks," nothing I recognize as a sneaker storefront. → `wuxv-p2-39-preview-expanded.png`, `wuxv-p2-40-preview-standalone.png`

*(Notably absent sins: no horizontal scroll anywhere, no overflow, no scroll-eating 3D, tap targets were big and well-spaced, no lag/jank I could feel.)*

## 5. INTERVIEW
**Q1 — What is this and would you run it from your phone?**
"It's an app builder — you type 'I want an app that does X' and it builds and ships it for you, in 3D. The signup-to-build part? Yeah, I'd 100% do that from my phone in a coffee line, no problem. It's clean, fast, nothing fought me. Running it *long-term* from my phone… the funnel says yes but the thing it actually made me doesn't look like an app yet, so I'd want to check on a laptop."

**Q2 — Top 3 annoyances.**
"One, every question opened halfway down so I kept scrolling up to see what it was asking. Two, my app's name gets chopped off everywhere — 'App where sneakerheads can list and' — looks half-finished. Three, and this is the big one: I built the whole thing and the preview is just a dark screen with some red static. Where's my storefront?"

**Q3 — Where did you bounce (or would you)?**
"I didn't bounce — I made it all the way to a 'verified shippable' app, which honestly shocked me. But the preview is where a real me *would* deflate. I did all that work and I can't see my kicks app. That's the moment I'd screenshot it, go 'lol what is this,' and close the tab — not because it's broken, but because it's not showing me anything I asked for."

**Q4 — What impressed you?**
"A bunch, actually. Pricing is dead honest — it literally says 'free in preview, paid plans finalize later' instead of hiding a number. Signup was instant, no email-verify wall. The guided questions took like 90 seconds. And the brief at the end played back *every single thing I picked* correctly, then streamed the build step by step — 'Materializing hub: Catalog, 7 nodes… Verifying… Deploying.' That felt real, not fake."

**Q5 — Recommend?**
"To another reseller? Maybe, with a warning: 'the setup is slick but wait to see how the actual app looks.' If the preview showed me a real storefront I'd be shouting about it. Right now it's a 6/10 — great bones, the payoff screen isn't there."

**Q6 — First thing you'd change.**
"Make the preview actually look like the app I described. I typed 'sneakerheads list and trade kicks' and picked a storefront with a catalog — show me a page with shoe cards and a 'List a pair' button. The dark red-static scene has to go, or at least come with real content on top of it."

## 6. SCREENSHOT INDEX
- `01`–`13`: /home first view → full scroll → footer (landing 10-sec test + mobile-sin sweep)
- `14`–`16`: /pricing top / Pro / Enterprise + Managed Care
- `17`: hero prompt typed · `18`: sign-in (Google/GitHub "awaiting keys") · `19`–`21`: sign-up form empty/expanded/filled
- `22`: guided-build entry (prompt carried through) · `23`–`34`: the 6 guided questions + selections
- `35`–`36`: Build Brief (top + full) · `37`: builder chat+preview · `38`: build complete "Verified shippable" · `39`: preview expanded · `40`: standalone preview URL

## 7. HONEST-STATE NOTES (quoted from the product)
- Sign-in/up: **"Google — awaiting keys"**, **"GitHub — awaiting keys"** (both buttons disabled). Only **"Email — with password"** works. Read clearly as "OAuth not wired yet, use email."
- Builder banner: **"Echo agent · W1 — orchestrator lands in W5"** — tells me the live orchestration is a placeholder in this build.
- Verify message: **"✓ Verified shippable — behavioral, visual, and deploy checks pass (fresh-context advocate pass still gates final 'done')."** — honest that a final human/advocate gate remains.
- Attach button: **"Attach files (metadata only in W1)."**
- Pricing: **"Every tier is free while Prism is in preview… The only price set today is Managed Care; plan pricing finalizes when checkout goes live."**
- **Zero JS errors** the entire session (131 console messages were all Three.js deprecation *warnings*, invisible to users).
