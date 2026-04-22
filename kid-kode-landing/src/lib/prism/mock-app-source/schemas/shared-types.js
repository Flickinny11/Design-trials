// Shared contract schemas for the Prism mock app.
//
// §3.1 + §5.4 of the spec expect a `schemas/shared-types.js` module shipped
// inside the .prism archive. Per §3.1 the canonical form in a production Prism
// build is a Zod-backed TS module compiled to JS. For the mock we ship a
// zero-dependency equivalent: each schema is a plain descriptor object naming
// the fields + JS types of inputs/outputs referenced by node contracts in
// `graph.json` (e.g. hero-card-cta's output `{ clickCount: z.number() }`,
// spec §3.1 line 477).
//
// Consumers (this mock has none in-runtime yet) can treat these as shape
// references for contract validation/UX; the authoritative contract still
// lives in the graph's `intent.contracts.{inputs,outputs}` map.

// ── Primitive schema helpers (stand in for z.number / z.string / z.boolean) ──
// `specRef` is documentation only — the literal expression a production Prism
// build would compile into Zod. Consumers should treat these descriptors as
// shape hints, not as evaluable code.
export const Number$ = Object.freeze({ kind: 'number', specRef: 'z.number()' });
export const String$ = Object.freeze({ kind: 'string', specRef: 'z.string()' });
export const Boolean$ = Object.freeze({ kind: 'boolean', specRef: 'z.boolean()' });

function object(shape) {
  return Object.freeze({ kind: 'object', shape: Object.freeze({ ...shape }) });
}

// ── Contract schemas referenced by the mock graph ───────────────────────────

// hero-card-cta — spec §3.1 line 475-478 declares outputs `{ clickCount: z.number() }`.
// Matches POST /api/mock/track-cta-click response body (§6 / backends/hero-card-cta.js).
export const HeroClickCounter = object({
  clickCount: Number$,
});

// user-preferences backend (§6 line 1000-1002) — GET returns / POST accepts.
export const UserPreferences = object({
  notificationsEnabled: Boolean$,
  theme: String$,
});

// analytics backend (§6 line 1004-1005) — GET returns an aggregated rollup.
// Shape taken verbatim from backends/analytics.js (the source of truth).
export const AnalyticsSummary = object({
  totalClicks: Number$,
  sessions: Number$,
  avgSessionTime: Number$,
});

// Convenience registry — lets tooling introspect the full schema set without
// enumerating named exports.
export const schemas = Object.freeze({
  HeroClickCounter,
  UserPreferences,
  AnalyticsSummary,
});
