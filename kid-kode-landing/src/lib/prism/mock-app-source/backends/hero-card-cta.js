// Prism backend handler for hero-card-cta node.
// Exposes POST /api/mock/track-cta-click. Increments heroCtaClicks in fakeDb
// and returns the new count. State updates are broadcast to subscribers so the
// stats-live-counter refreshes without a re-request.
export async function handler(request, ctx) {
  const { fakeDb, logger } = ctx;
  if (request.method === 'POST' && request.path === '/api/mock/track-cta-click') {
    const prev = (await fakeDb.get('heroCtaClicks')) ?? 0;
    const next = prev + 1;
    await fakeDb.set('heroCtaClicks', next);
    logger?.debug?.('[hero-card-cta] click tracked', { prev, next });
    return { status: 200, body: { clickCount: next } };
  }
  return { status: 404, body: { error: 'not found', path: request.path, method: request.method } };
}
