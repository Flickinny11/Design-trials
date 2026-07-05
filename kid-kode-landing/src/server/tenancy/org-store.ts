// PRISM SHELL — ORG + SHARING STORE (SHELL W7, deviation W7-D2)
//
// The AUDITED cross-tenant seam. Strict per-tenant isolation (I11) is the
// default and stays intact: a project is owner-only until an explicit grant is
// recorded here. Org membership is the ONLY cross-user visibility (Decision E
// scope clarification) — and it is explicit (a grant record) and audited
// (every membership/grant change appends to the org audit log).
//
// PORTABLE ON PURPOSE: this module imports NO `server-only` shim and touches
// no auth system, so the standalone CollabRoom host (a separate Node process,
// deviation W7-D1) can import `resolveProjectAccess` to gate a WebSocket join
// with the exact same authority the tRPC router uses. Auth identity is
// resolved by the caller (router / auth-bridge) and passed in — this store
// never trusts a client-supplied id.
//
// Storage (under PRISM_TENANCY_DIR, same root as the tenant store):
//   orgs/<orgId>/org.json            — { id, name, ownerUserId, planTier }
//   orgs/<orgId>/members.json        — PrismOrgMember[]
//   orgs/<orgId>/invites.json        — PrismPendingInvite[]
//   orgs/<orgId>/shares/<pid>.json   — PrismProjectShare
//   orgs/<orgId>/audit.log           — append-only JSONL
//   tenants/<userId>/org-memberships.json — reverse index (orgId[])
//   shared-index.json                — { [projectId]: { ownerUserId, orgId } }
//
// The shared-index is the ONLY global structure, and it holds nothing but the
// mapping needed to resolve a shared project's owning org. An UNSHARED project
// has no entry, so a cross-tenant probe on it can never resolve → I11 holds and
// the two-user isolation probe stays green.

import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  PRISM_SHARING_CONTRACT_VERSION,
  prismOrgDetailSchema,
  prismOrgMemberSchema,
  prismPendingInviteSchema,
  prismProjectShareSchema,
  type PrismEffectiveRole,
  type PrismGrantRole,
  type PrismOrgDetail,
  type PrismOrgMember,
  type PrismOrgRole,
  type PrismPendingInvite,
  type PrismProjectShare,
  type PrismShareGrant,
} from '../../../packages/shared-interfaces/src/prism-sharing';
import {
  prismOrgSchema,
  prismTenancyIdSchema,
  type PrismOrg,
  type PrismPlanTier,
} from '../../../packages/shared-interfaces/src/prism-tenancy';

// ── Paths + primitives (self-contained; mirror tenant-store idioms) ──────────

function tenancyRoot(): string {
  return (
    process.env.PRISM_TENANCY_DIR ?? path.join(process.cwd(), '.data', 'tenancy')
  );
}

function safeId(id: string, label: string): string {
  const parsed = prismTenancyIdSchema.safeParse(id);
  if (!parsed.success) throw new Error(`org-store: invalid ${label} id`);
  return parsed.data;
}

const ORGS_ROOT = 'orgs';

function orgDir(orgId: string): string {
  const root = path.join(tenancyRoot(), ORGS_ROOT, safeId(orgId, 'org'));
  const resolved = path.resolve(root);
  const base = path.resolve(path.join(tenancyRoot(), ORGS_ROOT));
  if (resolved !== base && !resolved.startsWith(base + path.sep)) {
    throw new Error('org-store: path escaped orgs root');
  }
  return resolved;
}

function orgFile(orgId: string, ...segments: string[]): string {
  const dir = orgDir(orgId);
  const joined = path.resolve(dir, ...segments);
  if (joined !== dir && !joined.startsWith(dir + path.sep)) {
    throw new Error('org-store: path escaped org dir');
  }
  return joined;
}

function membershipsFile(userId: string): string {
  return path.join(
    tenancyRoot(),
    'tenants',
    safeId(userId, 'user'),
    'org-memberships.json',
  );
}

function sharedIndexFile(): string {
  return path.join(tenancyRoot(), 'shared-index.json');
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8')) as T;
  } catch {
    return null;
  }
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${randomUUID()}`;
  await fs.writeFile(tmp, JSON.stringify(value, null, 2), 'utf8');
  await fs.rename(tmp, file);
}

// Per-key write serialization (index read-modify-write safety).
const chains = new Map<string, Promise<unknown>>();
function serialized<T>(key: string, op: () => Promise<T>): Promise<T> {
  const prev = chains.get(key) ?? Promise.resolve();
  const next = prev.then(op, op);
  chains.set(key, next);
  return next;
}

function nowIso(): string {
  return new Date().toISOString();
}

// ── Audit log (append-only JSONL) ─────────────────────────────────────────────

export interface AuditEntry {
  at: string;
  actorUserId: string;
  action: string;
  detail: Record<string, unknown>;
}

async function audit(
  orgId: string,
  actorUserId: string,
  action: string,
  detail: Record<string, unknown> = {},
): Promise<void> {
  const entry: AuditEntry = { at: nowIso(), actorUserId, action, detail };
  const file = orgFile(orgId, 'audit.log');
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.appendFile(file, JSON.stringify(entry) + '\n', 'utf8');
}

export async function readAudit(orgId: string): Promise<AuditEntry[]> {
  try {
    const raw = await fs.readFile(orgFile(orgId, 'audit.log'), 'utf8');
    return raw
      .split('\n')
      .filter(Boolean)
      .flatMap((line) => {
        try {
          return [JSON.parse(line) as AuditEntry];
        } catch {
          return [];
        }
      });
  } catch {
    return [];
  }
}

// ── Org metadata + members + invites ──────────────────────────────────────────

interface OrgMeta {
  id: string;
  name: string;
  ownerUserId: string;
  planTier: PrismPlanTier;
  createdAt: string;
}

async function readOrgMeta(orgId: string): Promise<OrgMeta | null> {
  return readJson<OrgMeta>(orgFile(orgId, 'org.json'));
}

async function readMembers(orgId: string): Promise<PrismOrgMember[]> {
  const raw = await readJson<unknown[]>(orgFile(orgId, 'members.json'));
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((m) => {
    const parsed = prismOrgMemberSchema.safeParse(m);
    return parsed.success ? [parsed.data] : [];
  });
}

async function readInvites(orgId: string): Promise<PrismPendingInvite[]> {
  const raw = await readJson<unknown[]>(orgFile(orgId, 'invites.json'));
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((i) => {
    const parsed = prismPendingInviteSchema.safeParse(i);
    return parsed.success ? [parsed.data] : [];
  });
}

async function addMembershipRef(userId: string, orgId: string): Promise<void> {
  await serialized(`mem:${userId}`, async () => {
    const existing = (await readJson<string[]>(membershipsFile(userId))) ?? [];
    if (!existing.includes(orgId)) {
      await writeJson(membershipsFile(userId), [...existing, orgId]);
    }
  });
}

async function removeMembershipRef(userId: string, orgId: string): Promise<void> {
  await serialized(`mem:${userId}`, async () => {
    const existing = (await readJson<string[]>(membershipsFile(userId))) ?? [];
    await writeJson(
      membershipsFile(userId),
      existing.filter((o) => o !== orgId),
    );
  });
}

export interface ActorProfile {
  userId: string;
  displayName: string;
  email: string;
}

/** Create an org (enterprise-tier gate enforced by the caller). The creator
 *  becomes the sole `owner` member. */
export async function createOrg(
  owner: ActorProfile,
  planTier: PrismPlanTier,
  name: string,
): Promise<OrgMeta> {
  const orgId = `org-${randomUUID()}`;
  const meta: OrgMeta = {
    id: orgId,
    name,
    ownerUserId: owner.userId,
    planTier,
    createdAt: nowIso(),
  };
  await serialized(`org:${orgId}`, async () => {
    await writeJson(orgFile(orgId, 'org.json'), meta);
    const member: PrismOrgMember = {
      userId: owner.userId,
      orgRole: 'owner',
      displayName: owner.displayName,
      email: owner.email,
      addedAt: nowIso(),
    };
    await writeJson(orgFile(orgId, 'members.json'), [member]);
    await writeJson(orgFile(orgId, 'invites.json'), []);
  });
  await addMembershipRef(owner.userId, orgId);
  await audit(orgId, owner.userId, 'org.create', { name });
  return meta;
}

export async function isOrgMember(
  orgId: string,
  userId: string,
): Promise<boolean> {
  const members = await readMembers(orgId);
  return members.some((m) => m.userId === userId);
}

/** Plan tier of an org (the multiplayer enterprise gate reads this). */
export async function orgPlanTier(
  orgId: string,
): Promise<PrismPlanTier | null> {
  const meta = await readOrgMeta(orgId);
  return meta?.planTier ?? null;
}

export async function orgRoleOf(
  orgId: string,
  userId: string,
): Promise<PrismOrgRole | null> {
  const members = await readMembers(orgId);
  return members.find((m) => m.userId === userId)?.orgRole ?? null;
}

/** Add a member (existing user) OR record a pending invite (unknown email).
 *  `acting` must be an org owner/admin (enforced by caller). */
export async function addMember(
  orgId: string,
  actingUserId: string,
  input: {
    email: string;
    orgRole: PrismOrgRole;
    /** Resolved by the caller from Better Auth; null ⇒ pending invite. */
    resolved: ActorProfile | null;
  },
): Promise<{ added: 'member' | 'invite' }> {
  const result = await serialized(`org:${orgId}`, async () => {
    if (input.resolved) {
      const members = await readMembers(orgId);
      if (!members.some((m) => m.userId === input.resolved!.userId)) {
        const member: PrismOrgMember = {
          userId: input.resolved.userId,
          orgRole: input.orgRole,
          displayName: input.resolved.displayName,
          email: input.resolved.email,
          addedAt: nowIso(),
        };
        await writeJson(orgFile(orgId, 'members.json'), [...members, member]);
      }
      // Drop any pending invite for the same email now satisfied.
      const invites = await readInvites(orgId);
      await writeJson(
        orgFile(orgId, 'invites.json'),
        invites.filter((i) => i.email !== input.email),
      );
      return { added: 'member' as const, userId: input.resolved.userId };
    }
    const invites = await readInvites(orgId);
    if (!invites.some((i) => i.email === input.email)) {
      const invite: PrismPendingInvite = {
        email: input.email,
        orgRole: input.orgRole,
        invitedByUserId: actingUserId,
        invitedAt: nowIso(),
      };
      await writeJson(orgFile(orgId, 'invites.json'), [...invites, invite]);
    }
    return { added: 'invite' as const, userId: null };
  });
  if (result.userId) await addMembershipRef(result.userId, orgId);
  await audit(orgId, actingUserId, `member.${result.added}`, {
    email: input.email,
    orgRole: input.orgRole,
  });
  return { added: result.added };
}

/** Remove a member (owner cannot be removed). Also strips their reverse ref and
 *  any per-user grants they held. */
export async function removeMember(
  orgId: string,
  actingUserId: string,
  userId: string,
): Promise<boolean> {
  const meta = await readOrgMeta(orgId);
  if (!meta || meta.ownerUserId === userId) return false;
  const ok = await serialized(`org:${orgId}`, async () => {
    const members = await readMembers(orgId);
    if (!members.some((m) => m.userId === userId)) return false;
    await writeJson(
      orgFile(orgId, 'members.json'),
      members.filter((m) => m.userId !== userId),
    );
    return true;
  });
  if (!ok) return false;
  await removeMembershipRef(userId, orgId);
  await audit(orgId, actingUserId, 'member.remove', { userId });
  return true;
}

/** When a user's account first appears (sign-up/first me()), turn any matching
 *  pending invites into memberships. Idempotent; safe to call every session. */
export async function reconcileInvites(profile: ActorProfile): Promise<void> {
  const orgIds = await listAllOrgIds();
  for (const orgId of orgIds) {
    const invites = await readInvites(orgId);
    const match = invites.find(
      (i) => i.email.toLowerCase() === profile.email.toLowerCase(),
    );
    if (!match) continue;
    await addMember(orgId, match.invitedByUserId, {
      email: profile.email,
      orgRole: match.orgRole,
      resolved: profile,
    });
  }
}

async function listAllOrgIds(): Promise<string[]> {
  try {
    const entries = await fs.readdir(path.join(tenancyRoot(), ORGS_ROOT), {
      withFileTypes: true,
    });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

// ── Org summaries + detail ─────────────────────────────────────────────────────

function toSummary(meta: OrgMeta, members: PrismOrgMember[]): PrismOrg {
  return prismOrgSchema.parse({
    id: meta.id,
    name: meta.name,
    ownerUserId: meta.ownerUserId,
    planTier: meta.planTier,
    memberUserIds: members.map((m) => m.userId),
    createdAt: meta.createdAt,
  });
}

export async function listUserOrgs(userId: string): Promise<PrismOrg[]> {
  const orgIds = (await readJson<string[]>(membershipsFile(userId))) ?? [];
  const out: PrismOrg[] = [];
  for (const orgId of orgIds) {
    const meta = await readOrgMeta(orgId);
    if (!meta) continue;
    const members = await readMembers(orgId);
    // Fail closed: only list orgs the user is genuinely still a member of.
    if (!members.some((m) => m.userId === userId)) continue;
    out.push(toSummary(meta, members));
  }
  return out;
}

export async function getOrgDetail(
  orgId: string,
  viewerUserId: string,
): Promise<PrismOrgDetail | null> {
  const meta = await readOrgMeta(orgId);
  if (!meta) return null;
  const members = await readMembers(orgId);
  if (!members.some((m) => m.userId === viewerUserId)) return null; // fail closed
  const invites = await readInvites(orgId);
  return prismOrgDetailSchema.parse({
    id: meta.id,
    name: meta.name,
    ownerUserId: meta.ownerUserId,
    planTier: meta.planTier,
    members,
    pendingInvites: invites,
    createdAt: meta.createdAt,
  });
}

// ── Shared index ──────────────────────────────────────────────────────────────

interface SharedIndex {
  [projectId: string]: { ownerUserId: string; orgId: string };
}

async function readSharedIndex(): Promise<SharedIndex> {
  return (await readJson<SharedIndex>(sharedIndexFile())) ?? {};
}

async function writeSharedIndexEntry(
  projectId: string,
  entry: { ownerUserId: string; orgId: string } | null,
): Promise<void> {
  await serialized('shared-index', async () => {
    const idx = await readSharedIndex();
    if (entry) idx[projectId] = entry;
    else delete idx[projectId];
    await writeJson(sharedIndexFile(), idx);
  });
}

// ── Project shares (grants) ────────────────────────────────────────────────────

function orgUrlFor(projectId: string): string {
  return `/app/builder/${projectId}`;
}

async function readShare(
  orgId: string,
  projectId: string,
): Promise<PrismProjectShare | null> {
  const raw = await readJson<unknown>(
    orgFile(orgId, 'shares', `${safeId(projectId, 'project')}.json`),
  );
  if (!raw) return null;
  const parsed = prismProjectShareSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** Owner sets the full grant list for a project within an org (replace
 *  semantics, §6.9.1). Caller has already asserted: acting user OWNS the
 *  project and is a member of the org. Empty grants ⇒ visibility 'private'
 *  (still indexed so the owner's org can find it in the dashboard). */
export async function setProjectShare(
  orgId: string,
  ownerUserId: string,
  projectId: string,
  projectName: string,
  grantsIn: Array<{
    subjectType: 'org' | 'user';
    subjectUserId?: string | null;
    role: PrismGrantRole;
  }>,
): Promise<PrismProjectShare> {
  const grants: PrismShareGrant[] = grantsIn.map((g) => ({
    subjectType: g.subjectType,
    subjectUserId: g.subjectType === 'user' ? (g.subjectUserId ?? null) : null,
    role: g.role,
    grantedByUserId: ownerUserId,
    grantedAt: nowIso(),
  }));
  const share: PrismProjectShare = prismProjectShareSchema.parse({
    projectId,
    ownerUserId,
    orgId,
    visibility: grants.length > 0 ? 'org' : 'private',
    grants,
    orgUrl: orgUrlFor(projectId),
    updatedAt: nowIso(),
  });
  await serialized(`org:${orgId}`, async () => {
    await writeJson(
      orgFile(orgId, 'shares', `${safeId(projectId, 'project')}.json`),
      { ...share, projectName },
    );
  });
  await writeSharedIndexEntry(projectId, { ownerUserId, orgId });
  await audit(orgId, ownerUserId, 'project.share', {
    projectId,
    visibility: share.visibility,
    grantCount: grants.length,
  });
  return share;
}

/** Owner's view of a project's current share state (null when never shared). */
export async function getProjectShare(
  ownerUserId: string,
  projectId: string,
): Promise<PrismProjectShare | null> {
  const idx = await readSharedIndex();
  const entry = idx[projectId];
  if (!entry || entry.ownerUserId !== ownerUserId) return null;
  return readShare(entry.orgId, projectId);
}

const ROLE_RANK: Record<PrismGrantRole, number> = { view: 1, comment: 2, edit: 3 };

/** THE audited cross-tenant resolver (deviation W7-D2). Returns the viewer's
 *  effective role on a SHARED project, or 'none'. Owner-of-a-shared-project
 *  resolves to 'owner'. Unshared projects (no index entry) resolve to 'none'
 *  here — the caller determines ownership of unshared projects via the
 *  owner-keyed tenant store, so I11 for unshared data is never in this path. */
export async function resolveProjectAccess(
  viewerUserId: string,
  projectId: string,
): Promise<{
  role: PrismEffectiveRole;
  orgId: string | null;
  ownerUserId: string | null;
}> {
  const idx = await readSharedIndex();
  const entry = idx[projectId];
  if (!entry) return { role: 'none', orgId: null, ownerUserId: null };
  const { ownerUserId, orgId } = entry;
  if (viewerUserId === ownerUserId) return { role: 'owner', orgId, ownerUserId };
  // Cross-tenant: viewer MUST be a current member of the owning org.
  if (!(await isOrgMember(orgId, viewerUserId))) {
    return { role: 'none', orgId: null, ownerUserId: null };
  }
  const share = await readShare(orgId, projectId);
  if (!share || share.visibility !== 'org') {
    return { role: 'none', orgId: null, ownerUserId: null };
  }
  // Best applicable grant: a user-specific grant outranks the org-wide grant;
  // within that, higher role wins.
  let best: PrismGrantRole | null = null;
  for (const g of share.grants) {
    const applies =
      g.subjectType === 'org' ||
      (g.subjectType === 'user' && g.subjectUserId === viewerUserId);
    if (!applies) continue;
    if (!best || ROLE_RANK[g.role] > ROLE_RANK[best]) best = g.role;
  }
  if (!best) return { role: 'none', orgId: null, ownerUserId: null };
  return { role: best, orgId, ownerUserId };
}

// ── Enterprise dashboard: collective builds visible through an org ─────────────

export interface OrgBuildRaw {
  projectId: string;
  projectName: string;
  ownerUserId: string;
  visibility: 'private' | 'org';
  updatedAt: string;
}

/** All projects shared into an org (owner rows carry projectName for the
 *  dashboard). Caller enriches with owner display names + build state. */
export async function listOrgSharedProjects(
  orgId: string,
): Promise<OrgBuildRaw[]> {
  try {
    const dir = orgFile(orgId, 'shares');
    const files = await fs.readdir(dir);
    const out: OrgBuildRaw[] = [];
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      const raw = await readJson<
        PrismProjectShare & { projectName?: string }
      >(path.join(dir, f));
      if (!raw) continue;
      out.push({
        projectId: raw.projectId,
        projectName: raw.projectName ?? raw.projectId,
        ownerUserId: raw.ownerUserId,
        visibility: raw.visibility,
        updatedAt: raw.updatedAt,
      });
    }
    return out;
  } catch {
    return [];
  }
}

export const ORG_STORE_CONTRACT_VERSION = PRISM_SHARING_CONTRACT_VERSION;
