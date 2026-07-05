// USER-ADVOCATE verdict schema — gate-matrix coverage (P5 task C, item 2).
//
// The validator at scripts/useradvocate-verdict-schema.mjs previously made
// INDIFFERENT-without-mustFix INVALID (line ~92), which made RUBRIC.md's
// "INDIFFERENT | no (flags only) | PASS-WITH-FLAGS" row unreachable. These
// tests pin the full deterministic mapping from
// notes/verification/useradvocate/RUBRIC.md ("NET-VERDICT → gate mapping"):
//
//   | NET         | Any MUST-FIX?    | Gate              |
//   |-------------|------------------|-------------------|
//   | ANNOYED     | (implies ≥1)     | BLOCKED           |
//   | INDIFFERENT | yes              | BLOCKED           |
//   | INDIFFERENT | no (flags only)  | PASS-WITH-FLAGS   |
//   | PLEASED     | no               | PASS              |
//   | PLEASED     | yes              | INVALID           |
//
// Anti-rubber-stamp additions that must survive: INDIFFERENT with neither
// mustFix nor flags is invalid (an indifferent verdict must name what is
// underwhelming), ANNOYED without mustFix is invalid, and every rubric answer
// still needs real evidence.

import { describe, it, expect } from 'vitest';
// eslint-disable-next-line import/no-relative-packages -- the validator is a
// runnable script, not a src module; import it directly so the test exercises
// the exact code the CLI runs.
import {
  gateFor,
  validateVerdict,
  runSelfTest,
} from '../../scripts/useradvocate-verdict-schema.mjs';

const RUBRIC_KEYS = [
  'q1_defects',
  'q2_reads_as',
  'q3_discoverable',
  'q4_responsive',
  'q5_net',
] as const;

type Rubric = Record<string, { answer: string; evidence: string[] }>;

function rubricOk(): Rubric {
  return Object.fromEntries(
    RUBRIC_KEYS.map((k) => [
      k,
      { answer: 'test answer', evidence: ['metrics: hue 24°, sat 0.8'] },
    ]),
  );
}

const MF = [{ issue: 'broken', evidence: 'metrics: frameDeltaMag 0 across play frames' }];
const FLAGS = [{ note: 'slightly muddy', evidence: 'metrics: luma 0.21 (taste call)' }];

function verdict(over: Record<string, unknown>) {
  return { feature: 'gate-matrix', rubric: rubricOk(), mustFix: [], flags: [], ...over };
}

describe('gateFor — deterministic net+mustFix → gate mapping (RUBRIC.md table)', () => {
  it('maps every row of the table', () => {
    expect(gateFor('PLEASED', false)).toBe('PASS');
    expect(gateFor('PLEASED', true)).toBe('INVALID');
    expect(gateFor('INDIFFERENT', true)).toBe('BLOCKED');
    expect(gateFor('INDIFFERENT', false)).toBe('PASS-WITH-FLAGS');
    expect(gateFor('ANNOYED', true)).toBe('BLOCKED');
    expect(gateFor('ANNOYED', false)).toBe('BLOCKED');
  });
});

describe('validateVerdict — gate matrix (the PASS-WITH-FLAGS row must be reachable)', () => {
  it('PLEASED with no mustFix → valid, PASS', () => {
    const r = validateVerdict(verdict({ net: 'PLEASED' }), null);
    expect(r.errors).toEqual([]);
    expect(r.valid).toBe(true);
    expect(r.computedGate).toBe('PASS');
  });

  it('PLEASED with a mustFix → invalid contradiction', () => {
    const r = validateVerdict(verdict({ net: 'PLEASED', mustFix: MF }), null);
    expect(r.valid).toBe(false);
    expect(r.computedGate).toBe('INVALID');
  });

  it('INDIFFERENT with a mustFix → valid, BLOCKED (unchanged semantics)', () => {
    const r = validateVerdict(verdict({ net: 'INDIFFERENT', mustFix: MF }), null);
    expect(r.errors).toEqual([]);
    expect(r.valid).toBe(true);
    expect(r.computedGate).toBe('BLOCKED');
  });

  it('INDIFFERENT with zero mustFix and ≥1 evidenced flag → VALID, PASS-WITH-FLAGS (previously unreachable row)', () => {
    const r = validateVerdict(verdict({ net: 'INDIFFERENT', flags: FLAGS }), null);
    expect(r.errors).toEqual([]);
    expect(r.valid).toBe(true);
    expect(r.computedGate).toBe('PASS-WITH-FLAGS');
  });

  it('INDIFFERENT with neither mustFix nor flags → invalid (must name what is underwhelming)', () => {
    const r = validateVerdict(verdict({ net: 'INDIFFERENT' }), null);
    expect(r.valid).toBe(false);
    expect(r.errors.join('\n')).toMatch(/neither mustFix nor flags/);
  });

  it('ANNOYED with a mustFix → valid, BLOCKED', () => {
    const r = validateVerdict(verdict({ net: 'ANNOYED', mustFix: MF }), null);
    expect(r.errors).toEqual([]);
    expect(r.valid).toBe(true);
    expect(r.computedGate).toBe('BLOCKED');
  });

  it('ANNOYED without a mustFix → invalid (an annoyed verdict must name what is wrong)', () => {
    const r = validateVerdict(verdict({ net: 'ANNOYED' }), null);
    expect(r.valid).toBe(false);
    expect(r.errors.join('\n')).toMatch(/ANNOYED but mustFix is empty/);
  });

  it('a declared gate that disagrees with the mapping → invalid', () => {
    const r = validateVerdict(
      verdict({ net: 'INDIFFERENT', flags: FLAGS, gate: 'PASS' }),
      null,
    );
    expect(r.valid).toBe(false);
    expect(r.errors.join('\n')).toMatch(/maps to PASS-WITH-FLAGS/);
  });
});

describe('validateVerdict — anti-rubber-stamp evidence rules survive the fix', () => {
  it('a flag entry without evidence → invalid even on the PASS-WITH-FLAGS path', () => {
    const r = validateVerdict(
      verdict({ net: 'INDIFFERENT', flags: [{ note: 'meh' }] }),
      null,
    );
    expect(r.valid).toBe(false);
    expect(r.errors.join('\n')).toMatch(/flag entry lacks evidence/);
  });

  it('a rubric answer with empty evidence → invalid', () => {
    const rub = rubricOk();
    rub.q1_defects = { answer: 'fine', evidence: [] };
    const r = validateVerdict(verdict({ net: 'PLEASED', rubric: rub }), null);
    expect(r.valid).toBe(false);
    expect(r.errors.join('\n')).toMatch(/evidence EMPTY/);
  });
});

describe('runSelfTest — the script-internal matrix stays green', () => {
  it('reports 0 failed cases', () => {
    const r = runSelfTest();
    expect(r.failed).toBe(0);
    expect(r.total).toBeGreaterThanOrEqual(10);
  });
});
