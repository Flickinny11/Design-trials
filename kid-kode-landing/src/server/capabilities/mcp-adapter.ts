// PRISM NODE-EDITOR V2 — MCP reference adapter (DEFAULT CapabilityProvider, D1).
// Server-only (reads provider env + dynamic-imports the MCP SDK). The UI reaches
// it via /api/prism/capabilities/* routes, never by importing it directly.
//
// MCP is the open-standard connectivity layer (@modelcontextprotocol/sdk). Two
// modes, chosen by env (production-readiness = a SWAP, A6/D5):
//   • LIVE  — when PRISM_MCP_ENDPOINT is set: connect to a real MCP server via a
//     LAZY dynamic import of the SDK (so the dep is optional + no aggregator SDK
//     sits at module top level — INV-NEV2-4).
//   • OFFLINE/REFERENCE — the default. Curated catalog of REAL providers with
//     REAL brand marks, simulated sandbox validation, and a MOCK managed-auth
//     flow yielding a capability REFERENCE only (INV-NEV2-2 / INV-R13).
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

interface CatalogAction extends ActionTileDescriptor {
  platformId: string;
}

const ACTIONS: CatalogAction[] = [
  { platformId: 'stripe', actionId: 'stripe-create-payment-intent', label: 'Create payment intent', platform: 'Stripe', brandKey: 'stripe', category: 'Payments', description: 'Start a card charge for an amount + currency', params: [{ name: 'amount', type: 'number', required: true }, { name: 'currency', type: 'string', required: true }] },
  { platformId: 'stripe', actionId: 'stripe-create-customer', label: 'Create customer', platform: 'Stripe', brandKey: 'stripe', category: 'Payments', description: 'Register a customer record', params: [{ name: 'email', type: 'string', required: true }] },
  { platformId: 'stripe', actionId: 'stripe-create-checkout-session', label: 'Create checkout session', platform: 'Stripe', brandKey: 'stripe', category: 'Payments', description: 'Hosted checkout for a price', params: [{ name: 'priceId', type: 'string', required: true }] },
  { platformId: 'stripe', actionId: 'stripe-list-invoices', label: 'List invoices', platform: 'Stripe', brandKey: 'stripe', category: 'Payments', description: 'Fetch a customer’s invoices' },
  { platformId: 'github', actionId: 'github-create-issue', label: 'Create issue', platform: 'GitHub', brandKey: 'github', category: 'Dev', description: 'Open an issue on a repo', params: [{ name: 'repo', type: 'string', required: true }, { name: 'title', type: 'string', required: true }] },
  { platformId: 'github', actionId: 'github-open-pr', label: 'Open pull request', platform: 'GitHub', brandKey: 'github', category: 'Dev', description: 'Create a PR from a branch', params: [{ name: 'repo', type: 'string', required: true }, { name: 'head', type: 'string', required: true }, { name: 'base', type: 'string', required: true }] },
  { platformId: 'github', actionId: 'github-dispatch-workflow', label: 'Dispatch workflow', platform: 'GitHub', brandKey: 'github', category: 'Dev', description: 'Trigger an Actions workflow' },
  { platformId: 'slack', actionId: 'slack-post-message', label: 'Post message', platform: 'Slack', brandKey: 'slack', category: 'Comms', description: 'Send a message to a channel', params: [{ name: 'channel', type: 'string', required: true }, { name: 'text', type: 'string', required: true }] },
  { platformId: 'slack', actionId: 'slack-upload-file', label: 'Upload file', platform: 'Slack', brandKey: 'slack', category: 'Comms', description: 'Share a file in a channel' },
  { platformId: 'discord', actionId: 'discord-send-message', label: 'Send message', platform: 'Discord', brandKey: 'discord', category: 'Comms', description: 'Post to a Discord channel', params: [{ name: 'channelId', type: 'string', required: true }, { name: 'content', type: 'string', required: true }] },
  { platformId: 'twilio', actionId: 'twilio-send-sms', label: 'Send SMS', platform: 'Twilio', brandKey: 'twilio', category: 'Comms', description: 'Text a phone number', params: [{ name: 'to', type: 'string', required: true }, { name: 'body', type: 'string', required: true }] },
  { platformId: 'sendgrid', actionId: 'sendgrid-send-email', label: 'Send email', platform: 'SendGrid', brandKey: 'sendgrid', category: 'Comms', description: 'Transactional email', params: [{ name: 'to', type: 'string', required: true }, { name: 'subject', type: 'string', required: true }] },
  { platformId: 'resend', actionId: 'resend-send-email', label: 'Send email', platform: 'Resend', brandKey: 'resend', category: 'Comms', description: 'Developer-first transactional email', params: [{ name: 'to', type: 'string', required: true }, { name: 'subject', type: 'string', required: true }] },
  { platformId: 'supabase', actionId: 'supabase-insert-row', label: 'Insert row', platform: 'Supabase', brandKey: 'supabase', category: 'Data', description: 'Insert into a table', params: [{ name: 'table', type: 'string', required: true }, { name: 'values', type: 'object', required: true }] },
  { platformId: 'supabase', actionId: 'supabase-select', label: 'Query rows', platform: 'Supabase', brandKey: 'supabase', category: 'Data', description: 'Select from a table' },
  { platformId: 'notion', actionId: 'notion-create-page', label: 'Create page', platform: 'Notion', brandKey: 'notion', category: 'Data', description: 'Add a page to a database', params: [{ name: 'databaseId', type: 'string', required: true }] },
  { platformId: 'airtable', actionId: 'airtable-create-record', label: 'Create record', platform: 'Airtable', brandKey: 'airtable', category: 'Data', description: 'Add a record to a base' },
  { platformId: 'openai', actionId: 'openai-chat-completion', label: 'Chat completion', platform: 'OpenAI', brandKey: 'openai', category: 'AI', description: 'Generate a model response', params: [{ name: 'model', type: 'string', required: true }, { name: 'messages', type: 'array', required: true }] },
  { platformId: 'anthropic', actionId: 'anthropic-create-message', label: 'Create message', platform: 'Anthropic', brandKey: 'anthropic', category: 'AI', description: 'Claude message completion', params: [{ name: 'model', type: 'string', required: true }] },
  { platformId: 'replicate', actionId: 'replicate-run-model', label: 'Run model', platform: 'Replicate', brandKey: 'replicate', category: 'AI', description: 'Run a hosted model prediction' },
  { platformId: 'runpod', actionId: 'runpod-start-pod', label: 'Start pod', platform: 'RunPod', brandKey: 'runpod', category: 'Compute', description: 'Boot a GPU pod from a template', params: [{ name: 'templateId', type: 'string', required: true }, { name: 'gpuType', type: 'string', required: true }] },
  { platformId: 'runpod', actionId: 'runpod-run-serverless', label: 'Run serverless job', platform: 'RunPod', brandKey: 'runpod', category: 'Compute', description: 'Invoke a serverless endpoint', params: [{ name: 'endpointId', type: 'string', required: true }] },
  { platformId: 'modal', actionId: 'modal-run-function', label: 'Run function', platform: 'Modal', brandKey: 'modal', category: 'Compute', description: 'Invoke a deployed Modal function' },
  { platformId: 'shopify', actionId: 'shopify-create-order', label: 'Create order', platform: 'Shopify', brandKey: 'shopify', category: 'Commerce', description: 'Create a draft order' },
];

const PLATFORMS: PlatformDescriptor[] = [
  { platformId: 'runpod', platform: 'RunPod', brandKey: 'runpod', authMethods: ['oauth2.1', 'api-token', 'cli'], category: 'Compute', description: 'GPU cloud — pods, templates, serverless endpoints' },
  { platformId: 'stripe', platform: 'Stripe', brandKey: 'stripe', authMethods: ['oauth2.1', 'api-token'], category: 'Payments', description: 'Payments, billing, checkout' },
  { platformId: 'github', platform: 'GitHub', brandKey: 'github', authMethods: ['oauth2.1', 'api-token', 'mcp'], category: 'Dev', description: 'Repos, issues, actions' },
  { platformId: 'supabase', platform: 'Supabase', brandKey: 'supabase', authMethods: ['oauth2.1', 'api-token', 'mcp'], category: 'Data', description: 'Postgres, auth, storage' },
  { platformId: 'slack', platform: 'Slack', brandKey: 'slack', authMethods: ['oauth2.1', 'mcp'], category: 'Comms', description: 'Channels, messages, files' },
  { platformId: 'notion', platform: 'Notion', brandKey: 'notion', authMethods: ['oauth2.1', 'mcp'], category: 'Data', description: 'Pages, databases' },
  { platformId: 'openai', platform: 'OpenAI', brandKey: 'openai', authMethods: ['api-token'], category: 'AI', description: 'Models, embeddings, images' },
  { platformId: 'anthropic', platform: 'Anthropic', brandKey: 'anthropic', authMethods: ['api-token'], category: 'AI', description: 'Claude models' },
  { platformId: 'discord', platform: 'Discord', brandKey: 'discord', authMethods: ['oauth2.1', 'api-token'], category: 'Comms', description: 'Servers, channels, bots' },
  { platformId: 'twilio', platform: 'Twilio', brandKey: 'twilio', authMethods: ['api-token'], category: 'Comms', description: 'SMS, voice, verify' },
  { platformId: 'sendgrid', platform: 'SendGrid', brandKey: 'sendgrid', authMethods: ['api-token'], category: 'Comms', description: 'Transactional email' },
  { platformId: 'modal', platform: 'Modal', brandKey: 'modal', authMethods: ['api-token', 'cli'], category: 'Compute', description: 'Serverless GPU functions' },
  { platformId: 'replicate', platform: 'Replicate', brandKey: 'replicate', authMethods: ['api-token'], category: 'AI', description: 'Hosted model inference' },
  { platformId: 'shopify', platform: 'Shopify', brandKey: 'shopify', authMethods: ['oauth2.1'], category: 'Commerce', description: 'Storefront, orders, products' },
  { platformId: 'cloudflare', platform: 'Cloudflare', brandKey: 'cloudflare', authMethods: ['oauth2.1', 'api-token', 'mcp'], category: 'Infra', description: 'Workers, R2, KV, DNS' },
  { platformId: 'airtable', platform: 'Airtable', brandKey: 'airtable', authMethods: ['oauth2.1', 'api-token'], category: 'Data', description: 'Bases, tables, records' },
];

const SAVED_ASSETS: Record<string, IntegrationAsset[]> = {
  runpod: [
    { id: 'pod_a100_useast', kind: 'pod', name: 'A100 80GB · us-east', detail: 'running' },
    { id: 'pod_l40s_eu', kind: 'pod', name: 'L40S 48GB · eu-central', detail: 'stopped' },
    { id: 'tmpl_pytorch24', kind: 'template', name: 'PyTorch 2.4 + CUDA 12.4', detail: 'template' },
    { id: 'tmpl_comfyui', kind: 'template', name: 'ComfyUI · SDXL', detail: 'template' },
    { id: 'ep_whisper_sl', kind: 'endpoint', name: 'whisper-large-v3', detail: 'serverless' },
  ],
  supabase: [
    { id: 'proj_prism', kind: 'project', name: 'prism-prod', detail: 'us-east-1' },
    { id: 'tbl_users', kind: 'table', name: 'public.users', detail: '12,402 rows' },
    { id: 'tbl_snippets', kind: 'table', name: 'public.snippets', detail: 'RLS on' },
  ],
  github: [
    { id: 'repo_prism', kind: 'repo', name: 'kriptik/prism', detail: 'private' },
    { id: 'repo_landing', kind: 'repo', name: 'kriptik/kid-kode-landing', detail: 'private' },
  ],
  stripe: [
    { id: 'price_pro', kind: 'price', name: 'Pro · $20/mo', detail: 'recurring' },
    { id: 'price_team', kind: 'price', name: 'Team · $99/mo', detail: 'recurring' },
  ],
  slack: [
    { id: 'ch_general', kind: 'channel', name: '#general', detail: 'public' },
    { id: 'ch_alerts', kind: 'channel', name: '#prism-alerts', detail: 'private' },
  ],
};

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
  if (best === 0) {
    const toks = needle.split(/\s+/);
    const hay = fields.join(' ').toLowerCase();
    if (toks.some((t) => t.length > 1 && hay.includes(t))) best = 1;
  }
  return best;
}

export class McpReferenceAdapter implements CapabilityProvider {
  readonly id = 'mcp';
  readonly live: boolean;
  private readonly endpoint: string | undefined;

  constructor(opts?: { endpoint?: string }) {
    this.endpoint = opts?.endpoint ?? process.env.PRISM_MCP_ENDPOINT;
    this.live = Boolean(this.endpoint);
  }

  private async liveClient(): Promise<unknown | null> {
    if (!this.endpoint) return null;
    // Optional dep — only present when the live MCP path is wired (production
    // swap). Hidden from the bundler via optionalImport so build works offline.
    return optionalImport('@modelcontextprotocol/sdk/client/index.js');
  }

  async searchActions(query: string, limit = 24): Promise<ActionTileDescriptor[]> {
    return ACTIONS.map((a) => ({ a, s: matchScore(query, a.label, a.platform, a.category ?? '', a.description ?? '', a.actionId) }))
      .filter((x) => x.s > 0)
      .sort((x, y) => y.s - x.s)
      .slice(0, limit)
      .map(({ a }) => {
        const { platformId: _omit, ...tile } = a;
        return tile;
      });
  }

  async validateAction(input: { actionId: string; params?: Record<string, unknown> }): Promise<ValidationResult> {
    const action = ACTIONS.find((a) => a.actionId === input.actionId);
    if (!action) return { ok: false, status: 'broken', message: `Unknown action ${input.actionId}` };
    const missing = (action.params ?? []).filter((p) => p.required && (input.params?.[p.name] === undefined || input.params?.[p.name] === ''));
    if (missing.length > 0) {
      const fix: Record<string, unknown> = { ...(input.params ?? {}) };
      for (const m of missing) fix[m.name] = sampleFor(m.type);
      return {
        ok: false,
        status: 'broken',
        message: `Sandbox test failed: missing required ${missing.map((m) => `\`${m.name}\``).join(', ')}`,
        autoFix: { params: fix, note: `Filled ${missing.map((m) => m.name).join(', ')} with safe sample values` },
      };
    }
    return { ok: true, status: 'valid', message: `Sandbox test passed (${action.platform} → ${action.label})` };
  }

  async searchPlatforms(query: string, limit = 24): Promise<PlatformDescriptor[]> {
    return PLATFORMS.map((p) => ({ p, s: matchScore(query, p.platform, p.category ?? '', p.description ?? '', p.platformId) }))
      .filter((x) => x.s > 0)
      .sort((x, y) => y.s - x.s)
      .slice(0, limit)
      .map(({ p }) => p);
  }

  async connect(input: { platformId: string; method: IntegrationAuthMethod }): Promise<ConnectResult> {
    const platform = PLATFORMS.find((p) => p.platformId === input.platformId);
    if (!platform) return { ok: false, message: `Unknown platform ${input.platformId}` };
    if (!platform.authMethods.includes(input.method)) {
      return { ok: false, message: `${platform.platform} does not support ${input.method}` };
    }
    const refId = `cap_${input.platformId}_${input.method}_${stableSuffix(input.platformId + input.method)}`;
    const capabilityRef: CapabilityRef = {
      refId,
      scope: `${input.platformId}:connect`,
      label: `${platform.platform} (${input.method})`,
      provider: 'mcp',
      authMethod: input.method,
    };
    return {
      ok: true,
      capabilityRef,
      authUrl: input.method === 'oauth2.1' ? `mock://oauth/${input.platformId}` : undefined,
      message: `Connected ${platform.platform} via ${input.method} (capability reference stored)`,
    };
  }

  async listAssets(input: { platformId: string; capabilityRef: CapabilityRef }): Promise<IntegrationAsset[]> {
    return SAVED_ASSETS[input.platformId] ?? [];
  }
}

function sampleFor(type: string): unknown {
  switch (type) {
    case 'number': return 1000;
    case 'boolean': return true;
    case 'array': return [];
    case 'object': return {};
    default: return 'sample';
  }
}

function stableSuffix(seed: string): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36).slice(0, 6);
}
