// ORRERY No.7 §4 / SC-O10 — the transmission budget guard. ≤2 live Path-B
// surfaces; a 3rd request is rejected (caller downgrades to Path C) and the cap
// is logged. The factory wires admit/release around every refracting material.

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_TRANSMISSION,
  getTransmissionCount,
  requestTransmission,
  releaseTransmission,
  __resetTransmissionBudget,
} from '@/lib/prism/runtime/shared/transmission-budget';

afterEach(() => {
  __resetTransmissionBudget();
  vi.restoreAllMocks();
});

describe('transmission budget guard (SC-O10)', () => {
  it('admits up to MAX_TRANSMISSION (2) surfaces and counts them', () => {
    const a = {}, b = {};
    expect(requestTransmission(a)).toBe(true);
    expect(requestTransmission(b)).toBe(true);
    expect(getTransmissionCount()).toBe(2);
    expect(MAX_TRANSMISSION).toBe(2);
  });

  it('rejects a 3rd surface, holds the count at 2, and logs the cap', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const a = {}, b = {}, c = {};
    requestTransmission(a);
    requestTransmission(b);
    expect(requestTransmission(c)).toBe(false); // caller must fall back to Path C
    expect(getTransmissionCount()).toBe(2); // never exceeds the budget
    expect(warn).toHaveBeenCalledWith('[PRISM] TRANSMISSION LIMIT: capped at 2');
  });

  it('frees a slot on release so a later surface is admitted', () => {
    const a = {}, b = {}, c = {};
    requestTransmission(a);
    requestTransmission(b);
    expect(requestTransmission(c)).toBe(false);
    releaseTransmission(a);
    expect(getTransmissionCount()).toBe(1);
    expect(requestTransmission(c)).toBe(true); // slot freed → admitted
    expect(getTransmissionCount()).toBe(2);
  });

  it('is idempotent — re-requesting an admitted material does not double-count', () => {
    const a = {};
    expect(requestTransmission(a)).toBe(true);
    expect(requestTransmission(a)).toBe(true);
    expect(getTransmissionCount()).toBe(1);
  });
});
