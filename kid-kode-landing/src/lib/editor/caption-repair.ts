'use client';

/**
 * STEP5 edit-path — caption-driven cold-context repair (anchor §8, node-editor
 * §9.2, NE-SC-13).
 *
 * "On any build/verify failure, dispatch a small internal model to that node.
 *  With NO prior context, it reads the node + hub captions and the node's
 *  contents, understands what the node/hub should do/look like/function as,
 *  fixes the node, and re-verifies."
 *
 * SCOPE BOUNDARY (STEP5): the *small internal AI model* itself is future-source
 * (anchor §0/§9: the AI app-builder pipeline + codegen routing are out of scope
 * for this slice). What STEP5 builds is the REPAIR LOOP and its cold-context
 * input contract — detect → read captions + contents → produce a repaired node
 * → re-verify — with a deterministic caption-reading repair *strategy* standing
 * in for the model call. The strategy reads ONLY the node caption, the hub
 * caption, and the node's own stored contents (the cold-context inputs the real
 * model will get); it has no access to the editor session, the user's edit
 * history, or sibling nodes. Swapping the deterministic body for a model call is
 * a localized change behind this same signature.
 *
 * The strategy's job: turn a node that failed to build into a node that DOES
 * build and renders something faithful to its caption — never show the broken
 * or previous state (anchor §8, F4). It is contamination-aware (node-editor
 * §9.2 / canvas INV-10): it regenerates a renderable form from the caption +
 * contents; it does not re-run the broken artifact source.
 */

import type { PrismHub, PrismNode, PrismTextContent } from '@/lib/prism-graph/types';

export interface RepairInputs {
  nodeCaption: string;
  hubCaption: string;
  hubTitle: string;
}

export interface RepairResult {
  /** The repaired node config (a fresh object; the source node is not mutated). */
  node: PrismNode;
  /** Human-readable repair strategy taken (for the report + telemetry). */
  strategy: string;
  /** The cold-context inputs the repair actually read (evidence it used captions). */
  inputs: RepairInputs;
}

/** Derive a short artifact name from a caption: the lead phrase before the
 *  first em-dash / en-dash / hyphen-with-spaces / period. Mirrors how the
 *  galaxy exterior label = "the built artifact's name" (node-editor §3.3). */
function artifactNameFromCaption(caption: string): string {
  const trimmed = (caption ?? '').trim();
  if (!trimmed) return 'element';
  const cut = trimmed.split(/\s+[—–-]\s+|[.:]/)[0];
  return (cut || trimmed).trim().slice(0, 64);
}

function sanePlaneSize(node: PrismNode): { width: number; height: number } {
  const w = node.visual?.transform?.width;
  const h = node.visual?.transform?.height;
  return {
    width: typeof w === 'number' && Number.isFinite(w) && w > 0 ? w : 1.6,
    height: typeof h === 'number' && Number.isFinite(h) && h > 0 ? h : 0.9,
  };
}

/**
 * Produce a repaired node from a node that failed to build, reading only the
 * cold-context inputs (node caption, hub caption, node contents).
 */
export function repairNode(node: PrismNode, hub: PrismHub | null | undefined): RepairResult {
  const nodeCaption = node.intent?.caption ?? '';
  const hubCaption = hub?.caption ?? '';
  const hubTitle = hub?.title ?? '';
  const inputs: RepairInputs = { nodeCaption, hubCaption, hubTitle };

  const { width, height } = sanePlaneSize(node);
  const hasAsset = !!node.visual?.sourceAsset;
  const hasMesh = !!node.meshUrl;

  // Base: a fresh node clone with a guaranteed-sane visual transform. We never
  // mutate the passed node (the source store record stays as the user left it).
  const repaired: PrismNode = {
    ...node,
    visual: {
      ...node.visual,
      transform: { ...node.visual?.transform, width, height } as PrismNode['visual']['transform'],
    },
  };

  // The failure is almost always a broken codeRef module (load rejected → the
  // coderef factory's placeholder group stays empty) or a renderMode that has
  // no renderable source. Cold-context decision, driven by the contents the
  // caption implies the node should hold:

  if (node.codeRef) {
    // A code-based artifact failed to load. Strip the broken codeRef and fall
    // back to the best renderable form the node's *other* contents support.
    repaired.codeRef = '';
    if (hasAsset) {
      repaired.renderMode = 'plane';
      return {
        node: repaired,
        strategy:
          'broken codeRef dropped; fell back to a plane built from the node\'s existing image asset (caption-confirmed visual element)',
        inputs,
      };
    }
    if (hasMesh) {
      repaired.renderMode = 'mesh';
      return {
        node: repaired,
        strategy: 'broken codeRef dropped; fell back to the node\'s GLB mesh artifact',
        inputs,
      };
    }
    // No asset, no mesh — synthesize an MSDF text artifact from the caption so
    // the node renders a faithful stand-in of its named intent.
    repaired.renderMode = 'plane';
    repaired.intent = seedTextFromCaption(node, artifactNameFromCaption(nodeCaption));
    return {
      node: repaired,
      strategy: `broken codeRef dropped; synthesized an MSDF text artifact ("${artifactNameFromCaption(
        nodeCaption,
      )}") from the node caption because the node holds no image or mesh`,
      inputs,
    };
  }

  // Non-codeRef empty build. If there is an asset, force a plane; else seed text.
  if (hasAsset) {
    repaired.renderMode = 'plane';
    return {
      node: repaired,
      strategy: 'empty build repaired to a plane bound to the node\'s image asset',
      inputs,
    };
  }
  repaired.renderMode = 'plane';
  repaired.intent = seedTextFromCaption(node, artifactNameFromCaption(nodeCaption));
  return {
    node: repaired,
    strategy: `empty build repaired by synthesizing an MSDF text artifact ("${artifactNameFromCaption(
      nodeCaption,
    )}") from the node caption`,
    inputs,
  };
}

/** Seed `intent.visualSpec.textContent` with a single MSDF run derived from the
 *  caption's artifact name, preserving the rest of the node's intent. */
function seedTextFromCaption(node: PrismNode, name: string): PrismNode['intent'] {
  const run: PrismTextContent = {
    text: name,
    typography: { fontSize: 0.18, color: '#e8ecff' },
  } as PrismTextContent;
  const prevVisualSpec = node.intent?.visualSpec ?? ({} as PrismNode['intent']['visualSpec']);
  return {
    ...node.intent,
    visualSpec: { ...prevVisualSpec, textContent: [run] },
  } as PrismNode['intent'];
}
