/**
 * EBR2-E-01 — failing tests for §R2-E SC-072 (with §R2-E SC-073 setting context).
 *
 * usePreviewStateStore is the ephemeral per-node edit buffer that Inspector
 * tabs will write through (FP-15 enforces the routing in EBR2-E-02). The
 * renderer reads `sourceNode ⊕ peek(nodeId)` so live preview is real-time;
 * Save (EBR2-E-03) commits the buffer → useGraphSourceStore.updateNode and
 * clears the buffer for that node.
 *
 * Contract under test (this task only):
 *   - set(nodeId, patch)   merge patch into buffer for nodeId
 *   - peek(nodeId)         return current patch (Partial<PrismNode>) or null
 *   - isDirty(nodeId)      true iff a non-empty patch exists for nodeId
 *   - commit(nodeId)       return current patch and clear the buffer for nodeId
 *   - discard(nodeId)      clear the buffer for nodeId
 *
 * Persistence: in-memory only (no localStorage / IndexedDB / network).
 */
import { afterEach, describe, expect, it } from 'vitest';
import type { PrismNode } from '@/lib/prism-graph/types';
import { usePreviewStateStore } from '@/stores/usePreviewStateStore';

function resetStore(): void {
  const { discardAll } = usePreviewStateStore.getState();
  discardAll();
}

afterEach(() => {
  resetStore();
});

describe('EBR2-E-01 / usePreviewStateStore — surface', () => {
  it('exposes set, commit, discard, peek, isDirty', () => {
    const s = usePreviewStateStore.getState();
    expect(typeof s.set).toBe('function');
    expect(typeof s.commit).toBe('function');
    expect(typeof s.discard).toBe('function');
    expect(typeof s.peek).toBe('function');
    expect(typeof s.isDirty).toBe('function');
  });

  it('peek returns null and isDirty returns false on an unknown node', () => {
    const s = usePreviewStateStore.getState();
    expect(s.peek('never-seen')).toBeNull();
    expect(s.isDirty('never-seen')).toBe(false);
  });
});

describe('EBR2-E-01 / usePreviewStateStore — set + peek', () => {
  it('set(nodeId, patch) records the patch and peek returns it', () => {
    const { set, peek } = usePreviewStateStore.getState();
    set('node-1', { subtype: 'cta-button' });
    expect(peek('node-1')).toEqual({ subtype: 'cta-button' });
  });

  it('set merges into an existing patch rather than replacing it', () => {
    const { set, peek } = usePreviewStateStore.getState();
    set('node-1', { subtype: 'cta-button' });
    set('node-1', { codeRef: 'gen/cta.tsx' });
    expect(peek('node-1')).toEqual({
      subtype: 'cta-button',
      codeRef: 'gen/cta.tsx',
    });
  });

  it('set on one node does not contaminate another', () => {
    const { set, peek } = usePreviewStateStore.getState();
    set('node-a', { subtype: 'header' });
    set('node-b', { subtype: 'footer' });
    expect(peek('node-a')).toEqual({ subtype: 'header' });
    expect(peek('node-b')).toEqual({ subtype: 'footer' });
  });

  it('isDirty returns true after set and false after no edits', () => {
    const { set, isDirty } = usePreviewStateStore.getState();
    expect(isDirty('node-1')).toBe(false);
    set('node-1', { subtype: 'cta-button' });
    expect(isDirty('node-1')).toBe(true);
  });

  it('set with an empty patch object does not mark the node dirty', () => {
    const { set, isDirty, peek } = usePreviewStateStore.getState();
    set('node-1', {} as Partial<PrismNode>);
    expect(isDirty('node-1')).toBe(false);
    expect(peek('node-1')).toBeNull();
  });
});

describe('EBR2-E-01 / usePreviewStateStore — commit', () => {
  it('commit returns the current patch and then clears the buffer (SC-073 single-node clear)', () => {
    const { set, commit, isDirty, peek } = usePreviewStateStore.getState();
    set('node-1', { subtype: 'cta-button' });
    const committed = commit('node-1');
    expect(committed).toEqual({ subtype: 'cta-button' });
    expect(peek('node-1')).toBeNull();
    expect(isDirty('node-1')).toBe(false);
  });

  it('commit on a clean node returns null and is a no-op', () => {
    const { commit, isDirty } = usePreviewStateStore.getState();
    expect(commit('never-seen')).toBeNull();
    expect(isDirty('never-seen')).toBe(false);
  });

  it('commit on node-a does not affect node-b (SC-073: clear for that node only)', () => {
    const { set, commit, peek } = usePreviewStateStore.getState();
    set('node-a', { subtype: 'header' });
    set('node-b', { subtype: 'footer' });
    commit('node-a');
    expect(peek('node-a')).toBeNull();
    expect(peek('node-b')).toEqual({ subtype: 'footer' });
  });
});

describe('EBR2-E-01 / usePreviewStateStore — discard', () => {
  it('discard clears the buffer for the given node', () => {
    const { set, discard, isDirty, peek } = usePreviewStateStore.getState();
    set('node-1', { subtype: 'cta-button' });
    discard('node-1');
    expect(peek('node-1')).toBeNull();
    expect(isDirty('node-1')).toBe(false);
  });

  it('discard on a clean node is a no-op', () => {
    const { discard, isDirty } = usePreviewStateStore.getState();
    expect(() => discard('never-seen')).not.toThrow();
    expect(isDirty('never-seen')).toBe(false);
  });
});

describe('EBR2-E-01 / usePreviewStateStore — purity (no persistence, no I/O)', () => {
  it('does not write to localStorage', () => {
    const { set, commit } = usePreviewStateStore.getState();
    const before = typeof localStorage === 'undefined' ? 0 : localStorage.length;
    set('node-1', { subtype: 'cta-button' });
    commit('node-1');
    const after = typeof localStorage === 'undefined' ? 0 : localStorage.length;
    expect(after).toBe(before);
  });

  it('peek returns the same reference shape between calls when buffer is unchanged', () => {
    const { set, peek } = usePreviewStateStore.getState();
    set('node-1', { subtype: 'cta-button' });
    const a = peek('node-1');
    const b = peek('node-1');
    expect(a).toEqual(b);
  });
});
