// PRISM SHELL — PER-TENANT PROJECT STORE (SHELL W1A, 2026-07-04)
//
// THE data layer where I11 (tenant isolation) is enforced: "no user's
// projects, graphs, assets, or builds are ever readable by another tenant —
// enforced at the data layer and CI-tested with a two-user isolation probe."
//
// Isolation walls, innermost first:
//   1. Every path this module can touch lives under
//      .data/tenancy/tenants/<tenantId>/ — the tenant id is the FIRST
//      argument of every function and the root of every resolved path.
//   2. Every id (tenant, project, version, asset) must pass the contract's
//      single-path-segment grammar; anything else throws before any fs call.
//   3. After joining, resolved paths are re-checked to sit inside the
//      tenant root (belt-and-braces against future join mistakes).
//   4. Not-owned and non-existent are the SAME observable outcome (null) —
//      cross-tenant probes learn nothing, not even existence.
//
// Backing store (deviation W1A-D1/D2, docs/spec-deviations-prism.md): the
// repo's established local-store precedent (snippets/store.ts, assets/
// store.ts) — server-only JSON + content-addressed binaries under the
// gitignored .data/. Supabase/R2 later = swap the fs calls behind this same
// surface; the tenant-key-first signatures ARE the isolation contract and
// do not change.
//
// Concurrency note: read-modify-write on small per-tenant JSON indexes,
// serialized per process through a per-tenant promise chain. Fine for the
// dev/CI scale W1A ships at; a real DB takes over transactions in the swap.

import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  prismProjectSchema,
  prismProjectVersionSchema,
  prismTenancyIdSchema,
  prismTenantAssetSchema,
  type PrismProject,
  type PrismProjectVersion,
  type PrismTenantAsset,
} from '../../../packages/shared-interfaces/src/prism-tenancy';

const MAX_GRAPH_BYTES = 16 * 1024 * 1024; // 16 MB graph JSON ceiling
const MAX_ASSET_BYTES = 64 * 1024 * 1024; // matches assets/store.ts ceiling

function tenancyRoot(): string {
  // PRISM_TENANCY_DIR override keeps the isolation probe hermetic.
  return (
    process.env.PRISM_TENANCY_DIR ??
    path.join(process.cwd(), '.data', 'tenancy')
  );
}

/** Wall #2 — the id grammar (no separators, no dots, single segment). */
function safeId(id: string, label: string): string {
  const parsed = prismTenancyIdSchema.safeParse(id);
  if (!parsed.success) {
    throw new Error(`tenant-store: invalid ${label} id`);
  }
  return parsed.data;
}

/** Wall #1 + #3 — every path starts at the tenant root and must still be
 *  inside it after resolution. */
function tenantRoot(tenantId: string): string {
  return path.join(tenancyRoot(), 'tenants', safeId(tenantId, 'tenant'));
}

function insideTenant(tenantId: string, ...segments: string[]): string {
  const root = tenantRoot(tenantId);
  const joined = path.resolve(root, ...segments);
  if (joined !== root && !joined.startsWith(root + path.sep)) {
    throw new Error('tenant-store: path escaped tenant root');
  }
  return joined;
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8')) as T;
  } catch {
    return null; // wall #4 — absent and unreadable look identical
  }
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${randomUUID()}`;
  await fs.writeFile(tmp, JSON.stringify(value, null, 2), 'utf8');
  await fs.rename(tmp, file);
}

// Per-tenant write serialization (index read-modify-write safety).
const tenantChains = new Map<string, Promise<unknown>>();
function serialized<T>(tenantId: string, op: () => Promise<T>): Promise<T> {
  const prev = tenantChains.get(tenantId) ?? Promise.resolve();
  const next = prev.then(op, op);
  tenantChains.set(tenantId, next);
  return next;
}

function nowIso(): string {
  return new Date().toISOString();
}

// ── Projects ─────────────────────────────────────────────────────────────────

function projectsIndexPath(tenantId: string): string {
  return insideTenant(tenantId, 'projects.json');
}

async function readProjects(tenantId: string): Promise<PrismProject[]> {
  const raw = await readJson<unknown[]>(projectsIndexPath(tenantId));
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((p) => {
    const parsed = prismProjectSchema.safeParse(p);
    return parsed.success ? [parsed.data] : [];
  });
}

export async function listProjects(tenantId: string): Promise<PrismProject[]> {
  return readProjects(tenantId);
}

export async function getProject(
  tenantId: string,
  projectId: string,
): Promise<PrismProject | null> {
  const pid = safeId(projectId, 'project');
  const all = await readProjects(tenantId);
  // Ownership is structural: only THIS tenant's index is ever read, so a
  // foreign projectId simply is not found (wall #4).
  return all.find((p) => p.id === pid) ?? null;
}

export async function createProject(
  tenantId: string,
  input: { name: string; modelOverrideId?: string | null },
): Promise<PrismProject> {
  return serialized(tenantId, async () => {
    const project: PrismProject = prismProjectSchema.parse({
      id: `proj-${randomUUID()}`,
      ownerUserId: safeId(tenantId, 'tenant'),
      orgId: null,
      name: input.name,
      graphRef: null,
      modelOverrideId: input.modelOverrideId ?? null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    const all = await readProjects(tenantId);
    await writeJson(projectsIndexPath(tenantId), [...all, project]);
    return project;
  });
}

async function updateProject(
  tenantId: string,
  projectId: string,
  patch: (p: PrismProject) => PrismProject,
): Promise<PrismProject | null> {
  return serialized(tenantId, async () => {
    const pid = safeId(projectId, 'project');
    const all = await readProjects(tenantId);
    const idx = all.findIndex((p) => p.id === pid);
    if (idx < 0) return null;
    const updated = prismProjectSchema.parse({
      ...patch(all[idx]),
      id: all[idx].id,
      ownerUserId: all[idx].ownerUserId, // ownership is immutable here
      updatedAt: nowIso(),
    });
    const next = [...all];
    next[idx] = updated;
    await writeJson(projectsIndexPath(tenantId), next);
    return updated;
  });
}

export async function renameProject(
  tenantId: string,
  projectId: string,
  name: string,
): Promise<PrismProject | null> {
  return updateProject(tenantId, projectId, (p) => ({ ...p, name }));
}

export async function setProjectModelOverride(
  tenantId: string,
  projectId: string,
  modelOverrideId: string | null,
): Promise<PrismProject | null> {
  return updateProject(tenantId, projectId, (p) => ({ ...p, modelOverrideId }));
}

// ── Graphs ───────────────────────────────────────────────────────────────────

function graphPath(tenantId: string, projectId: string): string {
  return insideTenant(
    tenantId,
    'projects',
    safeId(projectId, 'project'),
    'graph.json',
  );
}

export async function saveGraph(
  tenantId: string,
  projectId: string,
  graph: Record<string, unknown>,
): Promise<{ graphRef: string } | null> {
  const owned = await getProject(tenantId, projectId);
  if (!owned) return null; // fail closed — not owned == not found
  const bytes = Buffer.byteLength(JSON.stringify(graph), 'utf8');
  if (bytes > MAX_GRAPH_BYTES) {
    throw new Error('tenant-store: graph exceeds size ceiling');
  }
  await writeJson(graphPath(tenantId, projectId), graph);
  const graphRef = `tenancy:${owned.id}/graph.json`;
  await updateProject(tenantId, projectId, (p) => ({ ...p, graphRef }));
  return { graphRef };
}

export async function getGraph(
  tenantId: string,
  projectId: string,
): Promise<Record<string, unknown> | null> {
  const owned = await getProject(tenantId, projectId);
  if (!owned) return null;
  return readJson<Record<string, unknown>>(graphPath(tenantId, projectId));
}

// ── Versions (E1 snapshot pointers) ─────────────────────────────────────────

function versionsIndexPath(tenantId: string, projectId: string): string {
  return insideTenant(
    tenantId,
    'projects',
    safeId(projectId, 'project'),
    'versions.json',
  );
}

export async function listVersions(
  tenantId: string,
  projectId: string,
): Promise<PrismProjectVersion[] | null> {
  const owned = await getProject(tenantId, projectId);
  if (!owned) return null;
  const raw = await readJson<unknown[]>(versionsIndexPath(tenantId, projectId));
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((v) => {
    const parsed = prismProjectVersionSchema.safeParse(v);
    return parsed.success ? [parsed.data] : [];
  });
}

export async function createVersion(
  tenantId: string,
  projectId: string,
  label: string,
): Promise<PrismProjectVersion | null> {
  const owned = await getProject(tenantId, projectId);
  if (!owned) return null;
  return serialized(tenantId, async () => {
    const graph =
      (await readJson<Record<string, unknown>>(graphPath(tenantId, projectId))) ??
      {};
    const versionId = `ver-${randomUUID()}`;
    const snapshotFile = insideTenant(
      tenantId,
      'projects',
      safeId(projectId, 'project'),
      'versions',
      `${versionId}.json`,
    );
    await writeJson(snapshotFile, graph); // immutable snapshot bytes
    const version: PrismProjectVersion = prismProjectVersionSchema.parse({
      id: versionId,
      projectId: owned.id,
      label,
      graphSnapshotRef: `tenancy:${owned.id}/versions/${versionId}.json`,
      createdByUserId: safeId(tenantId, 'tenant'),
      createdAt: nowIso(),
    });
    const raw =
      (await readJson<unknown[]>(versionsIndexPath(tenantId, projectId))) ?? [];
    await writeJson(versionsIndexPath(tenantId, projectId), [...raw, version]);
    return version;
  });
}

// ── Assets (content-addressed binaries, tenant-keyed) ───────────────────────

function assetsDir(tenantId: string, projectId: string): string {
  return insideTenant(
    tenantId,
    'projects',
    safeId(projectId, 'project'),
    'assets',
  );
}

function assetsIndexPath(tenantId: string, projectId: string): string {
  return insideTenant(
    tenantId,
    'projects',
    safeId(projectId, 'project'),
    'assets.json',
  );
}

export async function putAsset(
  tenantId: string,
  projectId: string,
  input: { name: string; mimeType: string; data: Buffer },
): Promise<PrismTenantAsset | null> {
  const owned = await getProject(tenantId, projectId);
  if (!owned) return null;
  if (input.data.byteLength > MAX_ASSET_BYTES) {
    throw new Error('tenant-store: asset exceeds size ceiling');
  }
  return serialized(tenantId, async () => {
    const hash = createHash('sha256').update(input.data).digest('hex');
    const dir = assetsDir(tenantId, projectId);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, hash), input.data);
    const asset: PrismTenantAsset = prismTenantAssetSchema.parse({
      id: hash,
      projectId: owned.id,
      name: input.name,
      mimeType: input.mimeType,
      bytes: input.data.byteLength,
      url: `/api/tenant/assets/${owned.id}/${hash}`,
      createdAt: nowIso(),
    });
    const raw =
      (await readJson<unknown[]>(assetsIndexPath(tenantId, projectId))) ?? [];
    const withoutDupe = raw.filter(
      (a) => !(typeof a === 'object' && a !== null && (a as { id?: string }).id === hash),
    );
    await writeJson(assetsIndexPath(tenantId, projectId), [...withoutDupe, asset]);
    return asset;
  });
}

export async function getAsset(
  tenantId: string,
  projectId: string,
  assetId: string,
): Promise<{ meta: PrismTenantAsset; data: Buffer } | null> {
  const owned = await getProject(tenantId, projectId);
  if (!owned) return null;
  if (!/^[a-f0-9]{64}$/.test(assetId)) return null;
  const raw = await readJson<unknown[]>(assetsIndexPath(tenantId, projectId));
  if (!Array.isArray(raw)) return null;
  const meta = raw
    .flatMap((a) => {
      const parsed = prismTenantAssetSchema.safeParse(a);
      return parsed.success ? [parsed.data] : [];
    })
    .find((a) => a.id === assetId);
  if (!meta) return null;
  try {
    const data = await fs.readFile(path.join(assetsDir(tenantId, projectId), assetId));
    return { meta, data };
  } catch {
    return null;
  }
}
