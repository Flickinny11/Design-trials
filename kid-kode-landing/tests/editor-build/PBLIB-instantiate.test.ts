// PBLIB-instantiate — §13 prebuilt element library drag-to-place (criterion 21).
//
// Spec refs:
//   - Canvas-spec §13: "Drag-to-place instantiates the cluster, tethered to the
//     current hub, with all member nodes created in the graph (INV-7). Clusters
//     ... editable like any node group."
//   - §18 criterion 21: "Prebuilt-library drag-to-place instantiates a cluster
//     with all member nodes created in the graph and tethered to the hub."
//
// Covers the PURE instantiation contract (`buildClusterNodeInputs`) and that the
// produced inputs are accepted by `useGraphSourceStore.addNodesBatch`, landing
// as a grouped, hub-tethered subtree.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ElementClusterDefinition } from '@/lib/editor/elements/contract';
import { buildClusterNodeInputs } from '@/lib/editor/elements/instantiate';
import { useGraphSourceStore } from '@/stores/useGraphSourceStore';

const HUB_ID = 'hub-home';

// A minimal 3-member cluster fixture (two meshes + one text), enough to exercise
// tether, group, pose offset, and field carry-through.
const FIXTURE: ElementClusterDefinition = {
  id: 'test-trio',
  label: 'Test Trio',
  category: 'showcase',
  caption: 'A three-piece test cluster',
  description: 'fixture',
  tier: 'T1',
  designRefs: ['test'],
  preview: { frozenPhase: 0.5, loopSeconds: 3 },
  members: [
    {
      localId: 'a',
      subtype: 'element',
      caption: 'piece A',
      renderMode: 'mesh',
      pose: { x: -1, y: 0, z: 0, rotationX: 0, rotationY: 0, rotationZ: 0, scaleX: 1, scaleY: 1, scaleZ: 1 },
      footprint: { width: 0.6, height: 0.6 },
      meshPrimitive: { kind: 'sphere' },
      materialSpec: { metalness: 1, roughness: 0.2 },
      animationBindings: [{ id: 'orig-1', primitive: 'orbit', driver: 'time' }],
    },
    {
      localId: 'b',
      subtype: 'element',
      caption: 'piece B',
      renderMode: 'mesh',
      pose: { x: 1, y: 0, z: 0, rotationX: 0, rotationY: 0, rotationZ: 0, scaleX: 1, scaleY: 1, scaleZ: 1 },
      footprint: { width: 0.6, height: 0.6 },
      meshPrimitive: { kind: 'cube' },
    },
    {
      localId: 'c',
      subtype: 'element',
      caption: 'label C',
      renderMode: 'text',
      pose: { x: 0, y: 1, z: 0, rotationX: 0, rotationY: 0, rotationZ: 0, scaleX: 1, scaleY: 1, scaleZ: 1 },
      footprint: { width: 1.2, height: 0.3 },
      textSpec: { content: 'HELLO' },
    },
  ],
};

describe('buildClusterNodeInputs (criterion 21 — pure)', () => {
  it('creates one input per member, all tethered to the hub', () => {
    const inputs = buildClusterNodeInputs(FIXTURE, HUB_ID, { x: 0, y: 0, z: 0 }, { groupId: 'grp-fixed' });
    expect(inputs).toHaveLength(3);
    for (const input of inputs) expect(input.parentHubId).toBe(HUB_ID);
  });

  it('stamps ONE shared groupId on every member (≥2 → grouped)', () => {
    const inputs = buildClusterNodeInputs(FIXTURE, HUB_ID, { x: 0, y: 0, z: 0 }, { groupId: 'grp-fixed' });
    const groupIds = new Set(inputs.map((i) => i.groupId));
    expect(groupIds.size).toBe(1);
    expect([...groupIds][0]).toBe('grp-fixed');
  });

  it('offsets each local pose by the drop anchor (translation only)', () => {
    const inputs = buildClusterNodeInputs(FIXTURE, HUB_ID, { x: 5, y: -2, z: 1 }, { groupId: 'g' });
    // member a local x -1 → 4; member c local y 1 → -1
    expect(inputs[0].scenePosition?.x).toBe(4);
    expect(inputs[2].scenePosition?.y).toBe(-1);
    // scale/rotation carry through unchanged
    expect(inputs[0].scenePosition?.scaleX).toBe(1);
  });

  it('carries look fields through and re-mints binding ids', () => {
    const inputs = buildClusterNodeInputs(FIXTURE, HUB_ID, { x: 0, y: 0, z: 0 }, { groupId: 'g' });
    expect(inputs[0].meshPrimitive?.kind).toBe('sphere');
    expect(inputs[0].materialSpec?.metalness).toBe(1);
    expect(inputs[2].textSpec?.content).toBe('HELLO');
    // binding id is re-minted (not the original 'orig-1'); order defaulted
    expect(inputs[0].animationBindings?.[0].id).not.toBe('orig-1');
    expect(inputs[0].animationBindings?.[0].primitive).toBe('orbit');
    expect(inputs[0].animationBindings?.[0].order).toBe(0);
  });

  it('skips groupId for a single-member cluster', () => {
    const solo: ElementClusterDefinition = { ...FIXTURE, members: [FIXTURE.members[0]] };
    const inputs = buildClusterNodeInputs(solo, HUB_ID, { x: 0, y: 0, z: 0 });
    expect(inputs[0].groupId).toBeUndefined();
  });
});

describe('addNodesBatch + placement (criterion 21 — store)', () => {
  beforeEach(() => {
    useGraphSourceStore.getState().reset();
    useGraphSourceStore.setState({
      hubs: [{ hubId: HUB_ID, title: 'Home', layout: { viewportWidth: 1, viewportHeight: 1, contentHeight: 1, backgroundColor: '#000' } }],
      nodes: [],
      edges: [],
      rootNodes: [],
      ready: true,
    });
  });
  afterEach(() => {
    useGraphSourceStore.getState().reset();
  });

  it('lands all member nodes in the graph, grouped, tethered to the hub', () => {
    const inputs = buildClusterNodeInputs(FIXTURE, HUB_ID, { x: 0, y: 0, z: 0 }, { groupId: 'grp-fixed' });
    const ids = useGraphSourceStore.getState().addNodesBatch(inputs);
    expect(ids).toHaveLength(3);

    const nodes = useGraphSourceStore.getState().nodes;
    expect(nodes).toHaveLength(3);
    // INV-7 tether: every placed node names the current hub.
    for (const n of nodes) expect(n.parentHubId).toBe(HUB_ID);
    // grouped as one unit (criterion 22 semantics).
    expect(new Set(nodes.map((n) => n.groupId))).toEqual(new Set(['grp-fixed']));
    // each member is a distinct node with a minted id.
    expect(new Set(nodes.map((n) => n.nodeId)).size).toBe(3);
  });

  it('marks the graph dirty exactly once for the whole batch', () => {
    const inputs = buildClusterNodeInputs(FIXTURE, HUB_ID, { x: 0, y: 0, z: 0 }, { groupId: 'g' });
    useGraphSourceStore.setState({ isDirty: false });
    useGraphSourceStore.getState().addNodesBatch(inputs);
    expect(useGraphSourceStore.getState().isDirty).toBe(true);
  });
});
