// PRISM SHELL — CHAT STORE (SHELL W1, 2026-07-04)
//
// The one Zustand store (I3) for the builder's chat agentic loop. Assistant
// turns are ORDERED SEGMENTS — prose runs interleaved with tool steps in
// arrival order — because the agentic reading ("said → did → said") is the
// product, not a transcript plus a sidebar. Tool steps are the E4 surface:
// W5 streams verification evidence into them; W1 renders them collapsible.
//
// Interruption model: stopping is client-owned (the agent contract has no
// 'interrupted' server event) — the stream consumer marks the turn
// 'interrupted' and any still-running steps 'stopped'.

import { create } from 'zustand';
import type { AgentAttachment } from '../../../packages/shared-interfaces/src/prism-agent';
import type { CapabilityCard } from '../../../packages/shared-interfaces/src/prism-conductor';
import { getDefaultModel } from './model-config';

export interface ChatToolStep {
  readonly stepId: string;
  readonly title: string;
  readonly detail?: string;
  readonly body: string;
  readonly status: 'running' | 'ok' | 'error' | 'stopped';
}

/** E17 — one-click capability cards rendered IN the chat turn (W5B-D4). */
export interface ChatCardGroup {
  readonly cardsId: string;
  readonly cards: readonly CapabilityCard[];
}

export type ChatSegment =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'step'; readonly step: ChatToolStep }
  | { readonly kind: 'cards'; readonly group: ChatCardGroup };

export type ChatTurnStatus = 'streaming' | 'complete' | 'interrupted' | 'error';

export interface ChatTurn {
  readonly id: string;
  readonly role: 'user' | 'assistant';
  readonly segments: readonly ChatSegment[];
  readonly status: ChatTurnStatus;
  /** Resolved model driving an assistant turn (from message-start). */
  readonly modelId?: string;
  readonly errorMessage?: string;
  readonly attachments?: readonly AgentAttachment[];
}

interface ChatState {
  turns: readonly ChatTurn[];
  isStreaming: boolean;
  /** User-selected model id (config-driven; spec 7.4). */
  activeModelId: string;
  /** Attachment metadata staged on the composer. */
  pendingAttachments: readonly AgentAttachment[];

  setActiveModel(modelId: string): void;
  stageAttachment(att: AgentAttachment): void;
  unstageAttachment(name: string): void;

  /** Push the user turn + an empty streaming assistant turn; returns the
   *  assistant turn id. */
  beginTurn(prompt: string, attachments: readonly AgentAttachment[]): string;
  noteMessageStart(turnId: string, modelId: string): void;
  appendText(turnId: string, delta: string): void;
  startStep(turnId: string, stepId: string, title: string, detail?: string): void;
  appendStep(turnId: string, stepId: string, delta: string): void;
  endStep(turnId: string, stepId: string, status: 'ok' | 'error'): void;
  /** E17 — attach/replace a one-click capability card group on a turn. */
  setCards(turnId: string, cardsId: string, cards: readonly CapabilityCard[]): void;
  finishTurn(turnId: string, status: ChatTurnStatus, errorMessage?: string): void;
}

let turnSeq = 0;

function updateTurn(
  turns: readonly ChatTurn[],
  turnId: string,
  fn: (turn: ChatTurn) => ChatTurn,
): readonly ChatTurn[] {
  return turns.map((t) => (t.id === turnId ? fn(t) : t));
}

function updateStep(
  segments: readonly ChatSegment[],
  stepId: string,
  fn: (step: ChatToolStep) => ChatToolStep,
): readonly ChatSegment[] {
  return segments.map((seg) =>
    seg.kind === 'step' && seg.step.stepId === stepId ? { kind: 'step', step: fn(seg.step) } : seg,
  );
}

export const useChatStore = create<ChatState>((set) => ({
  turns: [],
  isStreaming: false,
  activeModelId: getDefaultModel().id,
  pendingAttachments: [],

  setActiveModel: (modelId) => set({ activeModelId: modelId }),

  stageAttachment: (att) =>
    set((s) => ({
      pendingAttachments: s.pendingAttachments.some((a) => a.name === att.name)
        ? s.pendingAttachments
        : [...s.pendingAttachments, att].slice(0, 8),
    })),

  unstageAttachment: (name) =>
    set((s) => ({
      pendingAttachments: s.pendingAttachments.filter((a) => a.name !== name),
    })),

  beginTurn: (prompt, attachments) => {
    turnSeq += 1;
    const userId = `turn-${turnSeq}-user`;
    const assistantId = `turn-${turnSeq}-assistant`;
    set((s) => ({
      isStreaming: true,
      pendingAttachments: [],
      turns: [
        ...s.turns,
        {
          id: userId,
          role: 'user' as const,
          segments: [{ kind: 'text' as const, text: prompt }],
          status: 'complete' as const,
          attachments: attachments.length > 0 ? attachments : undefined,
        },
        {
          id: assistantId,
          role: 'assistant' as const,
          segments: [],
          status: 'streaming' as const,
        },
      ],
    }));
    return assistantId;
  },

  noteMessageStart: (turnId, modelId) =>
    set((s) => ({ turns: updateTurn(s.turns, turnId, (t) => ({ ...t, modelId })) })),

  appendText: (turnId, delta) =>
    set((s) => ({
      turns: updateTurn(s.turns, turnId, (t) => {
        const last = t.segments.at(-1);
        if (last && last.kind === 'text') {
          return {
            ...t,
            segments: [...t.segments.slice(0, -1), { kind: 'text', text: last.text + delta }],
          };
        }
        return { ...t, segments: [...t.segments, { kind: 'text', text: delta }] };
      }),
    })),

  startStep: (turnId, stepId, title, detail) =>
    set((s) => ({
      turns: updateTurn(s.turns, turnId, (t) => ({
        ...t,
        segments: [
          ...t.segments,
          { kind: 'step', step: { stepId, title, detail, body: '', status: 'running' } },
        ],
      })),
    })),

  appendStep: (turnId, stepId, delta) =>
    set((s) => ({
      turns: updateTurn(s.turns, turnId, (t) => ({
        ...t,
        segments: updateStep(t.segments, stepId, (step) => ({
          ...step,
          body: step.body + delta,
        })),
      })),
    })),

  endStep: (turnId, stepId, status) =>
    set((s) => ({
      turns: updateTurn(s.turns, turnId, (t) => ({
        ...t,
        segments: updateStep(t.segments, stepId, (step) => ({ ...step, status })),
      })),
    })),

  setCards: (turnId, cardsId, cards) =>
    set((s) => ({
      turns: updateTurn(s.turns, turnId, (t) => {
        const group = { cardsId, cards };
        const existing = t.segments.findIndex((seg) => seg.kind === 'cards' && seg.group.cardsId === cardsId);
        if (existing >= 0) {
          const next = [...t.segments];
          next[existing] = { kind: 'cards', group };
          return { ...t, segments: next };
        }
        return { ...t, segments: [...t.segments, { kind: 'cards', group }] };
      }),
    })),

  finishTurn: (turnId, status, errorMessage) =>
    set((s) => ({
      isStreaming: false,
      turns: updateTurn(s.turns, turnId, (t) => ({
        ...t,
        status,
        errorMessage,
        // A stop mid-step leaves the step honestly marked, never fake-'ok'.
        segments: t.segments.map((seg) =>
          seg.kind === 'step' && seg.step.status === 'running'
            ? {
                kind: 'step',
                step: { ...seg.step, status: status === 'interrupted' ? 'stopped' : 'error' },
              }
            : seg,
        ),
      })),
    })),
}));
