// PRISM SHELL — IN-PLATFORM DOMAINS CONTRACT — prism-domains.ts
// (SHELL W5B / E16, 2026-07-05)
//
// The founder anchor: "buy and search for custom url's ... without ever needing
// to leave our platform ... all via one-click." E16 makes domain search →
// purchase → auto-DNS an in-UI flow. Entri Sell/Connect/Monitor is the
// universal spine (commission revenue; Connect covers 35+ DNS providers;
// Monitor webhooks feed shipped-state checks). Native registrar adapters —
// Vercel Domains Registrar (when shipping to Vercel) and Cloudflare Registrar
// (at-cost) — are config-selected alternates behind the SAME interface.
//
// I5: no secret ever rides these shapes. Availability/pricing/orders are public
// facts + capability references; the vendor API keys stay server-side. Until a
// vendor key is present every step runs SANDBOX (deterministic, no charge, no
// real registration) — labeled `sandbox` so it is never mistaken for live.
//
// Discipline: ADDITIVE ONLY.

import { z } from 'zod';
import { prismTenancyIdSchema } from './prism-tenancy';

export const PRISM_DOMAINS_CONTRACT_VERSION = 1 as const;

/** The domain provider spine + config-selected registrar alternates (E16). */
export const domainProviderSchema = z.enum([
  'entri',
  'vercel-registrar',
  'cloudflare-registrar',
]);
export type DomainProvider = z.infer<typeof domainProviderSchema>;

/** `sandbox` = no vendor key → deterministic, no charge, no real registration.
 *  `live` = the vendor API answered. */
export const domainModeSchema = z.enum(['sandbox', 'live']);
export type DomainMode = z.infer<typeof domainModeSchema>;

/** Availability + pricing for one domain candidate. */
export const domainAvailabilitySchema = z.object({
  domain: z.string().min(3).max(253),
  available: z.boolean(),
  provider: domainProviderSchema,
  mode: domainModeSchema,
  /** Registration + renewal price. Null when unavailable. */
  price: z
    .object({
      registerUsd: z.number().nonnegative(),
      renewUsd: z.number().nonnegative(),
      currency: z.literal('USD'),
    })
    .nullable(),
  /** Where the price/availability came from (cited in UI — never faked live). */
  source: z.string().max(200),
});
export type DomainAvailability = z.infer<typeof domainAvailabilitySchema>;

export const domainSearchInputSchema = z
  .object({
    /** A base name or full domain, e.g. "novaship" or "novaship.com". */
    query: z.string().min(1).max(253),
    provider: domainProviderSchema.default('entri'),
  })
  .strict();
export type DomainSearchInput = z.infer<typeof domainSearchInputSchema>;

export const domainSearchOutputSchema = z.object({
  v: z.literal(PRISM_DOMAINS_CONTRACT_VERSION),
  results: z.array(domainAvailabilitySchema).max(24),
});
export type DomainSearchOutput = z.infer<typeof domainSearchOutputSchema>;

/** A DNS record Connect auto-DNS sets to point the domain at the deploy. */
export const dnsRecordSchema = z.object({
  type: z.enum(['A', 'AAAA', 'CNAME', 'TXT', 'ALIAS']),
  name: z.string().min(1).max(253),
  value: z.string().min(1).max(600),
  ttl: z.number().int().positive().default(3600),
});
export type DnsRecord = z.infer<typeof dnsRecordSchema>;

/** The purchase order (E16). Sandbox → a sandbox order id, no charge. */
export const domainOrderSchema = z.object({
  orderId: z.string().min(1).max(120),
  domain: z.string().min(3).max(253),
  provider: domainProviderSchema,
  mode: domainModeSchema,
  status: z.enum(['sandbox', 'pending', 'active', 'error']),
  /** The deploy this domain is (being) connected to. */
  deployId: z.string().max(120).nullable(),
  /** The DNS records Connect auto-DNS applies (evidence + what live would set). */
  dnsRecords: z.array(dnsRecordSchema).max(12),
  createdAt: z.string().datetime(),
});
export type DomainOrder = z.infer<typeof domainOrderSchema>;

export const domainPurchaseInputSchema = z
  .object({
    projectId: prismTenancyIdSchema,
    deployId: z.string().min(1).max(120),
    domain: z.string().min(3).max(253),
    provider: domainProviderSchema.default('entri'),
  })
  .strict();
export type DomainPurchaseInput = z.infer<typeof domainPurchaseInputSchema>;

export const domainPurchaseOutputSchema = z.object({
  v: z.literal(PRISM_DOMAINS_CONTRACT_VERSION),
  order: domainOrderSchema,
});
export type DomainPurchaseOutput = z.infer<typeof domainPurchaseOutputSchema>;

/** An Entri Monitor webhook event — Monitor watches DNS propagation + domain
 *  state and posts these; recording one flips the deploy's domainStatus. */
export const domainMonitorEventSchema = z.object({
  event: z.enum(['dns.configured', 'domain.active', 'domain.error']),
  domain: z.string().min(3).max(253),
  provider: domainProviderSchema,
  deployId: z.string().max(120).nullable(),
  detail: z.string().max(300).optional(),
  at: z.string().datetime(),
});
export type DomainMonitorEvent = z.infer<typeof domainMonitorEventSchema>;

/** The webhook envelope Monitor POSTs. `signature` is an HMAC over `payload`
 *  (verified server-side; sandbox uses a fixture secret). */
export const domainWebhookEnvelopeSchema = z.object({
  signature: z.string().min(1).max(300),
  payload: domainMonitorEventSchema,
});
export type DomainWebhookEnvelope = z.infer<typeof domainWebhookEnvelopeSchema>;

/** A provider descriptor the UI renders (which providers are live vs sandbox). */
export const domainProviderDescriptorSchema = z.object({
  provider: domainProviderSchema,
  label: z.string().min(1).max(80),
  mode: domainModeSchema,
  requiredEnv: z.array(z.string().min(1).max(80)).max(8),
  note: z.string().max(200),
});
export type DomainProviderDescriptor = z.infer<typeof domainProviderDescriptorSchema>;
