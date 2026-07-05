// PRISM SHELL — CAPABILITY AUTHORING (SHELL W5B / E17, 2026-07-05)
//
// When a user accepts a completeness card, the Conductor AUTHORS the missing
// capability's nodes into the graph through the SAME certified node path the
// build uses (W5B-D4): node-factory's `authorNode` mints schema-complete nodes,
// then a capability reference (integrationRefs — an allowlisted additive field,
// carrying a CAPABILITY REFERENCE only, never a secret — I5) is applied through
// the exact `sanitizeAdditive` + `applyPlanRendererDefaults` +
// `validatePlanRendererFields` discipline as a prompt-edit patch. No raw code,
// no bypass of the completeness/schema gate.

import type {
  GraphSource,
  PrismNode,
  IntegrationRef,
} from '../../lib/prism-graph/types';
import {
  applyPlanRendererDefaults,
  validatePlanRendererFields,
} from '../../lib/prism/codegen/plan-output-hook';
import type { CapabilityCategory } from '../../../packages/shared-interfaces/src/prism-conductor';
import type { BlueprintNode } from './blueprint';
import type { ResolvedDirection } from './directions';
import { authorNode, sanitizeAdditive } from './node-factory';
import { CAPABILITY_SUBTYPE_PREFIX, categorySpec } from './completeness-scan';

export interface AuthoredCapability {
  nodes: PrismNode[];
  nodeIds: string[];
  hubId: string;
}

/** A short CTA/label copy per capability. */
function copyFor(category: CapabilityCategory): { cta: string; label: string } {
  switch (category) {
    case 'auth': return { cta: 'Sign in', label: 'Accounts' };
    case 'db': return { cta: 'Your data', label: 'Database' };
    case 'storage': return { cta: 'Upload', label: 'Storage' };
    case 'payments': return { cta: 'Checkout', label: 'Payments' };
    case 'subscriptions': return { cta: 'Subscribe', label: 'Plans' };
    case 'email': return { cta: 'Notify me', label: 'Email' };
    case 'analytics': return { cta: 'Insights', label: 'Analytics' };
    default: return { cta: 'Open', label: 'Capability' };
  }
}

/** A capability REFERENCE (I5 — no secret). The vault resolves the live
 *  credential server-side from this reference at request time. */
function capabilityIntegrationRef(providerId: string, category: CapabilityCategory): IntegrationRef {
  return {
    id: `ig-cap-${category}`,
    order: 0,
    providerId: 'nango',
    platformId: providerId,
    platform: providerId.charAt(0).toUpperCase() + providerId.slice(1),
    authMethod: 'oauth2.1',
    capabilityRef: {
      refId: `nango:${providerId}:cap-${category}`,
      scope: `${providerId}:${category}`,
      label: `${providerId} (${category})`,
    },
    contentIcon: { brandKey: providerId },
  };
}

/** Author the nodes for one accepted capability into a target hub, through the
 *  certified node path. `ts` + `slotY` keep placement deterministic. */
export function authorCapabilityNodes(
  category: CapabilityCategory,
  direction: ResolvedDirection,
  hubId: string,
  index: number,
): AuthoredCapability {
  const spec = categorySpec(category);
  const providerId = spec?.providers[0] ?? 'stripe';
  const { cta, label } = copyFor(category);
  const subtype = `${CAPABILITY_SUBTYPE_PREFIX}${category}`;
  // Place capability CTAs along the bottom of the home hub, fanned by index.
  const x = -3 + (index % 4) * 2;

  const ctaBlueprint: BlueprintNode = {
    id: `cap-${category}-cta`,
    subtype,
    caption: `${label} capability`,
    scenePosition: { x, y: -3.4, z: 0.2 },
    envelope: { width: 1.8, height: 0.7 },
    render: { kind: 'mesh', primitive: 'plane', params: { width: 1.8, height: 0.62 }, colorRole: 'accent' },
    emits: [`${category}-open`],
  };
  const labelBlueprint: BlueprintNode = {
    id: `cap-${category}-label`,
    subtype: `${subtype}-label`,
    caption: `${label} label`,
    scenePosition: { x, y: -3.4, z: 0.26 },
    envelope: { width: 1.6, height: 0.4 },
    render: { kind: 'text', content: cta, fontSize: 0.26, fontWeight: 600, colorRole: 'secondary', align: 'center' },
  };

  const authoredCta = authorNode(ctaBlueprint, hubId, direction);
  const authoredLabel = authorNode(labelBlueprint, hubId, direction);

  // Apply the capability REFERENCE to the CTA node through the certified
  // additive path (integrationRefs is on APPLYABLE_NODE_FIELDS).
  const skipped: string[] = [];
  const capPatch = sanitizeAdditive(
    { integrationRefs: [capabilityIntegrationRef(providerId, category)] },
    skipped,
  );
  const ctaWithCap = applyPlanRendererDefaults({ ...authoredCta.node, ...capPatch }) as PrismNode;
  // Re-assert the schema-completeness gate on the patched node.
  const violations = validatePlanRendererFields(ctaWithCap).filter((v) => v.severity === 'error');
  const ctaNode = violations.length === 0 ? ctaWithCap : authoredCta.node;

  return {
    nodes: [ctaNode, authoredLabel.node],
    nodeIds: [ctaNode.nodeId, authoredLabel.node.nodeId],
    hubId,
  };
}

/** Merge authored capability nodes into a graph (home hub target). Returns the
 *  updated graph + the ids added. Idempotent per category (re-adding replaces
 *  the prior capability nodes for that category). */
export function addCapabilityToGraph(
  graph: GraphSource,
  category: CapabilityCategory,
  direction: ResolvedDirection,
): { graph: GraphSource; addedNodeIds: string[] } {
  const homeHub = graph.hubs.find((h) => h.hubId === 'hub-home') ?? graph.hubs[0];
  if (!homeHub) return { graph, addedNodeIds: [] };

  const subtype = `${CAPABILITY_SUBTYPE_PREFIX}${category}`;
  // Drop any prior nodes for this category (idempotent re-add).
  const kept = graph.nodes.filter((n) => n.subtype !== subtype && n.subtype !== `${subtype}-label`);
  const existingCaps = kept.filter((n) => n.subtype.startsWith(CAPABILITY_SUBTYPE_PREFIX) && !n.subtype.endsWith('-label')).length;

  const authored = authorCapabilityNodes(category, direction, homeHub.hubId, existingCaps);
  const nodes = [...kept, ...authored.nodes];

  return {
    graph: { ...graph, nodes },
    addedNodeIds: authored.nodeIds,
  };
}
