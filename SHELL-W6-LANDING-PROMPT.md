# SHELL W-6 — LANDING/MARKETING (Next.js surface, live hero, gallery)

Branch `codex/prism-recovery-harness-20260630`. Additive. Evidence law.

## Governing
Spec §10(S2), §12(W6) · DECISIONS D (Next.js marketing surface) ·
ENHANCEMENTS E2 · DESIGN LAW DL1–DL14 (this is the showpiece: DL10/DL11 at
full strength, DL8 still binds) · V-STANDARD · NEAR-HUMAN-QA.

## Hard boundaries
Landing prompt CTA MUST enter Phase 0 — no dead end (S2). LCP never blocked
by the showpiece (lazy behind meaningful first paint); reduced-motion +
low-GPU fallbacks. 380px correct. Bespoke Prism Premium — a generic template
look is a MUST-FIX DESIGN LAW failure. No grotesques, packs, emoji, CSS-style.

## Tasks
1. Next.js marketing app (decision D) alongside the Vite app: landing,
   how-it-works, pricing (tier stubs, E6 copy), gallery (E2 templates +
   showcase builds), docs/changelog/legal shells; SEO (SSR, meta, OG).
2. Hero: LIVE WebGPU showpiece proving the 3D capability (real scene, not
   video) — premium.ts materiality, ambient refraction, weighted motion;
   deferred/lazy per DL8 with instant-feeling first paint.
3. Landing prompt bar → hands off into the app's intake Phase 0 (auth-aware:
   signed-out → sign-in → resumes intake with the prompt preserved).
4. A11y: WCAG 2.2 AA pass on the marketing surface (keyboard, contrast,
   reduced-motion honored by the hero).
5. Perf evidence: LCP/CLS measured headless on 4G-throttled mobile profile;
   numbers in the report.

## Gate (spec: live hero + landing-prompt→build + a11y + perf verified)
Headless: land → prompt → auth → intake with prompt intact. Frames desktop +
390px incl. reduced-motion state. S2 checklist green; DL sweep; tsc 0-new;
full verify + tenancy ALL GREEN. Dual judges 0 MUST-FIX (advocate: "would a
stranger believe this is the most premium builder they've seen?").

## Process
Commits+frames; deviations BEFORE code; report notes/SHELL-W6-REPORT.md.
Markers: `PRISM-SHELL-W6: RUN COMPLETE` / `PRISM-SHELL-W6: BLOCKED-NEEDS-FOUNDER`
