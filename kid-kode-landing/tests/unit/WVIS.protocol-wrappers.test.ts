// W-VIS D6 — protocol wrapper + exemplar retrieval tests.

import { describe, expect, it } from 'vitest';
import { buildProtocolWrapper, wrapUserTurn, CONSTRAINT_CHECKLIST } from '@/lib/prism/codegen/model-wrappers';
import { WORKED_EXEMPLARS, selectNearestExemplars, deriveNodeTags, buildExemplarBlock } from '@/lib/prism/codegen/exemplar-registry';
import type { PrismNode } from '@/lib/prism-graph/types';

describe('W-VIS D6 — protocol wrappers', () => {
  it('checklist rides at the END of the wrapped turn (recency ordering)', () => {
    const turn = wrapUserTurn('anthropic/claude-sonnet-5', 'TASK BODY HERE');
    const bodyIdx = turn.indexOf('TASK BODY HERE');
    const checklistIdx = turn.indexOf('FINAL CONSTRAINT CHECKLIST');
    expect(bodyIdx).toBeGreaterThan(-1);
    expect(checklistIdx).toBeGreaterThan(bodyIdx);
    expect(turn.indexOf('plan: open the module')).toBeLessThan(bodyIdx);
  });

  it('fence-prone models (haiku 40/40, deepseek 38/39 fenced in W-BAKEB) get the raw-output wrapper', () => {
    for (const m of ['anthropic/claude-haiku-4.5', 'deepseek/deepseek-v4-flash', 'claude-haiku-4.5']) {
      const w = buildProtocolWrapper(m);
      expect(w.preamble).toContain('Do NOT wrap the code in');
      expect(w.postamble).toContain('zero markdown fences');
    }
  });

  it('prose/parse-prone models (gemini 22/40, glm 17/33 unparsed) get the no-prose wrapper', () => {
    for (const m of ['google/gemini-3.5-flash', 'z-ai/glm-5.2']) {
      const w = buildProtocolWrapper(m);
      expect(w.preamble).toContain('Code and code comments only');
    }
  });

  it('clean models (fable/opus/gpt-oss/mercury) get plan-then-code + checklist only', () => {
    for (const m of ['anthropic/claude-fable-5', 'openai/gpt-oss-120b', 'mercury-2']) {
      const w = buildProtocolWrapper(m);
      expect(w.preamble).toContain('plan');
      expect(w.preamble).not.toContain('Do NOT wrap');
    }
  });

  it('checklist covers the doctrine load-bearers', () => {
    for (const needle of ['export default function createNode', 'ctx.fontAtlas', 'userData.cleanup', '@spec-manifest', 'signal-red']) {
      expect(CONSTRAINT_CHECKLIST).toContain(needle);
    }
  });
});

describe('W-VIS D6 — exemplar retrieval (2 nearest, replacing the generic six)', () => {
  it('registry entries all carry committed code+frame refs and a lesson', () => {
    expect(WORKED_EXEMPLARS.length).toBeGreaterThanOrEqual(6);
    for (const ex of WORKED_EXEMPLARS) {
      expect(ex.codeRef.length).toBeGreaterThan(0);
      expect(ex.frameRef.length).toBeGreaterThan(0);
      expect(ex.lesson.length).toBeGreaterThan(80);
    }
  });

  it('returns at most 2, deterministic', () => {
    const node = { nodeId: 'n', renderMode: 'mesh', intent: { caption: 'Machined titanium product hero on a plinth' } } as unknown as PrismNode;
    const a = selectNearestExemplars(node);
    const b = selectNearestExemplars(node);
    expect(a).toHaveLength(2);
    expect(a.map((e) => e.id)).toEqual(b.map((e) => e.id));
  });

  it('3D product hero retrieves the watch-hero exemplar first', () => {
    const node = { nodeId: 'n', renderMode: 'mesh', intent: { caption: 'Machined metal product hero, key+rim lighting' } } as unknown as PrismNode;
    const picks = selectNearestExemplars(node, 2, true);
    expect(picks[0].id).toBe('ex-w9a-watch-hero');
  });

  it('2D pricing node retrieves the ledgerline exemplar', () => {
    const node = { nodeId: 'n', renderMode: 'plane', intent: { caption: 'Pricing card tiers with CTA button' } } as unknown as PrismNode;
    const picks = selectNearestExemplars(node, 2, false);
    expect(picks.map((e) => e.id)).toContain('ex-wtpl-ledgerline');
  });

  it('tags derive from caption + renderMode signals', () => {
    const tags = deriveNodeTags({ nodeId: 'n', renderMode: 'mesh', intent: { caption: 'orbit product hero with rim light' } } as unknown as PrismNode);
    expect(tags).toContain('3d');
    expect(tags).toContain('product');
    expect(tags).toContain('hero');
  });

  it('exemplar block carries lessons, never file dumps', () => {
    const block = buildExemplarBlock([WORKED_EXEMPLARS[0], WORKED_EXEMPLARS[1]]);
    expect(block).toContain('WORKED EXEMPLARS');
    expect(block).toContain('lessons');
    expect(block.split('\n')).toHaveLength(3);
  });
});
