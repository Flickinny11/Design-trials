// PRISM NODE-EDITOR V2 — CapabilityProvider factory (D1 swap seam). Server-only.
// One place to choose the active provider. Default = MCP reference adapter
// (open standard, offline-capable). Set PRISM_CAPABILITY_PROVIDER=pipedream|
// composio|nango to swap aggregators once their SDK is installed + keyed. Route
// handlers import THIS; client components never import an adapter (INV-NEV2-4).
import 'server-only';
import type { CapabilityProvider } from '../../lib/capabilities/provider';
import { McpReferenceAdapter } from './mcp-adapter';
import { PipedreamAdapter, ComposioAdapter, NangoAdapter } from './aggregator-stubs';

let cached: CapabilityProvider | null = null;

export function getCapabilityProvider(): CapabilityProvider {
  if (cached) return cached;
  const choice = (process.env.PRISM_CAPABILITY_PROVIDER || 'mcp').toLowerCase();
  switch (choice) {
    case 'pipedream': cached = new PipedreamAdapter(); break;
    case 'composio': cached = new ComposioAdapter(); break;
    case 'nango': cached = new NangoAdapter(); break;
    case 'mcp':
    default: cached = new McpReferenceAdapter(); break;
  }
  return cached;
}

export function __resetCapabilityProvider(): void { cached = null; }
