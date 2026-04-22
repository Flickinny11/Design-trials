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
export const Number$ = Object.freeze({ kind: 'number', ref: 'z.number()' });
export const String$ = Object.freeze({ kind: 'string', ref: 'z.string()' });
export const Boolean$ = Object.freeze({ kind: 'boolean', ref: 'z.boolean()' });

function object(shape) {
  return Object.freeze({ kind: 'object', shape: Object.freeze({ ...shape }) });
}

// ── Contract schemas referenced by the mock graph ───────────────────────────

// hero-card-cta backend (§3.1 line 475-478) — outputs { clickCount: z.number() }.
// Matches POST /api/mock/track-cta-click response body (§6 / backends/hero-card-cta.js).
export const HeroClickCounter = object({
  clickCount: Number$,
});

// user-preferences backend (§6 "Mock Endpoint List") — GET returns, POST accepts.
export const UserPreferences = object({
  notificationsEnabled: Boolean$,
  theme: String$,
});

// analytics backend (§6 Mock Endpoint List) — POST body shape.
export const AnalyticsEvent = object({
  event: String$,
  nodeId: String$,
});

// Convenience registry — lets tooling introspect the full schema set without
// enumerating named exports.
export const schemas = Object.freeze({
  HeroClickCounter,
  UserPreferences,
  AnalyticsEvent,
});
