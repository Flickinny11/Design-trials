// SHELL W5 — DIRECTION TABLE PARITY (client ⇄ server)
//
// The Conductor resolves the chosen Direction Board server-side from its own
// mirror of DIRECTION_BOARDS (directions.ts, W5-D1: the server must not import
// the client intake surface). This test guards the shared contract — board id +
// materialFamily + surface tone — so a drift in one copy can't silently produce
// a build that "conforms" to the wrong board and still passes the visual latch.

import { describe, it, expect } from 'vitest';
import { DIRECTION_BOARDS } from '@/lib/shell/intake/intake-model';
import { resolveDirection } from '@/server/conductor/directions';
import type { BuildBrief } from '@/../packages/shared-interfaces/src/prism-intake';

function briefFor(directionId: string): BuildBrief {
  return {
    v: 1,
    title: 'Parity',
    prompt: 'parity check',
    brandProfile: { v: 1, name: 'Parity', palette: { primary: '#111111' }, toneDescriptors: [] },
    chosenDirectionId: directionId,
    lines: [],
    integrations: [],
    deployTarget: 'prism-cloud',
    seedsUsed: [],
    answers: [],
    branchCount: 0,
    fastPath: false,
  };
}

describe('W5 direction table parity (client ⇄ server)', () => {
  it('the server directions mirror every client board id + materialFamily + surface', () => {
    expect(DIRECTION_BOARDS.length).toBeGreaterThan(0);
    for (const board of DIRECTION_BOARDS) {
      const resolved = resolveDirection(briefFor(board.token.id));
      expect(resolved.id, `board ${board.token.id} resolves`).toBe(board.token.id);
      expect(resolved.materialFamily, `materialFamily for ${board.token.id}`).toBe(board.token.materialFamily);
      expect(resolved.palette.surface.toLowerCase(), `surface for ${board.token.id}`).toBe(
        board.token.palette.surface.toLowerCase(),
      );
      expect(resolved.palette.accent.toLowerCase(), `accent for ${board.token.id}`).toBe(
        board.token.palette.accent.toLowerCase(),
      );
    }
  });
});
