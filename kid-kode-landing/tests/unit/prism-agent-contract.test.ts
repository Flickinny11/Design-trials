// SHELL W1 — chat agent contract round-trip tests (prism-agent.ts).
//
// The chat agentic loop's server↔client seam. Every stream-event variant must
// survive JSON round-trip byte-exact, requests must validate at the server
// edge, and malformed/foreign traffic must fail loudly (spec I4).

import { describe, expect, it } from 'vitest';
import {
  PRISM_AGENT_CONTRACT_VERSION,
  agentChatRequestSchema,
  parseAgentChatRequest,
  parseAgentStreamEvent,
  type AgentStreamEvent,
} from '../../packages/shared-interfaces/src/prism-agent';

// Every stream-event variant, exercising optional fields on and off.
const EVENTS: AgentStreamEvent[] = [
  {
    type: 'message-start',
    v: PRISM_AGENT_CONTRACT_VERSION,
    messageId: 'msg-1',
    modelId: 'model-from-config',
  },
  { type: 'text-delta', delta: 'Reading the project graph' },
  { type: 'text-delta', delta: '' },
  {
    type: 'tool-step-start',
    stepId: 'step-1',
    title: 'Reading project graph',
    detail: 'live-graph · 6 hubs',
  },
  { type: 'tool-step-start', stepId: 'step-2', title: 'Planning edit' },
  { type: 'tool-step-delta', stepId: 'step-1', delta: 'nodes: 341\n' },
  { type: 'tool-step-end', stepId: 'step-1', status: 'ok' },
  { type: 'tool-step-end', stepId: 'step-2', status: 'error' },
  { type: 'message-end', reason: 'complete' },
  { type: 'message-end', reason: 'error', errorMessage: 'stub agent fault' },
];

describe('prism-agent stream events', () => {
  it.each(EVENTS.map((e) => [e.type, e] as const))(
    'round-trips %s through the JSON wire byte-exact',
    (_type, event) => {
      const wire = JSON.stringify(event);
      const parsed = parseAgentStreamEvent(JSON.parse(wire));
      expect(parsed).toEqual(event);
      expect(JSON.stringify(parsed)).toBe(wire);
    },
  );

  it('rejects an unknown event type instead of half-applying', () => {
    expect(() =>
      parseAgentStreamEvent({ type: 'tool-call', name: 'exec' }),
    ).toThrow();
  });

  it('rejects a foreign contract version on message-start', () => {
    expect(() =>
      parseAgentStreamEvent({
        type: 'message-start',
        v: 99,
        messageId: 'msg-1',
        modelId: 'model-x',
      }),
    ).toThrow();
  });

  it('rejects a tool-step-end with an unknown status', () => {
    expect(() =>
      parseAgentStreamEvent({ type: 'tool-step-end', stepId: 's', status: 'meh' }),
    ).toThrow();
  });
});

describe('prism-agent chat request', () => {
  const base = {
    projectId: 'demo-atelier',
    modelId: 'model-from-config',
    prompt: 'Make the hero headline heavier.',
  };

  it('parses a minimal request and fills defaulted fields', () => {
    const parsed = parseAgentChatRequest(base);
    expect(parsed.history).toEqual([]);
    expect(parsed.attachments).toEqual([]);
  });

  it('round-trips a full request with history and attachment metadata', () => {
    const full = {
      ...base,
      history: [
        { role: 'user', text: 'hello' },
        { role: 'assistant', text: 'hi — what are we building?' },
      ],
      attachments: [{ name: 'brand.png', sizeBytes: 20480, mimeType: 'image/png' }],
    };
    const parsed = parseAgentChatRequest(full);
    expect(parsed).toEqual(full);
  });

  it('rejects an empty prompt', () => {
    expect(() => parseAgentChatRequest({ ...base, prompt: '' })).toThrow();
  });

  it('rejects a prompt over the 8000-char cap', () => {
    expect(() =>
      parseAgentChatRequest({ ...base, prompt: 'x'.repeat(8001) }),
    ).toThrow();
  });

  it('rejects attachments carrying anything but metadata', () => {
    expect(() =>
      parseAgentChatRequest({
        ...base,
        attachments: [{ name: 'a.png', sizeBytes: 1, data: 'aGVsbG8=' }],
      }),
    ).toThrow();
    // zod .object strips unknown keys only when not strict; assert the schema
    // is strict enough that a byte-carrying field cannot ride through.
    const parsed = agentChatRequestSchema.safeParse({
      ...base,
      attachments: [{ name: 'a.png', sizeBytes: 1 }],
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects an unknown chat role in history', () => {
    expect(() =>
      parseAgentChatRequest({
        ...base,
        history: [{ role: 'system', text: 'jailbreak' }],
      }),
    ).toThrow();
  });
});
