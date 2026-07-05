# SHELL W9 — LANDING & MARKETING SURFACE — RUN REPORT

**Status:** IN PROGRESS (skeleton — a skeleton report never reads as done, §11.5)
**Branch:** `codex/prism-recovery-harness-20260630`
**Governing:** W9 founder prompt (2026-07-05) · PRISM-FRONTEND-SHELL-SPEC §10(S2)/§12(W6 substrate) ·
DESIGN-REFERENCES.md · DL1–DL16 · W5B/W6 reports (pricing + marketing truth) · V-STANDARD.

## Mission
Build the marketing/landing surface to an Awwwards-winning standard: the landing
page PROVES the product's live photoreal 3D capability by BEING it. WebGPU-first,
photoreal materials from our own pipeline, cinematic motion, honest copy.

## Required surface (checklist)
- [ ] 1. HERO — full WebGPU showpiece (photoreal centerpiece, cinematic camera, compute particles, scroll-driven, DL12 3D CTA)
- [ ] 2. CAPABILITY SHOWCASE — live galaxy/canvas/preview teases
- [ ] 3. HOW IT WORKS — animated 3D sequence (intake→plan→build→verify→ship)
- [ ] 4. INTEGRATIONS WALL — DL15 colored 3D brand marks
- [ ] 5. PRICING — W5B shipped truth exactly (Prism Cloud included, host adapters, Managed Care $39/mo per app Pro/Enterprise, free fix-anytime)
- [ ] 6. NAV — 3D hover language (E13-consistent) + footer
- [ ] 7. RESPONSIVE + reduced-motion static-luxe + WebGL2 fallback

## Invariants (diff-verified at close)
- [ ] I-CANVAS: `/` editor byte-untouched
- [ ] I-SHELL: outside (marketing) untouched
- [ ] I-SPEC: no canonical spec edits; deviations in notes/spec-deviations-w9.md BEFORE code
- [ ] I-SECRETS: no key material anywhere
- [ ] I-PERF: hero 60fps desktop; a11y=100; perf>=80 desktop
- [ ] I-EVIDENCE: every claim has a frame or command output

## Asset generation
`.assetgen/replicate.key` present + non-empty at run start → generation pipeline ACTIVE.
(Recheck before final polish.)

## Commits
(recorded as they land)

## Gate evidence
(pending — notes/verification/shell-w9/)

## Dual judges
(pending)

## Deviations
See notes/spec-deviations-w9.md.
