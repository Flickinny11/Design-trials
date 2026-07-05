// PRISM NODE-EDITOR V2 — /api/prism/snippets (criteria B5). Per-user custom
// function snippets. GET (list) · POST (save) · DELETE (remove). Backed by the
// SnippetStore (LocalSnippetStore by default; Supabase RLS on greenlight).
// Secrets are never stored here.
import { getSnippetStore, type Snippet } from '@/server/snippets/store';

export const runtime = 'nodejs';

// The harness has no auth provider yet; a stable per-browser user id is passed
// from the client (a placeholder for the real authed user — A6 swap to Supabase
// auth). Defaults to a shared local user.
function userId(req: Request, body?: Record<string, unknown>): string {
  const fromBody = body && typeof body.userId === 'string' ? body.userId : '';
  const url = new URL(req.url);
  const fromQuery = url.searchParams.get('userId') || '';
  return (fromBody || fromQuery || 'local-user').slice(0, 80);
}

function err(message: string, status = 400): Response {
  return new Response(JSON.stringify({ ok: false, error: message }), { status, headers: { 'content-type': 'application/json' } });
}

export async function GET(req: Request): Promise<Response> {
  const store = getSnippetStore();
  const uid = userId(req);
  try {
    const snippets = await store.list(uid);
    return new Response(JSON.stringify({ ok: true, store: store.id, snippets }), { status: 200, headers: { 'content-type': 'application/json' } });
  } catch (e) {
    return err(`list failed: ${(e as Error).message}`, 500);
  }
}

export async function POST(req: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return err('invalid JSON body');
  }
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return err('name is required');
  const store = getSnippetStore();
  const uid = userId(req, body);
  const draft: Omit<Snippet, 'id' | 'userId' | 'createdAt'> = {
    name,
    providerId: typeof body.providerId === 'string' ? body.providerId : 'custom',
    actionId: typeof body.actionId === 'string' ? body.actionId : 'custom-action',
    brandKey: typeof body.brandKey === 'string' ? body.brandKey : 'custom',
    platform: typeof body.platform === 'string' ? body.platform : 'Custom',
    label: typeof body.label === 'string' ? body.label : name,
    params: (body.params ?? undefined) as Record<string, unknown> | undefined,
    body: typeof body.body === 'string' ? body.body : undefined,
  };
  try {
    const snippet = await store.save(uid, draft);
    return new Response(JSON.stringify({ ok: true, store: store.id, snippet }), { status: 200, headers: { 'content-type': 'application/json' } });
  } catch (e) {
    return err(`save failed: ${(e as Error).message}`, 500);
  }
}

export async function DELETE(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const id = url.searchParams.get('id') || '';
  if (!id) return err('id query param required');
  const store = getSnippetStore();
  const uid = userId(req);
  try {
    await store.remove(uid, id);
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
  } catch (e) {
    return err(`delete failed: ${(e as Error).message}`, 500);
  }
}
