// PRISM NODE-EDITOR V2 — CapabilityProvider interface (D1, provider-agnostic).
//
// The Functions tab (criteria B) and Integrations tab (criteria C) source their
// catalog, branded logos, validation, managed auth, and saved-asset listing
// through THIS interface — never through a single aggregator's SDK directly
// (INV-NEV2-4). Adapters implement it:
//   • McpReferenceAdapter   — the DEFAULT, open-standard reference adapter
//     (@modelcontextprotocol/sdk). Offline it serves a curated REAL-provider
//     catalog with REAL brand marks + simulated sandbox validation; with a key
//     it connects to real MCP servers/registries.
//   • Pipedream / Composio / Nango adapters — typed stubs (document live SDK).
//
// Picking the live aggregator later is a `getCapabilityProvider()` config
// change — no UI rework (the COGS/vendor decision defers cleanly, D1).

import type {
  IntegrationAsset,
  IntegrationAuthMethod,
  CapabilityRef,
} from '../prism-graph/types.ts';

/** A branded action returned by `searchActions` — becomes a draggable tile (B2). */
export interface ActionTileDescriptor {
  /** Provider-scoped action id (stable). */
  actionId: string;
  /** Plain-language action label ("Create payment intent"). */
  label: string;
  /** Platform name ("Stripe"). */
  platform: string;
  /** Brand key → real logo via brand-assets (NOT stock, NOT fake). */
  brandKey: string;
  /** Short description for the tile subtitle. */
  description?: string;
  /** Category tag for grouping ("Payments", "Comms", "Compute"). */
  category?: string;
  /** Declared non-secret params the action accepts. */
  params?: Array<{ name: string; type: string; required?: boolean }>;
}

/** A platform the user can connect in the Integrations tab (C1). */
export interface PlatformDescriptor {
  platformId: string;
  platform: string;
  brandKey: string;
  /** Auth methods this platform supports (C2). */
  authMethods: IntegrationAuthMethod[];
  category?: string;
  description?: string;
}

/** Result of validating a function tile against the provider (B4). */
export interface ValidationResult {
  ok: boolean;
  /** 'valid' | 'broken' — surfaced as the tile badge. */
  status: 'valid' | 'broken';
  message: string;
  /** When broken AND auto-fixable, the patched params the adapter proposes. */
  autoFix?: { params: Record<string, unknown>; note: string };
}

/** Result of a (managed) auth connect (C2). Yields a capability REFERENCE — the
 *  raw credential stays in the provider/vault (INV-NEV2-2 / INV-R13). */
export interface ConnectResult {
  ok: boolean;
  capabilityRef?: CapabilityRef;
  /** For OAuth, the URL the UI would open; for mock flows, a sentinel. */
  authUrl?: string;
  message: string;
}

/** The provider-agnostic capability surface (D1). */
export interface CapabilityProvider {
  /** Stable provider id ('mcp' | 'pipedream' | 'composio' | 'nango'). */
  readonly id: string;
  /** Whether a live backend is configured (key present). False → stub data. */
  readonly live: boolean;

  // ── Functions tab ──────────────────────────────────────────────────────────
  /** Auto-complete action search (B1/B2). Returns branded tiles. */
  searchActions(query: string, limit?: number): Promise<ActionTileDescriptor[]>;
  /** Validate a function tile's action+params against the provider sandbox (B4). */
  validateAction(input: {
    actionId: string;
    params?: Record<string, unknown>;
  }): Promise<ValidationResult>;

  // ── Integrations tab ────────────────────────────────────────────────────────
  /** Auto-fill platform search (C1). */
  searchPlatforms(query: string, limit?: number): Promise<PlatformDescriptor[]>;
  /** Managed one-click auth (C2). Returns a capability REFERENCE only. */
  connect(input: {
    platformId: string;
    method: IntegrationAuthMethod;
  }): Promise<ConnectResult>;
  /** Once connected, self-populate the user's saved assets on the platform (C3). */
  listAssets(input: {
    platformId: string;
    capabilityRef: CapabilityRef;
  }): Promise<IntegrationAsset[]>;
}
