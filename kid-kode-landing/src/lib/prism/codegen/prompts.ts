// T04 — Codegen prompts (spec §9 L248-L355).
// Stub signatures landed alongside the failing tests; real implementation
// is filled in during step 7 of /ralph-step.

import type { PrismNode, RenderMode } from '@/lib/prism-graph/types';

export const SHARED_SYSTEM_PROMPT: string = '__T04_STUB__';

export interface CodegenNeighbor {
  id: string;
  type: string;
}

export interface CodegenNeighbors {
  parent: CodegenNeighbor | null;
  siblings: CodegenNeighbor[];
  children: CodegenNeighbor[];
}

export interface CodegenAtlasRegion {
  atlasIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CodegenPrompt {
  system: string;
  user: string;
}

export function buildPerNodePrompt(
  _node: PrismNode,
  _neighbors: CodegenNeighbors,
  _atlas: CodegenAtlasRegion,
): string {
  throw new Error('T04 stub - buildPerNodePrompt not implemented');
}

export function buildRenderModeSubPrompt(_mode: RenderMode): string {
  throw new Error('T04 stub - buildRenderModeSubPrompt not implemented');
}

export function buildCodegenPrompt(
  _node: PrismNode,
  _neighbors: CodegenNeighbors,
  _atlas: CodegenAtlasRegion,
): CodegenPrompt {
  throw new Error('T04 stub - buildCodegenPrompt not implemented');
}
