// PRISM SHELL — E7 EXPORT DOWNLOAD (SHELL W5, spec E7 / I11)
//
// GET /api/tenant/export/<projectId> — streams the deployable runtime bundle
// (a zip of manifest.json + graph.json) ONLY from the caller's own tenant
// space. The store resolves under the session user's root exclusively, so
// another tenant's projectId simply does not resolve (404, no existence leak).
// Anonymous → 401. Honest positioning (E7): this is the RUNNING app (the
// three/webgpu runtime graph), not React source.

import JSZip from 'jszip';
import { auth, ensureAuthSchema } from '../../../../../server/auth/auth';
import { getGraph, getProject } from '../../../../../server/tenancy/tenant-store';
import { buildExport } from '../../../../../server/conductor/export-bundle';

function originFromHeaders(headers: Headers): string {
  const host = headers.get('x-forwarded-host') ?? headers.get('host') ?? 'localhost:3000';
  const proto = headers.get('x-forwarded-proto') ?? (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https');
  return `${proto}://${host}`;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  await ensureAuthSchema();
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return Response.json({ error: 'Sign in required.' }, { status: 401 });
  }
  const { projectId } = await params;
  try {
    const project = await getProject(session.user.id, projectId);
    const graph = await getGraph(session.user.id, projectId);
    const bundle = await buildExport({
      tenantId: session.user.id,
      projectId,
      appOrigin: originFromHeaders(req.headers),
      nowIso: new Date().toISOString(),
    });
    if (!project || !graph || !bundle) {
      return Response.json({ error: 'Nothing to export.' }, { status: 404 });
    }

    const zip = new JSZip();
    zip.file('manifest.json', JSON.stringify(bundle.manifest, null, 2));
    zip.file('graph.prism.json', JSON.stringify(graph, null, 2));
    zip.file(
      'README.md',
      [
        `# ${project.name} — Prism runtime bundle`,
        '',
        'This is a deployable **Prism runtime** app graph — the running app, not',
        'React source. Mount `graph.prism.json` in the three/webgpu Prism runtime',
        '(`mountFromGraphSource`); `manifest.json` lists the hosting requirements.',
      ].join('\n'),
    );
    const data = await zip.generateAsync({ type: 'uint8array' });

    const filename = `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 48) || 'prism-app'}.prism.zip`;
    return new Response(new Uint8Array(data), {
      status: 200,
      headers: {
        'content-type': 'application/zip',
        'content-disposition': `attachment; filename="${filename}"`,
        'cache-control': 'private, max-age=0, must-revalidate',
      },
    });
  } catch {
    return Response.json({ error: 'Export failed.' }, { status: 500 });
  }
}
