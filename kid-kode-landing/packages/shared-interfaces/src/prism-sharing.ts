// PRISM SHELL — ORG SHARING + PERMISSION MATRIX CONTRACT — prism-sharing.ts
// (SHELL W7, decision E enterprise-tier scope, 2026-07-04)
//
// Contract-first (spec I4) shapes for org-scoped project sharing (spec §6.9
// S9) and the ENTERPRISE-tier org surface. Org membership is the ONLY
// cross-user visibility (Decision E scope clarification) — explicit and
// audited. The permission matrix below is the SINGLE source of truth for
// which role may take which action; both the server (sharing router + collab
// host) and the client render from it, so "can an editor do X" is a data
// question, not scattered branching.
//
// Isolation note (I11 / deviation W7-D2): NONE of the request schemas carry a
// viewer/owner id — the viewer is always the server-resolved Better Auth
// session. A project only becomes cross-tenant-visible through an explicit
// grant recorded in the org store; the default (no grant) stays owner-only.
//
// Discipline: ADDITIVE ONLY — never remove or repurpose a variant or field.

import { z } from 'zod';
import { prismPlanTierSchema, prismTenancyIdSchema } from './prism-tenancy';

/** Contract version for the sharing surface. */
export const PRISM_SHARING_CONTRACT_VERSION = 1 as const;

// ── Roles ─────────────────────────────────────────────────────────────────────

/** What an owner may GRANT on a project (spec §6.9.1: view · comment · edit;
 *  "private" is the absence of any grant). */
export const prismGrantRoleSchema = z.enum(['view', 'comment', 'edit']);
export type PrismGrantRole = z.infer<typeof prismGrantRoleSchema>;

/** The EFFECTIVE role a viewer resolves to on a project — the grant roles plus
 *  `owner` (the tenant who owns the row) and the implicit no-access `none`. */
export const prismEffectiveRoleSchema = z.enum([
  'owner',
  'edit',
  'comment',
  'view',
  'none',
]);
export type PrismEffectiveRole = z.infer<typeof prismEffectiveRoleSchema>;

/** A member's standing WITHIN an org (distinct from a project role). */
export const prismOrgRoleSchema = z.enum(['owner', 'admin', 'member']);
export type PrismOrgRole = z.infer<typeof prismOrgRoleSchema>;

// ── Permission matrix (THE source of truth) ─────────────────────────────────

/** Every gate-able action on a shared project. `chat` = "chat with the builder
 *  in the same session" (spec §6.9.1, granted with edit). `collaborate` = join
 *  the CollabRoom presence/co-editing channel (additionally enterprise-gated,
 *  see `canCollaborate`). `manageSharing`/`deleteProject` are owner-only. */
export const prismShareActionSchema = z.enum([
  'view',
  'comment',
  'edit',
  'chat',
  'collaborate',
  'manageSharing',
  'deleteProject',
]);
export type PrismShareAction = z.infer<typeof prismShareActionSchema>;

/** Role → allowed actions. Frozen so no consumer can mutate the matrix. */
export const PRISM_PERMISSION_MATRIX: Readonly<
  Record<PrismEffectiveRole, readonly PrismShareAction[]>
> = Object.freeze({
  owner: [
    'view',
    'comment',
    'edit',
    'chat',
    'collaborate',
    'manageSharing',
    'deleteProject',
  ],
  edit: ['view', 'comment', 'edit', 'chat', 'collaborate'],
  comment: ['view', 'comment'],
  view: ['view'],
  none: [],
});

/** The one gate. Pure, total, and the ONLY place the matrix is read. */
export function can(role: PrismEffectiveRole, action: PrismShareAction): boolean {
  return PRISM_PERMISSION_MATRIX[role].includes(action);
}

/** Capability bag the client renders from — no client-side matrix reimpl. */
export const prismProjectCapabilitiesSchema = z.object({
  view: z.boolean(),
  comment: z.boolean(),
  edit: z.boolean(),
  chat: z.boolean(),
  collaborate: z.boolean(),
  manageSharing: z.boolean(),
  deleteProject: z.boolean(),
});
export type PrismProjectCapabilities = z.infer<
  typeof prismProjectCapabilitiesSchema
>;

/** Materialize the capability bag for a role. `enterprise` additionally gates
 *  `collaborate` (multiplayer is the enterprise capability, Decision E). */
export function capabilitiesFor(
  role: PrismEffectiveRole,
  enterprise: boolean,
): PrismProjectCapabilities {
  return {
    view: can(role, 'view'),
    comment: can(role, 'comment'),
    edit: can(role, 'edit'),
    chat: can(role, 'chat'),
    collaborate: enterprise && can(role, 'collaborate'),
    manageSharing: can(role, 'manageSharing'),
    deleteProject: can(role, 'deleteProject'),
  };
}

// ── Org + membership ──────────────────────────────────────────────────────────

export const prismOrgMemberSchema = z.object({
  userId: prismTenancyIdSchema,
  orgRole: prismOrgRoleSchema,
  /** Display projection (never auth storage) — for the member roster UI. */
  displayName: z.string().min(1).max(200),
  email: z.string().email().max(320),
  addedAt: z.string().datetime(),
});
export type PrismOrgMember = z.infer<typeof prismOrgMemberSchema>;

/** A member invited by email who has not yet signed up — a real, listed
 *  pending seat, resolved to a full member the moment their account exists. */
export const prismPendingInviteSchema = z.object({
  email: z.string().email().max(320),
  orgRole: prismOrgRoleSchema,
  invitedByUserId: prismTenancyIdSchema,
  invitedAt: z.string().datetime(),
});
export type PrismPendingInvite = z.infer<typeof prismPendingInviteSchema>;

/** Full org detail (enterprise dashboard). */
export const prismOrgDetailSchema = z.object({
  id: prismTenancyIdSchema,
  name: z.string().min(1).max(200),
  ownerUserId: prismTenancyIdSchema,
  planTier: prismPlanTierSchema,
  members: z.array(prismOrgMemberSchema),
  pendingInvites: z.array(prismPendingInviteSchema),
  createdAt: z.string().datetime(),
});
export type PrismOrgDetail = z.infer<typeof prismOrgDetailSchema>;

// ── Share grants ──────────────────────────────────────────────────────────────

/** One grant on a project: the whole org, or a single member. */
export const prismShareGrantSchema = z
  .object({
    subjectType: z.enum(['org', 'user']),
    /** Required iff subjectType === 'user' (a specific member). */
    subjectUserId: prismTenancyIdSchema.nullish(),
    role: prismGrantRoleSchema,
    grantedByUserId: prismTenancyIdSchema,
    grantedAt: z.string().datetime(),
  })
  .refine(
    (g) => (g.subjectType === 'user' ? Boolean(g.subjectUserId) : true),
    { message: 'user grants require subjectUserId' },
  );
export type PrismShareGrant = z.infer<typeof prismShareGrantSchema>;

/** The share state of one project. `visibility` is derived (grants present ⇒
 *  shared) but carried explicitly so the UI can render "Private" honestly. */
export const prismProjectShareSchema = z.object({
  projectId: prismTenancyIdSchema,
  ownerUserId: prismTenancyIdSchema,
  orgId: prismTenancyIdSchema,
  visibility: z.enum(['private', 'org']),
  grants: z.array(prismShareGrantSchema),
  /** Internal org URL (spec §6.9.3) — a route inside this app, never a secret. */
  orgUrl: z.string().max(400),
  updatedAt: z.string().datetime(),
});
export type PrismProjectShare = z.infer<typeof prismProjectShareSchema>;

// ── tRPC IO ────────────────────────────────────────────────────────────────────

export const orgCreateInputSchema = z
  .object({ name: z.string().min(1).max(200) })
  .strict();
export type OrgCreateInput = z.infer<typeof orgCreateInputSchema>;

export const orgGetInputSchema = z
  .object({ orgId: prismTenancyIdSchema })
  .strict();
export type OrgGetInput = z.infer<typeof orgGetInputSchema>;

export const memberAddInputSchema = z
  .object({
    orgId: prismTenancyIdSchema,
    email: z.string().email().max(320),
    orgRole: prismOrgRoleSchema.default('member'),
  })
  .strict();
export type MemberAddInput = z.infer<typeof memberAddInputSchema>;

export const memberRemoveInputSchema = z
  .object({ orgId: prismTenancyIdSchema, userId: prismTenancyIdSchema })
  .strict();
export type MemberRemoveInput = z.infer<typeof memberRemoveInputSchema>;

/** Replace-semantics: the full grant set for a project (owner-only, §6.9.1). */
export const projectShareSetInputSchema = z
  .object({
    projectId: prismTenancyIdSchema,
    orgId: prismTenancyIdSchema,
    grants: z
      .array(
        z.object({
          subjectType: z.enum(['org', 'user']),
          subjectUserId: prismTenancyIdSchema.nullish(),
          role: prismGrantRoleSchema,
        }),
      )
      .max(200),
  })
  .strict();
export type ProjectShareSetInput = z.infer<typeof projectShareSetInputSchema>;

export const projectShareGetInputSchema = z
  .object({ projectId: prismTenancyIdSchema })
  .strict();
export type ProjectShareGetInput = z.infer<typeof projectShareGetInputSchema>;

/** `sharing.project.access` output — the viewer's effective role + capability
 *  bag for a project (the builder gate reads this). */
export const projectAccessOutputSchema = z.object({
  v: z.literal(PRISM_SHARING_CONTRACT_VERSION),
  projectId: prismTenancyIdSchema,
  role: prismEffectiveRoleSchema,
  capabilities: prismProjectCapabilitiesSchema,
  /** True when the viewer's plan (or the owning org's plan) is enterprise. */
  enterprise: z.boolean(),
});
export type ProjectAccessOutput = z.infer<typeof projectAccessOutputSchema>;

/** Enterprise dashboard payload: the org + the collective builds visible to
 *  the viewer through it (founder scope note — shared org view). */
export const prismOrgBuildRowSchema = z.object({
  projectId: prismTenancyIdSchema,
  name: z.string().min(1).max(200),
  ownerUserId: prismTenancyIdSchema,
  ownerName: z.string().max(200),
  buildState: z.string().max(40).nullable(),
  visibility: z.enum(['private', 'org']),
  updatedAt: z.string().datetime(),
});
export type PrismOrgBuildRow = z.infer<typeof prismOrgBuildRowSchema>;

export const orgDashboardOutputSchema = z.object({
  v: z.literal(PRISM_SHARING_CONTRACT_VERSION),
  org: prismOrgDetailSchema,
  builds: z.array(prismOrgBuildRowSchema),
  seats: z.object({
    used: z.number().int().nonnegative(),
    limit: z.number().int().nonnegative().nullable(),
  }),
});
export type OrgDashboardOutput = z.infer<typeof orgDashboardOutputSchema>;
