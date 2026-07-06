// PRISM FLIGHT RECORDER — consent resolution (I-CONSENT, deviation D6).
//
// Every record carries a consent flag. consent=TRUE records reach the training
// sink; consent=FALSE records are QUARANTINED to a separate non-training sink so
// an enterprise opt-out is honored end-to-end. Resolution order (first defined
// wins), documented in D6:
//   1. per-call override (explicit consent passed by the caller)
//   2. tenant-level flag (seam — the tenant store gains an opt-out field at
//      SHIP-BRAND; today the resolver returns undefined so #3 applies)
//   3. env default (PRISM_FR_CONSENT_DEFAULT; default true on this dev machine —
//      dev/demo data is the founder's own)
//
// Wiring the real tenant flag later is a ONE-LINE change inside `tenantConsent`,
// not a schema or call-site change (D6).

import type { ConsentBasis } from './schema';

export interface ConsentResolution {
  consent: boolean;
  basis: ConsentBasis;
}

/** Seam: the tenant-level enterprise opt-out. Returns undefined until the tenant
 *  store carries the flag (SHIP-BRAND). Kept as a function so the real lookup
 *  drops in here without touching any call site. */
export function tenantConsent(_tenantId?: string): boolean | undefined {
  // SHIP-BRAND: return store.getTenant(tenantId)?.dataRightsConsent.
  return undefined;
}

function envDefault(): boolean {
  const raw = (typeof process !== 'undefined' ? process.env?.PRISM_FR_CONSENT_DEFAULT : undefined) ?? 'true';
  return raw !== 'false' && raw !== '0';
}

/** Resolve consent for one record. Pure + synchronous so the write path never
 *  blocks on an async lookup (I-FAILOPEN). */
export function resolveConsent(input: { tenantId?: string; override?: boolean }): ConsentResolution {
  if (typeof input.override === 'boolean') {
    return { consent: input.override, basis: 'override' };
  }
  const tflag = tenantConsent(input.tenantId);
  if (typeof tflag === 'boolean') {
    return { consent: tflag, basis: 'tenant-flag' };
  }
  return { consent: envDefault(), basis: 'env-default' };
}
