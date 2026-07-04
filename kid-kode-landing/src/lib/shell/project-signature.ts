// PRISM SHELL — PROJECT VISUAL SIGNATURE (SHELL W4, S3 gallery)
//
// Every project card in the gallery carries a REAL 3D thumbnail and a
// "signature jewel" (S3 checklist). Until a project has rendered a last-frame
// capture, its thumbnail is a live 3D mini whose form + jewel are DERIVED
// deterministically from the project id — so each card reads as a distinct
// object (never a placeholder), and the same signature drives the DOM accent so
// the card and its mini agree. Pure + shared by the 3D cell and the DOM card.

export type SignatureScene =
  | 'obelisk'
  | 'orbital'
  | 'lattice'
  | 'monolith'
  | 'facet';

export type SignatureJewel = 'red' | 'chrome' | 'champagne' | 'sapphire';

export interface ProjectSignature {
  scene: SignatureScene;
  jewel: SignatureJewel;
  /** DOM accent hex for the card's hairline + jewel dot (matches the 3D). */
  accent: string;
  /** 0..1 phase so no two minis rotate in lockstep. */
  phase: number;
}

const SCENES: SignatureScene[] = ['obelisk', 'orbital', 'lattice', 'monolith', 'facet'];
const JEWELS: SignatureJewel[] = ['red', 'chrome', 'champagne', 'sapphire'];
const JEWEL_HEX: Record<SignatureJewel, string> = {
  red: '#ff3b3b',
  chrome: '#d7dde6',
  champagne: '#e7d3ab',
  sapphire: '#5f8fd6',
};

/** FNV-1a — a stable, dependency-free hash of the id. */
function hash(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function projectSignature(id: string): ProjectSignature {
  const h = hash(id);
  const scene = SCENES[h % SCENES.length];
  const jewel = JEWELS[(h >>> 8) % JEWELS.length];
  return {
    scene,
    jewel,
    accent: JEWEL_HEX[jewel],
    phase: ((h >>> 16) % 1000) / 1000,
  };
}
