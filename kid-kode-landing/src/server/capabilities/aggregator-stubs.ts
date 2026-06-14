// PRISM NODE-EDITOR V2 — aggregator adapter STUBS (D1). Server-only.
// Pipedream / Composio / Nango are alternative CapabilityProvider backends to
// the MCP reference adapter. Shipped as TYPED STUBS: each documents the live SDK
// + verified June-2026 version, and signals "not configured" until wired.
// Choosing one later is a config change — NO UI rework (INV-NEV2-4, D1).
import 'server-only';
import type {
  CapabilityProvider,
  ActionTileDescriptor,
  PlatformDescriptor,
  ValidationResult,
  ConnectResult,
} from '../../lib/capabilities/provider.ts';
import type { IntegrationAsset, IntegrationAuthMethod, CapabilityRef } from '../../lib/prism-graph/types.ts';

abstract class AggregatorStub implements CapabilityProvider {
  abstract readonly id: string;
  abstract readonly sdk: { pkg: string; version: string; env: string };
  get live(): boolean {
    return Boolean(process.env[this.sdk.env]);
  }
  private notConfigured(): never {
    throw new Error(
      `${this.id} adapter is a stub. To enable: npm i ${this.sdk.pkg}@${this.sdk.version}, ` +
        `set ${this.sdk.env}, and wire the live calls in this file. Until then use the MCP reference adapter.`,
    );
  }
  async searchActions(_q: string, _l?: number): Promise<ActionTileDescriptor[]> { this.notConfigured(); }
  async validateAction(_i: { actionId: string; params?: Record<string, unknown> }): Promise<ValidationResult> { this.notConfigured(); }
  async searchPlatforms(_q: string, _l?: number): Promise<PlatformDescriptor[]> { this.notConfigured(); }
  async connect(_i: { platformId: string; method: IntegrationAuthMethod }): Promise<ConnectResult> { this.notConfigured(); }
  async listAssets(_i: { platformId: string; capabilityRef: CapabilityRef }): Promise<IntegrationAsset[]> { this.notConfigured(); }
}

/** Pipedream Connect — 2700+ APIs, thousands of prebuilt maintained actions. */
export class PipedreamAdapter extends AggregatorStub {
  readonly id = 'pipedream';
  readonly sdk = { pkg: '@pipedream/sdk', version: '3.1.0', env: 'PIPEDREAM_CLIENT_SECRET' };
}

/** Composio — AI-native executable tools + managed auth. */
export class ComposioAdapter extends AggregatorStub {
  readonly id = 'composio';
  readonly sdk = { pkg: '@composio/core', version: '0.10.0', env: 'COMPOSIO_API_KEY' };
}

/** Nango — OSS, self-hostable, 400+ providers, full control. */
export class NangoAdapter extends AggregatorStub {
  readonly id = 'nango';
  readonly sdk = { pkg: 'nango', version: '0.70.6', env: 'NANGO_SECRET_KEY' };
}
