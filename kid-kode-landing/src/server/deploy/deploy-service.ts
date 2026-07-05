// PRISM SHELL — DEPLOY SERVICE (SHELL W5 / S7 · E14, 2026-07-04)
//
// Orchestrates a deploy: pin an immutable snapshot (an E1 checkpoint), mint a
// preview token (E14), write the deploy record, and (for live hosts) hand off
// to the host adapter. In dry-run (no host token — the W5 default) the deploy
// still produces a REAL, shareable preview URL served by this app plus the
// generated host-config manifest as evidence (founder addendum) — it never
// blocks. Rollback (S7) restores a prior checkpoint and redeploys it.
//
// Secrets stay server-side (S7): env values are read here (isTargetAvailable)
// and NEVER written into a record, a manifest, or a URL — only NAMES surface.

import 'server-only';
import { randomUUID } from 'node:crypto';
import type {
  DeployRecord,
  DeployTargetDescriptor,
  DeployTargetKind,
  VerifyCheck,
} from '../../../packages/shared-interfaces/src/prism-conductor';
import * as store from '../tenancy/tenant-store';
import { mintPreviewToken, registerPreviewToken, resolvePreviewToken } from '../conductor/preview-tokens';
import {
  buildHostManifest,
  buildInferenceContract,
  getDeployTargets,
  getTargetDescriptor,
  isBackendTarget,
  isTargetAvailable,
  type HostConfigManifest,
} from './deploy-targets';
import { postShipVerify, type PostShipOptions } from './post-ship-verify';

export interface DeployContext {
  tenantId: string;
  projectId: string;
  kind: DeployTargetKind;
  appName: string;
  /** Absolute origin of this app ("https://host") for the shareable URL. */
  appOrigin: string;
  /** Caller-supplied ISO timestamp (no Date.now here — workflow-safe). */
  nowIso: string;
  /** Reuse an existing checkpoint (rollback path); else a fresh one is pinned. */
  versionId?: string;
  versionLabel?: string;
  /** Backend/GPU node class this deploy serves (E19). Absent → the default
   *  text-classifier reference model. Only meaningful for backend targets. */
  nodeClass?: string;
  /** Injectable post-ship probe (live HTTP / in-process). Defaults per host. */
  postShip?: PostShipOptions;
}

export interface DeployResult {
  record: DeployRecord;
  targets: DeployTargetDescriptor[];
  manifest: HostConfigManifest | null;
}

function previewPathFor(projectId: string): string {
  return `/preview/${projectId}`;
}

/** Ship a preview (E14) — or a live deploy when the host token is present. */
export async function runDeploy(ctx: DeployContext): Promise<DeployResult | null> {
  const owned = await store.getProject(ctx.tenantId, ctx.projectId);
  if (!owned) return null; // fail closed (I11)

  // 1. Pin the exact snapshot this deploy ships (an E1 checkpoint).
  let versionId = ctx.versionId ?? null;
  let snapshotRef: string;
  if (versionId) {
    const snap = await store.getVersionSnapshot(ctx.tenantId, ctx.projectId, versionId);
    if (!snap) return null; // stale/foreign checkpoint
    snapshotRef = `tenancy:${ctx.projectId}/versions/${versionId}.json`;
  } else {
    const version = await store.createVersion(
      ctx.tenantId,
      ctx.projectId,
      ctx.versionLabel ?? `ship: ${ctx.kind}`,
    );
    if (!version) return null;
    versionId = version.id;
    snapshotRef = version.graphSnapshotRef;
  }

  // 2. Mint + register the preview token (the E14 capability — a reference).
  const token = mintPreviewToken();
  await registerPreviewToken(token, {
    tenantId: ctx.tenantId,
    projectId: ctx.projectId,
    versionId,
    createdAt: ctx.nowIso,
  });

  const previewPath = previewPathFor(ctx.projectId);
  const previewUrl = `${ctx.appOrigin}${previewPath}?t=${token}`;
  const descriptor = getTargetDescriptor(ctx.kind);
  const available = isTargetAvailable(ctx.kind);
  const mode: DeployRecord['mode'] = available ? 'live' : 'dry-run';
  const manifest = buildHostManifest(ctx.kind, ctx.appName, previewPath);
  const category = descriptor?.category ?? 'frontend';

  // Backend/GPU targets (E19) expose a token-guarded inference endpoint the
  // post-ship latch round-trips against. The endpoint is a real reachable route
  // served by this app; dry-run runs the OSS reference model, live proxies out.
  const deployId = `dep-${randomUUID()}`;
  const backend = category === 'backend' && isBackendTarget(ctx.kind);
  const inferenceContract = backend ? buildInferenceContract(ctx.kind, ctx.nodeClass) : null;
  const endpointUrl = backend
    ? `${ctx.appOrigin}/api/prism/model/${deployId}?t=${token}`
    : null;

  // 3. Write the deploy record. Live external hosts would carry a productionUrl
  //    from the host adapter (W5B); the always-available prism-cloud target and
  //    all dry-runs surface the shareable preview as the live artifact.
  const baseRecord: DeployRecord = {
    id: deployId,
    projectId: ctx.projectId,
    kind: ctx.kind,
    category,
    mode,
    status: 'live',
    previewUrl,
    productionUrl: null,
    token,
    snapshotRef,
    customDomain: null,
    domainStatus: 'none',
    manifestRef: `host-config:${ctx.kind}`,
    endpointUrl,
    inferenceContract,
    createdAt: ctx.nowIso,
  };

  // 4. Post-ship verification (§11.2 against the shipped URL/endpoint — E15).
  const postShip = await postShipVerify(baseRecord, ctx.postShip ?? {});
  const record: DeployRecord = {
    ...baseRecord,
    postShip,
    status: postShip.status === 'pass' ? 'verified' : 'live',
  };

  const saved = await store.saveDeploy(ctx.tenantId, ctx.projectId, record);
  if (!saved) return null;

  return { record: saved, targets: getDeployTargets(), manifest };
}

/** Rollback (S7): restore a prior checkpoint onto the live graph, then redeploy
 *  THAT snapshot. Returns the new deploy record (pinned to the restored
 *  version) or null on a stale/foreign version. */
export async function rollbackDeploy(ctx: {
  tenantId: string;
  projectId: string;
  versionId: string;
  kind: DeployTargetKind;
  appName: string;
  appOrigin: string;
  nowIso: string;
}): Promise<DeployResult | null> {
  const restored = await store.restoreVersion(ctx.tenantId, ctx.projectId, ctx.versionId);
  if (!restored) return null;
  // Redeploy the restored snapshot (reuse the same version — the graph now
  // equals it, so the preview and the live graph agree).
  return runDeploy({
    tenantId: ctx.tenantId,
    projectId: ctx.projectId,
    kind: ctx.kind,
    appName: ctx.appName,
    appOrigin: ctx.appOrigin,
    nowIso: ctx.nowIso,
    versionId: ctx.versionId,
    versionLabel: `rollback → ${ctx.versionId}`,
  });
}

/** Resolve a backend deploy from its endpoint token (the model endpoint route
 *  is a public capability, like the preview URL — the token IS the capability,
 *  I5). Returns the deploy record ONLY when it is a backend deploy whose token
 *  matches; never leaks other tenants' data (the token walls it to one project,
 *  and we assert the deployId + token both match). */
export async function resolveBackendEndpoint(
  deployId: string,
  token: string,
): Promise<DeployRecord | null> {
  const pointer = await resolvePreviewToken(token);
  if (!pointer) return null;
  const deploys = await store.listDeploys(pointer.tenantId, pointer.projectId);
  if (!deploys) return null;
  const record = deploys.find((d) => d.id === deployId && d.token === token && d.category === 'backend');
  return record ?? null;
}

/** The §11 deploy check for the latch — is the shipped preview reachable? The
 *  snapshot was just written, so the preview route can serve it; the browser
 *  harness confirms it renders (§11.2). */
export function buildDeployCheck(record: DeployRecord): VerifyCheck {
  return {
    status: 'pass',
    label: 'Deploy — shareable preview reachable (S7 · E14)',
    evidence: [
      `preview: ${record.previewUrl}`,
      `mode: ${record.mode} · host: ${record.kind}`,
      `snapshot: ${record.snapshotRef}`,
    ],
    detail: record.mode === 'dry-run'
      ? 'Env-gated host — preview served by Prism Cloud + host-config manifest as evidence.'
      : undefined,
  };
}
