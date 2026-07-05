# SHELL W-1A — ACCOUNTS & TENANCY (Better Auth, Google/GH one-click, isolation)

Branch `codex/prism-recovery-harness-20260630`. Additive only. Evidence law.

## Governing
Spec §8 (I2, I5, NEW I11 tenant isolation — §14), §10 Global, §12/§14 (W1A) ·
DECISIONS 2026-07-04 (multi-tenant scope clarification — verbatim founder) ·
ENHANCEMENTS E6 · DESIGN LAW DL1–DL14 (auth screens are shell surfaces) ·
VERIFICATION-STANDARD · NEAR-HUMAN-QA.

## Hard boundaries
Better Auth ONLY (I2), sameSite:'lax'. No second auth system. No secrets
client-side (I5). Canvas `/` untouchable. Contract-first (I4): schemas before
routes. OAuth app credentials: read from env; if env lacks Google/GitHub
client ids, build fully against Better Auth's providers with placeholder env
names, prove the flow with the email/dev provider headlessly, and list the
exact env vars for the founder in the report (do NOT block).

## Tasks
1. Better Auth wiring: Google + GitHub one-click providers + session
   management; auth screens (sign-in/up) under DESIGN LAW (premium.ts
   controls, DL3 type, dark-first) with mobile parity.
2. Schema (tRPC+Zod, contract-first): user, org (enterprise-tier stub),
   project, projectVersion (E1 snapshot pointer), planTier stub (E6).
   Additive `prism-` types in shared-interfaces.
3. Per-tenant storage: project graphs/assets keyed by tenant; wire the
   established stack (Supabase/R2 per existing patterns in repo).
4. **I11 isolation probe (CI):** two seeded users; assert every project/graph/
   asset route returns only owner data; cross-tenant access attempts fail
   closed. Wire into npm run verify as verify:tenancy.
5. Route guards: /app/* requires session; signed-out → premium sign-in;
   post-auth lands on dashboard shell (placeholder until W4).

## Gate
Signup→dashboard proven headless on the available provider path (frames);
isolation probe green in verify chain; S-auth screens pass DL sweep; tsc
0-new; Cortex + full existing verify ALL GREEN. Dual judges 0 MUST-FIX.

## Process
Commits+frames; deviations logged BEFORE code; report
notes/SHELL-W1A-REPORT.md incl. exact OAuth env var list for founder.
Markers: `PRISM-SHELL-W1A: RUN COMPLETE` / `PRISM-SHELL-W1A: BLOCKED-NEEDS-FOUNDER`

---
## FOUNDER ADDENDUM — 2026-07-04 14:58 CDT (binding; judges enforce)
DL15–DL16 just added to the design law — read them. (1) The Google and
GitHub sign-in buttons MUST carry the REAL official brand marks — colored,
premium, 3D-rendered (extruded/beveled, true shading), brand-guideline
colors — per DL15. (2) Auth screens must satisfy DL16: photoreal material
richness over the dark base — no flat all-black backgrounds or all-black
buttons anywhere. Recapture affected frames. Judges verify DL15+DL16
explicitly.
