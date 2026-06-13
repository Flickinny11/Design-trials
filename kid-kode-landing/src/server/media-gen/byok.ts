import 'server-only';

// CANVAS-FINAL — Prism Media Generator: Bring-Your-Own-Key hook (documented
// stub). Prism presents one in-house generator; a user MAY later add their own
// API key for another platform, resolved server-side through the secrets vault
// as a capability reference (INV-19 — the raw key never enters graph data or
// the client bundle). This is the seam for that, intentionally not fully wired:
// today every request uses the default fal backing provider.
//
// To wire later: read the user's provider capability ref from the vault
// (src/server/secrets/vault.resolve(scope, ref)), instantiate that platform's
// MediaProvider, and return it. The route surface does not change — getProvider
// already prefers a BYOK provider when one resolves.

import type { MediaProvider } from './types';

export interface ProviderContext {
  /** Vault scope identifying the user/app (capability-ref resolution). */
  scope?: string;
  /** Capability ref naming the user's own provider key, if they added one. */
  providerKeyRef?: string;
}

/** Resolve a user-supplied provider, or null to fall back to the default
 *  backing provider. Stub: always null today (default fal). */
export function resolveUserProvider(_ctx: ProviderContext): MediaProvider | null {
  return null;
}

/** Whether BYOK is configured for this context (UI hint surface). Stub. */
export function hasUserProvider(_ctx: ProviderContext): boolean {
  return false;
}
