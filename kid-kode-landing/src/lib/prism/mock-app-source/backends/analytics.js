// Prism backend handler for /api/mock/analytics. Not bound to a specific node —
// the stats-live-counter optionally pulls aggregate counts.
export async function handler(request, ctx) {
  const { fakeDb } = ctx;
  if (request.method !== "GET" || request.path !== "/api/mock/analytics") {
    return { status: 404, body: { error: "not found" } };
  }
  const heroClicks = (await fakeDb.get("heroCtaClicks")) ?? 0;
  const sessionStart = (await fakeDb.get("__session-started-at")) ?? Date.now();
  return {
    status: 200,
    body: {
      totalClicks: heroClicks,
      sessions: 1,
      avgSessionTime: Math.round((Date.now() - sessionStart) / 1000),
    },
  };
}
