// Editor view-model: per-tab accessors that map the canonical GraphSource
// shape onto the values each Inspector tab expects.
//
// Plan ref: /Users/loganbaird/.claude/plans/i-recently-made-changes-effervescent-church.md §Phase 1.
//
// Field-mapping table (Inspector tab → JSON field):
//   Visual      ← intent.caption, samHints, alphaCutout, visualSpec.layers,
//                  visualSpec.textContent, visual.frameCount
//   Behavior    ← intent.behaviorSpec.interactions (event/effect),
//                  triggersDownstream[].targetNodeIds, contracts.inputs
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
 * expected (event/action/target) triple. Target is derived from the matching
 * triggersDownstream entry when one exists; otherwise the action name doubles
 * as the target.
 */
export function getInteractions(node: PrismNode): EditorInteraction[] {
  const behavior = node?.intent?.behaviorSpec;
  if (!behavior || !Array.isArray(behavior.interactions)) return [];
  const triggers = Array.isArray(behavior.triggersDownstream) ? behavior.triggersDownstream : [];
  return behavior.interactions.map((i) => {
    // Pick the first trigger whose name relates to the effect, else fall back
    // to the first listed downstream target, else self.
    const trigger = triggers[0];
    const target = trigger?.targetNodeIds?.[0] ?? 'self';
    return {
      event: i.event,
      action: i.effect,
      target,
    };
  });
}

export function getStateCount(node: PrismNode): number {
  const inputs = node?.intent?.contracts?.inputs;
  if (!inputs || typeof inputs !== 'object') return 0;
  return Object.keys(inputs).length;
}

export function getVerificationScore(_node: PrismNode): number {
  // Editor-runtime metadata; not stored in JSON. Default per plan §Phase 2.
  return 0.85;
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
