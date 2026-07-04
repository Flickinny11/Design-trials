# shared-interfaces (Prism)

Typed, Zod-validated contracts shared across the Prism shell, engine, and
(future) workers. Authored at SHELL W0 (2026-07-04) per
`docs/prism/PRISM-FRONTEND-SHELL-SPEC.md` §0/§8 (I0, I4) and
`docs/prism/PRISM-SHELL-DECISIONS-2026-07-04.md` (decision E).

Provenance note: `PRISM-ENGINE-SPEC-V3.md` §2.2 describes
`packages/shared-interfaces` as "existing" in the full Kriptik monorepo. That
monorepo is not this repository — this package is its Prism-scoped seed,
created fresh here (additive by construction). When the shell merges into the
monorepo, these `prism-*` modules graft into the existing package unchanged.

## Modules

- `src/prism-shell.ts` — the shell↔engine command/event contract (the Prime
  Boundary's only crossing). Versioned envelopes, Zod-parsed.
- `src/prism-collab.ts` — CollabRoom contract, **types only** (decision E).
  Presence, per-property LWW ops, room events. Zero transport code in W0.
- `src/prism-brand.ts` — Brand Profile schema (intake Phase 1 seed).

## Rules

- **Additive only.** Never delete/rename an exported field, variant, or type.
- **`prism-` prefix** on every module; all re-exported through `src/index.ts`.
- **No transport, no DOM, no three.js** in this package — shapes only.
- Contract tests live in `tests/unit/prism-shell-contract.test.ts` and run in
  the default vitest suite.
