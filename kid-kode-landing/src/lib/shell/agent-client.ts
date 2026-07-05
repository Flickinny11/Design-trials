'use client';

// PRISM SHELL — CHAT AGENT CLIENT (SHELL W1, 2026-07-04)
//
// Drives one chat turn against the tRPC stub-agent endpoint and folds the
// streamed contract events into the chat store. Every yielded value is
// RE-VALIDATED against the Zod contract at this edge (parseAgentStreamEvent)
// — the consumer trusts the contract, not the transport typing.
//
// INTERRUPTIBLE AT ALL TIMES (spec §10 S4): the active turn holds an
// AbortController; stopStreaming() aborts the underlying fetch, the
// for-await loop throws, and the turn is marked 'interrupted' with any
// running tool step marked 'stopped'. The stop is real — the network request
// is torn down, not hidden.

import { createTRPCClient, httpBatchStreamLink } from '@trpc/client';
import type { AppRouter } from '../../server/trpc/router';
import {
  parseAgentStreamEvent,
  type AgentAttachment,
  type AgentChatRequestInput,
} from '../../../packages/shared-interfaces/src/prism-agent';
import { useChatStore } from './chat-store';

const trpc = createTRPCClient<AppRouter>({
  links: [httpBatchStreamLink({ url: '/api/trpc' })],
});

let activeAbort: AbortController | null = null;

export function isStreamActive(): boolean {
  return activeAbort !== null;
}

/** Abort the in-flight turn (the chat's stop control). Safe to call always. */
export function stopStreaming(): void {
  activeAbort?.abort();
}

export async function sendChatMessage(opts: {
  projectId: string;
  prompt: string;
}): Promise<void> {
  const chat = useChatStore.getState();
  if (chat.isStreaming) return;

  // E17 — a ship / make-profitable message routes to the completeness scan
  // instead of the freeform agent (NL-invocation).
  const { isShipIntent, runShipScan } = await import('./ship-client');
  if (isShipIntent(opts.prompt)) {
    await runShipScan(opts.projectId);
    return;
  }

  const attachments: readonly AgentAttachment[] = chat.pendingAttachments;
  // History = completed prose turns before this one (contract: tool-step
  // bodies are presentation, not conversation state).
  const history = chat.turns
    .filter((t) => t.status === 'complete' || t.status === 'interrupted')
    .map((t) => ({
      role: t.role,
      text: t.segments
        .filter((s) => s.kind === 'text')
        .map((s) => (s.kind === 'text' ? s.text : ''))
        .join(''),
    }))
    .filter((t) => t.text.length > 0)
    .slice(-64);

  const turnId = chat.beginTurn(opts.prompt, attachments);
  const request: AgentChatRequestInput = {
    projectId: opts.projectId,
    modelId: chat.activeModelId,
    prompt: opts.prompt,
    history,
    attachments: [...attachments],
  };

  const abort = new AbortController();
  activeAbort = abort;
  const store = useChatStore.getState();

  try {
    const stream = await trpc.agent.chat.mutate(request, { signal: abort.signal });
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
          store.finishTurn(
            turnId,
            event.reason === 'complete' ? 'complete' : 'error',
            event.errorMessage,
          );
          break;
      }
    }
    if (!ended) {
      // Stream closed without message-end (server hiccup) — honest state.
      store.finishTurn(turnId, 'interrupted');
    }
  } catch (err) {
    if (abort.signal.aborted) {
      store.finishTurn(turnId, 'interrupted');
    } else {
      store.finishTurn(
        turnId,
        'error',
        err instanceof Error ? err.message : 'agent stream failed',
      );
    }
  } finally {
    activeAbort = null;
  }
}
