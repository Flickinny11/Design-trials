// PRISM SHELL — W1 ECHO/STUB AGENT (SHELL W1, 2026-07-04)
//
// The local stand-in behind the chat agentic loop's contract
// (packages/shared-interfaces/src/prism-agent.ts). It streams a scripted,
// prompt-aware turn — prose deltas interleaved with two tool steps — at a
// human-readable cadence so the W1 UI (collapsible steps, live streaming,
// mid-stream stop) is exercised for real. The REAL build orchestrator
// replaces this module in W5 behind the same contract; nothing here may leak
// into the shapes.
//
// Interruption: the client aborts the fetch; tRPC tears the generator down
// and `signal` flips aborted. Every await checks it so the server never
// keeps computing for a hung-up caller.

import 'server-only';
import type {
  AgentChatRequest,
  AgentStreamEvent,
} from '../../../packages/shared-interfaces/src/prism-agent';
import { PRISM_AGENT_CONTRACT_VERSION } from '../../../packages/shared-interfaces/src/prism-agent';
import { getDefaultModel, getModelById } from '../../lib/shell/model-config';
import { getStubProject } from '../../lib/shell/project-stub';

const DELTA_MS = 100; // per-chunk cadence — a full turn runs ~8s so a user stop lands mid-stream

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t);
        resolve();
      },
      { once: true },
    );
  });
}

/** Split prose into ~word-pair chunks so streaming reads as generation. */
function chunks(text: string): string[] {
  const words = text.split(' ');
  const out: string[] = [];
  for (let i = 0; i < words.length; i += 2) {
    out.push((i === 0 ? '' : ' ') + words.slice(i, i + 2).join(' '));
  }
  return out;
}

let turnSeq = 0;

/** Resolve the requested model against the config registry (spec 7.4):
 *  unknown/gated ids fall back to the configured default — the shell never
 *  trusts a stale persisted string. */
function resolveModelId(requested: string): string {
  const entry = getModelById(requested);
  return entry && entry.status === 'active' ? entry.id : getDefaultModel().id;
}

export async function* runStubAgent(
  input: AgentChatRequest,
  signal?: AbortSignal,
): AsyncGenerator<AgentStreamEvent> {
  turnSeq += 1;
  const messageId = `stub-turn-${turnSeq}-${input.projectId}`;
  const project = getStubProject(input.projectId);
  const promptExcerpt =
    input.prompt.length > 90 ? `${input.prompt.slice(0, 90)}…` : input.prompt;

  yield {
    type: 'message-start',
    v: PRISM_AGENT_CONTRACT_VERSION,
    messageId,
    modelId: resolveModelId(input.modelId),
  };

  const opener =
    `Understood — "${promptExcerpt}". ` +
    `Let me look at ${project.name} before I plan anything.` +
    (input.attachments.length > 0
      ? ` I can see ${input.attachments.length} attachment${
          input.attachments.length === 1 ? '' : 's'
        } on this message.`
      : '');
  for (const delta of chunks(opener)) {
    if (signal?.aborted) return;
    yield { type: 'text-delta', delta };
    await sleep(DELTA_MS, signal);
  }

  // ── Tool step 1 — read the graph ──────────────────────────────────────────
  const hubs = [...new Set(project.nodes.map((n) => n.hubId))];
  yield {
    type: 'tool-step-start',
    stepId: `${messageId}-read`,
    title: 'Reading project graph',
    detail: `${project.graphRef} · ${hubs.length} hubs`,
  };
  const readLines = [
    `graph: ${project.graphRef}\n`,
    `hubs: ${hubs.map((h) => h.replace('hub-', '')).join(' · ')}\n`,
    `content nodes: ${project.nodes.length}\n`,
    `contract: prism-shell v1 · selection round-trip live\n`,
  ];
  for (const delta of readLines) {
    if (signal?.aborted) return;
    yield { type: 'tool-step-delta', stepId: `${messageId}-read`, delta };
    await sleep(DELTA_MS * 3, signal);
  }
  yield { type: 'tool-step-end', stepId: `${messageId}-read`, status: 'ok' };

  const bridge = chunks(' The graph is healthy. Sketching the smallest edit that honors your intent:');
  for (const delta of bridge) {
    if (signal?.aborted) return;
    yield { type: 'text-delta', delta };
    await sleep(DELTA_MS, signal);
  }

  // ── Tool step 2 — plan a scoped edit ──────────────────────────────────────
  yield {
    type: 'tool-step-start',
    stepId: `${messageId}-plan`,
    title: 'Planning scoped edit',
    detail: 'single-node mutation path (I10)',
  };
  const planLines = [
    `target: ${project.nodes[0].caption.toLowerCase()}\n`,
    'approach: additive graph mutation, neighbors untouched\n',
    'verification: behavioral + visual pass before shippable (I9)\n',
  ];
  for (const delta of planLines) {
    if (signal?.aborted) return;
    yield { type: 'tool-step-delta', stepId: `${messageId}-plan`, delta };
    await sleep(DELTA_MS * 3, signal);
  }
  yield { type: 'tool-step-end', stepId: `${messageId}-plan`, status: 'ok' };

  const closer =
    ' When the build orchestrator lands (W5), this is where I would execute the plan wave by wave — ' +
    'and stream the verification evidence into these steps as they pass. ' +
    'For now I am the W1 echo agent: same contract, scripted hands.';
  for (const delta of chunks(closer)) {
    if (signal?.aborted) return;
    yield { type: 'text-delta', delta };
    await sleep(DELTA_MS, signal);
  }

  yield { type: 'message-end', reason: 'complete' };
}
