# SHELL W-6 — LANDING / MARKETING — RUN REPORT

**Marker:** `PRISM-SHELL-W6: RUN COMPLETE`
**Branch:** `codex/prism-recovery-harness-20260630`
**Commits:** `6ef77f63` (surface) → `c7fad5ce` (judge fixes)
**Governing:** Spec §10(S2), §12(W6) · DECISIONS D (Next.js marketing surface) ·
ENHANCEMENTS E2 (templates) / E6 (tier stubs) · DESIGN LAW DL1–DL10 ·
PRISM-SHELL-DESIGN-LAW-2026-07-03 · V-STANDARD · NEAR-HUMAN-QA.

---

## 1. What shipped

A **public marketing surface** — the front door of the product — built as a
Next.js SSR/SEO route group **outside** the `/app/*` session boundary (decision
D). It is additive: the FP7-protected editor at `/` and every engine-interior
file are untouched.

### Routes (new `src/app/(marketing)/` group)
| Route | Purpose |
|---|---|
| `/home` | The landing — live 3D hero + Phase-0 prompt bar, stats, how-it-works, capabilities, gallery teaser, pricing teaser, FAQ, closing CTA |
| `/how-it-works` | The guided path in full (Phases 0–6), each with a 3D icon |
| `/pricing` | E6 tier stubs (Studio / Pro / Enterprise) — limits mirror the real per-tenant quotas; model labels pulled from `getModelRegistry()` (FP4) |
| `/gallery` | E2 template gallery — six `.prism` templates with per-template 3D signature jewels + "Remix" (→ sign-up → build) |
| `/docs` | Documentation reading shell (sidebar + prose) |
| `/changelog` | Public changelog (mirrors shipped shell waves) |
| `/legal`, `/legal/terms`, `/legal/privacy` | Legal shells + contact anchor |

### SEO (decision D)
- Every page is a **server component** with per-page `metadata` (title template,
  description, canonical, OpenGraph, Twitter card).
- `src/app/sitemap.ts` (9 public routes; excludes `/app`, `/`, labs) and
  `src/app/robots.ts` (disallows `/app/`, `/api/`, `/sign-in`, `/sign-up`).
- Lighthouse SEO 91 (the one flagged audit, `meta-description`, is a Next-dev
  false-negative — the `<meta name="description">` tag is present in the SSR
  HTML, verified via curl; crawlers see it).

### The live hero showpiece (S2 hero)
`HeroShowpiece3D` renders a **real-time 3D scene** — a signal-red prism rising
through a chrome gyroscope over a machined pedestal, ringed by a small
constellation of graph nodes wired in red (the app-as-graph made literal), with
chrome shards drawn upward. It responds to the pointer (parallax) so a visitor
can feel it is live, not a video. Built on the shell's single-sourced
`premium.ts` material system (DL2/DL10). Reduced-motion holds a static, readable
pose; the island is `dynamic(ssr:false)` behind an SSR poster inside a `Lazy3D`
viewport + capability guard, so it **never blocks LCP** (DL8) and degrades to the
poster on low-GPU / no-WebGL / render failure.

### Landing prompt → Phase 0 handoff (S2 — no dead-end)
`HeroPrompt` navigates to `/app/build?prompt=<encoded>`. The handoff is
auth-aware **without the component knowing the session**: the existing `/app/*`
edge guard (`middleware.ts` + `safeNextPath`) redirects a signed-out visitor to
`/sign-in?next=…` and back to the same intake URL after auth — the prompt rides
through untouched. Empty prompt still enters `/app/build` (never nowhere).

---

## 2. Gate — all green

| Check | Result |
|---|---|
| **Handoff signed-in** | prompt "a booking site for my barbershop with online payments" seeded verbatim into the intake field (`05-handoff-intake-signedin.png`) |
| **Handoff signed-out** | `/app/build?prompt=…` (no cookie) → `307 → /sign-in?next=%2Fapp%2Fbuild%3Fprompt%3D…` (prompt preserved) |
| **Desktop frame** | `01-hero-desktop.png` — premium live hero + crisp Build button |
| **390px mobile frame** | `06-hero-mobile-390.png` — hero stage on top, collapsed nav; `07-mobile-menu-open.png` drawer |
| **Reduced-motion frame** | `08-hero-reduced-motion.png` — island holds a static pose (WCAG 2.3.3), 0 console errors |
| **A11y (Lighthouse desktop)** | **100** — landmarks, heading hierarchy, skip link, aria-labels, focus-visible, contrast (color-contrast + label-in-name both pass), zoomable viewport (`maximumScale:5`, restored for the marketing subtree) |
| **Best Practices (Lighthouse)** | **100** |
| **Perf (Fast 4G + 4× CPU, mobile)** | **LCP 548 ms**, **CLS 0.00** — showpiece does not block LCP (`perf-lcp-cls.txt`) |
| **tsc `--noEmit`** | **9 = baseline** (1 GraphScene + 8 test fixtures); **0 new** in any W6 file |
| **`npm run verify`** | **EXIT 0** — prism 6/6, global-shell, parity-static, schema 338/338, repair-loop, galaxy |
| **`verify:tenancy`** | **30/30 GREEN (I11)** |
| **Console errors on all routes** | 0 (after dev-server restart cleared a stale-chunk HMR artifact) |

---

## 3. Design Law + invariant compliance

- **DL1** dark-first true-black base; **DL2** RED/BLACK/WHITE — marketing
  imports `prism-premium-tokens` / uses `--pp-*`, invents no parallel palette;
  **DL3** Fraunces × JetBrains Mono via `shellFontVariables`, zero grotesques;
  **DL4** no flat glassmorphism — depth is real 3D + solid machined elevation +
  hairlines, no backdrop-blur frosted cards; **DL5** icons are real 3D forms
  from the `premium.ts` set (`PremiumIcon3D`), no icon packs / emoji; **DL7**
  crisp 1px hairlines, exact geometry; **DL8** perf is a design law — verified
  LCP-safe on 4G mobile; **DL10** photoreal materiality on the showpieces.
- **FP4** — no hardcoded model-id strings in components (grep clean); pricing
  reads `getModelRegistry()`.
- **FP7** — `src/app/page.tsx`, `src/components/editor/**`,
  `src/lib/prism/runtime/**`, `globals.css` all untouched. `.mk` owns its own
  scroll rather than edit `globals.css`.
- **I0** — marketing is DOM (correct); the 3D islands are bounded DOM-shell
  canvases (the allowed carve-out), importing only R3F/three + shell materials,
  speaking no engine contract.
- **I5** — public copy only; no secret reads (only `NEXT_PUBLIC_SITE_URL`).

---

## 4. Deviations (logged before/at code; reviewer-accepted)

1. **Landing at `/home`, not `/`.** `/` is the FP7-protected editor prototype.
   The marketing landing therefore lives at `/home`, and an **env-gated apex
   rewrite** (`next.config.mjs`) serves it at `/` on the marketing deployment
   (`PRISM_SURFACE=marketing`). **OFF by default** — `/` continues to resolve to
   the editor and every existing verify script that hits `/` is unaffected.
2. **Hero renders on the WebGL2 tier, not the WebGPU backend.** The Prism
   *runtime* is `three/webgpu` (WebGL2 fallback). The marketing hero's premium
   IBL look depends on `PMREMGenerator`, which is **unsupported on
   `WebGPURenderer` in this three build** — the editor's own `GraphScene`
   likewise keeps PMREM off the WebGPU path (it uses a LightingRig). WebGL2 is
   the engine's own fallback backend, gives the identical materials with
   reliable, universally-capturable refraction, and never black-frames in
   headless. The hero badge reads **"Live · real-time 3D"** (not "WebGPU") so
   the claim is exact. Flip path documented: `HERO_BACKEND` in
   `HeroShowpiece3D.tsx`.

---

## 5. Dual-judge verdicts

- **Criteria reviewer (`prism-criteria-reviewer`, fresh context, diff + S2
  rubric):** **PASS — 0 MUST-FIX.** Two SHOULD-FIX, both addressed in
  `c7fad5ce`: the "5 modes" stat corrected to "3 modes" (canonical view-mode
  count); a lockstep comment added to `posters.tsx` for the inlined premium.ts
  hexes.
- **User-advocate (evidence-based, non-technical):** first pass returned **1
  MUST-FIX** — the translucent sticky header let scrolled section copy bleed up
  and collide with the logo (how-it-works), plus a flag on the muddy in-prompt
  3D CTA. **Both fixed** in `c7fad5ce`: header is now solid/opaque with
  `scroll-padding-top`; the 3D CTA was replaced with a crisp machined red
  "Build →" button. Re-review verdict appended below.

**Advocate re-review (post-fix, judged the refreshed frames independently):**
**net `PLEASED`, gate `PASS`, 0 MUST-FIX.** Verbatim: *"A stranger would say:
'This is the most premium builder I've seen — the hero is genuinely alive, the
type and colours feel bespoke, and when I typed my idea and hit Build it took me
right in with my exact words.' Both prior nicks — the header/logo text collision
and the muddy Build button — are gone, and mobile and reduced-motion hold up."*
One cosmetic non-blocking flag: at one exact scroll offset the Features red
eyebrow grazes the now-opaque nav's bottom edge (still legible; a
scroll-capture framing artifact, not a collision — normal sticky-header
behaviour).

**Both judges PASS with 0 MUST-FIX. Gate CLEAR.**

---

## 6. Founder / operator notes

- **Marketing deployment:** set `PRISM_SURFACE=marketing` to serve the landing
  at `/` (apex). Set `NEXT_PUBLIC_SITE_URL` to the real marketing origin so
  `metadataBase`, canonical URLs, OG, sitemap, and robots emit absolute URLs
  (defaults to `https://prism.build`).
- **Contact/sales:** enterprise + sales CTAs point at `/legal#contact`
  (`hello@prism.build`); wire a real inbox/route when sales is live.
- **Pricing dollar figures are stubs (E6)** — honestly labelled on the page; the
  limits are the real enforced per-tenant quotas. Finalize on billing wire-up.

## 7. Evidence index — `notes/verification/shell-w6/`
`01-hero-desktop.png` · `03-features-desktop.png` · `04-gallery-teaser.png` ·
`05-handoff-intake-signedin.png` · `06-hero-mobile-390.png` ·
`07-mobile-menu-open.png` · `08-hero-reduced-motion.png` ·
`09-pricing-desktop.png` · `10-how-it-works.png` · `11-docs.png` ·
`12-gallery-full.png` · `perf-lcp-cls.txt`
