'use client';

// PRISM SHELL — INTAKE STORE (SHELL W2 — Guided Build / Intake)
//
// One Zustand store for the intake concern (I3). Holds the working answers
// through Phases 0–2, derives the editable Build Brief on demand, and tracks
// the "try a different approach" branch count and the "skip questions — just
// build" fast path. No secrets ever land here (I5): integrations are provider
// references only.

import { create } from 'zustand';
import type {
  BrandProfile,
} from '../../../../packages/shared-interfaces/src/prism-brand';
import type {
  BuildBrief,
  DeployTarget,
  IntakeIntegrationRef,
} from '../../../../packages/shared-interfaces/src/prism-intake';
import {
  DECK,
  deriveBrief,
  type IntakeWorking,
} from './intake-model';

export type IntakePhase = 'prompt' | 'cards' | 'brief';

interface IntakeState extends IntakeWorking {
  phase: IntakePhase;
  cardIndex: number;
  brief: BuildBrief | null;

  // Phase 0
  setPrompt: (prompt: string) => void;
  patchBrandSeed: (patch: Partial<BrandProfile>) => void;
  addSeed: (seed: IntakeWorking['seedsUsed'][number]) => void;
  startCards: () => void;

  // Phase 1
  toggleOption: (cardId: string, optionId: string, multi: boolean) => void;
  setFreeText: (cardId: string, text: string) => void;
  skipCard: (cardId: string) => void;
  clearSkip: (cardId: string) => void;
  chooseDirection: (directionId: string) => void;
  toggleIntegration: (ref: IntakeIntegrationRef) => void;
  requestConnector: (label: string) => void;
  setGithub: (requested: boolean, repo?: string) => void;
  setDeploy: (target: DeployTarget) => void;
  nextCard: () => void;
  prevCard: () => void;
  goToBrief: () => void;
  fastForward: () => void; // "skip questions — just build"

  // Phase 2
  editBriefLine: (lineId: string, value: string) => void;
  editBriefTitle: (value: string) => void;
  branch: () => void; // "try a different approach"
  reset: () => void;
}

const INITIAL: IntakeWorking & { phase: IntakePhase; cardIndex: number; brief: BuildBrief | null } = {
  phase: 'prompt',
  cardIndex: 0,
  brief: null,
  prompt: '',
  brandSeed: {},
  answers: {},
  chosenDirectionId: null,
  integrations: [],
  githubImport: undefined,
  deployTarget: 'undecided',
  seedsUsed: [],
  branchCount: 0,
  fastPath: false,
};

function streamOf(cardId: string): 'design' | 'capability' {
  return DECK.find((c) => c.id === cardId)?.stream ?? 'design';
}

export const useIntakeStore = create<IntakeState>((set, get) => ({
  ...INITIAL,

  setPrompt: (prompt) => set({ prompt }),

  patchBrandSeed: (patch) =>
    set((s) => ({ brandSeed: { ...s.brandSeed, ...patch } })),

  addSeed: (seed) =>
    set((s) => {
      // De-dupe by kind+detail so re-seeding the same URL doesn't stack.
      const has = s.seedsUsed.some((x) => x.kind === seed.kind && x.detail === seed.detail);
      return has ? {} : { seedsUsed: [...s.seedsUsed, seed] };
    }),

  startCards: () => set({ phase: 'cards', cardIndex: 0 }),

  toggleOption: (cardId, optionId, multi) =>
    set((s) => {
      const prev = s.answers[cardId];
      const prevIds = prev?.optionIds ?? [];
      const nextIds = multi
        ? prevIds.includes(optionId)
          ? prevIds.filter((id) => id !== optionId)
          : [...prevIds, optionId]
        : prevIds.includes(optionId)
          ? []
          : [optionId];
      return {
        answers: {
          ...s.answers,
          [cardId]: {
            cardId,
            stream: streamOf(cardId),
            optionIds: nextIds,
            freeText: prev?.freeText,
            skipped: false,
          },
        },
      };
    }),

  setFreeText: (cardId, text) =>
    set((s) => {
      const prev = s.answers[cardId];
      return {
        answers: {
          ...s.answers,
          [cardId]: {
            cardId,
            stream: streamOf(cardId),
            optionIds: prev?.optionIds,
            freeText: text,
            skipped: text.trim() ? false : prev?.skipped,
          },
        },
      };
    }),

  skipCard: (cardId) =>
    set((s) => ({
      answers: {
        ...s.answers,
        [cardId]: { cardId, stream: streamOf(cardId), skipped: true },
      },
    })),

  clearSkip: (cardId) =>
    set((s) => {
      const prev = s.answers[cardId];
      if (!prev?.skipped) return {};
      return {
        answers: {
          ...s.answers,
          [cardId]: { ...prev, skipped: false },
        },
      };
    }),

  chooseDirection: (directionId) => set({ chosenDirectionId: directionId }),

  toggleIntegration: (ref) =>
    set((s) => {
      const exists = s.integrations.some((i) => i.providerId === ref.providerId);
      return {
        integrations: exists
          ? s.integrations.filter((i) => i.providerId !== ref.providerId)
          : [...s.integrations, ref],
      };
    }),

  requestConnector: (label) =>
    set((s) => {
      const providerId = `request:${label.trim().toLowerCase().replace(/\s+/g, '-')}`.slice(0, 80);
      if (!label.trim() || s.integrations.some((i) => i.providerId === providerId)) return {};
      return {
        integrations: [...s.integrations, { providerId, label: label.trim().slice(0, 80), requested: true }],
      };
    }),

  setGithub: (requested, repo) => set({ githubImport: { requested, repo } }),

  setDeploy: (target) => set({ deployTarget: target }),

  nextCard: () =>
    set((s) => ({ cardIndex: Math.min(s.cardIndex + 1, DECK.length - 1) })),

  prevCard: () => set((s) => ({ cardIndex: Math.max(s.cardIndex - 1, 0) })),

  goToBrief: () => set((s) => ({ phase: 'brief', brief: deriveBrief(s) })),

  fastForward: () =>
    set((s) => ({ phase: 'brief', fastPath: true, brief: deriveBrief({ ...s, fastPath: true }) })),

  editBriefLine: (lineId, value) =>
    set((s) => {
      if (!s.brief) return {};
      return {
        brief: {
          ...s.brief,
          lines: s.brief.lines.map((l) => (l.id === lineId ? { ...l, value } : l)),
        },
      };
    }),

  editBriefTitle: (value) =>
    set((s) => (s.brief ? { brief: { ...s.brief, title: value.slice(0, 200) } } : {})),

  branch: () =>
    set((s) => ({
      phase: 'cards',
      cardIndex: 0,
      brief: null,
      branchCount: s.branchCount + 1,
    })),

  reset: () => set({ ...INITIAL }),
}));
