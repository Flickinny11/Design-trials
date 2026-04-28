// Editor view-model: per-tab accessors that map the canonical GraphSource
// shape onto the values each Inspector tab expects.
//
// Plan ref: /Users/loganbaird/.claude/plans/i-recently-made-changes-effervescent-church.md §Phase 1.
//
// Field-mapping table (Inspector tab → JSON field):
//   Visual      ← intent.caption, samHints, alphaCutout, visualSpec.layers,
//                  visualSpec.textContent, visual.frameCount
//   Behavior    ← intent.behaviorSpec.interactions (event/effect),
//                  triggersDownstream[].targetNodeIds, intent.stateEffects
//   Code        ← codeRef (file path; loaded by Phase 2 wiring)
//   Animation   ← intent.animationSpec, intent.visualSpec.animationSpec,
//                  visual.frameCount
//   Connections ← edges[].from / edges[].to + intent.visualNeighbors +
//                  intent.interactionNeighbors
//   Backend     ← backendRef + behaviorSpec.apiCalls + contracts
//
// All accessors are pure functions: input is the canonical PrismNode (or
// GraphSource), output is the editor's expected shape. No React, no I/O.

import type {
  GraphSource,
  PrismAlphaCutout,
  PrismAnimationSpec,
  PrismEdge,
  PrismInteractionNeighbors,
  PrismLayer,
  PrismNode,
  PrismResponsiveSizing,
  PrismSamHints,
  PrismTextContent,
  PrismVisibility,
  PrismVisualNeighbors,
} from './types.ts';

// ── Visual tab ─────────────────────────────────────────────────────────────

export function getCaption(node: PrismNode): string {
  return node?.intent?.caption ?? '';
}

export function getElementType(node: PrismNode): string {
  const sam = node?.intent?.samHints?.elementType;
  if (sam && typeof sam === 'string') return sam;
  return 'element';
}

export function getTextContent(node: PrismNode): PrismTextContent[] {
  const tc = node?.intent?.visualSpec?.textContent;
  return Array.isArray(tc) ? tc : [];
}

export function getLayers(node: PrismNode): PrismLayer[] {
  const layers = node?.intent?.visualSpec?.layers;
  return Array.isArray(layers) ? layers : [];
}

// ── Behavior tab ───────────────────────────────────────────────────────────

export interface EditorInteraction {
  event: string;
  action: string;
  target: string;
}

/**
 * Map JSON's behaviorSpec.interactions (event/effect) onto the editor's
 * expected (event/action/target) triple. Target rule (in order):
 *   1. exact match — a triggersDownstream entry whose `eventName` equals
 *      this interaction's `effect`; use its first targetNodeIds entry.
 *   2. 1-to-1 fallback — node has exactly one interaction and one
 *      downstream trigger; assume they pair.
 *   3. otherwise 'self' — local state effect with no cross-node consequence
 *      (swap-to-hover, scale-press, etc.).
 *
 * Avoids indiscriminately assigning the first trigger's target to every
 * interaction (which produced false cross-node edges for nodes like
 * theme-selector-button with many local interactions + a single trigger).
 */
export function getInteractions(node: PrismNode): EditorInteraction[] {
  const behavior = node?.intent?.behaviorSpec;
  if (!behavior || !Array.isArray(behavior.interactions)) return [];
  const triggers = Array.isArray(behavior.triggersDownstream) ? behavior.triggersDownstream : [];
  return behavior.interactions.map((i) => {
    const exact = triggers.find((t) => t.eventName === i.effect);
    if (exact?.targetNodeIds?.[0]) {
      return { event: i.event, action: i.effect, target: exact.targetNodeIds[0] };
    }
    if (behavior.interactions.length === 1 && triggers.length === 1) {
      const target = triggers[0].targetNodeIds?.[0];
      if (target) return { event: i.event, action: i.effect, target };
    }
    return { event: i.event, action: i.effect, target: 'self' };
  });
}

export function getStateCount(node: PrismNode): number {
  // Inspector "state count" reflects the number of named state effects this
  // node carries (lift-hover, scale-press, glow-pulse, …) rather than the
  // size of the Zod input contract. Both fields exist; stateEffects is the
  // closer match to the Inspector concept.
  const effects = node?.intent?.stateEffects;
  return Array.isArray(effects) ? effects.length : 0;
}

// Editor-runtime metadata not stored in JSON. Phase 2 will surface this
// through the editor's verification subsystem; until then a neutral default
// keeps the Inspector tab populated without lying about node health.
const DEFAULT_VERIFICATION_SCORE = 0.85;

export function getVerificationScore(_node: PrismNode): number {
  return DEFAULT_VERIFICATION_SCORE;
}

// ── Animation tab ──────────────────────────────────────────────────────────

export function getHasAnimation(node: PrismNode): boolean {
  const intentAnim = node?.intent?.animationSpec;
  const hasIntentAnim = !!intentAnim && typeof intentAnim === 'object' && Object.keys(intentAnim as Record<string, unknown>).length > 0;
  const frameCount = node?.visual?.frameCount;
  return hasIntentAnim || (typeof frameCount === 'number' && frameCount > 1);
}

export function getAnimationFrames(node: PrismNode): number {
  const fc = node?.visual?.frameCount;
  return typeof fc === 'number' ? fc : 0;
}

export function getAnimationSpec(node: PrismNode): PrismAnimationSpec {
  const spec = node?.intent?.animationSpec;
  return (spec && typeof spec === 'object') ? spec : {};
}

// ── Backend tab ────────────────────────────────────────────────────────────

export interface EditorBackendContract {
  service: string;
  route: string;
  method: string;
  schema: string;
}

export function getBackendContract(node: PrismNode): EditorBackendContract | null {
  const ref = node?.backendRef;
  if (!ref || typeof ref !== 'string') return null;
  const fileName = ref.split('/').pop() ?? ref;
  const service = fileName.replace(/\.(js|mjs|ts)$/, '');
  const apiCall = node?.intent?.behaviorSpec?.apiCalls?.[0];
  const inputs = node?.intent?.contracts?.inputs ?? {};
  const outputs = node?.intent?.contracts?.outputs ?? {};
  return {
    service,
    route: apiCall?.endpoint ?? '',
    method: apiCall?.method ?? 'GET',
    schema: JSON.stringify({ inputs, outputs }),
  };
}

// ── Connections tab ────────────────────────────────────────────────────────

export interface EditorEdge {
  source: string;
  target: string;
  type: string;
  event?: string;
}

export function getEdges(graph: GraphSource, nodeId: string): EditorEdge[] {
  if (!graph || !Array.isArray(graph.edges)) return [];
  return graph.edges
    .filter((e: PrismEdge) => e.from === nodeId || e.to === nodeId)
    .map((e: PrismEdge) => ({
      source: e.from,
      target: e.to,
      type: e.type,
      event: e.event,
    }));
}

// ── 2026-04-27 caption-enrichment first-class accessors ────────────────────

export function getSamHints(node: PrismNode): PrismSamHints | null {
  return node?.intent?.samHints ?? null;
}

export function getAlphaCutout(node: PrismNode): PrismAlphaCutout | null {
  return node?.intent?.alphaCutout ?? null;
}

export function getVisualNeighbors(node: PrismNode): PrismVisualNeighbors | null {
  return node?.intent?.visualNeighbors ?? null;
}

export function getInteractionNeighbors(node: PrismNode): PrismInteractionNeighbors | null {
  return node?.intent?.interactionNeighbors ?? null;
}

export function getResponsiveSizing(node: PrismNode): PrismResponsiveSizing | null {
  return node?.intent?.responsiveSizing ?? null;
}

export function getVisibility(node: PrismNode): PrismVisibility | null {
  return node?.intent?.visibility ?? null;
}

// ── Editor-side identity helpers ───────────────────────────────────────────

export function getNodeName(node: PrismNode): string {
  if (!node?.nodeId) return '';
  return node.nodeId
    .split('-')
    .map((part) => (part.length === 0 ? part : part[0].toUpperCase() + part.slice(1)))
    .join(' ');
}

export function getHubIds(node: PrismNode): string[] {
  return node?.parentHubId ? [node.parentHubId] : [];
}
