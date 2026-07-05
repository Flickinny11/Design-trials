// PRISM SHELL — DOMAIN ORDER INDEX (SHELL W5B / E16, 2026-07-05)
//
// A Monitor webhook arrives WITHOUT a session (it is posted by Entri), so it
// must resolve which tenant/project/deploy a domain belongs to. This global
// index maps a deployId → (tenant, project, domain, orderId) — exactly the
// preview-token precedent: the index is global, but every mutation it enables
// goes through the tenant store's isolation wall (updateDeploy under the
// resolved tenant). No secret rides the index.

import 'server-only';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export interface DomainPointer {
  tenantId: string;
  projectId: string;
  deployId: string;
  domain: string;
  orderId: string;
}

function indexRoot(): string {
  return (
    process.env.PRISM_DOMAIN_INDEX_DIR ??
    path.join(process.cwd(), '.data', 'domain-index')
  );
}

const DEPLOY_RE = /^[A-Za-z0-9._-]{1,120}$/;

function pointerFile(deployId: string): string {
  return path.join(indexRoot(), `${deployId}.json`);
}

export async function registerDomainPointer(pointer: DomainPointer): Promise<void> {
  if (!DEPLOY_RE.test(pointer.deployId)) throw new Error('domain-index: malformed deployId');
  const file = pointerFile(pointer.deployId);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(pointer, null, 2), 'utf8');
}

export async function resolveDomainPointer(deployId: string): Promise<DomainPointer | null> {
  if (!DEPLOY_RE.test(deployId)) return null;
  try {
    const raw = JSON.parse(await fs.readFile(pointerFile(deployId), 'utf8')) as DomainPointer;
    if (!raw || typeof raw.tenantId !== 'string' || typeof raw.projectId !== 'string') return null;
    return raw;
  } catch {
    return null;
  }
}
