// PRISM SHELL — TENANT ASSET UPLOAD (SHELL W1A, spec §14 W1A / I11)
//
// POST /api/tenant/assets/<projectId> — raw body upload into the caller's
// OWN tenant space. Binary bytes ride this guarded REST route (the tRPC
// surface stays JSON); the tenant key is ALWAYS the server-resolved session
// user, never any request field. Anonymous → 401; a projectId the caller
// does not own → 404 (indistinguishable from nonexistent — fail closed).

import { auth, ensureAuthSchema } from '../../../../../server/auth/auth';
import { putAsset } from '../../../../../server/tenancy/tenant-store';

const MAX_UPLOAD_BYTES = 64 * 1024 * 1024;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  await ensureAuthSchema();
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return Response.json({ error: 'Sign in required.' }, { status: 401 });
  }
  const { projectId } = await params;
  const name = req.headers.get('x-prism-asset-name') ?? 'asset';
  const mimeType = req.headers.get('content-type') ?? 'application/octet-stream';
  const data = Buffer.from(await req.arrayBuffer());
  if (data.byteLength === 0 || data.byteLength > MAX_UPLOAD_BYTES) {
    return Response.json({ error: 'Invalid asset size.' }, { status: 400 });
  }
  try {
    const asset = await putAsset(session.user.id, projectId, {
      name: name.slice(0, 200),
      mimeType: mimeType.slice(0, 120),
      data,
    });
    if (!asset) {
      return Response.json({ error: 'Project not found.' }, { status: 404 });
    }
    return Response.json(asset, { status: 201 });
  } catch {
    // Invalid ids (traversal shapes) land here — same closed answer.
    return Response.json({ error: 'Project not found.' }, { status: 404 });
  }
}
