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

import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  PRISM_DEFAULT_NOTIFICATION_PREFS,
  PRISM_TENANCY_CONTRACT_VERSION,
  prismAccountSettingsSchema,
  prismProjectSchema,
  prismProjectVersionSchema,
  prismTenancyIdSchema,
  prismTenantAssetSchema,
  type PrismAccountSettings,
  type PrismBuildState,
  type PrismNotificationPrefs,
  type PrismProject,
  type PrismProjectVersion,
  type PrismTenantAsset,
} from "../../../packages/shared-interfaces/src/prism-tenancy";
import {
  buildBriefSchema,
  type BuildBrief,
} from "../../../packages/shared-interfaces/src/prism-intake";
import {
  fidelityReportSchema,
  type FidelityReport,
} from "../../../packages/shared-interfaces/src/prism-ingest";
import {
  connectorRequestSchema,
  githubImportSchema,
  integrationConnectionSchema,
  projectCapabilityBindingSchema,
  type ConnectorRequest,
  type GithubImport,
  type IntegrationConnection,
  type ProjectCapabilityBinding,
} from "../../../packages/shared-interfaces/src/prism-integrations";
import {
  savedBackgroundItemSchema,
  type SavedBackgroundItemRecord,
} from "../../../packages/shared-interfaces/src/prism-backgrounds";
import {
  conductorStatusSchema,
  deployRecordSchema,
  type ConductorStatus,
  type DeployRecord,
} from "../../../packages/shared-interfaces/src/prism-conductor";
import {
  careConfigSchema,
  type CareConfig,
} from "../../../packages/shared-interfaces/src/prism-care";
import { getTemplate, templateGraph } from "@/lib/templates/registry";

const MAX_GRAPH_BYTES = 16 * 1024 * 1024; // 16 MB graph JSON ceiling
const MAX_ASSET_BYTES = 64 * 1024 * 1024; // matches assets/store.ts ceiling

function tenancyRoot(): string {
  // PRISM_TENANCY_DIR override keeps the isolation probe hermetic.
  return (
    process.env.PRISM_TENANCY_DIR ??
    path.join(process.cwd(), ".data", "tenancy")
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
  return path.join(tenancyRoot(), "tenants", safeId(tenantId, "tenant"));
}

function insideTenant(tenantId: string, ...segments: string[]): string {
  const root = tenantRoot(tenantId);
  const joined = path.resolve(root, ...segments);
  if (joined !== root && !joined.startsWith(root + path.sep)) {
    throw new Error("tenant-store: path escaped tenant root");
  }
  return joined;
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T;
  } catch {
    return null; // wall #4 — absent and unreadable look identical
  }
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${randomUUID()}`;
  await fs.writeFile(tmp, JSON.stringify(value, null, 2), "utf8");
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
  return insideTenant(tenantId, "projects.json");
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
  const pid = safeId(projectId, "project");
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
      ownerUserId: safeId(tenantId, "tenant"),
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
    const pid = safeId(projectId, "project");
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

/** W7 — link a project to an enterprise org (set when the owner shares it).
 *  Owner-keyed like every mutation here; cross-tenant callers never reach it. */
export async function setProjectOrg(
  tenantId: string,
  projectId: string,
  orgId: string | null,
): Promise<PrismProject | null> {
  return updateProject(tenantId, projectId, (p) => ({ ...p, orgId }));
}

export async function setBuildState(
  tenantId: string,
  projectId: string,
  buildState: PrismBuildState,
): Promise<PrismProject | null> {
  return updateProject(tenantId, projectId, (p) => ({ ...p, buildState }));
}

function projectDir(tenantId: string, projectId: string): string {
  return insideTenant(tenantId, "projects", safeId(projectId, "project"));
}

/** Delete a project and all its tenant-keyed bytes (graph, brief, versions,
 *  assets, integrations). Fails closed — not owned == not found (returns
 *  false, never touching another tenant's tree). */
export async function deleteProject(
  tenantId: string,
  projectId: string,
): Promise<boolean> {
  const pid = safeId(projectId, "project");
  return serialized(tenantId, async () => {
    const all = await readProjects(tenantId);
    const idx = all.findIndex((p) => p.id === pid);
    if (idx < 0) return false; // not owned == not found
    const next = all.filter((p) => p.id !== pid);
    await writeJson(projectsIndexPath(tenantId), next);
    // Remove the project's directory tree (graph/brief/versions/assets). The
    // path is re-checked to sit inside the tenant root by projectDir/insideTenant.
    await fs.rm(projectDir(tenantId, pid), { recursive: true, force: true });
    return true;
  });
}

/** Duplicate a project into a fresh row in the SAME tenant. Copies the live
 *  graph, the approved brief, and capability bindings (the meaningful build
 *  state); version HISTORY and per-project assets start fresh on the copy.
 *  Fails closed — a foreign projectId simply is not found (null). */
export async function duplicateProject(
  tenantId: string,
  projectId: string,
): Promise<PrismProject | null> {
  const owned = await getProject(tenantId, projectId);
  if (!owned) return null;
  return serialized(tenantId, async () => {
    const cloneId = `proj-${randomUUID()}`;
    const graph = await readJson<Record<string, unknown>>(
      graphPath(tenantId, owned.id),
    );
    const graphRef = graph ? `tenancy:${cloneId}/graph.json` : null;
    const clone: PrismProject = prismProjectSchema.parse({
      id: cloneId,
      ownerUserId: safeId(tenantId, "tenant"),
      orgId: owned.orgId ?? null,
      name: `${owned.name} copy`.slice(0, 200),
      graphRef,
      modelOverrideId: owned.modelOverrideId ?? null,
      buildState: owned.buildState ?? null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    const all = await readProjects(tenantId);
    await writeJson(projectsIndexPath(tenantId), [...all, clone]);
    if (graph) await writeJson(graphPath(tenantId, cloneId), graph);
    const brief = await readJson<unknown>(briefPath(tenantId, owned.id));
    if (brief) await writeJson(briefPath(tenantId, cloneId), brief);
    const integrations = await readJson<unknown>(
      projectIntegrationsPath(tenantId, owned.id),
    );
    if (integrations)
      await writeJson(projectIntegrationsPath(tenantId, cloneId), integrations);
    return clone;
  });
}

/** W8 E2 — fork a REAL .prism template graph (from the template registry) into
 *  a fresh project in this tenant. The graph is sourced from the registry, not
 *  another owned project (so it works for a brand-new account remixing from the
 *  public gallery). Returns null for an unknown slug. */
export async function remixTemplate(
  tenantId: string,
  slug: string,
): Promise<PrismProject | null> {
  const tpl = getTemplate(slug);
  const graph = templateGraph(slug);
  if (!tpl || !graph) return null;
  return serialized(tenantId, async () => {
    const cloneId = `proj-${randomUUID()}`;
    const graphRef = `tenancy:${cloneId}/graph.json`;
    const project: PrismProject = prismProjectSchema.parse({
      id: cloneId,
      ownerUserId: safeId(tenantId, "tenant"),
      orgId: null,
      name: `${tpl.name} (remix)`.slice(0, 200),
      graphRef,
      modelOverrideId: null,
      buildState: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    const all = await readProjects(tenantId);
    await writeJson(projectsIndexPath(tenantId), [...all, project]);
    await writeJson(
      graphPath(tenantId, cloneId),
      graph as unknown as Record<string, unknown>,
    );
    return project;
  });
}

// ── Build Brief (W2 — Guided Build intake output, tenant-keyed) ──────────────

function briefPath(tenantId: string, projectId: string): string {
  return insideTenant(
    tenantId,
    "projects",
    safeId(projectId, "project"),
    "brief.json",
  );
}

const MAX_BRIEF_BYTES = 512 * 1024; // 512 KB brief JSON ceiling

/** Persist an approved Build Brief and move the project to `plan-pending`.
 *  Fails closed (not owned == not found) exactly like every other write. */
export async function saveBrief(
  tenantId: string,
  projectId: string,
  brief: BuildBrief,
): Promise<{ project: PrismProject } | null> {
  const owned = await getProject(tenantId, projectId);
  if (!owned) return null;
  const bytes = Buffer.byteLength(JSON.stringify(brief), "utf8");
  if (bytes > MAX_BRIEF_BYTES) {
    throw new Error("tenant-store: brief exceeds size ceiling");
  }
  await writeJson(briefPath(tenantId, projectId), brief);
  const project = await updateProject(tenantId, projectId, (p) => ({
    ...p,
    name: brief.title.slice(0, 200),
    buildState: "plan-pending" as const,
  }));
  return project ? { project } : null;
}

export async function getBrief(
  tenantId: string,
  projectId: string,
): Promise<BuildBrief | null> {
  const owned = await getProject(tenantId, projectId);
  if (!owned) return null;
  const raw = await readJson<unknown>(briefPath(tenantId, projectId));
  if (raw == null) return null;
  const parsed = buildBriefSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

// ── Import fidelity report (W-IMPORT — attached to a project at approval, D7) ──

function fidelityPath(tenantId: string, projectId: string): string {
  return insideTenant(
    tenantId,
    "projects",
    safeId(projectId, "project"),
    "fidelity.json",
  );
}

const MAX_FIDELITY_BYTES = 256 * 1024;

/** Persist the import fidelity ledger onto a project. Fails closed (not owned ==
 *  not found), mirroring saveBrief exactly. */
export async function saveFidelityReport(
  tenantId: string,
  projectId: string,
  report: FidelityReport,
): Promise<boolean> {
  const owned = await getProject(tenantId, projectId);
  if (!owned) return false;
  const bytes = Buffer.byteLength(JSON.stringify(report), "utf8");
  if (bytes > MAX_FIDELITY_BYTES) {
    throw new Error("tenant-store: fidelity report exceeds size ceiling");
  }
  await writeJson(fidelityPath(tenantId, projectId), report);
  return true;
}

export async function getFidelityReport(
  tenantId: string,
  projectId: string,
): Promise<FidelityReport | null> {
  const owned = await getProject(tenantId, projectId);
  if (!owned) return null;
  const raw = await readJson<unknown>(fidelityPath(tenantId, projectId));
  if (raw == null) return null;
  const parsed = fidelityReportSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

// ── Graphs ───────────────────────────────────────────────────────────────────

function graphPath(tenantId: string, projectId: string): string {
  return insideTenant(
    tenantId,
    "projects",
    safeId(projectId, "project"),
    "graph.json",
  );
}

export async function saveGraph(
  tenantId: string,
  projectId: string,
  graph: Record<string, unknown>,
): Promise<{ graphRef: string } | null> {
  const owned = await getProject(tenantId, projectId);
  if (!owned) return null; // fail closed — not owned == not found
  const bytes = Buffer.byteLength(JSON.stringify(graph), "utf8");
  if (bytes > MAX_GRAPH_BYTES) {
    throw new Error("tenant-store: graph exceeds size ceiling");
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
    "projects",
    safeId(projectId, "project"),
    "versions.json",
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
      (await readJson<Record<string, unknown>>(
        graphPath(tenantId, projectId),
      )) ?? {};
    const versionId = `ver-${randomUUID()}`;
    const snapshotFile = insideTenant(
      tenantId,
      "projects",
      safeId(projectId, "project"),
      "versions",
      `${versionId}.json`,
    );
    await writeJson(snapshotFile, graph); // immutable snapshot bytes
    const version: PrismProjectVersion = prismProjectVersionSchema.parse({
      id: versionId,
      projectId: owned.id,
      label,
      graphSnapshotRef: `tenancy:${owned.id}/versions/${versionId}.json`,
      createdByUserId: safeId(tenantId, "tenant"),
      createdAt: nowIso(),
    });
    const raw =
      (await readJson<unknown[]>(versionsIndexPath(tenantId, projectId))) ?? [];
    await writeJson(versionsIndexPath(tenantId, projectId), [...raw, version]);
    return version;
  });
}

/** E1 one-click restore: copy an immutable checkpoint snapshot back onto the
 *  live graph. BOTH the project and the version must belong to the tenant —
 *  the version lives inside the project's own tenant-keyed dir, so a foreign
 *  or mismatched id simply is not found (null). Returns the restored version
 *  and the restored graph so the caller can re-verify the round-trip. */
export async function restoreVersion(
  tenantId: string,
  projectId: string,
  versionId: string,
): Promise<{
  version: PrismProjectVersion;
  graph: Record<string, unknown>;
} | null> {
  const owned = await getProject(tenantId, projectId);
  if (!owned) return null;
  const versions = await listVersions(tenantId, projectId);
  const version = versions?.find((v) => v.id === versionId) ?? null;
  if (!version) return null; // not this project's checkpoint == not found
  // Write the graph under the per-tenant lock. NOTE: do NOT call updateProject
  // (which itself takes the lock) from inside this block — re-entering
  // serialized() on the same tenant deadlocks the chain. The graphRef patch
  // runs as its OWN serialized op after this one resolves.
  const snapshot = await serialized(tenantId, async () => {
    const snapshotFile = insideTenant(
      tenantId,
      "projects",
      safeId(projectId, "project"),
      "versions",
      `${safeId(versionId, "version")}.json`,
    );
    const snap = await readJson<Record<string, unknown>>(snapshotFile);
    if (snap == null) return null;
    await writeJson(graphPath(tenantId, projectId), snap);
    return snap;
  });
  if (snapshot == null) return null;
  await updateProject(tenantId, projectId, (p) => ({
    ...p,
    graphRef: `tenancy:${owned.id}/graph.json`,
  }));
  return { version, graph: snapshot };
}

// ── Usage counts (E6 — real per-tenant numbers behind the config quotas) ─────

/** Real per-tenant usage figures the E6 meter renders against tier quotas.
 *  `builds` = projects that reached a built state; `checkpoints` = named E1
 *  versions across all projects (the credit proxy until real build metering,
 *  W5). Owner-scoped by construction — only THIS tenant's tree is read. */
export async function countUsage(
  tenantId: string,
): Promise<{ projects: number; builds: number; checkpoints: number }> {
  const projects = await readProjects(tenantId);
  let builds = 0;
  let checkpoints = 0;
  for (const p of projects) {
    if (p.buildState === "built") builds += 1;
    const versions = await readJson<unknown[]>(
      versionsIndexPath(tenantId, p.id),
    );
    if (Array.isArray(versions)) checkpoints += versions.length;
  }
  return { projects: projects.length, builds, checkpoints };
}

// ── Account settings (W7 — settings depth; tenant-keyed like everything) ─────

function accountSettingsPath(tenantId: string): string {
  return insideTenant(tenantId, "account-settings.json");
}

const DEFAULT_ACCOUNT_SETTINGS: PrismAccountSettings = {
  v: PRISM_TENANCY_CONTRACT_VERSION,
  defaultModelId: null,
  notifications: PRISM_DEFAULT_NOTIFICATION_PREFS,
};

export async function getAccountSettings(
  tenantId: string,
): Promise<PrismAccountSettings> {
  const raw = await readJson<unknown>(accountSettingsPath(tenantId));
  const parsed = prismAccountSettingsSchema.safeParse(raw);
  return parsed.success ? parsed.data : DEFAULT_ACCOUNT_SETTINGS;
}

export async function setAccountSettings(
  tenantId: string,
  patch: {
    defaultModelId?: string | null;
    notifications?: Partial<PrismNotificationPrefs>;
  },
): Promise<PrismAccountSettings> {
  return serialized(tenantId, async () => {
    const current = await getAccountSettings(tenantId);
    const next = prismAccountSettingsSchema.parse({
      v: PRISM_TENANCY_CONTRACT_VERSION,
      defaultModelId:
        patch.defaultModelId !== undefined
          ? patch.defaultModelId
          : current.defaultModelId,
      notifications: {
        ...current.notifications,
        ...(patch.notifications ?? {}),
      },
    });
    await writeJson(accountSettingsPath(tenantId), next);
    return next;
  });
}

/** W7-D3 danger zone — irreversibly wipe ALL of this tenant's Prism data.
 *  Better Auth's own user row is left to the auth admin surface (deviation
 *  W7-D3); the caller signs the session out. */
export async function deleteAllTenantData(tenantId: string): Promise<boolean> {
  return serialized(tenantId, async () => {
    try {
      await fs.rm(tenantRoot(tenantId), { recursive: true, force: true });
      return true;
    } catch {
      return false;
    }
  });
}

// ── Assets (content-addressed binaries, tenant-keyed) ───────────────────────

function assetsDir(tenantId: string, projectId: string): string {
  return insideTenant(
    tenantId,
    "projects",
    safeId(projectId, "project"),
    "assets",
  );
}

function assetsIndexPath(tenantId: string, projectId: string): string {
  return insideTenant(
    tenantId,
    "projects",
    safeId(projectId, "project"),
    "assets.json",
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
    throw new Error("tenant-store: asset exceeds size ceiling");
  }
  return serialized(tenantId, async () => {
    const hash = createHash("sha256").update(input.data).digest("hex");
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
      (a) =>
        !(
          typeof a === "object" &&
          a !== null &&
          (a as { id?: string }).id === hash
        ),
    );
    await writeJson(assetsIndexPath(tenantId, projectId), [
      ...withoutDupe,
      asset,
    ]);
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
    const data = await fs.readFile(
      path.join(assetsDir(tenantId, projectId), assetId),
    );
    return { meta, data };
  } catch {
    return null;
  }
}

// ── Integrations (SHELL W3) ─────────────────────────────────────────────────
// Connected accounts + connector requests live at the TENANT root; per-project
// capability bindings + the GitHub import live under the project dir. Same
// four isolation walls as everything above: tenant-key-first paths, id-grammar
// validation, path re-check inside the tenant root, and not-owned == not-found.
// I5 posture is enforced by the schemas — a connection carries a capability
// REFERENCE only; the store never sees a token to persist.

function connectionsIndexPath(tenantId: string): string {
  return insideTenant(tenantId, "integrations", "connections.json");
}

export async function listConnections(
  tenantId: string,
): Promise<IntegrationConnection[]> {
  const raw = await readJson<unknown[]>(connectionsIndexPath(tenantId));
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((c) => {
    const parsed = integrationConnectionSchema.safeParse(c);
    return parsed.success ? [parsed.data] : [];
  });
}

export async function getConnection(
  tenantId: string,
  connectionId: string,
): Promise<IntegrationConnection | null> {
  const cid = safeId(connectionId, "connection");
  const all = await listConnections(tenantId);
  return all.find((c) => c.id === cid) ?? null;
}

export async function addConnection(
  tenantId: string,
  connection: IntegrationConnection,
): Promise<IntegrationConnection> {
  const parsed = integrationConnectionSchema.parse(connection);
  return serialized(tenantId, async () => {
    const all = await listConnections(tenantId);
    // De-dupe by (providerId) — re-connecting a platform replaces its record.
    const withoutDupe = all.filter((c) => c.providerId !== parsed.providerId);
    await writeJson(connectionsIndexPath(tenantId), [...withoutDupe, parsed]);
    return parsed;
  });
}

export async function updateConnection(
  tenantId: string,
  connectionId: string,
  patch: (c: IntegrationConnection) => IntegrationConnection,
): Promise<IntegrationConnection | null> {
  return serialized(tenantId, async () => {
    const cid = safeId(connectionId, "connection");
    const all = await listConnections(tenantId);
    const idx = all.findIndex((c) => c.id === cid);
    if (idx < 0) return null;
    const updated = integrationConnectionSchema.parse({
      ...patch(all[idx]),
      id: all[idx].id, // id immutable
      updatedAt: nowIso(),
    });
    const next = [...all];
    next[idx] = updated;
    await writeJson(connectionsIndexPath(tenantId), next);
    return updated;
  });
}

export async function removeConnection(
  tenantId: string,
  connectionId: string,
): Promise<boolean> {
  return serialized(tenantId, async () => {
    const cid = safeId(connectionId, "connection");
    const all = await listConnections(tenantId);
    const next = all.filter((c) => c.id !== cid);
    if (next.length === all.length) return false;
    await writeJson(connectionsIndexPath(tenantId), next);
    return true;
  });
}

function connectorRequestsIndexPath(tenantId: string): string {
  return insideTenant(tenantId, "integrations", "connector-requests.json");
}

export async function listConnectorRequests(
  tenantId: string,
): Promise<ConnectorRequest[]> {
  const raw = await readJson<unknown[]>(connectorRequestsIndexPath(tenantId));
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((r) => {
    const parsed = connectorRequestSchema.safeParse(r);
    return parsed.success ? [parsed.data] : [];
  });
}

export async function addConnectorRequest(
  tenantId: string,
  request: ConnectorRequest,
): Promise<ConnectorRequest> {
  const parsed = connectorRequestSchema.parse(request);
  return serialized(tenantId, async () => {
    const all = await listConnectorRequests(tenantId);
    await writeJson(connectorRequestsIndexPath(tenantId), [...all, parsed]);
    return parsed;
  });
}

// ── Generated background library (W-BG) ─────────────────────────────────────
// Prompt-to-background results persist per tenant (same collection idiom as
// connector requests): a JSON list validated item-by-item on read, appended
// under the per-tenant write chain. Layer assets are public urls only.

function backgroundPresetsIndexPath(tenantId: string): string {
  return insideTenant(tenantId, "backgrounds", "background-presets.json");
}

export async function listBackgroundPresets(
  tenantId: string,
): Promise<SavedBackgroundItemRecord[]> {
  const raw = await readJson<unknown[]>(backgroundPresetsIndexPath(tenantId));
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((r) => {
    const parsed = savedBackgroundItemSchema.safeParse(r);
    return parsed.success ? [parsed.data] : [];
  });
}

export async function addBackgroundPreset(
  tenantId: string,
  item: SavedBackgroundItemRecord,
): Promise<SavedBackgroundItemRecord> {
  const parsed = savedBackgroundItemSchema.parse(item);
  return serialized(tenantId, async () => {
    const all = await listBackgroundPresets(tenantId);
    await writeJson(backgroundPresetsIndexPath(tenantId), [...all, parsed]);
    return parsed;
  });
}

// ── Per-project capability bindings + GitHub import (E5) ─────────────────────

function projectIntegrationsPath(tenantId: string, projectId: string): string {
  return insideTenant(
    tenantId,
    "projects",
    safeId(projectId, "project"),
    "integrations.json",
  );
}

interface ProjectIntegrations {
  bindings: ProjectCapabilityBinding[];
  githubImport: GithubImport | null;
}

async function readProjectIntegrations(
  tenantId: string,
  projectId: string,
): Promise<ProjectIntegrations> {
  const raw = await readJson<{ bindings?: unknown[]; githubImport?: unknown }>(
    projectIntegrationsPath(tenantId, projectId),
  );
  const bindings = Array.isArray(raw?.bindings)
    ? raw!.bindings.flatMap((b) => {
        const parsed = projectCapabilityBindingSchema.safeParse(b);
        return parsed.success ? [parsed.data] : [];
      })
    : [];
  const gi = githubImportSchema.safeParse(raw?.githubImport);
  return { bindings, githubImport: gi.success ? gi.data : null };
}

export async function getProjectIntegrations(
  tenantId: string,
  projectId: string,
): Promise<ProjectIntegrations | null> {
  const owned = await getProject(tenantId, projectId);
  if (!owned) return null; // fail closed — not owned == not found
  return readProjectIntegrations(tenantId, projectId);
}

export async function addProjectBinding(
  tenantId: string,
  projectId: string,
  binding: ProjectCapabilityBinding,
): Promise<ProjectCapabilityBinding | null> {
  const owned = await getProject(tenantId, projectId);
  if (!owned) return null;
  const parsed = projectCapabilityBindingSchema.parse(binding);
  return serialized(tenantId, async () => {
    const cur = await readProjectIntegrations(tenantId, projectId);
    // De-dupe by connectionId — one binding per connection per project.
    const bindings = [
      ...cur.bindings.filter((b) => b.connectionId !== parsed.connectionId),
      parsed,
    ];
    await writeJson(projectIntegrationsPath(tenantId, projectId), {
      bindings,
      githubImport: cur.githubImport,
    });
    return parsed;
  });
}

export async function removeProjectBinding(
  tenantId: string,
  projectId: string,
  bindingId: string,
): Promise<boolean> {
  const owned = await getProject(tenantId, projectId);
  if (!owned) return false;
  const bid = safeId(bindingId, "binding");
  return serialized(tenantId, async () => {
    const cur = await readProjectIntegrations(tenantId, projectId);
    const bindings = cur.bindings.filter((b) => b.id !== bid);
    if (bindings.length === cur.bindings.length) return false;
    await writeJson(projectIntegrationsPath(tenantId, projectId), {
      bindings,
      githubImport: cur.githubImport,
    });
    return true;
  });
}

export async function setGithubImport(
  tenantId: string,
  projectId: string,
  githubImport: GithubImport,
): Promise<GithubImport | null> {
  const owned = await getProject(tenantId, projectId);
  if (!owned) return null;
  const parsed = githubImportSchema.parse(githubImport);
  return serialized(tenantId, async () => {
    const cur = await readProjectIntegrations(tenantId, projectId);
    await writeJson(projectIntegrationsPath(tenantId, projectId), {
      bindings: cur.bindings,
      githubImport: parsed,
    });
    return parsed;
  });
}

// ── Conductor build status + deploy records (SHELL W5) ───────────────────────
// The Conductor's per-project build status and its deploy/preview records.
// Same four isolation walls: tenant-key-first paths, id-grammar validation,
// path re-check, not-owned == not-found. I5 posture holds — a deploy record
// carries a capability TOKEN (a reference to a project snapshot), never a
// secret; env values never touch these files (only NAMES, via the contract).

function conductorStatusPath(tenantId: string, projectId: string): string {
  return insideTenant(
    tenantId,
    "projects",
    safeId(projectId, "project"),
    "conductor-status.json",
  );
}

export async function saveConductorStatus(
  tenantId: string,
  projectId: string,
  status: ConductorStatus,
): Promise<ConductorStatus | null> {
  const owned = await getProject(tenantId, projectId);
  if (!owned) return null;
  const parsed = conductorStatusSchema.parse(status);
  await writeJson(conductorStatusPath(tenantId, projectId), parsed);
  return parsed;
}

export async function getConductorStatus(
  tenantId: string,
  projectId: string,
): Promise<ConductorStatus | null> {
  const owned = await getProject(tenantId, projectId);
  if (!owned) return null;
  const raw = await readJson<unknown>(conductorStatusPath(tenantId, projectId));
  if (raw == null) return null;
  const parsed = conductorStatusSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

// ── E20 managed-care config (per project) ─────────────────────────────────────

function careConfigPath(tenantId: string, projectId: string): string {
  return insideTenant(
    tenantId,
    "projects",
    safeId(projectId, "project"),
    "care-config.json",
  );
}

export async function saveCareConfig(
  tenantId: string,
  projectId: string,
  config: CareConfig,
): Promise<CareConfig | null> {
  const owned = await getProject(tenantId, projectId);
  if (!owned) return null;
  const parsed = careConfigSchema.parse(config);
  await writeJson(careConfigPath(tenantId, projectId), parsed);
  return parsed;
}

export async function getCareConfig(
  tenantId: string,
  projectId: string,
): Promise<CareConfig | null> {
  const owned = await getProject(tenantId, projectId);
  if (!owned) return null;
  const raw = await readJson<unknown>(careConfigPath(tenantId, projectId));
  if (raw == null) return null;
  const parsed = careConfigSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

function deploysIndexPath(tenantId: string, projectId: string): string {
  return insideTenant(
    tenantId,
    "projects",
    safeId(projectId, "project"),
    "deploys.json",
  );
}

async function readDeploys(
  tenantId: string,
  projectId: string,
): Promise<DeployRecord[]> {
  const raw = await readJson<unknown[]>(deploysIndexPath(tenantId, projectId));
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((d) => {
    const parsed = deployRecordSchema.safeParse(d);
    return parsed.success ? [parsed.data] : [];
  });
}

export async function saveDeploy(
  tenantId: string,
  projectId: string,
  record: DeployRecord,
): Promise<DeployRecord | null> {
  const owned = await getProject(tenantId, projectId);
  if (!owned) return null;
  const parsed = deployRecordSchema.parse(record);
  return serialized(tenantId, async () => {
    const all = await readDeploys(tenantId, projectId);
    await writeJson(deploysIndexPath(tenantId, projectId), [...all, parsed]);
    return parsed;
  });
}

export async function updateDeploy(
  tenantId: string,
  projectId: string,
  deployId: string,
  patch: (d: DeployRecord) => DeployRecord,
): Promise<DeployRecord | null> {
  const owned = await getProject(tenantId, projectId);
  if (!owned) return null;
  const did = safeId(deployId, "deploy");
  return serialized(tenantId, async () => {
    const all = await readDeploys(tenantId, projectId);
    const idx = all.findIndex((d) => d.id === did);
    if (idx < 0) return null;
    const updated = deployRecordSchema.parse({
      ...patch(all[idx]),
      id: all[idx].id,
    });
    const next = [...all];
    next[idx] = updated;
    await writeJson(deploysIndexPath(tenantId, projectId), next);
    return updated;
  });
}

export async function listDeploys(
  tenantId: string,
  projectId: string,
): Promise<DeployRecord[] | null> {
  const owned = await getProject(tenantId, projectId);
  if (!owned) return null;
  return readDeploys(tenantId, projectId);
}

export async function getDeploy(
  tenantId: string,
  projectId: string,
  deployId: string,
): Promise<DeployRecord | null> {
  const owned = await getProject(tenantId, projectId);
  if (!owned) return null;
  const all = await readDeploys(tenantId, projectId);
  return all.find((d) => d.id === safeId(deployId, "deploy")) ?? null;
}

/** Read an immutable version SNAPSHOT without touching the live graph — the
 *  preview route serves the exact graph a deploy shipped, not the moving live
 *  graph. Fails closed (not owned / not found == null). */
export async function getVersionSnapshot(
  tenantId: string,
  projectId: string,
  versionId: string,
): Promise<Record<string, unknown> | null> {
  const owned = await getProject(tenantId, projectId);
  if (!owned) return null;
  const snapshotFile = insideTenant(
    tenantId,
    "projects",
    safeId(projectId, "project"),
    "versions",
    `${safeId(versionId, "version")}.json`,
  );
  return readJson<Record<string, unknown>>(snapshotFile);
}
