// W-TPL D6 — client-side fire-and-forget beacon for template-catalog events.
// The picker calls this on a new-hub instantiation or a section drop; the actual
// recording (consent, PII scrub, sink write) happens server-side in
// /api/prism/catalog-event. Never throws, never blocks the UI — a recorder
// outage must never break instantiating a template.

export interface CatalogBeacon {
  stage: 'browse' | 'instantiate-hub' | 'drop-section';
  template_slug?: string;
  archetype?: string;
  primary_family?: string;
  section_slug?: string;
  section_kind?: string;
  route?: string;
  node_count?: number;
  hub_ref?: string;
  query?: string;
  ok?: boolean;
  detail?: string;
}

export function beaconCatalogEvent(payload: CatalogBeacon): void {
  try {
    if (typeof window === 'undefined') return;
    const body = JSON.stringify(payload);
    // Prefer sendBeacon (survives navigation); fall back to keepalive fetch.
    const nav = navigator as Navigator & {
      sendBeacon?: (url: string, data: BodyInit) => boolean;
    };
    if (typeof nav.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' });
      if (nav.sendBeacon('/api/prism/catalog-event', blob)) return;
    }
    void fetch('/api/prism/catalog-event', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* fail-open */
  }
}
