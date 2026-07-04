// PRISM SHELL — TENANT ASSET SERVE (SHELL W1A, spec §14 W1A / I11)
//
// GET /api/tenant/assets/<projectId>/<assetId> — serves bytes ONLY from the
// caller's own tenant space. The store resolves under the session user's
// root exclusively, so another tenant's asset hash simply does not resolve
// (404, no existence leak). Anonymous → 401.

import { auth, ensureAuthSchema } from '../../../../../../server/auth/auth';
import { getAsset } from '../../../../../../server/tenancy/tenant-store';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ projectId: string; assetId: string }> },
) {
  await ensureAuthSchema();
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return Response.json({ error: 'Sign in required.' }, { status: 401 });
  }
  const { projectId, assetId } = await params;
  try {
    const asset = await getAsset(session.user.id, projectId, assetId);
    if (!asset) {
      return Response.json({ error: 'Asset not found.' }, { status: 404 });
    }
    return new Response(new Uint8Array(asset.data), {
      status: 200,
      headers: {
        'content-type': asset.meta.mimeType,
        'content-length': String(asset.meta.bytes),
        // Tenant data: never cache across users at any shared layer.
        'cache-control': 'private, max-age=0, must-revalidate',
      },
    });
  } catch {
    return Response.json({ error: 'Asset not found.' }, { status: 404 });
  }
}
