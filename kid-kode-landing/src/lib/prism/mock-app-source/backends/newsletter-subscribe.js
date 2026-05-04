// Prism backend handler for /api/mock/newsletter-subscribe — accepts an
// email subscription and returns a synthetic confirmation. Mock app: no
// persistence; subscribers are not stored anywhere.
export async function handler(request, _ctx) {
  if (request.method !== 'POST' || request.path !== '/api/mock/newsletter-subscribe') {
    return { status: 404, body: { error: 'not found' } };
  }
  const email = request.body?.email ?? '';
  return {
    status: 200,
    body: { ok: true, email, confirmedAt: new Date().toISOString() },
  };
}
