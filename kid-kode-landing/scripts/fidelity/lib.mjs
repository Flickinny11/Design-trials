// Shared helpers for the ORRERY fidelity pass. Canonical load/save + a text-node
// factory that clones the established schema shape so new nodes validate.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const GRAPH = resolve(__dirname, '../../public/prism-mock/home/live-graph.json');

export function load() {
  return JSON.parse(readFileSync(GRAPH, 'utf8'));
}
export function save(graph) {
  writeFileSync(GRAPH, JSON.stringify(graph, null, 2) + '\n');
}
export function byId(graph) {
  return new Map(graph.nodes.map((n) => [n.nodeId, n]));
}
export function upsert(graph, node) {
  const i = graph.nodes.findIndex((n) => n.nodeId === node.nodeId);
  if (i >= 0) graph.nodes[i] = node;
  else graph.nodes.push(node);
}

const emptyIntent = (caption) => ({
  caption,
  behaviorSpec: { interactions: [], apiCalls: [], dataBindings: [], emits: [], listens: [], triggersDownstream: [] },
  stateEffects: [],
  visualSpec: { textContent: [], layers: [] },
  contracts: { inputs: {}, outputs: {} },
});

/** A text node matching the live-graph schema. opts: {x,y,z,fontSize,color,weight,
 *  letterSpacing,align,subtype,serviceTag,extrude,glow,fill,caption,fontFamily,depthLayer} */
export function makeText(nodeId, hubId, content, opts = {}) {
  const x = opts.x ?? 0, y = opts.y ?? 0, z = opts.z ?? 0.3;
  const textSpec = {
    content,
    fontFamily: opts.fontFamily ?? 'Inter',
    fontWeight: opts.weight ?? 500,
    fontSize: opts.fontSize ?? 0.12,
    letterSpacing: opts.letterSpacing ?? 0,
    align: opts.align ?? 'center',
    fill: opts.fill ?? { kind: 'solid', color: opts.color ?? '#d8c9a8' },
  };
  if (opts.glow) textSpec.glow = opts.glow;
  if (opts.outline) textSpec.outline = opts.outline;
  if (opts.extrude) textSpec.extrude = opts.extrude;
  return {
    nodeId,
    subtype: opts.subtype ?? 'body-text',
    parentHubId: hubId,
    serviceTag: opts.serviceTag ?? 'ui-text',
    visual: { transform: { x, y, z, width: opts.width ?? 4, height: opts.height ?? 0.2 }, alpha: 1 },
    intent: emptyIntent(opts.caption ?? content.slice(0, 40)),
    codeRef: '',
    backendRef: null,
    renderMode: 'text',
    depthMapUrl: null,
    meshUrl: null,
    cinematicPrimitives: [],
    scenePosition: {
      x, y, z,
      rotationX: opts.rotationX ?? 0, rotationY: 0, rotationZ: 0,
      scaleX: 1, scaleY: 1, scaleZ: 1,
    },
    textSpec,
    animationBindings: opts.animationBindings ?? [],
    receivesLighting: opts.receivesLighting ?? false,
    depthLayer: opts.depthLayer ?? 'overlay',
  };
}

/** A brass-extrude block for dimensional (non-glass) hub headlines. */
export function brassExtrude(overrides = {}) {
  return {
    enabled: true,
    depth: 0.14,
    bevelEnabled: true,
    bevelThickness: 0.016,
    bevelSize: 0.014,
    bevelSegments: 3,
    curveSegments: 12,
    metalness: 0.85,
    roughness: 0.3,
    sideFill: { kind: 'solid', color: '#6b4f1d' },
    ...overrides,
  };
}
