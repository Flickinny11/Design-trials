'use client';

// PRISM SHELL — CONDUCTOR CLIENT (SHELL W5, 2026-07-04)
//
// Drives the Conductor build against `conductor.run` and folds its streamed
// AgentStreamEvents into the SAME chat store the freeform agent uses — so the
// plan/build/verify/deploy EVIDENCE is visible live in chat (E4). Interruptible
// at all times (spec §10 S4): the build holds an AbortController; stopBuild()
// tears the fetch down. Plus the query/mutation helpers the preview frame and
// Ship panel read (status, deploy, rollback, custom domain, export).

import { createTRPCClient, httpBatchStreamLink } from '@trpc/client';
import type { AppRouter } from '../../server/trpc/router';
import { parseAgentStreamEvent } from '../../../packages/shared-interfaces/src/prism-agent';
import {
  conductorStatusSchema,
  deployListOutputSchema,
  deployOutputSchema,
  exportOutputSchema,
  recommendationsOutputSchema,
  type DeployTargetKind,
  type RecommendationsOutput,
} from '../../../packages/shared-interfaces/src/prism-conductor';
import { useChatStore } from './chat-store';
import { useConductorStore } from './conductor-store';

const trpc = createTRPCClient<AppRouter>({
  links: [httpBatchStreamLink({ url: '/api/trpc' })],
});

let buildAbort: AbortController | null = null;

export function isBuildActive(): boolean {
  return buildAbort !== null;
}

/** Abort the in-flight build (interruptible at all times, S4). */
export function stopBuild(): void {
  buildAbort?.abort();
}

/** Kick off a Conductor build. Streams evidence into chat; refreshes the
 *  conductor store (status + deploys) on completion. */
export async function runConductorBuild(opts: {
  projectId: string;
  rebuild?: boolean;
}): Promise<void> {
  const chat = useChatStore.getState();
  const conductor = useConductorStore.getState();
  if (chat.isStreaming || conductor.isBuilding) return;

  conductor.setBuildError(null);
  conductor.setBuilding(true);
  const opener = opts.rebuild ? '▷ Rebuild this app from the approved brief.' : '▷ Build this app from the approved brief.';
  const turnId = chat.beginTurn(opener, []);
  const store = useChatStore.getState();

  const abort = new AbortController();
  buildAbort = abort;

  try {
    const stream = await trpc.conductor.run.mutate(
      { projectId: opts.projectId, modelId: chat.activeModelId, rebuild: opts.rebuild },
      { signal: abort.signal },
    );
    let ended = false;
    for await (const raw of stream) {
      const event = parseAgentStreamEvent(raw);
      switch (event.type) {
        case 'message-start':
          store.noteMessageStart(turnId, event.modelId);
          break;
        case 'text-delta':
          store.appendText(turnId, event.delta);
          break;
        case 'tool-step-start':
          store.startStep(turnId, event.stepId, event.title, event.detail);
          break;
        case 'tool-step-delta':
          store.appendStep(turnId, event.stepId, event.delta);
          break;
        case 'tool-step-end':
          store.endStep(turnId, event.stepId, event.status);
          break;
        case 'message-end':
          ended = true;
          store.finishTurn(turnId, event.reason === 'complete' ? 'complete' : 'error', event.errorMessage);
          break;
      }
    }
    if (!ended) store.finishTurn(turnId, 'interrupted');
  } catch (err) {
    if (abort.signal.aborted) {
      store.finishTurn(turnId, 'interrupted');
    } else {
      const message = err instanceof Error ? err.message : 'build failed';
      store.finishTurn(turnId, 'error', message);
      useConductorStore.getState().setBuildError(message);
    }
  } finally {
    buildAbort = null;
    useConductorStore.getState().setBuilding(false);
    // Refresh settled state regardless of outcome.
    await Promise.all([refreshStatus(opts.projectId), refreshDeploys(opts.projectId)]);
  }
}

export async function refreshStatus(projectId: string): Promise<void> {
  try {
    const status = conductorStatusSchema.parse(
      await trpc.conductor.status.query({ projectId }),
    );
    useConductorStore.getState().setStatus(status);
  } catch {
    /* leave prior status */
  }
}

export async function refreshDeploys(projectId: string): Promise<void> {
  try {
    const out = deployListOutputSchema.parse(
      await trpc.conductor.listDeploys.query({ projectId }),
    );
    const store = useConductorStore.getState();
    store.setDeploys(out.deploys);
    store.setTargets(out.targets);
  } catch {
    /* leave prior */
  }
}

export async function deployPreview(opts: {
  projectId: string;
  kind: DeployTargetKind;
}): Promise<string | null> {
  try {
    const out = deployOutputSchema.parse(await trpc.conductor.deploy.mutate(opts));
    useConductorStore.getState().setTargets(out.targets);
    await refreshDeploys(opts.projectId);
    return out.deploy.previewUrl;
  } catch {
    return null;
  }
}

export async function rollbackTo(opts: {
  projectId: string;
  versionId: string;
  kind: DeployTargetKind;
}): Promise<string | null> {
  try {
    const out = deployOutputSchema.parse(await trpc.conductor.rollback.mutate(opts));
    await Promise.all([refreshDeploys(opts.projectId), refreshStatus(opts.projectId)]);
    return out.deploy.previewUrl;
  } catch {
    return null;
  }
}

export async function setDeployDomain(opts: {
  deployId: string;
  projectId: string;
  domain: string;
}): Promise<boolean> {
  try {
    await trpc.conductor.setCustomDomain.mutate(opts);
    await refreshDeploys(opts.projectId);
    return true;
  } catch {
    return false;
  }
}

export async function getRecommendations(projectId: string): Promise<RecommendationsOutput | null> {
  try {
    return recommendationsOutputSchema.parse(await trpc.conductor.recommendations.query({ projectId }));
  } catch {
    return null;
  }
}

export async function exportBundle(projectId: string): Promise<string | null> {
  try {
    const out = exportOutputSchema.parse(await trpc.conductor.export.query({ projectId }));
    return out.downloadUrl;
  } catch {
    return null;
  }
}
