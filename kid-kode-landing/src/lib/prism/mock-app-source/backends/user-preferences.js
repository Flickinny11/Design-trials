// Prism backend handler for notifications-toggle + theme-selector-button.
// Exposes GET and POST /api/mock/user-preferences over shared fakeDb keys.
export async function handler(request, ctx) {
  const { fakeDb } = ctx;
  if (request.path !== '/api/mock/user-preferences') {
    return { status: 404, body: { error: 'not found' } };
  }
  if (request.method === 'GET') {
    return {
      status: 200,
      body: {
        notificationsEnabled: (await fakeDb.get('notifications-enabled')) ?? false,
        theme: (await fakeDb.get('theme')) ?? 'dark',
      },
    };
  }
  if (request.method === 'POST') {
    const body = request.body ?? {};
    if (typeof body.notificationsEnabled === 'boolean') {
      await fakeDb.set('notifications-enabled', body.notificationsEnabled);
    }
    if (typeof body.theme === 'string') {
      await fakeDb.set('theme', body.theme);
    }
    return {
      status: 200,
      body: {
        notificationsEnabled: (await fakeDb.get('notifications-enabled')) ?? false,
        theme: (await fakeDb.get('theme')) ?? 'dark',
      },
    };
  }
  return { status: 405, body: { error: 'method not allowed' } };
}
