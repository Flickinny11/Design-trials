// PRISM WORKSPACE-COMPLETION W-2 — Nango CapabilityProvider adapter (D1).
// Server-only. A REAL, build-safe, GATED adapter behind the provider-agnostic
// CapabilityProvider seam. Nango is the chosen aggregator (SPEC §10): open-source,
// self-hostable, white-label one-click auth across 800+ APIs, OAuth2.1 / API-key /
// JWT / MCP-Auth, token refresh, a Proxy API, and a remote function builder. It
// satisfies INV-W7 (capability-references-only): the raw credential stays inside
// Nango's vault and never enters Prism's graph data or client bundle.
//
// OFFLINE-FIRST CONTRACT (W-2 / W-5):
//   • The MCP reference adapter remains the offline DEFAULT. The factory
//     (capability-provider.ts) selects Nango ONLY when NANGO_SECRET_KEY is set,
//     so the build + all verification run WITHOUT live Nango keys.
//   • This file NEVER hard-imports the Nango SDK. The client is resolved lazily
//     through `optionalImport('@nangohq/node')` (the bundler-hidden importer),
//     so `next build` does not try to resolve the absent module and `npm`
//     install of the dep is NOT required for the offline harness.
//   • `live` is false without a key; the live methods are reached only when keyed
//     (W-5). They are still written defensively: a null client throws a clear,
//     actionable error rather than silently returning bad data.
//
// LIVE-ACTIVATION (the production swap, done at W-5 — no UI rework, D1):
//   1. npm i @nangohq/node           (current: 0.70.x, June 2026)
//   2. export NANGO_SECRET_KEY=...    (and NANGO_HOST=... for a self-hosted Nango)
//   3. export PRISM_CAPABILITY_PROVIDER=nango
// With all three set, getCapabilityProvider() returns this adapter and the live
// Nango API is exercised. Without the key, the factory falls back to MCP.
//
// Nango Node SDK surface used (docs.nango.dev/reference/sdks/node, June 2026):
//   • new Nango({ secretKey, host? })
//   • listProviders()                  → { data: [{ name, categories, auth_mode, ... }] }
//   • getProvider({ provider })        → { data: { name, categories, auth_mode, ... } }
//   • getScriptsConfig()               → integrations[].actions[] (account's configured actions)
//   • createConnectSession({ allowed_integrations }) → { data: { token, connect_link, expires_at } }
//   • listConnections({ integrationId }) → { connections: [{ connection_id, provider_config_key, ... }] }
//   • proxy.get({ endpoint, providerConfigKey, connectionId }) → raw provider response
import 'server-only';
import { optionalImport } from '../optional-import';
import type {
  CapabilityProvider,
  ActionTileDescriptor,
  PlatformDescriptor,
  ValidationResult,
  ConnectResult,
} from '../../lib/capabilities/provider';
import type {
  IntegrationAsset,
  IntegrationAuthMethod,
  CapabilityRef,
} from '../../lib/prism-graph/types';

// ── Minimal structural typings for the slice of the Nango SDK we call ────────
// The dep is NOT installed, so we cannot `import type` from it. We declare only
// the methods + response fields this adapter touches and narrow the dynamically
// imported module to this shape. Everything stays `unknown`-safe (no `any` leak)
// so tsc is clean with the package absent (mirrors mcp-adapter's optional dep).
interface NangoProvider {
  name?: string;
  categories?: string[];
  /** Nango auth mode, e.g. 'OAUTH2' | 'API_KEY' | 'BASIC' | 'JWT' | 'OAUTH2_CC'. */
  auth_mode?: string;
  docs?: string;
}
interface NangoIntegrationConfig {
  unique_key?: string;
  provider?: string;
}
interface NangoScriptAction {
  name?: string;
  description?: string;
}
interface NangoScriptsIntegration {
  providerConfigKey?: string;
  provider?: string;
  actions?: NangoScriptAction[];
}
interface NangoConnection {
  connection_id?: string;
  provider?: string;
  provider_config_key?: string;
}
interface NangoConnectSession {
  token?: string;
  connect_link?: string;
  expires_at?: string;
}
interface NangoProxyResponse {
  status?: number;
  data?: unknown;
}
interface NangoClient {
  listProviders(): Promise<{ data?: NangoProvider[] }>;
  getProvider(opts: { provider: string }): Promise<{ data?: NangoProvider }>;
  listIntegrations(): Promise<{ configs?: NangoIntegrationConfig[] }>;
  getScriptsConfig?(): Promise<NangoScriptsIntegration[]>;
  createConnectSession(opts: {
    allowed_integrations?: string[];
    tags?: Record<string, string>;
  }): Promise<{ data?: NangoConnectSession }>;
  listConnections(params?: {
    connectionId?: string;
    integrationId?: string;
  }): Promise<{ connections?: NangoConnection[] }>;
  proxy: {
    get(config: {
      endpoint: string;
      providerConfigKey: string;
      connectionId: string;
    }): Promise<NangoProxyResponse>;
  };
}
type NangoCtor = new (config: { secretKey: string; host?: string }) => NangoClient;

/** Nango `auth_mode` → Prism `IntegrationAuthMethod` (C2). Conservative + total:
 *  anything unmapped still yields at least one usable method. */
function authMethodsForMode(mode?: string): IntegrationAuthMethod[] {
  const m = (mode || '').toUpperCase();
  if (m.startsWith('OAUTH')) return ['oauth2.1', 'api-token'];
  if (m === 'API_KEY' || m === 'BASIC' || m === 'JWT' || m === 'APP') return ['api-token'];
  if (m === 'TBA' || m === 'CUSTOM') return ['oauth2.1'];
  return ['api-token'];
}

/** Best-effort category label from Nango's `categories[]`. */
function categoryFor(p: NangoProvider): string | undefined {
  const first = p.categories?.[0];
  if (!first) return undefined;
  return first.charAt(0).toUpperCase() + first.slice(1);
}

function matchScore(q: string, ...fields: string[]): number {
  const needle = q.trim().toLowerCase();
  if (!needle) return 1;
  let best = 0;
  for (const f of fields) {
    const h = (f || '').toLowerCase();
    if (h === needle) best = Math.max(best, 4);
    else if (h.startsWith(needle)) best = Math.max(best, 3);
    else if (h.includes(needle)) best = Math.max(best, 2);
  }
  return best;
}

export class NangoAdapter implements CapabilityProvider {
  readonly id = 'nango';

  /** Live only when a Nango secret key is configured (gated behind W-5). */
  get live(): boolean {
    return Boolean(process.env.NANGO_SECRET_KEY);
  }

  private clientPromise: Promise<NangoClient | null> | null = null;

  /** Lazily resolve a Nango client. Returns null when the key is absent OR the
   *  SDK is not installed — so the offline build never resolves the module. The
   *  result is memoized per process. */
  private async client(): Promise<NangoClient | null> {
    if (this.clientPromise) return this.clientPromise;
    this.clientPromise = (async (): Promise<NangoClient | null> => {
      const secretKey = process.env.NANGO_SECRET_KEY;
      if (!secretKey) return null;
      // Optional dep — present only when the live Nango path is wired (W-5).
      // Hidden from the bundler via optionalImport so build works offline.
      const mod = await optionalImport<{ Nango?: NangoCtor; default?: NangoCtor }>(
        '@nangohq/node',
      );
      if (!mod) return null;
      const Ctor = mod.Nango ?? mod.default;
      if (typeof Ctor !== 'function') return null;
      const host = process.env.NANGO_HOST || undefined;
      return new Ctor({ secretKey, host });
    })();
    return this.clientPromise;
  }

  /** Resolve the client or fail loud. The factory guarantees MCP is used when
   *  unkeyed, so this never fires in the offline build/verify path. */
  private async requireClient(): Promise<NangoClient> {
    const c = await this.client();
    if (!c) {
      throw new Error(
        'Nango not configured (set NANGO_SECRET_KEY + install @nangohq/node). ' +
          'Falling back to the MCP reference adapter is the offline default.',
      );
    }
    return c;
  }

  // ── Functions tab ──────────────────────────────────────────────────────────
  // Branded action tiles from the account's configured Nango integrations +
  // their action scripts. Nango has no global "every action across 800 APIs"
  // catalog endpoint; `getScriptsConfig()` returns the actions actually wired in
  // the connected Nango account (the maintained, executable implementations).
  async searchActions(query: string, limit = 24): Promise<ActionTileDescriptor[]> {
    const nango = await this.requireClient();
    let integrations: NangoScriptsIntegration[] = [];
    try {
      if (typeof nango.getScriptsConfig === 'function') {
        integrations = (await nango.getScriptsConfig()) ?? [];
      }
    } catch {
      integrations = [];
    }
    const tiles: ActionTileDescriptor[] = [];
    for (const integ of integrations) {
      const brandKey = (integ.provider || integ.providerConfigKey || '').toLowerCase();
      const platform = integ.provider || integ.providerConfigKey || 'Integration';
      for (const action of integ.actions ?? []) {
        if (!action.name) continue;
        tiles.push({
          actionId: action.name,
          label: action.name,
          platform,
          brandKey,
          description: action.description,
        });
      }
    }
    return tiles
      .map((t) => ({ t, s: matchScore(query, t.label, t.platform, t.brandKey, t.description ?? '') }))
      .filter((x) => x.s > 0)
      .sort((x, y) => y.s - x.s)
      .slice(0, limit)
      .map(({ t }) => t);
  }

  // Lightweight validation: confirm the action's integration/provider exists in
  // Nango (a metadata check, no execution). A live dry-run would consume the
  // user's credits + side-effect their account, so we validate existence only.
  async validateAction(input: {
    actionId: string;
    params?: Record<string, unknown>;
  }): Promise<ValidationResult> {
    const nango = await this.requireClient();
    try {
      let found: NangoScriptsIntegration | undefined;
      if (typeof nango.getScriptsConfig === 'function') {
        const integrations = (await nango.getScriptsConfig()) ?? [];
        found = integrations.find((integ) =>
          (integ.actions ?? []).some((a) => a.name === input.actionId),
        );
      }
      if (!found) {
        return {
          ok: false,
          status: 'broken',
          message: `Action \`${input.actionId}\` not found in the connected Nango account`,
        };
      }
      return {
        ok: true,
        status: 'valid',
        message: `Action \`${input.actionId}\` is wired on ${found.provider ?? found.providerConfigKey} (Nango)`,
      };
    } catch (err) {
      return {
        ok: false,
        status: 'broken',
        message: `Nango validation error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  // ── Integrations tab ────────────────────────────────────────────────────────
  // Nango's provider registry → connectable platforms. `auth_mode` derives the
  // supported auth methods (C2).
  async searchPlatforms(query: string, limit = 24): Promise<PlatformDescriptor[]> {
    const nango = await this.requireClient();
    let providers: NangoProvider[] = [];
    try {
      providers = (await nango.listProviders()).data ?? [];
    } catch {
      providers = [];
    }
    return providers
      .map((p) => {
        const platformId = (p.name || '').toLowerCase();
        const descriptor: PlatformDescriptor = {
          platformId,
          platform: p.name || platformId,
          brandKey: platformId,
          authMethods: authMethodsForMode(p.auth_mode),
          category: categoryFor(p),
          description: p.docs,
        };
        return { descriptor, s: matchScore(query, descriptor.platform, descriptor.category ?? '', platformId) };
      })
      .filter((x) => x.s > 0 && x.descriptor.platformId)
      .sort((x, y) => y.s - x.s)
      .slice(0, limit)
      .map(({ descriptor }) => descriptor);
  }

  // Managed one-click auth → a Nango Connect session. Returns a capability
  // REFERENCE built from Nango ids (integration + an opaque session token id),
  // plus the hosted `connect_link` the UI opens. INV-W7: the ref carries NO
  // token/secret/credential — only ids + labels + provider + authMethod. The
  // raw credential is held by Nango's vault and resolved server-side later.
  async connect(input: {
    platformId: string;
    method: IntegrationAuthMethod;
  }): Promise<ConnectResult> {
    const nango = await this.requireClient();
    try {
      const session = (
        await nango.createConnectSession({ allowed_integrations: [input.platformId] })
      ).data;
      if (!session) {
        return { ok: false, message: `Nango returned no Connect session for ${input.platformId}` };
      }
      // A stable, NON-SECRET reference. We intentionally do NOT store the session
      // token in the ref (it is a short-lived auth bootstrap, not a credential to
      // persist). The connectionId is conventionally the platformId until the
      // hosted flow completes; the vault resolves the live connection by these ids.
      const capabilityRef: CapabilityRef = {
        refId: `nango:${input.platformId}:${input.platformId}`,
        scope: `${input.platformId}:connect`,
        label: `${input.platformId} (${input.method})`,
        provider: 'nango',
        authMethod: input.method,
        integrationId: input.platformId,
        connectionId: input.platformId,
      };
      return {
        ok: true,
        capabilityRef,
        authUrl: session.connect_link,
        message: `Open the Nango Connect flow to authorize ${input.platformId} (capability reference stored)`,
      };
    } catch (err) {
      return {
        ok: false,
        message: `Nango connect failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  // Self-populate the user's saved assets on a connected platform via the Nango
  // Proxy. Nango has no single generic "list everything" endpoint (each provider
  // models assets differently), so this is a best-effort, NEVER-throwing probe:
  // we resolve the live connection, then return [] gracefully where we cannot
  // generically enumerate. Per-provider asset listing is layered in additively.
  async listAssets(input: {
    platformId: string;
    capabilityRef: CapabilityRef;
  }): Promise<IntegrationAsset[]> {
    const nango = await this.client();
    if (!nango) return [];
    try {
      // Confirm a live connection exists for this integration. If none, there are
      // no assets to list yet (the hosted flow has not completed).
      const integrationId =
        (typeof input.capabilityRef.integrationId === 'string'
          ? input.capabilityRef.integrationId
          : undefined) ?? input.platformId;
      const { connections } = await nango.listConnections({ integrationId });
      if (!connections || connections.length === 0) return [];
      // Generic per-provider asset enumeration is not modeled by Nango uniformly;
      // return [] rather than guess an endpoint that could 404 / throw. Concrete
      // providers can be wired here behind a per-platform proxy call.
      return [];
    } catch {
      return [];
    }
  }
}
