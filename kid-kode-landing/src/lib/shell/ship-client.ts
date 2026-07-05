'use client';

// PRISM SHELL — SHIP & MAKE PROFITABLE CLIENT (SHELL W5B / E17, 2026-07-05)
//
// Drives the "Ship & Make Profitable" flow from the builder: streams the
// completeness scan into the chat (E4), then renders the one-click capability
// cards IN the same chat turn (W5B-D4). Accepting a card authors the capability
// through the certified path server-side and re-verifies; the turn updates with
// the result and the remaining cards. Also NL-invocable: `isShipIntent` lets
// the chat route a "ship / make profitable" message here instead of the agent.

import { createTRPCClient, httpBatchStreamLink } from '@trpc/client';
import type { AppRouter } from '../../server/trpc/router';
import { parseAgentStreamEvent } from '../../../packages/shared-interfaces/src/prism-agent';
import {
  addCapabilityOutputSchema,
  completenessScanSchema,
  type CapabilityCategory,
} from '../../../packages/shared-interfaces/src/prism-conductor';
import { useChatStore } from './chat-store';
import { refreshStatus } from './conductor-client';

const trpc = createTRPCClient<AppRouter>({
  links: [httpBatchStreamLink({ url: '/api/trpc' })],
});

/** Does this freeform message ask to ship / make profitable? (NL-invocation.) */
export function isShipIntent(prompt: string): boolean {
  const p = prompt.toLowerCase();
  return (
    /\bship\b/.test(p) && /(app|it|this|now|live|profit)/.test(p)
  ) || /make (it |this )?profitable/.test(p) || /ship (and|&) make profitable/.test(p) || /what('?s| is) missing/.test(p);
}

const CARDS_ID = 'completeness-cards';

/** Run the completeness scan: stream tool-steps into a chat turn, then attach
 *  the one-click capability cards to that same turn. */
export async function runShipScan(projectId: string): Promise<void> {
  const chat = useChatStore.getState();
  if (chat.isStreaming) return;

  const turnId = chat.beginTurn('▷ Ship & make profitable — scan my app', []);
  const store = useChatStore.getState();

  try {
    const stream = await trpc.conductor.shipScan.mutate({ projectId });
    let ended = false;
    for await (const raw of stream) {
      const event = parseAgentStreamEvent(raw);
      switch (event.type) {
        case 'message-start': store.noteMessageStart(turnId, event.modelId); break;
        case 'text-delta': store.appendText(turnId, event.delta); break;
        case 'tool-step-start': store.startStep(turnId, event.stepId, event.title, event.detail); break;
        case 'tool-step-delta': store.appendStep(turnId, event.stepId, event.delta); break;
        case 'tool-step-end': store.endStep(turnId, event.stepId, event.status); break;
        case 'message-end':
          ended = true;
          store.finishTurn(turnId, event.reason === 'complete' ? 'complete' : 'error', event.errorMessage);
          break;
      }
    }
    if (!ended) store.finishTurn(turnId, 'interrupted');

    // Attach the structured one-click cards to the turn (rendered in chat).
    const scan = completenessScanSchema.parse(await trpc.conductor.completeness.query({ projectId }));
    if (scan.cards.length > 0) {
      useChatStore.getState().setCards(turnId, CARDS_ID, scan.cards);
    }
  } catch (err) {
    store.finishTurn(turnId, 'error', err instanceof Error ? err.message : 'scan failed');
  }
}

/** Accept a capability card: author it + re-verify, then update the chat turn
 *  with the result and the remaining cards. */
export async function acceptCapability(
  projectId: string,
  category: CapabilityCategory,
  turnId: string,
): Promise<void> {
  const store = useChatStore.getState();
  try {
    const out = addCapabilityOutputSchema.parse(
      await trpc.conductor.addCapability.mutate({ projectId, category }),
    );
    const verified = out.latch.verifiedShippable;
    store.appendText(
      turnId,
      `\n✓ Added ${category} — wired through the certified node path (${out.addedNodeIds.length} nodes) and re-verified${verified ? ' — still shippable.' : '.'} `,
    );
    // Replace the card group with what's still missing.
    store.setCards(turnId, CARDS_ID, out.scan.cards);
    await refreshStatus(projectId);
  } catch (err) {
    store.appendText(turnId, `\n✕ Could not add ${category}: ${err instanceof Error ? err.message : 'error'} `);
  }
}
